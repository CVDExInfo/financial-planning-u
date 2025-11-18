import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import crypto from "node:crypto";

// Set environment variables before imports
process.env.DOCS_BUCKET = "docs-bucket";
process.env.AWS_REGION = "us-east-2";

const mockSignedUrl = "https://signed.example/upload";

// Set environment variables before importing handler
process.env.DOCS_BUCKET = "docs-bucket";
process.env.AWS_REGION = "us-east-2";

jest.mock("../../src/lib/auth", () => ({
  ensureCanWrite: jest.fn(),
  getUserEmail: jest.fn().mockReturnValue("tester@example.com"),
}));

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  tableName: jest.fn(() => "docs-table"),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue(mockSignedUrl),
}));

import { handler } from "../../src/handlers/upload-docs";

type ApiResult = APIGatewayProxyStructuredResultV2;

const auth = jest.requireMock("../../src/lib/auth") as jest.Mocked<
  typeof import("../../src/lib/auth")
>;
const dynamo = jest.requireMock("../../src/lib/dynamo") as {
  ddb: { send: jest.Mock };
  PutCommand: jest.Mock;
  tableName: jest.Mock;
};
const { getSignedUrl } = jest.requireMock("@aws-sdk/s3-request-presigner") as {
  getSignedUrl: jest.Mock;
};

const ORIGINAL_ENV = { ...process.env };

const baseEvent = (
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "POST /uploads/docs",
  rawPath: "/uploads/docs",
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123456789",
    apiId: "abc",
    domainName: "example.com",
    domainPrefix: "example",
    http: {
      method: "POST",
      path: "/uploads/docs",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "jest",
    },
    requestId: "id",
    routeKey: "POST /uploads/docs",
    stage: "$default",
    time: "",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
  body: undefined,
  ...overrides,
});

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
  process.env = {
    ...ORIGINAL_ENV,
    DOCS_BUCKET: "docs-bucket",
    AWS_REGION: "us-east-2",
  };
  jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  uuidSpy = jest
    .spyOn(crypto, "randomUUID")
    .mockReturnValue("12345678-aaaa-bbbb-cccc-ffffffffffff");
  dynamo.ddb.send.mockResolvedValue({});
});

afterEach(() => {
  uuidSpy.mockRestore();
});

describe("upload-docs handler", () => {
  const validBody = {
    projectId: "PROJ-123",
    module: "prefactura",
    lineItemId: "LINE-22",
    contentType: "application/pdf",
    originalName: "invoice.pdf",
  };

  it("returns a presigned url and stores metadata", async () => {
    const response = (await handler(
      baseEvent({ body: JSON.stringify(validBody) })
    )) as ApiResult;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload).toEqual({
      uploadUrl: mockSignedUrl,
      objectKey: "docs/PROJ-123/prefactura/LINE-22-12345678-invoice.pdf",
    });

    expect(auth.ensureCanWrite).toHaveBeenCalledTimes(1);
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    expect(dynamo.tableName).toHaveBeenCalledWith("docs");
    expect(dynamo.ddb.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "docs-table",
          Item: expect.objectContaining({
            pk: "DOC#PROJ-123",
            module: "prefactura",
            objectKey: payload.objectKey,
            uploader: "tester@example.com",
          }),
        }),
      })
    );
  });

  it("rejects requests with invalid module", async () => {
    const badBody = { ...validBody, module: "unknown" };

    const response = (await uploadDocsHandler(
      baseEvent({ body: JSON.stringify(badBody) })
    )) as ApiResult;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/module must be/);
    expect(dynamo.ddb.send).not.toHaveBeenCalled();
  });

  it("fails when request body is missing", async () => {
    const response = (await handler(
      baseEvent({ body: undefined })
    )) as ApiResult;
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/Missing request body/);
  });

  it("returns server error when DynamoDB write fails", async () => {
    dynamo.ddb.send.mockRejectedValue(new Error("ddb failure"));

    const response = (await uploadDocsHandler(
      baseEvent({ body: JSON.stringify(validBody) })
    )) as ApiResult;

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toContain("ddb failure");
  });
});
