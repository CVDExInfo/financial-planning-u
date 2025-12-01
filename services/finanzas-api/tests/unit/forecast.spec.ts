import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

type ApiResult = APIGatewayProxyStructuredResultV2;

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  tableName: jest.fn((name: string) => `${name}-table`),
}));

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(() => Promise.resolve()),
}));

import { handler as forecastHandler } from "../../src/handlers/forecast.js";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  QueryCommand: jest.Mock;
  tableName: jest.Mock;
};

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

describe("forecast handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      baseEvent({ queryStringParameters: { projectId: "PROJ-1", months: "0" } })
    )) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/months/i);
    expect(dynamo.ddb.send).not.toHaveBeenCalled();
  });

  it("merges allocations and payroll into forecast cells", async () => {
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
      .mockResolvedValueOnce({ Items: [] })
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
      });

    const response = (await forecastHandler(
      baseEvent({ queryStringParameters: { projectId: "PROJ-1", months: "1" } })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);

    expect(payload.projectId).toBe("PROJ-1");
    expect(payload.months).toBe(1);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(payload.generated_at).toBeDefined();

    const allocation = payload.data.find((item: any) => item.line_item_id === "R1");
    const payroll = payload.data.find((item: any) => item.line_item_id.startsWith("payroll-"));

    expect(allocation.variance).toBe(-200);
    expect(payroll.actual).toBe(2100);

    expect(dynamo.tableName).toHaveBeenCalledWith("allocations");
    expect(dynamo.tableName).toHaveBeenCalledWith("payroll_actuals");
    expect(dynamo.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "allocations-table" })
    );
  });

  it("derives forecast amounts from rubro attachments when allocations are empty", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({
        Items: [
          {
            rubroId: "R-FALLBACK",
            qty: 2,
            unit_cost: 100,
            recurring: true,
            start_month: 1,
            end_month: 2,
          },
        ],
      });

    const response = (await forecastHandler(
      baseEvent({ queryStringParameters: { projectId: "PROJ-2", months: "2" } })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
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
    dynamo.ddb.send.mockResolvedValue({ Items: [] });

    const response = (await forecastHandler(
      baseEvent({ queryStringParameters: { projectId: "PROJ-EMPTY", months: "3" } })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(0);
    expect(payload.months).toBe(3);
  });
});
