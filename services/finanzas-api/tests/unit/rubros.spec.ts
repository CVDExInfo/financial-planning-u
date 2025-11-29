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
    // Reset ddb.send to return a default empty response
    dynamo.ddb.send.mockResolvedValue({});
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
              codigo: "R-100",
              nombre: "Infraestructura",
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
        linea_codigo: "R-100",
        tipo_costo: "RECURRENT",
      }),
    ]);

    expect(dynamo.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "rubros-table" }),
    );
    expect(dynamo.BatchGetCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        RequestItems: expect.objectContaining({
          "rubros-table": expect.objectContaining({ Keys: [{ pk: "RUBRO#R-100", sk: "METADATA" }] }),
        }),
      }),
    );
  });

  it("validates project id", async () => {
    const response = await rubrosHandler(baseEvent({ pathParameters: {} }));
    expect(response.statusCode).toBe(400);
  });

  it("filters attachments without a rubro id", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({ Items: [{ projectId: "PROJ-1", sk: "RUBRO#" }] })
      .mockResolvedValueOnce({ Responses: { "rubros-table": [] } });

    const response = await rubrosHandler(baseEvent());
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body as string);
    expect(payload.data).toEqual([]);
  });

  it("chunks BatchGetCommand when more than 100 rubros attached", async () => {
    // Reset mocks specifically for this test
    dynamo.ddb.send.mockReset();
    dynamo.BatchGetCommand.mockReset();
    
    // Create 101 test rubros (just over the 100 limit)
    const attachments = Array.from({ length: 101 }, (_, i) => ({
      projectId: "PROJ-1",
      rubroId: `R-${i}`,
      sk: `RUBRO#R-${i}`,
      tier: "gold",
      category: "Ops",
    }));

    // Mock responses in order: QueryCommand, then two BatchGetCommands
    const firstBatch = Array.from({ length: 100 }, (_, i) => ({
      codigo: `R-${i}`,
      nombre: `Rubro ${i}`,
      tipo_costo: "RECURRENT",
    }));
    const secondBatch = [{
      codigo: `R-100`,
      nombre: `Rubro 100`,
      tipo_costo: "RECURRENT",
    }];

    // Set up mock to handle multiple calls
    dynamo.ddb.send.mockImplementation(async (command) => {
      if (command.input && command.input.KeyConditionExpression) {
        return { Items: attachments };
      }
      if (command.input && command.input.RequestItems) {
        const keys = command.input.RequestItems['rubros-table'].Keys;
        if (keys.length === 100) {
          return { Responses: { "rubros-table": firstBatch } };
        } else {
          return { Responses: { "rubros-table": secondBatch } };
        }
      }
      return {};
    });
    
    dynamo.BatchGetCommand.mockImplementation((input) => ({ input }));

    const response = await rubrosHandler(baseEvent());
    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.body as string);
    expect(payload.data).toHaveLength(101);
    expect(payload.total).toBe(101);

    // Verify BatchGetCommand was called twice with correct chunk sizes
    expect(dynamo.BatchGetCommand).toHaveBeenCalledTimes(2);
    const firstCall = dynamo.BatchGetCommand.mock.calls[0][0];
    const secondCall = dynamo.BatchGetCommand.mock.calls[1][0];

    expect(firstCall.RequestItems["rubros-table"].Keys).toHaveLength(100);
    expect(secondCall.RequestItems["rubros-table"].Keys).toHaveLength(1);
  });
});

