import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { handler as budgetsHandler } from "../../src/handlers/budgets";
import * as dynamo from "../../src/lib/dynamo";

// Mock DynamoDB
jest.mock("../../src/lib/dynamo", () => ({
  ddb: {
    send: jest.fn(),
  },
  tableName: jest.fn((name: string) => `test_${name}`),
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  ScanCommand: jest.fn(),
}));

// Mock auth
jest.mock("../../src/lib/auth", () => ({
  getUserContext: jest.fn(() => ({
    email: "test@example.com",
    sub: "test-user-id",
    isSDMT: true,
    isExecRO: false,
    roles: ["SDMT"],
  })),
}));

// Mock logging
jest.mock("../../src/utils/logging", () => ({
  logError: jest.fn(),
}));

const baseHeaders = { authorization: "Bearer test" };

describe("budgets handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles OPTIONS preflight request", async () => {
    const event: any = {
      headers: baseHeaders,
      requestContext: { http: { method: "OPTIONS" } },
    };

    const response = await budgetsHandler(event);

    expect(response.statusCode).toBe(204);
    expect(response.headers).toBeDefined();
  });

  describe("GET /budgets/all-in", () => {
    it("returns annual budget when it exists", async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Item: {
          pk: "BUDGET#ANNUAL",
          sk: "YEAR#2025",
          year: 2025,
          amount: 5000000,
          currency: "USD",
          lastUpdated: "2025-01-15T10:30:00Z",
          updatedBy: "admin@example.com",
        },
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { year: "2025" },
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.year).toBe(2025);
      expect(payload.amount).toBe(5000000);
      expect(payload.currency).toBe("USD");
    });

    it("returns 404 when budget does not exist", async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Item: undefined,
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { year: "2025" },
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain("No budget found for year 2025");
    });

    it("rejects missing year parameter", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: {},
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Missing required parameter: year");
    });

    it("rejects invalid year parameter", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { year: "invalid" },
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Invalid year parameter");
    });
  });

  describe("PUT /budgets/all-in", () => {
    it("creates new annual budget", async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        body: JSON.stringify({
          year: 2025,
          amount: 5000000,
          currency: "USD",
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.year).toBe(2025);
      expect(payload.amount).toBe(5000000);
      expect(payload.currency).toBe("USD");
      expect(payload.updatedBy).toBe("test@example.com");
      expect(payload.lastUpdated).toBeDefined();
    });

    it("defaults to USD when currency not specified", async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        body: JSON.stringify({
          year: 2025,
          amount: 5000000,
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.currency).toBe("USD");
    });

    it("rejects missing year", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        body: JSON.stringify({
          amount: 5000000,
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Missing or invalid year");
    });

    it("rejects missing amount", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        body: JSON.stringify({
          year: 2025,
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Amount must be a non-negative number");
    });

    it("rejects negative amount", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        body: JSON.stringify({
          year: 2025,
          amount: -1000,
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Amount must be a non-negative number");
    });

    it("rejects invalid currency", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        body: JSON.stringify({
          year: 2025,
          amount: 5000000,
          currency: "GBP",
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Currency must be USD, EUR, or MXN");
    });

    it("rejects year out of range", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT" } },
        body: JSON.stringify({
          year: 2150,
          amount: 5000000,
        }),
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Year must be between 2020 and 2100");
    });
  });

  describe("GET /budgets/all-in/overview", () => {
    it("returns budget overview with totals when budget exists", async () => {
      // Mock budget lookup
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: {
            pk: "BUDGET#ANNUAL",
            sk: "YEAR#2025",
            year: 2025,
            amount: 10000000,
            currency: "USD",
          },
        })
        // Mock allocations scan
        .mockResolvedValueOnce({
          Items: [
            {
              month: "2025-01",
              planned: 500000,
              forecast: 550000,
              actual: 480000,
            },
            {
              month: "2025-02",
              planned: 500000,
              forecast: 530000,
              actual: 490000,
            },
          ],
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { 
          http: { 
            method: "GET", 
            path: "/budgets/all-in/overview" 
          } 
        },
        queryStringParameters: { year: "2025" },
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.year).toBe(2025);
      expect(payload.budgetAllIn).toEqual({ amount: 10000000, currency: "USD" });
      expect(payload.totals.planned).toBe(1000000);
      expect(payload.totals.forecast).toBe(1080000);
      expect(payload.totals.actual).toBe(970000);
      expect(payload.totals.varianceBudgetVsForecast).toBe(8920000); // 10M - 1.08M
      expect(payload.totals.percentBudgetConsumedForecast).toBeCloseTo(10.8, 1);
    });

    it("returns overview with null budget when no budget set", async () => {
      // Mock budget lookup (not found)
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: undefined,
        })
        // Mock allocations scan
        .mockResolvedValueOnce({
          Items: [
            {
              month: "2025-01",
              planned: 500000,
              forecast: 550000,
              actual: 480000,
            },
          ],
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { 
          http: { 
            method: "GET", 
            path: "/budgets/all-in/overview" 
          } 
        },
        queryStringParameters: { year: "2025" },
        __verifiedClaims: { "cognito:groups": ["SDMT"], email: "test@example.com" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.budgetAllIn).toBeNull();
      expect(payload.totals.percentBudgetConsumedForecast).toBeNull();
    });

    it("allows ADMIN users to access budget overview", async () => {
      // Mock getUserContext to return ADMIN user
      const auth = require("../../src/lib/auth");
      auth.getUserContext.mockReturnValueOnce({
        email: "admin@example.com",
        sub: "admin-id",
        isSDMT: false,
        isAdmin: true,
        isExecRO: false,
        roles: ["ADMIN"],
      });

      // Mock budget lookup
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: {
            pk: "BUDGET#ANNUAL",
            sk: "YEAR#2025",
            year: 2025,
            amount: 5000000,
            currency: "USD",
          },
        })
        // Mock allocations scan
        .mockResolvedValueOnce({
          Items: [],
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { 
          http: { 
            method: "GET", 
            path: "/budgets/all-in/overview" 
          } 
        },
        queryStringParameters: { year: "2025" },
        __verifiedClaims: { "cognito:groups": ["ADMIN"], email: "admin@example.com" },
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(200);
    });
  });
});
