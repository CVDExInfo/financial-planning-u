import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

type ApiResult = APIGatewayProxyStructuredResultV2;

// --- Mocks -------------------------------------------------------------------

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  tableName: jest.fn((name: string) => `${name}-table`),
}));

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../src/lib/baseline-sdmt", () => ({
  queryProjectRubros: jest.fn(() => Promise.resolve([])),
}));

import { handler as forecastHandler } from "../../src/handlers/forecast.js";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  QueryCommand: jest.Mock;
  tableName: jest.Mock;
};

const baselineSDMT = jest.requireMock("../../src/lib/baseline-sdmt") as {
  queryProjectRubros: jest.Mock;
};

// --- Helpers -----------------------------------------------------------------

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "GET /plan/forecast",
  rawPath: "/plan/forecast",
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "GET",
      path: "/plan/forecast",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "GET /plan/forecast",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  queryStringParameters: { projectId: "PROJ-1" },
  ...overrides,
});

// --- Tests -------------------------------------------------------------------

describe("forecast handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    dynamo.tableName.mockImplementation((name: string) => `${name}-table`);
    dynamo.QueryCommand.mockImplementation((input) => ({ input }));
    // Mock queryProjectRubros to return empty array by default
    baselineSDMT.queryProjectRubros.mockResolvedValue([]);
  });

  it("rejects requests without projectId", async () => {
    const response = (await forecastHandler(
      baseEvent({ queryStringParameters: {} })
    )) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/projectId/i);
    expect(dynamo.ddb.send).not.toHaveBeenCalled();
  });

  it("validates months parameter", async () => {
    const response = (await forecastHandler(
      baseEvent({
        queryStringParameters: { projectId: "PROJ-1", months: "0" },
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/months/i);
    expect(dynamo.ddb.send).not.toHaveBeenCalled();
  });

  it("merges allocations and payroll into forecast cells", async () => {
    // allocations
    dynamo.ddb.send
      .mockResolvedValueOnce({
        Items: [
          {
            month: 1,
            rubroId: "R1",
            planned: 1000,
            actual: 800,
            created_at: "2024-01-01T00:00:00Z",
          },
          {
            month: 2,
            rubroId: "R2",
            planned: 5000,
            actual: 6000,
          },
        ],
      })
      // payroll
      .mockResolvedValueOnce({
        Items: [
          {
            month: 1,
            empleado_id: "E1",
            salario_base: 2000,
            salario_real: 2100,
            created_at: "2024-01-05T00:00:00Z",
          },
        ],
      })
      // rubros (unused in this scenario)
      .mockResolvedValueOnce({ Items: [] });

    const response = (await forecastHandler(
      baseEvent({
        queryStringParameters: { projectId: "PROJ-1", months: "1" },
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);

    expect(payload.projectId).toBe("PROJ-1");
    expect(payload.months).toBe(1);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(payload.generated_at).toBeDefined();

    const allocation = payload.data.find(
      (item: any) => item.line_item_id === "R1"
    );
    const payroll = payload.data.find((item: any) =>
      item.line_item_id.startsWith("payroll-")
    );

    expect(allocation.variance).toBe(-200); // 800 - 1000
    expect(payroll.actual).toBe(2100);

    expect(dynamo.tableName).toHaveBeenCalledWith("allocations");
    expect(dynamo.tableName).toHaveBeenCalledWith("payroll_actuals");
    expect(dynamo.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "allocations-table" })
    );
  });

  it("derives forecast amounts from rubro attachments when allocations are empty", async () => {
    // Mock queryProjectRubros to return rubro data
    baselineSDMT.queryProjectRubros.mockResolvedValueOnce([
      {
        rubroId: "R-FALLBACK",
        qty: 2,
        unit_cost: 100,
        recurring: true,
        start_month: 1,
        end_month: 2,
        total_cost: 400,
        currency: "USD",
        category: "Test",
        nombre: "Test Rubro",
        one_time: false,
      },
    ]);

    // allocations
    dynamo.ddb.send
      .mockResolvedValueOnce({ Items: [] })
      // payroll
      .mockResolvedValueOnce({ Items: [] });

    const response = (await forecastHandler(
      baseEvent({
        queryStringParameters: { projectId: "PROJ-2", months: "2" },
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);

    expect(Array.isArray(payload.data)).toBe(true);
    // recurring across months 1 and 2
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        line_item_id: "R-FALLBACK",
        month: 1,
        planned: 200,
        forecast: 200,
      })
    );
  });

  it("returns an empty data array when no allocations or payroll exist", async () => {
    // All three queries return empty
    dynamo.ddb.send.mockResolvedValue({ Items: [] });

    const response = (await forecastHandler(
      baseEvent({
        queryStringParameters: { projectId: "PROJ-EMPTY", months: "3" },
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);

    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(0);
    expect(payload.months).toBe(3);
  });

  it("returns 500 when DynamoDB queries fail", async () => {
    // First query (allocations) fails; others don't matter for Promise.all
    dynamo.ddb.send.mockRejectedValueOnce(new Error("boom"));
    dynamo.ddb.send.mockResolvedValue({ Items: [] });

    const response = (await forecastHandler(baseEvent())) as ApiResult;

    expect(response.statusCode).toBe(500);
    const payload = JSON.parse(response.body);
    expect(payload.error).toMatch(/Finanzas/i);
  });

  it("derives forecast from rubros with top-level baselineId (legacy seed data)", async () => {
    // Mock queryProjectRubros to return rubro with top-level baselineId
    baselineSDMT.queryProjectRubros.mockResolvedValueOnce([
      {
        rubroId: "RB0001",
        nombre: "MOD Engineers",
        category: "MOD",
        qty: 8,
        unit_cost: 75000,
        baselineId: "BL-TEST-001", // Legacy: top-level baseline_id
        recurring: true,
        one_time: false,
        start_month: 1,
        end_month: 2,
        total_cost: 1200000,
        currency: "USD",
      },
    ]);

    // allocations
    dynamo.ddb.send
      .mockResolvedValueOnce({ Items: [] })
      // payroll
      .mockResolvedValueOnce({ Items: [] });

    const response = (await forecastHandler(
      baseEvent({
        queryStringParameters: { projectId: "PROJ-LEGACY", months: "2" },
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);

    expect(Array.isArray(payload.data)).toBe(true);
    // Should have 2 entries (recurring across months 1 and 2)
    expect(payload.data.length).toBeGreaterThan(0);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        line_item_id: "RB0001",
        month: 1,
        planned: 600000, // qty * unit_cost
        forecast: 600000,
      })
    );
  });
});
