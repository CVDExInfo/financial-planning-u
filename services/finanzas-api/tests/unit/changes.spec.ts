// services/finanzas-api/tests/unit/changes.spec.ts

import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

import { handler } from "../../src/handlers/changes"; // ESM import – no require()

// Mock auth layer
jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
  ensureCanWrite: jest.fn(),
  getUserEmail: jest.fn().mockResolvedValue("changes@tester@example.com"),
}));

// Mock Dynamo layer
jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetCommand: jest.fn().mockImplementation((input) => ({ input })),
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  tableName: jest.fn(() => "changes-table"),
}));

const auth = jest.requireMock("../../src/lib/auth") as jest.Mocked<
  typeof import("../../src/lib/auth")
>;
const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  QueryCommand: jest.Mock;
  GetCommand: jest.Mock;
  PutCommand: jest.Mock;
  tableName: jest.Mock;
};

describe("changes handler", () => {
  const baseEvent = (
    overrides: Partial<APIGatewayProxyEventV2> = {},
  ): APIGatewayProxyEventV2 => ({
    version: "2.0",
    routeKey: "GET /projects/{projectId}/changes",
    rawPath: "/projects/PROJ-1/changes",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: "/projects/PROJ-1/changes",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "id",
      routeKey: "GET /projects/{projectId}/changes",
      stage: "$default",
      time: "",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    pathParameters: { projectId: "PROJ-1" },
    ...overrides,
  });

  const toPostEvent = (body: string): APIGatewayProxyEventV2 => {
    const template = baseEvent();
    return {
      ...template,
      routeKey: "POST /projects/{projectId}/changes",
      body,
      requestContext: {
        ...template.requestContext,
        routeKey: "POST /projects/{projectId}/changes",
        http: { ...template.requestContext.http, method: "POST" },
      },
    };
  };

  const toApprovalEvent = (
    changeId: string,
    body: string,
  ): APIGatewayProxyEventV2 => {
    const template = baseEvent({
      routeKey: "POST /projects/{projectId}/changes/{changeId}/approval",
      rawPath: `/projects/PROJ-1/changes/${changeId}/approval`,
      pathParameters: { projectId: "PROJ-1", changeId },
    });

    return {
      ...template,
      routeKey: "POST /projects/{projectId}/changes/{changeId}/approval",
      body,
      requestContext: {
        ...template.requestContext,
        routeKey: "POST /projects/{projectId}/changes/{changeId}/approval",
        http: { ...template.requestContext.http, method: "POST" },
      },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires projectId", async () => {
    const response = (await handler(
      baseEvent({ pathParameters: undefined }) as never,
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(400);
    expect(auth.ensureCanRead).not.toHaveBeenCalled();
    expect(auth.ensureCanWrite).not.toHaveBeenCalled();
  });

  it("lists changes for a project", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({
      Items: [
        { pk: "PROJECT#PROJ-1", sk: "CHANGE#CHG-1", title: "Scope update" },
      ],
    });

    const response = (await handler(
      baseEvent(),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.total).toBe(1);
    expect(payload.data[0].id).toBe("CHG-1");
    expect(auth.ensureCanRead).toHaveBeenCalledTimes(1);
    expect(dynamo.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "changes-table" }),
    );
  });

  it("validates JSON on create", async () => {
    const response = (await handler(
      toPostEvent("not-json"),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(400);
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
  });

  it("validates required fields on create", async () => {
    const response = (await handler(
      toPostEvent(
        JSON.stringify({ title: "", description: "", impact_amount: null }),
      ),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(422);
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
  });

  it("creates a change request", async () => {
    dynamo.ddb.send.mockResolvedValue({}); // PutCommand success

    const response = (await handler(
      toPostEvent(
        JSON.stringify({
          title: "Add QA lead",
          description: "Need QA lead for rollout",
          impact_amount: 12000,
          currency: "USD",
        }),
      ),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.project_id).toBe("PROJ-1");
    expect(body.status).toBe("pending");
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
    expect(dynamo.PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "changes-table" }),
    );
  });

  it("returns 409 when a duplicate change is detected", async () => {
    dynamo.ddb.send.mockRejectedValueOnce({
      name: "ConditionalCheckFailedException",
    });

    const response = (await handler(
      toPostEvent(
        JSON.stringify({
          title: "Duplicate change",
          description: "Existing change id",
          impact_amount: 1000,
          currency: "USD",
        }),
      ),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toMatch(/already exists/i);
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
  });

  it("approves a change request", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({ Item: { pk: "PROJECT#PROJ-1", sk: "CHANGE#CHG-1", id: "CHG-1" } })
      .mockResolvedValueOnce({});

    const response = (await handler(
      toApprovalEvent(
        "CHG-1",
        JSON.stringify({ action: "approve", comment: "Looks good" }),
      ),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("approved");
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
    expect(dynamo.GetCommand).toHaveBeenCalled();
    expect(dynamo.PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "changes-table" }),
    );
  });

  it("rejects a change request with required comment", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({ Item: { pk: "PROJECT#PROJ-1", sk: "CHANGE#CHG-2", id: "CHG-2" } })
      .mockResolvedValueOnce({});

    const response = (await handler(
      toApprovalEvent(
        "CHG-2",
        JSON.stringify({ action: "reject", comment: "Missing budget" }),
      ),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).status).toBe("rejected");
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
  });

  it("returns validation error for invalid approval payload", async () => {
    const response = (await handler(
      toApprovalEvent("CHG-3", JSON.stringify({ action: "reject" })),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(422);
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for missing change on approval", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({ Item: undefined });

    const response = (await handler(
      toApprovalEvent("CHG-404", JSON.stringify({ action: "approve" })),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(404);
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
  });

  it("surfaced missing table errors with a descriptive 500", async () => {
    dynamo.ddb.send.mockRejectedValueOnce({ name: "ResourceNotFoundException" });

    const response = (await handler(
      baseEvent(),
    )) as APIGatewayProxyStructuredResultV2;

    expect(response.statusCode).toBe(500);
    const payload = JSON.parse(response.body as string);
    expect(payload.error).toMatch(/table not found/i);
    expect(auth.ensureCanRead).toHaveBeenCalledTimes(1);
  });
});
