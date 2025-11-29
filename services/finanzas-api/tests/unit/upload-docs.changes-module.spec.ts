process.env.DOCS_BUCKET = process.env.DOCS_BUCKET || "docs-bucket";
process.env.AWS_REGION = process.env.AWS_REGION || "us-east-2";

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler as uploadDocsHandler } from "../../src/handlers/upload-docs";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async () => "https://signed.example/upload"),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({})),
  PutObjectCommand: jest.fn((input) => ({ input })),
}));

jest.mock("../../src/lib/auth", () => ({
  ensureCanWrite: jest.fn(async () => undefined),
  getUserEmail: jest.fn().mockResolvedValue("tester@example.com"),
}));

jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn(async () => undefined) },
  PutCommand: jest.fn((input) => ({ input })),
  tableName: jest.fn(() => "docs-table"),
}));

const ORIGINAL_ENV = { ...process.env };

describe("upload docs handler (changes module)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DOCS_BUCKET = "docs-bucket";
    process.env.AWS_REGION = "us-east-2";
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts changes module payloads using ESM imports", async () => {
    const event = {
      version: "2.0",
      routeKey: "POST /upload-docs",
      rawPath: "/upload-docs",
      rawQueryString: "",
      headers: {},
      requestContext: { http: { method: "POST" } },
      isBase64Encoded: false,
      body: JSON.stringify({
        projectId: "P-123",
        module: "changes",
        contentType: "application/pdf",
        originalName: "change.pdf",
      }),
    } as unknown as APIGatewayProxyEventV2;

    const response = await uploadDocsHandler(event);

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.uploadUrl).toContain("https://signed.example/upload");

    const dynamo = jest.requireMock("../../src/lib/dynamo") as {
      ddb: { send: jest.Mock };
      tableName: jest.Mock;
    };
    expect(dynamo.ddb.send).toHaveBeenCalledTimes(1);
    expect(dynamo.tableName).toHaveBeenCalledWith("docs");
  });
});
