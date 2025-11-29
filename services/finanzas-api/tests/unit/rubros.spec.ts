import { APIGatewayProxyEventV2 } from "aws-lambda";

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
  ensureCanWrite: jest.fn(),
  getUserEmail: jest.fn(),
}));

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  BatchGetCommand: jest.fn().mockImplementation((input) => ({ input })),
  PutCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  GetCommand: jest.fn(),
  tableName: jest.fn(() => "rubros-table"),
}));

import { handler as rubrosHandler } from "../../src/handlers/rubros.js";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  QueryCommand: jest.Mock;
  BatchGetCommand: jest.Mock;
  tableName: jest.Mock;
};

const baseEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}) => ({
  version: "2.0",
  routeKey: "GET /projects/{projectId}/rubros",
  rawPath: "/projects/PROJ-1/rubros",
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "GET",
      path: "/projects/PROJ-1/rubros",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "GET /projects/{projectId}/rubros",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  pathParameters: { projectId: "PROJ-1" },
  isBase64Encoded: false,
  ...overrides,
});

describe("rubros handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns attached project rubros with catalog metadata", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({
        Items: [
          {
            projectId: "PROJ-1",
            rubroId: "R-100",
            sk: "RUBRO#R-100",
            tier: "gold",
            category: "Ops",
          },
        ],
      })
      .mockResolvedValueOnce({
        Responses: {
          "rubros-table": [
            {
              rubro_id: "R-100",
              nombre: "Infraestructura",
              linea_codigo: "OPS",
              tipo_costo: "RECURRENT",
            },
          ],
        },
      });

    const response = await rubrosHandler(baseEvent());
    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.body as string);
    expect(payload.project_id).toBe("PROJ-1");
    expect(payload.data).toEqual([
      expect.objectContaining({
        id: "R-100",
        rubro_id: "R-100",
        nombre: "Infraestructura",
        linea_codigo: "OPS",
        tipo_costo: "RECURRENT",
      }),
    ]);

    expect(dynamo.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "rubros-table" }),
    );
    expect(dynamo.BatchGetCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        RequestItems: expect.objectContaining({
          "rubros-table": expect.objectContaining({ Keys: [{ pk: "RUBRO#R-100", sk: "DEF#R-100" }] }),
        }),
      }),
    );
  });

  it("validates project id", async () => {
    const response = await rubrosHandler(baseEvent({ pathParameters: {} }));
    expect(response.statusCode).toBe(400);
  });
});

