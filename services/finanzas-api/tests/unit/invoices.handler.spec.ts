import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { handler as invoicesHandler } from "../../src/handlers/invoices";
import * as dynamo from "../../src/lib/dynamo";

// Mock DynamoDB
jest.mock("../../src/lib/dynamo", () => ({
  ddb: {
    send: jest.fn(),
  },
  tableName: jest.fn((name: string) => `test_${name}`),
  QueryCommand: jest.fn(),
}));

// Mock auth
jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
}));

// Mock logging
jest.mock("../../src/utils/logging", () => ({
  logError: jest.fn(),
}));

const baseHeaders = { authorization: "Bearer test" };

describe("invoices handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles GET request and annotates invoices with canonical rubro", async () => {
    (dynamo.ddb.send as jest.Mock).mockResolvedValue({
      Items: [
        {
          pk: "PROJECT#P-123",
          sk: "INVOICE#INV-001",
          id: "INV-001",
          linea_codigo: "MOD-ING",
          amount: 50000,
          invoiceDate: "2026-01-15",
        },
        {
          pk: "PROJECT#P-123",
          sk: "INVOICE#INV-002",
          id: "INV-002",
          rubroId: "RB0001", // Legacy ID that maps to MOD-ING
          total: 30000,
          month: "2026-02",
        },
        {
          pk: "PROJECT#P-123",
          sk: "INVOICE#INV-003",
          id: "INV-003",
          description: "Consulting Services",
          amount: 25000,
        },
      ],
      Count: 3,
    });

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { project_id: "P-123" },
    };

    const response = await invoicesHandler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.data).toHaveLength(3);
    expect(payload.projectId).toBe("P-123");
    expect(payload.total).toBe(3);

    // Verify first invoice has canonical rubro from linea_codigo
    expect(payload.data[0].rubro_canonical).toBe("MOD-ING");
    expect(payload.data[0].month).toBe("2026-01");
    expect(payload.data[0].amount).toBe(50000);

    // Verify second invoice has canonical rubro mapped from legacy RB0001
    expect(payload.data[1].rubro_canonical).toBe("MOD-ING");
    expect(payload.data[1].month).toBe("2026-02");
    expect(payload.data[1].amount).toBe(30000);

    // Verify third invoice handles unknown rubros gracefully
    expect(payload.data[2].rubro_canonical).toBe("Consulting Services"); // Falls back to input
    expect(payload.data[2].amount).toBe(25000);
  });

  it("handles GET request with missing project_id", async () => {
    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: {},
    };

    const response = await invoicesHandler(event);

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("Missing required parameter: project_id");
  });

  it("handles GET request with no invoices found", async () => {
    (dynamo.ddb.send as jest.Mock).mockResolvedValue({
      Items: [],
      Count: 0,
    });

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { project_id: "P-999" },
    };

    const response = await invoicesHandler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.data).toHaveLength(0);
    expect(payload.total).toBe(0);
  });

  it("handles non-GET methods with 405", async () => {
    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "POST" } },
      queryStringParameters: { project_id: "P-123" },
    };

    const response = await invoicesHandler(event);

    expect(response.statusCode).toBe(405);
    expect(response.body).toContain("Method POST not allowed");
  });
});
