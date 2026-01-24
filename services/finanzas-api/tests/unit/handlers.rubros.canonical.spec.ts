/**
 * Unit tests for rubros handler canonical ID enforcement
 * 
 * Validates that:
 * - listProjectRubros returns canonical rubro_id values
 * - attachRubros writes canonical rubro_id to DB
 * - Legacy IDs like "mod-lead-ingeniero-delivery" are mapped to canonical "MOD-LEAD"
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "../../src/handlers/rubros";
import * as auth from "../../src/lib/auth";
import * as dynamo from "../../src/lib/dynamo";
import * as baselineSdmt from "../../src/lib/baseline-sdmt";
import * as canonicalTaxonomy from "../../src/lib/canonical-taxonomy";

// Mock dependencies
jest.mock("../../src/lib/auth");
jest.mock("../../src/lib/dynamo");
jest.mock("../../src/lib/baseline-sdmt");
jest.mock("../../src/lib/canonical-taxonomy", () => ({
  ...jest.requireActual("../../src/lib/canonical-taxonomy"),
  ensureTaxonomyLoaded: jest.fn().mockResolvedValue(undefined),
}));

const mockEnsureCanRead = auth.ensureCanRead as jest.MockedFunction<typeof auth.ensureCanRead>;
const mockEnsureCanWrite = auth.ensureCanWrite as jest.MockedFunction<typeof auth.ensureCanWrite>;
const mockGetUserEmail = auth.getUserEmail as jest.MockedFunction<typeof auth.getUserEmail>;
const mockQueryProjectRubros = baselineSdmt.queryProjectRubros as jest.MockedFunction<typeof baselineSdmt.queryProjectRubros>;
const mockDdbSend = dynamo.ddb.send as jest.MockedFunction<typeof dynamo.ddb.send>;

describe("rubros handler - canonical ID enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureCanRead.mockResolvedValue(undefined);
    mockEnsureCanWrite.mockResolvedValue(undefined);
    mockGetUserEmail.mockResolvedValue("test@example.com");
  });

  describe("listProjectRubros - GET", () => {
    it("returns canonical rubro_id for legacy tokens", async () => {
      const projectId = "P-test-123";
      
      // Mock queryProjectRubros to return items with legacy IDs
      mockQueryProjectRubros.mockResolvedValue([
        {
          rubroId: "mod-lead-ingeniero-delivery", // Legacy token
          category: "Engineering",
          linea_codigo: undefined,
        },
        {
          rubroId: "mod-sdm-service-delivery-manager", // Legacy token
          category: "Delivery",
          linea_codigo: undefined,
        },
        {
          rubroId: "MOD-LEAD", // Already canonical
          category: "Leadership",
          linea_codigo: "MOD-LEAD",
        },
      ] as any);

      // Mock BatchGetCommand to return empty definitions (handler will use taxonomy fallback)
      mockDdbSend.mockResolvedValue({
        Responses: {
          "test-rubros": [],
        },
      } as any);

      const event: APIGatewayProxyEventV2 = {
        pathParameters: { projectId },
        requestContext: {} as any,
      } as any;

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Verify canonical IDs are returned (legacy tokens mapped to canonical)
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rubro_id: "MOD-LEAD", // mod-lead-ingeniero-delivery → MOD-LEAD
          }),
          expect.objectContaining({
            rubro_id: "MOD-SDM", // mod-sdm-service-delivery-manager → MOD-SDM
          }),
          expect.objectContaining({
            rubro_id: "MOD-LEAD", // Already canonical, stays MOD-LEAD
          }),
        ])
      );

      // Ensure no legacy tokens in response
      body.data.forEach((item: any) => {
        expect(item.rubro_id).not.toMatch(/^mod-[a-z-]+$/); // No lowercase legacy format
        expect(item.rubro_id).not.toContain("ingeniero");
        expect(item.rubro_id).not.toContain("delivery-manager");
      });
    });

    it("handles mixed canonical and legacy IDs correctly", async () => {
      const projectId = "P-test-456";
      
      mockQueryProjectRubros.mockResolvedValue([
        {
          rubroId: "MOD-ING", // Canonical
          linea_codigo: "MOD-ING",
        },
        {
          rubroId: "mod-pm", // Legacy - should map to MOD-LEAD
          linea_codigo: undefined,
        },
      ] as any);

      mockDdbSend.mockResolvedValue({
        Responses: { "test-rubros": [] },
      } as any);

      const event: APIGatewayProxyEventV2 = {
        pathParameters: { projectId },
        requestContext: {} as any,
      } as any;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(body.data).toHaveLength(2);
      expect(body.data[0].rubro_id).toBe("MOD-ING"); // Stays canonical
      expect(body.data[1].rubro_id).toBe("MOD-LEAD"); // mod-pm → MOD-LEAD
    });
  });

  describe("attachRubros - POST", () => {
    it("writes canonical rubro_id when legacy ID is provided", async () => {
      const projectId = "P-test-789";
      let capturedPutItems: any[] = [];

      // Capture DB writes
      mockDdbSend.mockImplementation((command: any) => {
        if (command.input?.RequestItems) {
          const items = Object.values(command.input.RequestItems)[0] as any[];
          items.forEach((req: any) => {
            if (req.PutRequest) {
              capturedPutItems.push(req.PutRequest.Item);
            }
          });
        }
        return Promise.resolve({ UnprocessedItems: {} } as any);
      });

      const event: APIGatewayProxyEventV2 = {
        pathParameters: { projectId },
        body: JSON.stringify({
          rubros: [
            {
              rubroId: "mod-lead-ingeniero-delivery", // Legacy token
              qty: 2,
              unitCost: 5000,
              recurring: true,
            },
            {
              rubroId: "MOD-ING", // Already canonical
              qty: 3,
              unitCost: 4500,
              recurring: true,
            },
          ],
        }),
        requestContext: {} as any,
      } as any;

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      // Verify canonical IDs were written to DB
      expect(capturedPutItems.length).toBeGreaterThan(0);
      
      const legacyItem = capturedPutItems.find((item) => 
        item.sk?.includes("MOD-LEAD") || item.rubroId === "MOD-LEAD"
      );
      const canonicalItem = capturedPutItems.find((item) => 
        item.sk?.includes("MOD-ING") || item.rubroId === "MOD-ING"
      );

      expect(legacyItem).toBeDefined();
      expect(canonicalItem).toBeDefined();

      // Ensure NO legacy tokens were written
      capturedPutItems.forEach((item) => {
        expect(item.rubroId || item.rubro_id).not.toContain("ingeniero");
        expect(item.rubroId || item.rubro_id).not.toMatch(/^mod-[a-z-]+$/);
        expect(item.sk).not.toContain("ingeniero");
      });
    });

    it("normalizes multiple legacy IDs in batch attach", async () => {
      const projectId = "P-test-batch";
      let capturedPutItems: any[] = [];

      mockDdbSend.mockImplementation((command: any) => {
        if (command.input?.RequestItems) {
          const items = Object.values(command.input.RequestItems)[0] as any[];
          items.forEach((req: any) => {
            if (req.PutRequest) {
              capturedPutItems.push(req.PutRequest.Item);
            }
          });
        }
        return Promise.resolve({ UnprocessedItems: {} } as any);
      });

      const event: APIGatewayProxyEventV2 = {
        pathParameters: { projectId },
        body: JSON.stringify({
          rubros: [
            { rubroId: "mod-pm", qty: 1 }, // → MOD-LEAD
            { rubroId: "mod-pmo", qty: 1 }, // → MOD-LEAD
            { rubroId: "mod-sdm-service-delivery-manager", qty: 1 }, // → MOD-SDM
          ],
        }),
        requestContext: {} as any,
      } as any;

      await handler(event);

      // All legacy IDs should be canonicalized
      const rubrosWritten = capturedPutItems.map((item) => item.rubroId || item.rubro_id);
      
      expect(rubrosWritten).toContain("MOD-LEAD");
      expect(rubrosWritten).toContain("MOD-SDM");
      expect(rubrosWritten).not.toContain("mod-pm");
      expect(rubrosWritten).not.toContain("mod-pmo");
      expect(rubrosWritten).not.toContain("mod-sdm-service-delivery-manager");
    });
  });

  describe("canonical mapping verification", () => {
    it("getCanonicalRubroId maps known legacy tokens", () => {
      // Test the actual canonicalization function
      expect(canonicalTaxonomy.getCanonicalRubroId("mod-lead-ingeniero-delivery")).toBe("MOD-LEAD");
      expect(canonicalTaxonomy.getCanonicalRubroId("mod-sdm-service-delivery-manager")).toBe("MOD-SDM");
      expect(canonicalTaxonomy.getCanonicalRubroId("mod-pm")).toBe("MOD-LEAD");
      expect(canonicalTaxonomy.getCanonicalRubroId("mod-pmo")).toBe("MOD-LEAD");
      expect(canonicalTaxonomy.getCanonicalRubroId("MOD-LEAD")).toBe("MOD-LEAD"); // Idempotent
    });
  });
});
