import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

import { sampleProjects } from "../fixtures/sample-projects-with-rubros.js";

type ApiResult = APIGatewayProxyStructuredResultV2;

jest.mock("../../src/lib/auth", () => ({
  ensureCanWrite: jest.fn(),
  ensureCanRead: jest.fn(),
  getUserEmail: jest.fn().mockResolvedValue("qa-tester@ikusi.example"),
}));

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetCommand: jest.fn().mockImplementation((input) => ({ input })),
  tableName: jest.fn((name: string) => `${name}-table`),
}));

import { handler as rubrosHandler } from "../../src/handlers/rubros.js";

const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  PutCommand: jest.Mock;
  tableName: jest.Mock;
};

const auth = jest.requireMock("../../src/lib/auth") as {
  ensureCanWrite: jest.Mock;
  getUserEmail: jest.Mock;
};

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "POST /projects/{projectId}/rubros",
  rawPath: "/projects/P-OPS-001/rubros",
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "POST",
      path: "/projects/P-OPS-001/rubros",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "POST /projects/{projectId}/rubros",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  pathParameters: { projectId: "P-OPS-001" },
  body: undefined,
  ...overrides,
});

describe("rubros handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("attaches rubros array and writes audit rows", async () => {
    const project = sampleProjects[0];
    const rubro = project.rubros[0];

    dynamo.ddb.send.mockResolvedValue({});

    const response = (await rubrosHandler(
      baseEvent({
        body: JSON.stringify({
          rubroIds: [rubro.rubroId],
          qty: rubro.qty,
          unitCost: rubro.unitCost,
          type: rubro.type,
          duration: rubro.duration,
        }),
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body || "{}");
    expect(payload.attached).toEqual([rubro.rubroId]);

    expect(auth.ensureCanWrite).toHaveBeenCalled();
    expect(auth.getUserEmail).toHaveBeenCalled();

    const putCalls = dynamo.ddb.send.mock.calls.filter((call) =>
      call[0]?.input?.TableName?.includes("rubros-table")
    );
    expect(putCalls.length).toBe(1);
    expect(putCalls[0][0].input.Item).toEqual(
      expect.objectContaining({
        pk: `PROJECT#${project.id}`,
        sk: `RUBRO#${rubro.rubroId}`,
        rubroId: rubro.rubroId,
        projectId: project.id,
      })
    );

    const auditCalls = dynamo.ddb.send.mock.calls.filter((call) =>
      call[0]?.input?.TableName?.includes("audit_log-table")
    );
    expect(auditCalls.length).toBe(1);
    expect(auditCalls[0][0].input.Item).toEqual(
      expect.objectContaining({ action: "RUBRO_ATTACH", resource_id: rubro.rubroId })
    );
  });

  it("requires rubroIds array", async () => {
    const response = (await rubrosHandler(
      baseEvent({ body: JSON.stringify({ rubroId: "R-MISSING" }) })
    )) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body || "{}" ).error).toMatch(/rubroIds/i);
    expect(dynamo.ddb.send).not.toHaveBeenCalled();
  });
});

