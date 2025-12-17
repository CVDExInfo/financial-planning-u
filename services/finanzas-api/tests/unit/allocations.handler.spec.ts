import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { handler as allocationsHandler } from "../../src/handlers/allocations";
import * as dynamo from "../../src/lib/dynamo";

// Mock DynamoDB
jest.mock("../../src/lib/dynamo", () => ({
  ddb: {
    send: jest.fn(),
  },
  tableName: jest.fn((name: string) => `test_${name}`),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
  GetCommand: jest.fn(),
  UpdateCommand: jest.fn(),
}));

// Mock auth
jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
  ensureSDT: jest.fn(),
  ensurePMO: jest.fn(),
  getUserContext: jest.fn().mockResolvedValue({
    email: "pmo@example.com",
    roles: ["PMO"],
  }),
}));

// Mock logging
jest.mock("../../src/utils/logging", () => ({
  logError: jest.fn(),
}));

// Mock validation
jest.mock("../../src/validation/allocations", () => ({
  parseForecastBulkUpdate: jest.fn((data) => data),
}));

const baseHeaders = { authorization: "Bearer test" };

describe("allocations handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles OPTIONS preflight request", async () => {
    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "OPTIONS" } },
    };

    const response = await allocationsHandler(event);

    expect(response.statusCode).toBe(204);
    expect(response.headers).toBeDefined();
    expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });

  it("returns empty array when no allocations exist", async () => {
    (dynamo.ddb.send as jest.Mock).mockResolvedValue({
      Items: [],
    });

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { projectId: "P-123" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBe(0);
  });

  it("returns array of allocations when they exist", async () => {
    const mockAllocations = [
      {
        pk: "PROJECT#P-123",
        sk: "ALLOCATION#base_001#2025-01#MOD-ING",
        projectId: "P-123",
        month: "2025-01",
        amount: 10000,
        rubroId: "MOD-ING",
      },
      {
        pk: "PROJECT#P-123",
        sk: "ALLOCATION#base_001#2025-02#MOD-ING",
        projectId: "P-123",
        month: "2025-02",
        amount: 10000,
        rubroId: "MOD-ING",
      },
    ];

    (dynamo.ddb.send as jest.Mock).mockResolvedValue({
      Items: mockAllocations,
    });

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { projectId: "P-123" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBe(2);
    expect(payload[0].projectId).toBe("P-123");
  });

  it("returns array instead of object wrapper", async () => {
    (dynamo.ddb.send as jest.Mock).mockResolvedValue({
      Items: [{ id: "test" }],
    });

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { projectId: "P-123" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    // Ensure response is a bare array, not {data: []}
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.data).toBeUndefined();
    expect(payload.total).toBeUndefined();
  });

  describe("bulk forecast update", () => {
    it("updates forecast values for existing allocations", async () => {
      // Mock GetCommand to return existing allocation
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: {
            pk: "PROJECT#P-123",
            sk: "MONTH#2025-01#RUBRO#MOD-ING",
            planned: 10000,
            forecast: 10000,
          },
        })
        .mockResolvedValueOnce({}); // UpdateCommand

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "2025-01",
              forecast: 12000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["PMO"], email: "pmo@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.updated).toBe(1);
      expect(payload.skipped).toBe(0);
    });

    it("skips forecast update for non-existent allocations", async () => {
      // Mock GetCommand to return no item
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Item: undefined,
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "2025-01",
              forecast: 12000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["PMO"], email: "pmo@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.updated).toBe(0);
      expect(payload.skipped).toBe(1);
    });

    it("returns 403 if user is not PMO", async () => {
      const auth = require("../../src/lib/auth");
      auth.ensurePMO.mockRejectedValueOnce({
        statusCode: 403,
        body: "forbidden: PMO required",
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "2025-01",
              forecast: 12000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "sdmt@example.com" },
      };

      const response = await allocationsHandler(event);

      expect(response.statusCode).toBe(403);
    });
  });
});
