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

  describe("bulk allocations update", () => {
    it("creates planned allocations with type=planned", async () => {
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
        queryStringParameters: { type: "planned" },
        body: JSON.stringify({
          allocations: [
            {
              rubro_id: "rubro_test123",
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
          allocations: [
            {
              rubro_id: "rubro_test123",
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
        sk: "ALLOCATION#base_001#2025-01#rubro_test123",
        projectId: "P-123",
        baselineId: "base_001",
        rubroId: "rubro_test123",
        month: "2025-01",
        mes: "2025-01",
        monto_planeado: 50000,
        planned: 50000,
      };

      // Mock project lookup with start date
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProjectWithStartDate("2025-01-01"),
        })
        // Mock existing allocation check (found)
        .mockResolvedValueOnce({ Item: existingAllocation })
        // Mock put command
        .mockResolvedValueOnce({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          allocations: [
            {
              rubro_id: "rubro_test123",
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
              rubro_id: "rubro_test123",
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
      // Mock project lookup with start date
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProjectWithStartDate("2025-01-01"),
        })
        // Mock existing allocation checks (not found for both)
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        pathParameters: { id: "P-123" },
        queryStringParameters: { type: "forecast" },
        body: JSON.stringify({
          allocations: [
            {
              rubro_id: "rubro_test123",
              mes: "2025-01",
              monto_proyectado: 55000,
            },
            {
              rubro_id: "rubro_test456",
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
      // Mock project lookup with May start date
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProjectWithStartDate("2025-05-01"),
        })
        // Mock existing allocation check (not found)
        .mockResolvedValueOnce({ Item: undefined })
        // Mock put command
        .mockResolvedValueOnce({});

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
      // Mock project lookup with June start date
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: mockProjectWithStartDate("2025-06-15"),
        })
        // Mock existing allocation check (not found)
        .mockResolvedValueOnce({ Item: undefined })
        // Mock put command
        .mockResolvedValueOnce({});

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
      // Mock project lookup
      (dynamo.ddb.send as jest.Mock).mockResolvedValueOnce({
        Item: mockProjectWithStartDate("2025-01-01"),
      });

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

        (dynamo.ddb.send as jest.Mock)
          .mockResolvedValueOnce({
            Item: mockProject,
          })
          .mockResolvedValueOnce({ Item: undefined })
          .mockResolvedValueOnce({});

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

        // First call returns nothing (METADATA not found)
        // Second call returns legacy META record
        (dynamo.ddb.send as jest.Mock)
          .mockResolvedValueOnce({ Item: undefined })
          .mockResolvedValueOnce({ Item: mockLegacyProject })
          .mockResolvedValueOnce({ Item: undefined })
          .mockResolvedValueOnce({});

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
        // Both METADATA and META lookups return nothing
        (dynamo.ddb.send as jest.Mock)
          .mockResolvedValueOnce({ Item: undefined })
          .mockResolvedValueOnce({ Item: undefined });

        const event: any = {
          headers: baseHeaders,
          requestContext: { http: { method: "PUT" } },
          pathParameters: { id: "P-NONEXISTENT" },
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
});
