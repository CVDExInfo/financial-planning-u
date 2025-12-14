import { APIGatewayProxyEventV2 } from "aws-lambda";

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  tableName: jest.fn((name: string) => `${name}-table`),
  ScanCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

import { handler as projectsHandler } from "../../src/handlers/projects";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
};

const baseEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "GET /projects",
  rawPath: "/projects",
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: { method: "GET", path: "/projects", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "jest" },
    requestId: "id",
    routeKey: "GET /projects",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  ...overrides,
});

describe("projects handler RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows SDMT/FIN users to list projects", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({
      Items: [
        {
          pk: "PROJECT#P-1",
          sk: "METADATA",
          project_id: "P-1",
          nombre: "Proyecto Uno",
          cliente: "Cliente",
          fecha_inicio: "2024-01-01",
          fecha_fin: "2024-12-31",
          moneda: "USD",
          presupuesto_total: 100,
          estado: "active",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
    });

    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["FIN"], email: "fin.user@example.com" } } as any),
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body as string);
    expect(Array.isArray(payload.data)).toBe(true);
    // Canonical DTO now returns projectId, not id
    expect(payload.data[0].projectId).toBe("P-1");
    // Should have canonical fields
    expect(payload.data[0].name).toBe("Proyecto Uno");
    expect(payload.data[0].client).toBe("Cliente");
    expect(payload.data[0].currency).toBe("USD");
  });

  it("paginates through all project pages and preserves totals", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({
        Items: Array.from({ length: 100 }).map((_, idx) => ({
          pk: `PROJECT#P-${idx + 1}`,
          sk: "METADATA",
          project_id: `P-${idx + 1}`,
          nombre: `Proyecto ${idx + 1}`,
          cliente: "Cliente",
          moneda: "USD",
        })),
        LastEvaluatedKey: { pk: "PROJECT#P-100", sk: "METADATA" },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            pk: "PROJECT#P-101",
            sk: "METADATA",
            project_id: "P-101",
            nombre: "Proyecto 101",
            cliente: "Cliente",
            moneda: "USD",
          },
        ],
      });

    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["FIN"], email: "fin.user@example.com" } } as any),
    );

    expect(dynamo.ddb.send).toHaveBeenCalledTimes(2);
    expect(dynamo.ddb.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({
      pk: "PROJECT#P-100",
      sk: "METADATA",
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body as string);
    expect(payload.total).toBe(101);
    expect(payload.data).toHaveLength(101);
    expect(payload.data[100].projectId).toBe("P-101");
  });

  it("rejects requests without valid groups", async () => {
    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["guest"] } } as any),
    );

    expect(response.statusCode).toBe(403);
    const payload = JSON.parse(response.body as string);
    expect(payload.error).toBe("forbidden: valid group required");
  });
});
