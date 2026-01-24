/**
 * Unit tests for rubros handler canonicalization
 * 
 * Tests that listProjectRubros and attachRubros produce canonical rubro_id values.
 */

import { jest } from "@jest/globals";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

// Mock dependencies before importing handler
jest.mock("../../src/lib/baseline-sdmt", () => ({
  queryProjectRubros: jest.fn(),
}));

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn().mockResolvedValue(undefined),
  ensureCanWrite: jest.fn().mockResolvedValue(undefined),
  getUserEmail: jest.fn().mockResolvedValue("test@example.com"),
}));

jest.mock("../../src/lib/canonical-taxonomy", () => ({
  getCanonicalRubroId: jest.fn((id: string) => {
    const map: Record<string, string> = {
      "mod-lead-ingeniero-delivery": "MOD-LEAD",
      "mod-sdm-service-delivery-manager": "MOD-SDM",
      "mod-pm": "MOD-LEAD",
      "MOD-PM": "MOD-LEAD",
    };
    return map[id] || (id.startsWith("MOD-") ? id : null);
  }),
  normalizeRubroId: jest.fn((s: string) => ({
    canonicalId: s,
    isLegacy: false,
    isValid: true,
    warning: undefined,
  })),
  getAllCanonicalIds: jest.fn(() => ["MOD-LEAD", "MOD-SDM", "MOD-ING"]),
}));

// Mock DynamoDB
const mockSend = jest.fn();
jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: mockSend },
  tableName: (k: string) => `mock_${k}`,
  PutCommand: class PutCommand { constructor(public input: any) {} },
  QueryCommand: class QueryCommand { constructor(public input: any) {} },
  DeleteCommand: class DeleteCommand { constructor(public input: any) {} },
  GetCommand: class GetCommand { constructor(public input: any) {} },
  BatchGetCommand: class BatchGetCommand { constructor(public input: any) {} },
  ScanCommand: class ScanCommand { constructor(public input: any) {} },
}));

// Now import the handler after mocks are set up
import { handler } from "../../src/handlers/rubros";
import { queryProjectRubros } from "../../src/lib/baseline-sdmt";

const mockQueryProjectRubros = queryProjectRubros as unknown as jest.Mock;

describe("Rubros handler canonicalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  describe("listProjectRubros", () => {
    it("returns canonical rubro_id for legacy tokens", async () => {
      // Setup mock data with legacy token
      mockQueryProjectRubros.mockResolvedValue([
        {
          rubroId: "mod-lead-ingeniero-delivery",
          metadata: {},
          qty: 1,
          unit_cost: 100,
          descripcion: "Lead Engineer",
          category: "Labor",
        },
      ]);

      const event = {
        pathParameters: { projectId: "P-1" },
        requestContext: {
          http: {
            method: "GET",
            sourceIp: "127.0.0.1",
            userAgent: "test",
          },
        },
      } as unknown as APIGatewayProxyEventV2;

      const res = await handler(event);
      const body = JSON.parse(res.body || "{}");
      
      expect(res.statusCode).toBe(200);
      expect(body.data).toBeDefined();
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].rubro_id).toBe("MOD-LEAD");
      expect(body.data[0].id).toBe("MOD-LEAD");
    });
  });

  describe("attachRubros", () => {
    it("normalizes input before write", async () => {
      const event = {
        pathParameters: { projectId: "P-1" },
        body: JSON.stringify({
          rubroIds: [
            {
              rubroId: "mod-sdm-service-delivery-manager",
              qty: 1,
              unitCost: 100,
              type: "recurring",
              duration: 12,
            },
          ],
        }),
        requestContext: {
          http: {
            method: "POST",
            sourceIp: "127.0.0.1",
            userAgent: "test",
          },
        },
      } as unknown as APIGatewayProxyEventV2;

      mockSend.mockResolvedValue({});

      const res = await handler(event);
      
      expect(res.statusCode).toBe(200);
      
      // Verify ddb.send was called with canonical rubro_id
      const calls = mockSend.mock.calls;
      const putCalls = calls.filter(c => c[0]?.constructor?.name === "PutCommand");
      
      // Should have at least one PutCommand with canonical rubro_id
      const foundCanonical = putCalls.some(call => {
        const item = call[0]?.input?.Item;
        return item && (
          item.rubro_id === "MOD-SDM" || 
          item.rubroId === "MOD-SDM" ||
          (item.sk && item.sk.includes("MOD-SDM"))
        );
      });
      
      expect(foundCanonical).toBe(true);
    });

    it("canonicalizes MOD-PM to MOD-LEAD", async () => {
      const event = {
        pathParameters: { projectId: "P-1" },
        body: JSON.stringify({
          rubroIds: [
            {
              rubroId: "MOD-PM",
              qty: 1,
              unitCost: 150,
              type: "recurring",
              duration: 12,
            },
          ],
        }),
        requestContext: {
          http: {
            method: "POST",
            sourceIp: "127.0.0.1",
            userAgent: "test",
          },
        },
      } as unknown as APIGatewayProxyEventV2;

      mockSend.mockResolvedValue({});

      const res = await handler(event);
      
      expect(res.statusCode).toBe(200);
      
      // Verify MOD-PM was canonicalized to MOD-LEAD
      const calls = mockSend.mock.calls;
      const putCalls = calls.filter(c => c[0]?.constructor?.name === "PutCommand");
      
      const foundCanonical = putCalls.some(call => {
        const item = call[0]?.input?.Item;
        return item && (
          item.rubro_id === "MOD-LEAD" || 
          item.rubroId === "MOD-LEAD" ||
          (item.sk && item.sk.includes("MOD-LEAD"))
        );
      });
      
      expect(foundCanonical).toBe(true);
    });
  });
});
