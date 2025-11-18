import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import crypto from "node:crypto";

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
  ensureCanWrite: jest.fn(),
  getUserEmail: jest.fn().mockReturnValue("prefa@tester.com"),
}));

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  tableName: jest.fn(() => "prefacturas-table"),
}));

import { handler as prefacturasHandler } from "../../src/handlers/prefacturas.js";

const auth = jest.requireMock("../../src/lib/auth") as jest.Mocked<
  typeof import("../../src/lib/auth")
>;
const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  PutCommand: jest.Mock;
  QueryCommand: jest.Mock;
  tableName: jest.Mock;
};

const ORIGINAL_ENV = { ...process.env };

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "GET /prefacturas",
  rawPath: "/prefacturas",
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "GET",
      path: "/prefacturas",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "GET /prefacturas",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  ...overrides,
});

const toPostEvent = (body: string): APIGatewayProxyEventV2 => {
  const template = baseEvent();
  return {
    ...template,
    routeKey: "POST /prefacturas",
    body,
    requestContext: {
      ...template.requestContext,
      routeKey: "POST /prefacturas",
      http: { ...template.requestContext.http, method: "POST" },
    },
  };
};

type ApiResult = APIGatewayProxyStructuredResultV2;

let uuidSpy: jest.SpyInstance<string, [crypto.RandomUUIDOptions?]>;

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
  process.env = ORIGINAL_ENV;
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  jest.setSystemTime(new Date("2025-02-01T00:00:00.000Z"));
  uuidSpy = jest
    .spyOn(crypto, "randomUUID")
    .mockReturnValue("abcd1234-efgh-ijkl-mnop-qrstuvwx");
  dynamo.ddb.send.mockResolvedValue({});
});

afterEach(() => {
  uuidSpy.mockRestore();
});

describe("prefacturas handler", () => {
  it("lists prefacturas for a project", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({
      Items: [
        {
          pk: "PROJECT#PROJ-1",
          sk: "INVOICE#1",
          invoiceNumber: "INV-1",
        },
      ],
      Count: 1,
    });

    const response = (await prefacturasHandler(
      baseEvent({
        queryStringParameters: { projectId: "PROJ-1" },
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.projectId).toBe("PROJ-1");
    expect(payload.total).toBe(1);
    expect(auth.ensureCanRead).toHaveBeenCalledTimes(1);
    expect(dynamo.tableName).toHaveBeenCalledWith("prefacturas");
    expect(dynamo.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: "prefacturas-table",
        KeyConditionExpression: "pk = :pk",
      })
    );
  });

  it("requires projectId on GET", async () => {
    const response = (await prefacturasHandler(
      baseEvent({ queryStringParameters: {} })
    )) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(
      /projectId is required|Missing/
    );
  });

  it("creates a prefactura when payload is valid", async () => {
    const postEvent = toPostEvent(
      JSON.stringify({
        projectId: "PROJ-10",
        lineItemId: "LINE-7",
        invoiceNumber: "INV-500",
        amount: 1200,
        month: 6,
        documentKey: "docs/PROJ-10/prefactura/file.pdf",
      })
    );

    const response = (await prefacturasHandler(postEvent)) as ApiResult;

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.projectId).toBe("PROJ-10");
    expect(body.invoiceId).toBe("INV-abcd1234efgh");
    expect(body.documentKey).toBe("docs/PROJ-10/prefactura/file.pdf");
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
    expect(dynamo.PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: "prefacturas-table",
        Item: expect.objectContaining({
          projectId: "PROJ-10",
          documentKey: "docs/PROJ-10/prefactura/file.pdf",
          uploaded_by: "prefa@tester.com",
        }),
      })
    );
  });

  it("rejects invalid JSON payload", async () => {
    const response = (await prefacturasHandler(toPostEvent("not-json"))) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/Invalid JSON/);
  });

  it("validates positive amount", async () => {
    const event = toPostEvent(
      JSON.stringify({
        projectId: "PROJ-10",
        lineItemId: "LINE-7",
        invoiceNumber: "INV-500",
        amount: -5,
        month: 6,
        documentKey: "docs/key",
      })
    );

    const response = (await prefacturasHandler(event)) as ApiResult;
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/amount must be/);
  });

  it("requires documentKey", async () => {
    const event = toPostEvent(
      JSON.stringify({
        projectId: "PROJ-10",
        lineItemId: "LINE-7",
        invoiceNumber: "INV-500",
        amount: 1200,
        month: 6,
        documentKey: "",
      })
    );

    const response = (await prefacturasHandler(event)) as ApiResult;
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/documentKey is required/);
  });
});
