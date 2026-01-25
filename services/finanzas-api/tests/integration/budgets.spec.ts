/**
 * Integration tests for budgets endpoints
 * Tests all budget endpoints including annual and monthly budget operations
 */

import { handler } from "../../src/handlers/budgets";
import { ddb } from "../../src/lib/dynamo";
import { getUserContext } from "../../src/lib/auth";

type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> };
type ApiEvent = Mutable<Parameters<typeof handler>[0]>;

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(async () => undefined),
  ensureCanWrite: jest.fn(async () => undefined),
  getUserContext: jest.fn(async () => ({
    email: "sdmt-user@example.com",
    groups: ["SDMT"],
    roles: ["SDMT"],
    isAdmin: false,
    isExecRO: false,
    isSDM: false,
    isPMO: false,
    isSDMT: true,
    sub: "test-user-sdmt",
  })),
}));

jest.mock("../../src/lib/dynamo", () => {
  const actual = jest.requireActual("../../src/lib/dynamo");
  const sendDdb = jest.fn();
  return {
    ...actual,
    sendDdb,
    ddb: { send: sendDdb },
    tableName: jest.fn((key: string) => `test-${key}`),
  };
});

const mockDdbSend = ddb.send as jest.Mock;
const mockGetUserContext = getUserContext as jest.Mock;

describe("budgets handler - GET /budgets/all-in/monthly", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
    mockGetUserContext.mockClear();
  });

  const baseGetEvent: ApiEvent = {
    version: "2.0",
    routeKey: "GET /budgets/all-in/monthly",
    rawPath: "/budgets/all-in/monthly",
    rawQueryString: "year=2026",
    headers: { authorization: "Bearer fake" },
    queryStringParameters: { year: "2026" },
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: "/budgets/all-in/monthly",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "test-request-id",
      routeKey: "GET /budgets/all-in/monthly",
      stage: "$default",
      time: "",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  } as any;

  it("should return monthly budget with monthlyMap for valid year", async () => {
    const mockBudgetData = {
      pk: "ORG#FINANZAS",
      sk: "BUDGET#ALLIN#MONTHLY#YEAR#2026",
      year: 2026,
      currency: "USD",
      months: [
        { month: "2026-01", amount: 1000000 },
        { month: "2026-02", amount: 1200000 },
        { month: "2026-03", amount: 1100000 },
        { month: "2026-04", amount: 1300000 },
        { month: "2026-05", amount: 1400000 },
        { month: "2026-06", amount: 1500000 },
        { month: "2026-07", amount: 1600000 },
        { month: "2026-08", amount: 1700000 },
        { month: "2026-09", amount: 1800000 },
        { month: "2026-10", amount: 1900000 },
        { month: "2026-11", amount: 2000000 },
        { month: "2026-12", amount: 2100000 },
      ],
      updated_at: "2026-01-01T00:00:00.000Z",
      updated_by: "admin@example.com",
    };

    mockDdbSend.mockResolvedValueOnce({
      Item: mockBudgetData,
    });

    const result = await handler(baseGetEvent);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body!);
    
    // Verify basic structure
    expect(body).toHaveProperty("year", 2026);
    expect(body).toHaveProperty("currency", "USD");
    expect(body).toHaveProperty("months");
    expect(body).toHaveProperty("monthlyMap");
    
    // Verify months array
    expect(body.months).toHaveLength(12);
    expect(body.months[0]).toEqual({ month: "2026-01", amount: 1000000 });
    
    // Verify monthlyMap structure (this is what the frontend uses)
    expect(body.monthlyMap).toEqual({
      "2026-01": 1000000,
      "2026-02": 1200000,
      "2026-03": 1100000,
      "2026-04": 1300000,
      "2026-05": 1400000,
      "2026-06": 1500000,
      "2026-07": 1600000,
      "2026-08": 1700000,
      "2026-09": 1800000,
      "2026-10": 1900000,
      "2026-11": 2000000,
      "2026-12": 2100000,
    });
    
    // Verify audit fields
    expect(body).toHaveProperty("updated_at");
    expect(body).toHaveProperty("updated_by");
  });

  it("should return 404 when no monthly budget exists for the year", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Item: undefined,
    });

    const result = await handler(baseGetEvent);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("No monthly budgets found for year 2026");
  });

  it("should return 400 for missing year parameter", async () => {
    const eventWithoutYear: ApiEvent = {
      ...baseGetEvent,
      queryStringParameters: {},
      rawQueryString: "",
    };

    const result = await handler(eventWithoutYear);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("Missing required parameter: year");
  });

  it("should return 400 for invalid year parameter", async () => {
    const eventWithInvalidYear: ApiEvent = {
      ...baseGetEvent,
      queryStringParameters: { year: "invalid" },
      rawQueryString: "year=invalid",
    };

    const result = await handler(eventWithInvalidYear);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("Invalid year parameter");
  });

  it("should handle partial monthly budgets (not all 12 months)", async () => {
    const mockBudgetData = {
      pk: "ORG#FINANZAS",
      sk: "BUDGET#ALLIN#MONTHLY#YEAR#2026",
      year: 2026,
      currency: "USD",
      months: [
        { month: "2026-01", amount: 1000000 },
        { month: "2026-02", amount: 1200000 },
        { month: "2026-03", amount: 1100000 },
        // Only 3 months budgeted
      ],
      updated_at: "2026-01-01T00:00:00.000Z",
      updated_by: "admin@example.com",
    };

    mockDdbSend.mockResolvedValueOnce({
      Item: mockBudgetData,
    });

    const result = await handler(baseGetEvent);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body!);
    
    // Should return only the months that were budgeted
    expect(body.months).toHaveLength(3);
    expect(body.monthlyMap).toEqual({
      "2026-01": 1000000,
      "2026-02": 1200000,
      "2026-03": 1100000,
    });
  });
});

describe("budgets handler - GET /budgets/all-in", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
    mockGetUserContext.mockClear();
  });

  const baseGetEvent: ApiEvent = {
    version: "2.0",
    routeKey: "GET /budgets/all-in",
    rawPath: "/budgets/all-in",
    rawQueryString: "year=2026",
    headers: { authorization: "Bearer fake" },
    queryStringParameters: { year: "2026" },
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: "/budgets/all-in",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "test-request-id",
      routeKey: "GET /budgets/all-in",
      stage: "$default",
      time: "",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  } as any;

  it("should return annual budget for valid year", async () => {
    const mockBudgetData = {
      pk: "BUDGET#ANNUAL",
      sk: "YEAR#2026",
      year: 2026,
      amount: 18600000,
      currency: "USD",
      updated_at: "2026-01-01T00:00:00.000Z",
      updated_by: "admin@example.com",
    };

    mockDdbSend.mockResolvedValueOnce({
      Item: mockBudgetData,
    });

    const result = await handler(baseGetEvent);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body!);
    
    expect(body).toEqual({
      year: 2026,
      amount: 18600000,
      currency: "USD",
      updated_at: "2026-01-01T00:00:00.000Z",
      updated_by: "admin@example.com",
    });
  });

  it("should return 404 when no annual budget exists for the year", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Item: undefined,
    });

    const result = await handler(baseGetEvent);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("No budget found for year 2026");
  });
});

describe("budgets handler - PUT /budgets/all-in/monthly", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
    mockGetUserContext.mockClear();
  });

  const basePutEvent: ApiEvent = {
    version: "2.0",
    routeKey: "PUT /budgets/all-in/monthly",
    rawPath: "/budgets/all-in/monthly",
    rawQueryString: "",
    headers: { 
      authorization: "Bearer fake",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      year: 2026,
      currency: "USD",
      months: [
        { month: "2026-01", amount: 1000000 },
        { month: "2026-02", amount: 1200000 },
        { month: "2026-03", amount: 1100000 },
        { month: "2026-04", amount: 1300000 },
        { month: "2026-05", amount: 1400000 },
        { month: "2026-06", amount: 1500000 },
        { month: "2026-07", amount: 1600000 },
        { month: "2026-08", amount: 1700000 },
        { month: "2026-09", amount: 1800000 },
        { month: "2026-10", amount: 1900000 },
        { month: "2026-11", amount: 2000000 },
        { month: "2026-12", amount: 2100000 },
      ],
    }),
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "PUT",
        path: "/budgets/all-in/monthly",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "test-request-id",
      routeKey: "PUT /budgets/all-in/monthly",
      stage: "$default",
      time: "",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  } as any;

  it("should create monthly budget successfully", async () => {
    mockDdbSend.mockResolvedValueOnce({});

    const result = await handler(basePutEvent);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body!);
    
    expect(body).toHaveProperty("year", 2026);
    expect(body).toHaveProperty("currency", "USD");
    expect(body).toHaveProperty("months");
    expect(body.months).toHaveLength(12);
    expect(body).toHaveProperty("updated_at");
    expect(body).toHaveProperty("updated_by");
    
    // Verify DynamoDB was called correctly
    expect(mockDdbSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "test-allocations",
          Item: expect.objectContaining({
            pk: "ORG#FINANZAS",
            sk: "BUDGET#ALLIN#MONTHLY#YEAR#2026",
            year: 2026,
            currency: "USD",
          }),
        }),
      })
    );
  });

  it("should return 400 for invalid month format", async () => {
    const eventWithInvalidMonth: ApiEvent = {
      ...basePutEvent,
      body: JSON.stringify({
        year: 2026,
        currency: "USD",
        months: [
          { month: "invalid-format", amount: 1000000 },
        ],
      }),
    };

    const result = await handler(eventWithInvalidMonth);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("Invalid month format");
  });
});
