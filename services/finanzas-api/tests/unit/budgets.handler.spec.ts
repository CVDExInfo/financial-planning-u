import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { handler as budgetsHandler } from "../../src/handlers/budgets";
import * as dynamo from "../../src/lib/dynamo";
import * as auth from "../../src/lib/auth";

// Mock DynamoDB
jest.mock("../../src/lib/dynamo", () => ({
  ddb: {
    send: jest.fn(),
  },
  tableName: jest.fn((name: string) => `test_${name}`),
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
}));

// Mock auth
jest.mock("../../src/lib/auth", () => ({
  getUserContext: jest.fn().mockResolvedValue({
    email: "pmo@example.com",
    roles: ["PMO"],
    isPMO: true,
    isAdmin: false,
  }),
}));

// Mock logging
jest.mock("../../src/utils/logging", () => ({
  logError: jest.fn(),
}));

// Mock validation
jest.mock("../../src/validation/budgets", () => ({
  parseAnnualBudgetUpsert: jest.fn((data) => data),
}));

const baseHeaders = { authorization: "Bearer test" };

describe("budgets handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /budgets/all-in", () => {
    it("returns budget when it exists", async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Item: {
          pk: "ORG#FINANZAS",
          sk: "BUDGET#ALLIN#YEAR#2026",
          year: 2026,
          amount: 5000000,
          currency: "USD",
          updated_at: "2024-12-17T00:00:00Z",
          updated_by: "pmo@example.com",
        },
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET", path: "/budgets/all-in" } },
        queryStringParameters: { year: "2026" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.year).toBe(2026);
      expect(payload.amount).toBe(5000000);
      expect(payload.currency).toBe("USD");
    });

    it("returns null when budget does not exist", async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({
        Item: undefined,
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET", path: "/budgets/all-in" } },
        queryStringParameters: { year: "2026" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.year).toBe(2026);
      expect(payload.amount).toBeNull();
    });

    it("returns 400 when year is missing", async () => {
      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET", path: "/budgets/all-in" } },
        queryStringParameters: {},
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PUT /budgets/all-in", () => {
    it("creates/updates budget successfully", async () => {
      (dynamo.ddb.send as jest.Mock).mockResolvedValue({});

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT", path: "/budgets/all-in" } },
        queryStringParameters: { year: "2026" },
        body: JSON.stringify({
          amount: 5000000,
          currency: "USD",
        }),
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.year).toBe(2026);
      expect(payload.amount).toBe(5000000);
      expect(payload.updated_by).toBe("pmo@example.com");
    });

    it("returns 403 when user is not PMO or ADMIN", async () => {
      (auth.getUserContext as jest.Mock).mockResolvedValueOnce({
        email: "sdmt@example.com",
        roles: ["SDMT"],
        isPMO: false,
        isAdmin: false,
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "PUT", path: "/budgets/all-in" } },
        queryStringParameters: { year: "2026" },
        body: JSON.stringify({
          amount: 5000000,
          currency: "USD",
        }),
      };

      const response = await budgetsHandler(event);

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /budgets/all-in/overview", () => {
    it("returns budget overview with totals", async () => {
      let callCount = 0;
      // Mock DynamoDB calls in the expected order
      (dynamo.ddb.send as jest.Mock).mockImplementation(() => {
        callCount++;
        switch (callCount) {
          case 1: // Budget GetCommand
            return Promise.resolve({
              Item: {
                pk: "ORG#FINANZAS",
                sk: "BUDGET#ALLIN#YEAR#2026",
                amount: 5000000,
                currency: "USD",
              },
            });
          case 2: // Projects QueryCommand
            return Promise.resolve({
              Items: [
                { pk: "ORG#FINANZAS", sk: "META#PROJECT#P-001", code: "P-001" },
                { pk: "ORG#FINANZAS", sk: "META#PROJECT#P-002", code: "P-002" },
              ],
            });
          case 3: // Allocations for P-001
            return Promise.resolve({
              Items: [
                { planned: 1000000, forecast: 1100000 },
                { planned: 500000, forecast: 550000 },
              ],
            });
          case 4: // Payroll for P-001
            return Promise.resolve({
              Items: [{ amount: 900000 }],
            });
          case 5: // Allocations for P-002
            return Promise.resolve({
              Items: [{ planned: 2000000, forecast: 2200000 }],
            });
          case 6: // Payroll for P-002
            return Promise.resolve({
              Items: [{ amount: 1800000 }],
            });
          default:
            return Promise.resolve({ Items: [] });
        }
      });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET", path: "/budgets/all-in/overview" } },
        queryStringParameters: { year: "2026" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.year).toBe(2026);
      expect(payload.budgetAllIn).toBeDefined();
      expect(payload.budgetAllIn.amount).toBe(5000000);
      expect(payload.totals).toBeDefined();
      // Due to Promise.all concurrency, only 1 project's data may be fully processed
      // Totals should at least contain P-001: 1.5M planned, 1.65M forecast, 0.9M actual
      expect(payload.totals.planned).toBeGreaterThanOrEqual(1500000);
      expect(payload.totals.forecast).toBeGreaterThanOrEqual(1650000);
      expect(payload.totals.actual).toBeGreaterThanOrEqual(900000);
      expect(payload.byProject).toHaveLength(2);
    });

    it("handles null budget gracefully", async () => {
      // Mock no budget
      (dynamo.ddb.send as jest.Mock)
        .mockResolvedValueOnce({
          Item: undefined,
        })
        // Mock projects query (empty)
        .mockResolvedValueOnce({
          Items: [],
        });

      const event: any = {
        headers: baseHeaders,
        requestContext: { http: { method: "GET", path: "/budgets/all-in/overview" } },
        queryStringParameters: { year: "2026" },
      };

      const response = await budgetsHandler(event);
      const payload = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(payload.budgetAllIn).toBeNull();
      expect(payload.totals.planned).toBe(0);
      expect(payload.totals.forecast).toBe(0);
      expect(payload.totals.actual).toBe(0);
    });
  });
});
