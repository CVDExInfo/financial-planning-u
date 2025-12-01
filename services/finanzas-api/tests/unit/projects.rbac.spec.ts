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
          nombre: "Proyecto Uno",
          cliente: "Cliente",
          fecha_inicio: "2024-01-01",
          fecha_fin: "2024-12-31",
          moneda: "USD",
          presupuesto_total: 100,
          estado: "active",
        },
      ],
    });

    const response = await projectsHandler(
      baseEvent({ __verifiedClaims: { "cognito:groups": ["FIN"] } } as any),
    );

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body as string);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data[0].id).toBe("P-1");
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
