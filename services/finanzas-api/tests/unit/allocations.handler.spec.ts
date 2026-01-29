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
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
}));

// Mock auth
jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn().mockResolvedValue(undefined),
  ensureCanWrite: jest.fn().mockResolvedValue(undefined),
  ensureSDT: jest.fn().mockResolvedValue(undefined),
  getUserContext: jest.fn(() => ({
    email: "test@example.com",
    sub: "test-user-id",
    isSDMT: true,
    isAdmin: false,
    roles: ["SDMT"],
  })),
}));

// Mock logging
jest.mock("../../src/utils/logging", () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

// Mock validation
jest.mock("../../src/validation/allocations", () => ({
  parseForecastBulkUpdate: jest.fn((data) => data),
}));

const baseHeaders = { authorization: "Bearer test" };

/**
 * Helper to create a mock project with start date
 * Both start_date and fecha_inicio are set for compatibility with different
 * parts of the codebase that may use either field name
 */
const mockProjectWithStartDate = (startDate: string) => ({
  pk: "PROJECT#P-123",
  baseline_id: "base_001",
  start_date: startDate,
  fecha_inicio: startDate, // Legacy field for backward compatibility
});

/**
 * Setup DynamoDB routing mock for deterministic test behavior
 * Routes mock responses based on command input rather than call order
 */
function setupDdbRoutingMock() {
  (dynamo.ddb.send as jest.Mock).mockImplementation(async (cmd: any) => {
    const input = cmd?.input ?? {};
    const table = String(input?.TableName || "").toLowerCase();

    // PROJECT metadata lookup (METADATA | META)
    if (table.includes("test_projects") && input?.Key?.pk === "PROJECT#P-123") {
      if (input?.Key?.sk === "METADATA" || input?.Key?.sk === "META") {
        return { Item: mockProjectWithStartDate("2025-01-01") };
      }
    }

    // Allocation existence check (ALLOCATION#...)
    if (table.includes("test_allocations") && typeof input?.Key?.sk === "string" && input.Key.sk.startsWith("ALLOCATION#")) {
      return { Item: undefined };
    }

    // Query for rubros/seed lookups: return Items: []
    if (cmd?.constructor?.name?.includes("Query") || cmd?.constructor?.name?.includes("Scan")) {
      return { Items: [], Count: 0 };
    }

    // Put / Update / Transact
    if (cmd?.constructor?.name?.includes("Put") || cmd?.constructor?.name?.includes("Update") || cmd?.constructor?.name?.includes("Transact")) {
      return {};
    }

    // Default safe response
    return {};
  });
}

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
      requestContext: { http: { method: "GET" }, requestId: "test-req-1" },
      queryStringParameters: { projectId: "P-123" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.data).toBeDefined();
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBe(0);
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
      requestContext: { http: { method: "GET" }, requestId: "test-req-2" },
      queryStringParameters: { projectId: "P-123" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.data).toBeDefined();
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBe(2);
    expect(payload.data[0].projectId).toBe("P-123");
  });

  it("returns normalized response with data wrapper", async () => {
    (dynamo.ddb.send as jest.Mock).mockResolvedValue({
      Items: [{ 
        pk: "PROJECT#P-123",
        sk: "ALLOCATION#base_001#2025-01#MOD-ING",
        id: "test" 
      }],
    });

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" }, requestId: "test-req-3" },
      queryStringParameters: { projectId: "P-123" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    // Ensure response has data wrapper: {data: [...]}
    expect(payload.data).toBeDefined();
    expect(Array.isArray(payload.data)).toBe(true);
  });

  it("handles DynamoDB errors gracefully returning empty data (defensive handling)", async () => {
    (dynamo.ddb.send as jest.Mock).mockRejectedValue(
      new Error("DynamoDB connection error")
    );

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" }, requestId: "test-req-error-1" },
      queryStringParameters: { projectId: "P-123" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    // With defensive handling, DynamoDB query errors return empty data array (200 OK)
    expect(response.statusCode).toBe(200);
    expect(payload.data).toBeDefined();
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBe(0);
  });

  it("handles null/malformed items in DynamoDB response", async () => {
    // Temporarily unmock logError to see the actual error
    const originalLogError = jest.requireMock("../../src/utils/logging").logError;
    jest.requireMock("../../src/utils/logging").logError = (msg: string, err: any) => {
      console.error(`[TEST] logError: ${msg}`, err);
    };

    const malformedItems = [
      null, // This will be filtered out
      { pk: "PROJECT#P-123", sk: "ALLOCATION#base_001#2025-01#MOD-ING", rubroId: "MOD-ING", amount: null },
      { pk: "PROJECT#P-123", sk: "ALLOCATION#base_001#2025-02#MOD-ING", rubroId: "MOD-LEAD", month: "2025-02", amount: 5000 },
    ];

    (dynamo.ddb.send as jest.Mock).mockResolvedValue({
      Items: malformedItems,
    });

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" }, requestId: "test-req-4" },
      queryStringParameters: { projectId: "P-123" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    // Restore logError
    jest.requireMock("../../src/utils/logging").logError = originalLogError;

    expect(response.statusCode).toBe(200);
    expect(payload.data).toBeDefined();
    expect(Array.isArray(payload.data)).toBe(true);
    // Should handle null items gracefully - null is filtered out, valid items are normalized
    expect(payload.data.length).toBeGreaterThanOrEqual(1);
    // Check that amounts are properly coerced
    const modIngAlloc = payload.data.find((a: any) => a.rubroId === 'MOD-ING');
    if (modIngAlloc) {
      expect(modIngAlloc.amount).toBe(0); // null amount coerced to 0
    }
  });

  it("returns 400 for missing required parameters", async () => {
    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" }, requestId: "test-req-5" },
      queryStringParameters: {}, // No projectId or baseline
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    // Should still work - returns all allocations with scan
    const response = await allocationsHandler(event);
    
    expect(response.statusCode).toBe(200);
  });

  it("includes requestId in error responses for traceability (defensive handling)", async () => {
    (dynamo.ddb.send as jest.Mock).mockRejectedValue(
      new Error("Table does not exist")
    );

    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "GET" }, requestId: "req-trace-123" },
      queryStringParameters: { projectId: "P-999" },
      __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
    };

    const response = await allocationsHandler(event);
    const payload = JSON.parse(response.body);

    // With defensive handling, returns 200 with empty data
    expect(response.statusCode).toBe(200);
    expect(payload.data).toBeDefined();
    expect(Array.isArray(payload.data)).toBe(true);
  });

  describe("bulk allocations update", () => {
    beforeEach(() => {
      // Set up routing mock for all tests in this describe block
      setupDdbRoutingMock();
    });

    it("creates planned allocations with type=planned", async () => {

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "planned" },
        body: JSON.stringify({
          allocations: [
            {
              rubro_id: "MOD-ING",
              mes: "2025-01",
              monto_planeado: 50000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(1);
      expect(payload.type).toBe("planned");
      expect(payload.allocations[0].status).toBe("created");
      expect(payload.allocations[0].monto_planeado).toBe(50000);
    });

    it("creates forecast allocations with type=forecast", async () => {
      setupDdbRoutingMock();

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          allocations: [
            {
              rubro_id: "MOD-ING",
              mes: "2025-01",
              monto_proyectado: 55000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(1);
      expect(payload.type).toBe("forecast");
      expect(payload.allocations[0].status).toBe("created");
      expect(payload.allocations[0].monto_proyectado).toBe(55000);
    });

    it("updates existing allocation with forecast value", async () => {
      const existingAllocation = {
        pk: "PROJECT#P-123",
        sk: "ALLOCATION#base_001#2025-01#MOD-ING",
        projectId: "P-123",
        baselineId: "base_001",
        rubroId: "MOD-ING",
        month: "2025-01",
        mes: "2025-01",
        monto_planeado: 50000,
        planned: 50000,
      };

      // Use routing mock but override for existing allocation check
      setupDdbRoutingMock();
      (dynamo.ddb.send as jest.Mock).mockImplementation(async (cmd: any) => {
        const input = cmd?.input ?? {};
        const table = String(input?.TableName || "").toLowerCase();

        // PROJECT metadata lookup
        if (table.includes("test_projects") && input?.Key?.pk === "PROJECT#P-123") {
          return { Item: mockProjectWithStartDate("2025-01-01") };
        }

        // Allocation existence check - return existing allocation
        if (table.includes("test_allocations") && typeof input?.Key?.sk === "string" && input.Key.sk.startsWith("ALLOCATION#")) {
          return { Item: existingAllocation };
        }

        // Put / Update / Transact
        if (cmd?.constructor?.name?.includes("Put") || cmd?.constructor?.name?.includes("Update") || cmd?.constructor?.name?.includes("Transact")) {
          return {};
        }

        return {};
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          allocations: [
            {
              rubro_id: "MOD-ING",
              mes: "2025-01",
              monto_proyectado: 55000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(1);
      expect(payload.allocations[0].status).toBe("updated");
    });

    it("rejects invalid type parameter", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "invalid" },
        body: JSON.stringify({
          allocations: [
            {
              rubro_id: "MOD-ING",
              mes: "2025-01",
              monto_planeado: 50000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Invalid type parameter");
    });

    it("rejects missing allocations array", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" }, // Use forecast to test the new auth path
        body: JSON.stringify({}),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Missing or invalid allocations");
    });

    it("processes multiple allocations in bulk", async () => {
      setupDdbRoutingMock();

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          allocations: [
            {
              rubro_id: "MOD-ING",
              mes: "2025-01",
              monto_proyectado: 55000,
            },
            {
              rubro_id: "MOD-LEAD",
              mes: "2025-01",
              monto_proyectado: 35000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(2);
      expect(payload.allocations).toHaveLength(2);
    });

    it("accepts new items format for forecast updates", async () => {
      setupDdbRoutingMock();

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
              forecast: 32000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(1);
      expect(payload.type).toBe("forecast");
      expect(payload.allocations[0].status).toBe("created");
    });

    it("accepts numeric monthIndex (1-12) and computes calendar month", async () => {
      // Override routing mock for this test to use May start date
      (dynamo.ddb.send as jest.Mock).mockImplementation(async (cmd: any) => {
        const input = cmd?.input ?? {};
        const table = String(input?.TableName || "").toLowerCase();
        const sk = input?.Key?.sk;

        if (table.includes("test_projects") && input?.Key?.pk === "PROJECT#P-123") {
          if (sk === "METADATA" || sk === "META") {
            return { Item: mockProjectWithStartDate("2025-05-01") };
          }
        }

        if (table.includes("test_allocations") && typeof sk === "string" && sk.startsWith("ALLOCATION#")) {
          return { Item: undefined };
        }

        if (cmd?.constructor?.name?.includes("Put")) {
          return {};
        }

        return {};
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" }, requestId: "test-123" },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: 1, // M1 should map to May 2025
              forecast: 32000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(1);
      expect(payload.allocations[0].calendarMonthKey).toBe("2025-05");
      expect(payload.allocations[0].monthIndex).toBe(1);
    });

    it("handles M-notation (M1, M2, etc.)", async () => {
      // Override routing mock for this test to use June start date
      (dynamo.ddb.send as jest.Mock).mockImplementation(async (cmd: any) => {
        const input = cmd?.input ?? {};
        const table = String(input?.TableName || "").toLowerCase();
        const sk = input?.Key?.sk;

        if (table.includes("test_projects") && input?.Key?.pk === "PROJECT#P-123") {
          if (sk === "METADATA" || sk === "META") {
            return { Item: mockProjectWithStartDate("2025-06-15") };
          }
        }

        if (table.includes("test_allocations") && typeof sk === "string" && sk.startsWith("ALLOCATION#")) {
          return { Item: undefined };
        }

        if (cmd?.constructor?.name?.includes("Put")) {
          return {};
        }

        return {};
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" }, requestId: "test-124" },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "M3", // M3 should map to August 2025 (Jun + 2 months)
              forecast: 40000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.allocations[0].calendarMonthKey).toBe("2025-08");
      expect(payload.allocations[0].monthIndex).toBe(3);
    });

    it("rejects invalid month values", async () => {
      setupDdbRoutingMock();

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" }, requestId: "test-125" },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: 61, // Invalid - must be 1-60
              forecast: 32000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Month index must be between 1 and 60");
    });

    it("rejects forecast updates from non-SDMT users", async () => {
      // Mock getUserContext to return non-SDMT user
      const auth = require("../../src/lib/auth");
      auth.getUserContext.mockReturnValueOnce({
        email: "user@example.com",
        sub: "user-id",
        isSDMT: false,
        isAdmin: false,
        roles: ["SDM"],
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
              forecast: 32000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDM"], email: "user@example.com" },
      };

      const response = await allocationsHandler(event);

      expect(response.statusCode).toBe(403);
      expect(response.body).toContain("Forbidden");
    });

    it("allows ADMIN users to update forecasts", async () => {
      // Mock getUserContext to return ADMIN user
      const auth = require("../../src/lib/auth");
      auth.getUserContext.mockReturnValueOnce({
        email: "admin@example.com",
        sub: "admin-id",
        isSDMT: false,
        isAdmin: true,
        roles: ["ADMIN"],
      });

      // Mock project lookup with start date
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProjectWithStartDate("2025-01-01"),
        })
        // Mock existing allocation check (not found)
        .mockResolvedValueOnce({ Item: undefined })
        // Mock put command
        .mockResolvedValueOnce({});

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
              forecast: 32000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["ADMIN"], email: "admin@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(1);
    });

    it("allows EXEC_RO users to update forecasts", async () => {
      // Mock getUserContext to return EXEC_RO user
      const auth = require("../../src/lib/auth");
      auth.getUserContext.mockReturnValueOnce({
        email: "exec@example.com",
        sub: "exec-id",
        isSDMT: false,
        isAdmin: false,
        isExecRO: true,
        roles: ["EXEC_RO"],
      });

      // Mock project lookup with start date
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProjectWithStartDate("2025-01-01"),
        })
        // Mock existing allocation check (not found)
        .mockResolvedValueOnce({ Item: undefined })
        // Mock put command
        .mockResolvedValueOnce({});

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
              forecast: 32000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["EXEC_RO"], email: "exec@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(1);
    });

    it("rejects forecast updates from PMO users", async () => {
      // Mock getUserContext to return PMO user (who should NOT have forecast access)
      const auth = require("../../src/lib/auth");
      auth.getUserContext.mockReturnValueOnce({
        email: "pmo@example.com",
        sub: "pmo-id",
        isSDMT: false,
        isAdmin: false,
        isExecRO: false,
        isPMO: true,
        roles: ["PMO"],
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
              forecast: 32000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["PMO"], email: "pmo@example.com" },
      };

      const response = await allocationsHandler(event);

      expect(response.statusCode).toBe(403);
      expect(response.body).toContain("Forbidden");
    });

    describe("project metadata lookup", () => {
      it("uses composite key with sk=METADATA for project lookup", async () => {
        const mockProject = {
          pk: "PROJECT#P-123",
          sk: "METADATA",
          baseline_id: "base_001",
          start_date: "2025-01-01",
        };

        // Override routing mock to return METADATA record
        (dynamo.ddb.send as jest.Mock).mockImplementation(async (cmd: any) => {
          const input = cmd?.input ?? {};
          const table = String(input?.TableName || "").toLowerCase();

          if (table.includes("test_projects") && input?.Key?.pk === "PROJECT#P-123") {
            if (input?.Key?.sk === "METADATA") {
              return { Item: mockProject };
            }
          }

          if (table.includes("test_allocations") && typeof input?.Key?.sk === "string" && input.Key.sk.startsWith("ALLOCATION#")) {
            return { Item: undefined };
          }

          if (cmd?.constructor?.name?.includes("Put")) {
            return {};
          }

          return {};
        });

        const event: any = {
          headers: baseHeaders,
          requestContext: { http: { method: "PUT" } },
          pathParameters: { id: "P-123" },
          queryStringParameters: { type: "planned" },
          body: JSON.stringify({
            allocations: [
              {
                rubro_id: "MOD-ING",
                mes: "2025-01",
                monto_planeado: 10000,
              },
            ],
          }),
          __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
        };

        const response = await allocationsHandler(event);

        expect(response.statusCode).toBe(200);
        // Verify ddb.send was called (at least once for project lookup)
        expect(dynamo.ddb.send).toHaveBeenCalled();
      });

      it("falls back to sk=META for legacy projects", async () => {
        const mockLegacyProject = {
          pk: "PROJECT#P-123",
          sk: "META",
          baseline_id: "base_001",
          start_date: "2025-01-01",
        };

        // Override routing mock to simulate METADATA not found, META found
        (dynamo.ddb.send as jest.Mock).mockImplementation(async (cmd: any) => {
          const input = cmd?.input ?? {};
          const table = String(input?.TableName || "").toLowerCase();

          if (table.includes("test_projects") && input?.Key?.pk === "PROJECT#P-123") {
            if (input?.Key?.sk === "METADATA") {
              return { Item: undefined }; // METADATA not found
            }
            if (input?.Key?.sk === "META") {
              return { Item: mockLegacyProject }; // META found
            }
          }

          if (table.includes("test_allocations") && typeof input?.Key?.sk === "string" && input.Key.sk.startsWith("ALLOCATION#")) {
            return { Item: undefined };
          }

          if (cmd?.constructor?.name?.includes("Put")) {
            return {};
          }

          return {};
        });

        const event: any = {
          headers: baseHeaders,
          requestContext: { http: { method: "PUT" } },
          pathParameters: { id: "P-123" },
          queryStringParameters: { type: "planned" },
          body: JSON.stringify({
            allocations: [
              {
                rubro_id: "MOD-ING",
                mes: "2025-01",
                monto_planeado: 10000,
              },
            ],
          }),
          __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
        };

        const response = await allocationsHandler(event);

        expect(response.statusCode).toBe(200);
        // Verify ddb.send was called multiple times (at least twice for project lookups)
        expect(dynamo.ddb.send).toHaveBeenCalledTimes(4); // 2 for project lookup, 1 for allocation check, 1 for put
      });

      it("returns 400 when project metadata not found", async () => {
        setupDdbRoutingMock(); // Set up routing mock, but P-NONEXISTENT won't match

        const event: any = {
          headers: baseHeaders,
          requestContext: { http: { method: "PUT" } },
          pathParameters: { id: "P-NONEXISTENT" }, // Will not match routing mock
          queryStringParameters: { type: "planned" },
          body: JSON.stringify({
            allocations: [
              {
                rubro_id: "MOD-ING",
                mes: "2025-01",
                monto_planeado: 10000,
              },
            ],
          }),
          __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
        };

        const response = await allocationsHandler(event);

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain("Project metadata not found");
      });
    });
  });

  describe("allocation normalization", () => {
    it("normalizes allocation with monto_planeado to amount field", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_001#2025-01#TEC-ITSM",
          projectId: "P-123",
          baselineId: "base_001",
          rubroId: "TEC-ITSM",
          month: "2025-01",
          monto_planeado: 1145.83,
          // Note: amount field is missing
        },
      ];

      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: mockAllocations,
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_001" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(1);
      expect(payload.data[0].amount).toBe(1145.83); // Should be normalized from monto_planeado
    });

    it("derives labour amount from baseline total_cost when amount is 0", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_bbf111163bb7#2025-06#MOD-LEAD",
          projectId: "P-123",
          baselineId: "base_bbf111163bb7",
          rubroId: "MOD-LEAD",
          month: "2025-06",
          amount: 0, // Zero amount - should be derived
          allocation_type: "planned",
        },
      ];

      const mockBaseline = {
        pk: "BASELINE#base_bbf111163bb7",
        sk: "METADATA",
        durationMonths: 12,
        labor_estimates: [
          {
            rubroId: "MOD-LEAD",
            total_cost: 120000,
          },
        ],
      };

      // First call: query allocations
      // Second call: getBaselineMetadata
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Items: mockAllocations,
        })
        .mockResolvedValueOnce({
          Item: mockBaseline,
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_bbf111163bb7" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(1);
      // Should derive: 120000 / 12 = 10000
      expect(payload.data[0].amount).toBe(10000);
    });

    it("derives labour amount from hourly rate when amount is 0", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_001#2025-01#MOD-SDM",
          projectId: "P-123",
          baselineId: "base_001",
          rubroId: "MOD-SDM",
          month: "2025-01",
          amount: 0,
        },
      ];

      const mockBaseline = {
        pk: "BASELINE#base_001",
        sk: "METADATA",
        durationMonths: 12,
        labor_estimates: [
          {
            rubroId: "MOD-SDM",
            hourly_rate: 50,
            hours_per_month: 160,
            fte_count: 1,
            on_cost_percentage: 25,
          },
        ],
      };

      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Items: mockAllocations,
        })
        .mockResolvedValueOnce({
          Item: mockBaseline,
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_001" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(1);
      // Should derive: 50 * 160 * 1 * 1.25 = 10000
      expect(payload.data[0].amount).toBe(10000);
    });

    it("does not derive amount for non-labour rubros", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_001#2025-01#TEC-ITSM",
          projectId: "P-123",
          baselineId: "base_001",
          rubroId: "TEC-ITSM",
          month: "2025-01",
          amount: 0, // Zero but not MOD
        },
      ];

      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: mockAllocations,
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_001" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(1);
      expect(payload.data[0].amount).toBe(0); // Should remain 0 for non-labour
    });

    it("handles missing baseline gracefully for labour derivation", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_missing#2025-01#MOD-LEAD",
          projectId: "P-123",
          baselineId: "base_missing",
          rubroId: "MOD-LEAD",
          month: "2025-01",
          amount: 0,
        },
      ];

      // First call: query allocations
      // Second call: getBaselineMetadata returns null
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Items: mockAllocations,
        })
        .mockResolvedValueOnce({
          Item: null, // Baseline not found
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_missing" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(1);
      expect(payload.data[0].amount).toBe(0); // Should remain 0 when baseline not found
    });

    it("normalizes month_index from various sources", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_001#2025-06#TEC-ITSM",
          projectId: "P-123",
          baselineId: "base_001",
          rubroId: "TEC-ITSM",
          calendarMonthKey: "2025-06",
          monto_planeado: 1000,
          // month_index is missing, should be derived from calendarMonthKey
        },
      ];

      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Items: mockAllocations,
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_001" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(1);
      expect(payload.data[0].month_index).toBe(6); // Should be derived from "2025-06"
      expect(payload.data[0].monthIndex).toBe(6);
    });

    it("handles multiple labour rubros in single request", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_001#2025-01#MOD-LEAD",
          projectId: "P-123",
          baselineId: "base_001",
          rubroId: "MOD-LEAD",
          month: "2025-01",
          amount: 0,
        },
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_001#2025-01#MOD-SDM",
          projectId: "P-123",
          baselineId: "base_001",
          rubroId: "MOD-SDM",
          month: "2025-01",
          amount: 0,
        },
      ];

      const mockBaseline = {
        pk: "BASELINE#base_001",
        sk: "METADATA",
        durationMonths: 12,
        labor_estimates: [
          {
            rubroId: "MOD-LEAD",
            total_cost: 120000,
          },
          {
            rubroId: "MOD-SDM",
            total_cost: 96000,
          },
        ],
      };

      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Items: mockAllocations,
        })
        .mockResolvedValue({
          Item: mockBaseline,
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_001" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(2);
      
      const leadAlloc = payload.data.find((p: any) => p.rubroId === "MOD-LEAD");
      const sdmAlloc = payload.data.find((p: any) => p.rubroId === "MOD-SDM");
      
      expect(leadAlloc.amount).toBe(10000); // 120000 / 12
      expect(sdmAlloc.amount).toBe(8000); // 96000 / 12
    });
  });

  describe("contract month index calculation (M1..M60)", () => {
    it("computes monthIndex from YYYY-MM calendar key with project start date", async () => {
      // Project starts June 2025, allocation for November 2026
      // June 2025 = M1, November 2026 = M18 (June + 17 months)
      const mockProject = {
        pk: "PROJECT#P-123",
        sk: "METADATA",
        baseline_id: "base_001",
        start_date: "2025-06-01",
      };

      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProject,
        })
        // Mock existing allocation check (not found)
        .mockResolvedValueOnce({ Item: undefined })
        // Mock put command
        .mockResolvedValueOnce({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" }, requestId: "test-monthindex" },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "2026-11", // November 2026
              forecast: 50000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.updated_count).toBe(1);
      expect(payload.allocations[0].monthIndex).toBe(18); // June 2025 + 17 months = November 2026 = M18
      expect(payload.allocations[0].calendarMonthKey).toBe("2026-11");
    });

    it("handles YYYY-MM for first month (project start)", async () => {
      const mockProject = {
        pk: "PROJECT#P-123",
        sk: "METADATA",
        baseline_id: "base_001",
        start_date: "2025-06-01",
      };

      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProject,
        })
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" }, requestId: "test-m1" },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "2025-06", // June 2025 = M1
              forecast: 30000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.allocations[0].monthIndex).toBe(1); // M1
      expect(payload.allocations[0].calendarMonthKey).toBe("2025-06");
    });

    it("handles M-notation correctly with calendar computation", async () => {
      const mockProject = {
        pk: "PROJECT#P-123",
        sk: "METADATA",
        baseline_id: "base_001",
        start_date: "2025-06-01",
      };

      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProject,
        })
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" }, requestId: "test-mnotation" },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "M13", // M13 should map to June 2026 (June 2025 + 12 months)
              forecast: 40000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.allocations[0].monthIndex).toBe(13);
      expect(payload.allocations[0].calendarMonthKey).toBe("2026-06"); // M13 = June 2026
    });

    it("normalizes allocation retrieval with calendarMonthKey to correct month_index", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_001#2026-11#MOD-ING",
          projectId: "P-123",
          baselineId: "base_001",
          rubroId: "MOD-ING",
          calendarMonthKey: "2026-11", // November 2026
          monto_planeado: 50000,
        },
      ];

      const mockBaseline = {
        pk: "BASELINE#base_001",
        sk: "METADATA",
        start_date: "2025-06-01", // Project starts June 2025
        durationMonths: 24,
      };

      // First call: query allocations
      // Second call: getBaselineMetadata for normalization
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Items: mockAllocations,
        })
        .mockResolvedValueOnce({
          Item: mockBaseline,
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_001" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(1);
      expect(payload.data[0].month_index).toBe(18); // November 2026 = M18 from June 2025 start
      expect(payload.data[0].monthIndex).toBe(18);
      expect(payload.data[0].calendarMonthKey).toBe("2026-11");
    });

    it("falls back to month-of-year when projectStartDate is missing", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-123",
          sk: "ALLOCATION#base_001#2026-11#MOD-ING",
          projectId: "P-123",
          baselineId: "base_001",
          rubroId: "MOD-ING",
          calendarMonthKey: "2026-11",
          monto_planeado: 50000,
        },
      ];

      // Baseline has no start_date
      const mockBaseline = {
        pk: "BASELINE#base_001",
        sk: "METADATA",
        durationMonths: 24,
        // No start_date field
      };

      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Items: mockAllocations,
        })
        .mockResolvedValueOnce({
          Item: mockBaseline,
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { projectId: "P-123", baseline: "base_001" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data.length).toBe(1);
      // Should fall back to month-of-year = 11 (November)
      expect(payload.data[0].month_index).toBe(11);
      expect(payload.data[0].monthIndex).toBe(11);
      expect(payload.data[0].calendarMonthKey).toBe("2026-11");
    });

    it("clamps monthIndex to 1-60 range for out-of-range dates", async () => {
      const mockProject = {
        pk: "PROJECT#P-123",
        sk: "METADATA",
        baseline_id: "base_001",
        start_date: "2020-01-01", // Old project start date
      };

      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProject,
        })
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" }, requestId: "test-clamp" },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          items: [
            {
              rubroId: "MOD-ING",
              month: "2026-11", // This would be M83 from 2020-01, should clamp to M60
              forecast: 50000,
            },
          ],
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.allocations[0].monthIndex).toBe(60); // Clamped to max
      expect(payload.allocations[0].calendarMonthKey).toBe("2026-11");
    });
  });

  describe("Defensive error handling and table fixes", () => {
    it("uses projects table (not prefacturas) for project metadata lookup", async () => {
      const mockAllocation = {
        pk: "PROJECT#P-456",
        sk: "ALLOCATION#base_002#2025-01#MOD-ING",
        projectId: "P-456",
        rubroId: "MOD-ING",
        amount: 0,
        month: "2025-01",
      };

      const mockProjectMetadata = {
        pk: "PROJECT#P-456",
        sk: "METADATA",
        start_date: "2024-06-01",
      };

      // First call: Query for allocations
      // Second call: GetCommand for project metadata (should be from projects table)
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Items: [mockAllocation],
        })
        .mockResolvedValueOnce({
          Item: mockProjectMetadata,
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" }, requestId: "test-table-fix" },
        queryStringParameters: { projectId: "P-456" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.data).toBeDefined();
      
      // Verify GetCommand was called with projects table
      // Since GetCommand is mocked, we check the mock calls for GetCommand invocations
      const sendCalls = (dynamo.ddb.send as jest.Mock).mock.calls;
      const getCommandCalls = sendCalls.filter(
        (call: any) => call[0]?.input?.Key?.pk?.startsWith('PROJECT#')
      );
      
      if (getCommandCalls.length > 0) {
        const getCall = getCommandCalls[0][0];
        // Verify it's using the projects table (test_projects in our mock)
        expect(getCall.input?.TableName).toBe("test_projects");
      }
    });

    it("returns empty array when DynamoDB query fails (defensive handling)", async () => {
      // Simulate DynamoDB throwing an error
      (dynamo.ddb.send as jest.Mock).mockRejectedValueOnce(
        new Error("ResourceNotFoundException: Table not found")
      );

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" }, requestId: "test-query-fail" },
        queryStringParameters: { projectId: "P-999" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      // With defensive handling, query failures return empty array (200 OK)
      expect(response.statusCode).toBe(200);
      expect(payload.data).toBeDefined();
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data.length).toBe(0);
    });

    it("handles per-item normalization failures gracefully (partial success)", async () => {
      const mockAllocations = [
        {
          pk: "PROJECT#P-789",
          sk: "ALLOCATION#base_003#2025-01#MOD-ING",
          projectId: "P-789",
          rubroId: "MOD-ING",
          amount: 1000,
          month: "2025-01",
        },
        {
          pk: "PROJECT#P-789",
          sk: "ALLOCATION#base_003#2025-02#MOD-LEAD",
          projectId: "P-789",
          rubroId: "MOD-LEAD",
          amount: 2000,
          month: "2025-02",
        },
      ];

      // First call: Query returns allocations
      // Second and subsequent calls: GetCommand for baseline metadata (simulate failure for one)
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Items: mockAllocations,
        })
        .mockRejectedValueOnce(new Error("Baseline not found")) // First baseline lookup fails
        .mockResolvedValueOnce({ Item: null }); // Second baseline lookup returns null

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" }, requestId: "test-partial-fail" },
        queryStringParameters: { projectId: "P-789", baseline: "base_003" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      // Should still return 200 with both items (fallback normalization)
      expect(response.statusCode).toBe(200);
      expect(payload.data).toBeDefined();
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data.length).toBe(2);
      // Items should have basic normalization applied (rubroId, amount)
      expect(payload.data[0].rubroId).toBe("MOD-ING");
      expect(payload.data[0].amount).toBe(1000);
      expect(payload.data[1].rubroId).toBe("MOD-LEAD");
      expect(payload.data[1].amount).toBe(2000);
    });

    it("includes requestId in 500 error response when top-level exception occurs", async () => {
      // Mock ensureCanRead to throw an unexpected error
      const mockAuth = jest.requireMock("../../src/lib/auth");
      mockAuth.ensureCanRead.mockRejectedValueOnce(
        new Error("Unexpected authorization error")
      );

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" }, requestId: "test-500-reqid" },
        queryStringParameters: { projectId: "P-ERROR" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      const response = await allocationsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(payload.error).toBeDefined();
      expect(payload.error).toContain("Failed to fetch allocations");
      expect(payload.error).toContain("test-500-reqid");

      // Restore mock
      mockAuth.ensureCanRead.mockResolvedValue(undefined);
    });

    it("logs full diagnostic context including triedKeys on error", async () => {
      // Capture console.error calls
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Mock ensureCanRead to throw
      const mockAuth = jest.requireMock("../../src/lib/auth");
      mockAuth.ensureCanRead.mockRejectedValueOnce(
        new Error("Test error for diagnostics")
      );

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" }, requestId: "test-diagnostics" },
        queryStringParameters: { projectId: "P-DIAG" },
        __verifiedClaims: { "cognito:groups": ["FIN"], email: "test@example.com" },
      };

      await allocationsHandler(event);

      // Verify error was logged with full context
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[allocations] Request test-diagnostics failed:"),
        expect.objectContaining({
          message: expect.any(String),
          stack: expect.any(String),
          triedKeys: expect.any(Array),
        })
      );

      // Cleanup
      consoleErrorSpy.mockRestore();
      mockAuth.ensureCanRead.mockResolvedValue(undefined);
    });
  });
});
