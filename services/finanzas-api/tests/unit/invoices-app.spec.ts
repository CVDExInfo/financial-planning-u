import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(),
  ensureCanWrite: jest.fn(),
  getUserEmail: jest.fn().mockResolvedValue("tester@example.com"),
}));

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  GetCommand: jest.fn().mockImplementation((input) => ({ input })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  tableName: jest.fn(() => "prefacturas-table"),
}));

import { handler as invoicesHandler } from "../../src/handlers/invoices/app.js";
import crypto from "node:crypto";

const auth = jest.requireMock("../../src/lib/auth") as jest.Mocked<
  typeof import("../../src/lib/auth")
>;
const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  GetCommand: jest.Mock;
  QueryCommand: jest.Mock;
  UpdateCommand: jest.Mock;
  PutCommand: jest.Mock;
  tableName: jest.Mock;
};

type ApiResult = APIGatewayProxyStructuredResultV2;

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {},
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "GET /projects/{projectId}/invoices",
  rawPath: "/projects/PROJ-1/invoices",
  rawQueryString: "",
  headers: {},
  pathParameters: { projectId: "PROJ-1" },
  requestContext: {
    accountId: "123",
    apiId: "api",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "GET",
      path: "/projects/PROJ-1/invoices",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "GET /projects/{projectId}/invoices",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  ...overrides,
});

describe("InvoicesFn handler", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(crypto, "randomUUID").mockReturnValue("f4b8b6f2-1111-2222-3333-444455556666");
  });

  it("lists invoices for a project", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({
      Items: [
        {
          pk: "PROJECT#PROJ-1",
          sk: "INVOICE#INV-1",
          projectId: "PROJ-1",
          lineItemId: "LINE-1",
          amount: 1000,
          month: 2,
          status: "Matched",
        },
      ],
    });

    const response = (await invoicesHandler(baseEvent())) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.projectId).toBe("PROJ-1");
    expect(payload.total).toBe(1);
    expect(payload.data[0]).toMatchObject({
      id: "INV-1",
      project_id: "PROJ-1",
      line_item_id: "LINE-1",
      status: "Matched",
    });
    expect(auth.ensureCanRead).toHaveBeenCalledTimes(1);
    expect(dynamo.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "prefacturas-table" })
    );
  });

  it("fetches a single invoice", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({
      Item: {
        pk: "PROJECT#PROJ-1",
        sk: "INVOICE#INV-99",
        lineItemId: "LINE-9",
        status: "Pending",
      },
    });

    const response = (await invoicesHandler(
      baseEvent({
        routeKey: "GET /projects/{projectId}/invoices/{invoiceId}",
        rawPath: "/projects/PROJ-1/invoices/INV-99",
        pathParameters: { projectId: "PROJ-1", invoiceId: "INV-99" },
        requestContext: {
          ...baseEvent().requestContext,
          http: { ...baseEvent().requestContext.http, path: "/projects/PROJ-1/invoices/INV-99" },
          routeKey: "GET /projects/{projectId}/invoices/{invoiceId}",
        },
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.id).toBe("INV-99");
    expect(auth.ensureCanRead).toHaveBeenCalledTimes(1);
    expect(dynamo.GetCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: { pk: "PROJECT#PROJ-1", sk: "INVOICE#INV-99" },
      })
    );
  });

  it("creates an invoice with validated payload", async () => {
    dynamo.ddb.send
      .mockResolvedValueOnce({ Item: { pk: "PROJECT#PROJ-1", sk: "RUBRO#LINE-1" } })
      .mockResolvedValueOnce({});

    const response = (await invoicesHandler(
      baseEvent({
        routeKey: "POST /projects/{projectId}/invoices",
        rawPath: "/projects/PROJ-1/invoices",
        requestContext: {
          ...baseEvent().requestContext,
          http: { ...baseEvent().requestContext.http, method: "POST", path: "/projects/PROJ-1/invoices" },
          routeKey: "POST /projects/{projectId}/invoices",
        },
        body: JSON.stringify({
          projectId: "PROJ-1",
          lineItemId: "LINE-1",
          month: 3,
          amount: 1500,
          invoiceNumber: "INV-12",
          documentKey: "docs/123",
        }),
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(201);
    const payload = JSON.parse(response.body);
    expect(payload.line_item_id).toBe("LINE-1");
    expect(payload.amount).toBe(1500);
    expect(payload.status).toBe("Pending");
    expect(dynamo.PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: "prefacturas-table" })
    );
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
  });

  it("rejects invoices missing required fields", async () => {
    const response = (await invoicesHandler(
      baseEvent({
        routeKey: "POST /projects/{projectId}/invoices",
        rawPath: "/projects/PROJ-1/invoices",
        requestContext: {
          ...baseEvent().requestContext,
          http: { ...baseEvent().requestContext.http, method: "POST", path: "/projects/PROJ-1/invoices" },
          routeKey: "POST /projects/{projectId}/invoices",
        },
        body: JSON.stringify({ projectId: "PROJ-1", amount: 0, month: 13 }),
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/lineItemId/i);
    expect(dynamo.ddb.send).not.toHaveBeenCalled();
  });

  it("maps Dynamo access issues to 503", async () => {
    dynamo.ddb.send.mockRejectedValueOnce({ name: "ResourceNotFoundException" });

    const response = (await invoicesHandler(
      baseEvent({
        routeKey: "GET /projects/{projectId}/invoices",
        rawPath: "/projects/PROJ-1/invoices",
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toMatch(/Invoices table not found/);
  });

  it("maps Dynamo validation missing table errors to 503", async () => {
    dynamo.ddb.send.mockRejectedValueOnce({
      name: "ValidationException",
      message: "Requested resource not found: Table: finz_prefacturas not found",
    });

    const response = (await invoicesHandler(
      baseEvent({
        routeKey: "POST /projects/{projectId}/invoices",
        rawPath: "/projects/PROJ-1/invoices",
        requestContext: {
          ...baseEvent().requestContext,
          http: { ...baseEvent().requestContext.http, method: "POST" },
          routeKey: "POST /projects/{projectId}/invoices",
        },
        body: JSON.stringify({ projectId: "PROJ-1", lineItemId: "L-1", month: 1, amount: 10 }),
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toMatch(/Invoices table not found/);
  });

  it("updates invoice status", async () => {
    dynamo.ddb.send.mockResolvedValueOnce({
      Attributes: {
        pk: "PROJECT#PROJ-1",
        sk: "INVOICE#INV-2",
        lineItemId: "LINE-5",
        amount: 400,
        status: "Matched",
        updated_at: "2025-02-01T00:00:00.000Z",
      },
    });

    const response = (await invoicesHandler(
      baseEvent({
        routeKey: "PUT /projects/{projectId}/invoices/{invoiceId}/status",
        rawPath: "/projects/PROJ-1/invoices/INV-2/status",
        pathParameters: { projectId: "PROJ-1", invoiceId: "INV-2" },
        requestContext: {
          ...baseEvent().requestContext,
          http: { ...baseEvent().requestContext.http, method: "PUT", path: "/projects/PROJ-1/invoices/INV-2/status" },
          routeKey: "PUT /projects/{projectId}/invoices/{invoiceId}/status",
        },
        body: JSON.stringify({ status: "Matched", comment: "synced" }),
      })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.status).toBe("Matched");
    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
    expect(dynamo.UpdateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: "prefacturas-table",
        Key: { pk: "PROJECT#PROJ-1", sk: "INVOICE#INV-2" },
      })
    );
  });

  it("validates project id", async () => {
    const response = (await invoicesHandler(
      baseEvent({ pathParameters: {}, rawPath: "/projects//invoices" })
    )) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/projectId/i);
  });
});
