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
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetCommand: jest.fn().mockImplementation((input) => ({ input })),
  tableName: jest.fn((name: string) => `${name}-table`),
}));

import { handler as rubrosHandler } from "../../src/handlers/rubros.js";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  QueryCommand: jest.Mock;
  BatchGetCommand: jest.Mock;
  tableName: jest.Mock;
};
const auth = jest.requireMock("../../src/lib/auth") as {
  getUserEmail: jest.Mock;
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

  it("persists cost metadata and allocations when attaching a rubro", async () => {
    auth.getUserEmail.mockResolvedValueOnce("user@example.com");
    const postEvent = baseEvent({
      requestContext: {
        ...baseEvent().requestContext,
        http: { ...baseEvent().requestContext.http, method: "POST" },
      },
      pathParameters: { projectId: "PROJ-1" },
      body: JSON.stringify({
        rubroIds: [
          {
            rubroId: "R-200",
            qty: 2,
            unitCost: 50,
            duration: "M1-M2",
          },
        ],
      }),
    });

    const response = await rubrosHandler(postEvent);
    expect(response.statusCode).toBe(200);

    const calls = dynamo.ddb.send.mock.calls.map((call) => call[0].input);
    const rubroPut = calls.find((call) => call?.TableName === "rubros-table");
    const allocationPuts = calls.filter(
      (call) => call?.TableName === "allocations-table",
    );

    expect(rubroPut?.Item).toEqual(
      expect.objectContaining({
        rubroId: "R-200",
        qty: 2,
        unit_cost: 50,
        start_month: 1,
        end_month: 2,
        total_cost: 100,
      }),
    );

    expect(allocationPuts).toHaveLength(1);
    expect(allocationPuts[0]?.Item).toEqual(
      expect.objectContaining({
        pk: "PROJECT#PROJ-1",
        month: 1,
        planned: 100,
        forecast: 100,
      }),
    );
  });

  it("preserves shared payload fields when rubroIds is an array of strings", async () => {
    auth.getUserEmail.mockResolvedValueOnce("user@example.com");
    const postEvent = baseEvent({
      requestContext: {
        ...baseEvent().requestContext,
        http: { ...baseEvent().requestContext.http, method: "POST" },
      },
      pathParameters: { projectId: "PROJ-1" },
      body: JSON.stringify({
        rubroIds: ["R-300"],
        qty: 3,
        unitCost: 1000,
        duration: "M2-M3",
        type: "one-time",
        currency: "MXN",
        description: "Consulting",
      }),
    });

    const response = await rubrosHandler(postEvent);
    expect(response.statusCode).toBe(200);

    const calls = dynamo.ddb.send.mock.calls.map((call) => call[0].input);
    const rubroPut = calls.find((call) => call?.TableName === "rubros-table");
    const allocationPuts = calls.filter((call) => call?.TableName === "allocations-table");

    expect(rubroPut?.Item).toEqual(
      expect.objectContaining({
        rubroId: "R-300",
        qty: 3,
        unit_cost: 1000,
        start_month: 2,
        end_month: 3,
        total_cost: 3000,
        description: "Consulting",
        currency: "MXN",
      }),
    );

    expect(allocationPuts).toHaveLength(1);
    expect(allocationPuts[0]?.Item).toEqual(
      expect.objectContaining({
        pk: "PROJECT#PROJ-1",
        sk: "ALLOC#R-300#M2",
        planned: 3000,
        forecast: 3000,
        created_by: "user@example.com",
      }),
    );
  });

  it("returns warnings when allocation mirroring fails but still attaches rubro", async () => {
    auth.getUserEmail.mockResolvedValueOnce("user@example.com");
    const postEvent = baseEvent({
      requestContext: {
        ...baseEvent().requestContext,
        http: { ...baseEvent().requestContext.http, method: "POST" },
      },
      pathParameters: { projectId: "PROJ-1" },
      body: JSON.stringify({
        rubroIds: [
          {
            rubroId: "R-500",
            qty: 1,
            unitCost: 200,
            duration: "M1",
          },
        ],
      }),
    });

    dynamo.ddb.send
      .mockResolvedValueOnce({}) // rubro Put
      .mockRejectedValueOnce(new Error("allocations table missing")) // allocation mirror
      .mockResolvedValueOnce({}); // audit log

    const response = await rubrosHandler(postEvent);
    expect(response.statusCode).toBe(200);

    const payload = JSON.parse(response.body as string);
    expect(payload.attached).toEqual(["R-500"]);
    expect(payload.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Allocation mirror failed for rubro R-500"),
      ]),
    );
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
      const tableKey = dynamo.tableName('rubros');
      if (command.input && command.input.KeyConditionExpression) {
        return { Items: attachments };
      }
      if (command.input && command.input.RequestItems) {
        const keys = command.input.RequestItems[tableKey].Keys;
        if (keys.length === 100) {
          return { Responses: { [tableKey]: firstBatch } };
        } else {
          return { Responses: { [tableKey]: secondBatch } };
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

