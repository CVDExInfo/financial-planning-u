/**
 * Integration tests for invoices endpoints
 * Tests invoice creation, retrieval, and canonical rubro mapping
 */

import { handler } from "../../src/handlers/invoices/app";
import { ddb } from "../../src/lib/dynamo";
import { getUserEmail } from "../../src/lib/auth";

type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> };
type ApiEvent = Mutable<Parameters<typeof handler>[0]>;

jest.mock("../../src/lib/auth", () => ({
  ensureCanRead: jest.fn(async () => undefined),
  ensureCanWrite: jest.fn(async () => undefined),
  getUserEmail: jest.fn(async () => "test-user@example.com"),
}));

jest.mock("../../src/lib/dynamo", () => {
  const actual = jest.requireActual("../../src/lib/dynamo");
  const sendDdb = jest.fn();
  return {
    ...actual,
    sendDdb,
    ddb: { send: sendDdb },
    tableName: jest.fn((key: string) => `test-${key}`),
  };
});

const mockDdbSend = ddb.send as jest.Mock;
const mockGetUserEmail = getUserEmail as jest.Mock;

describe("invoices handler - POST /projects/:projectId/invoices", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
    mockGetUserEmail.mockClear();
  });

  const projectId = "P-7f40767d-ac59-45ef-9aad-132a968a29a5";

  const basePostEvent: ApiEvent = {
    version: "2.0",
    routeKey: "POST /projects/{projectId}/invoices",
    rawPath: `/projects/${projectId}/invoices`,
    rawQueryString: "",
    headers: {
      authorization: "Bearer fake",
      "content-type": "application/json",
    },
    pathParameters: { projectId },
    body: JSON.stringify({
      projectId,
      lineItemId: "MOD-LEAD",
      amount: 100000,
      month: 10,
      vendor: "__other__",
      invoiceNumber: "PRL - No aplica",
      invoiceDate: "2026-01-01T00:00:00.000Z",
      documentKey: "docs/invoice-123.pdf",
      originalName: "Project Baseline Budget_123.pdf",
      contentType: "application/pdf",
    }),
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "POST",
        path: `/projects/${projectId}/invoices`,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "test-request-id",
      routeKey: "POST /projects/{projectId}/invoices",
      stage: "$default",
      time: "",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  } as any;

  it("should create invoice with valid canonical rubro ID", async () => {
    // Mock lineItemId validation - check that rubro exists in project
    mockDdbSend.mockResolvedValueOnce({
      Item: {
        pk: `PROJECT#${projectId}`,
        sk: "RUBRO#MOD-LEAD",
        linea_codigo: "MOD-LEAD",
        descripcion: "Lead Engineer",
      },
    });

    // Mock invoice creation
    mockDdbSend.mockResolvedValueOnce({});

    const result = await handler(basePostEvent);

    expect(result.statusCode).toBe(201);

    const body = JSON.parse(result.body!);

    // Verify invoice was created with correct fields including rubro_canonical
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("project_id", projectId);
    expect(body).toHaveProperty("line_item_id", "MOD-LEAD");
    expect(body).toHaveProperty("amount", 100000);
    expect(body).toHaveProperty("month", 10);
    expect(body).toHaveProperty("vendor", "__other__");
    expect(body).toHaveProperty("status", "Pending");

    // Verify DynamoDB was called to validate lineItemId
    expect(mockDdbSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "test-rubros",
          Key: {
            pk: `PROJECT#${projectId}`,
            sk: "RUBRO#MOD-LEAD",
          },
        }),
      })
    );

    // Verify DynamoDB was called to create invoice with rubro_canonical
    expect(mockDdbSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "test-prefacturas",
          Item: expect.objectContaining({
            pk: `PROJECT#${projectId}`,
            lineItemId: "MOD-LEAD",
            rubro_canonical: expect.any(String), // Should be computed from lineItemId
            amount: 100000,
            month: 10,
            status: "Pending",
          }),
        }),
      })
    );
  });

  it("should return 400 when lineItemId not found in project rubros", async () => {
    // Mock lineItemId validation - rubro doesn't exist
    mockDdbSend.mockResolvedValueOnce({
      Item: undefined,
    });

    const result = await handler(basePostEvent);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("lineItemId not found for project");
  });

  it("should accept and store rubro_canonical when provided in request", async () => {
    // Create event with explicit rubro_canonical
    const eventWithRubroCanonical: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify({
        projectId,
        lineItemId: "MOD-LEAD",
        rubro_canonical: "MOD-LEAD", // Explicit canonical ID
        amount: 100000,
        month: 10,
        vendor: "__other__",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01T00:00:00.000Z",
      }),
    };

    // Mock lineItemId validation
    mockDdbSend.mockResolvedValueOnce({
      Item: {
        pk: `PROJECT#${projectId}`,
        sk: "RUBRO#MOD-LEAD",
        linea_codigo: "MOD-LEAD",
      },
    });

    // Mock invoice creation
    mockDdbSend.mockResolvedValueOnce({});

    const result = await handler(eventWithRubroCanonical);

    expect(result.statusCode).toBe(201);

    // Verify rubro_canonical was stored
    expect(mockDdbSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "test-prefacturas",
          Item: expect.objectContaining({
            lineItemId: "MOD-LEAD",
            rubro_canonical: "MOD-LEAD", // Should match provided value
          }),
        }),
      })
    );
  });

  it("should return 400 for missing required field: projectId", async () => {
    const eventWithoutProjectId: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify({
        lineItemId: "MOD-LEAD",
        amount: 100000,
        month: 10,
      }),
    };

    const result = await handler(eventWithoutProjectId);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("projectId is required");
  });

  it("should return 400 for missing required field: lineItemId", async () => {
    const eventWithoutLineItemId: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify({
        projectId,
        amount: 100000,
        month: 10,
      }),
    };

    const result = await handler(eventWithoutLineItemId);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("lineItemId is required");
  });

  it("should return 400 for invalid month (< 1)", async () => {
    const eventWithInvalidMonth: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify({
        projectId,
        lineItemId: "MOD-LEAD",
        amount: 100000,
        month: 0,
      }),
    };

    const result = await handler(eventWithInvalidMonth);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("month must be an integer between 1 and 12");
  });

  it("should return 400 for invalid month (> 12)", async () => {
    const eventWithInvalidMonth: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify({
        projectId,
        lineItemId: "MOD-LEAD",
        amount: 100000,
        month: 13,
      }),
    };

    const result = await handler(eventWithInvalidMonth);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("month must be an integer between 1 and 12");
  });

  it("should return 400 for invalid amount (negative)", async () => {
    const eventWithNegativeAmount: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify({
        projectId,
        lineItemId: "MOD-LEAD",
        amount: -1000,
        month: 10,
      }),
    };

    const result = await handler(eventWithNegativeAmount);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("amount must be a positive number");
  });

  it("should return 400 for invalid amount (zero)", async () => {
    const eventWithZeroAmount: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify({
        projectId,
        lineItemId: "MOD-LEAD",
        amount: 0,
        month: 10,
      }),
    };

    const result = await handler(eventWithZeroAmount);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("amount must be a positive number");
  });

  it("should return 400 for projectId mismatch between path and body", async () => {
    const eventWithMismatchedProjectId: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify({
        projectId: "DIFFERENT-PROJECT-ID",
        lineItemId: "MOD-LEAD",
        amount: 100000,
        month: 10,
      }),
    };

    const result = await handler(eventWithMismatchedProjectId);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body!);
    expect(body.error || body.message).toContain("projectId mismatch");
  });

  it("should handle duplicate lineItemId field in payload (use last occurrence per JSON.parse)", async () => {
    // This tests the scenario from the problem statement where the payload
    // had duplicate lineItemId fields. We simulate this using a JSON string
    // that contains the same key twice; when parsed, the last occurrence wins.
    const duplicatePayloadJson = `
      {
        "projectId": "${projectId}",
        "lineItemId": "mod-lead",
        "amount": 100000,
        "contentType": "application/pdf",
        "documentKey": "docs/invoice.pdf",
        "invoiceDate": "2026-01-01T00:00:00.000Z",
        "invoiceNumber": "PRL - No aplica",
        "lineItemId": "MOD-LEAD",
        "month": 10,
        "originalName": "Project Baseline Budget.pdf",
        "vendor": "__other__"
      }
    `;

    const duplicatePayload = JSON.parse(duplicatePayloadJson);

    // JSON.parse will only keep the last occurrence
    const parsed = JSON.parse(JSON.stringify(duplicatePayload));
    expect(parsed.lineItemId).toBe("MOD-LEAD");

    // Mock lineItemId validation
    mockDdbSend.mockResolvedValueOnce({
      Item: {
        pk: `PROJECT#${projectId}`,
        sk: "RUBRO#MOD-LEAD",
        linea_codigo: "MOD-LEAD",
      },
    });

    // Mock invoice creation
    mockDdbSend.mockResolvedValueOnce({});

    const eventWithDuplicateField: ApiEvent = {
      ...basePostEvent,
      body: JSON.stringify(duplicatePayload),
    };

    const result = await handler(eventWithDuplicateField);

    // Should succeed with the last occurrence value
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body!);
    expect(body.line_item_id).toBe("MOD-LEAD");
  });
});

describe("invoices handler - GET /projects/:projectId/invoices", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
    mockGetUserEmail.mockClear();
  });

  const projectId = "P-7f40767d-ac59-45ef-9aad-132a968a29a5";

  const baseGetEvent: ApiEvent = {
    version: "2.0",
    routeKey: "GET /projects/{projectId}/invoices",
    rawPath: `/projects/${projectId}/invoices`,
    rawQueryString: "",
    headers: { authorization: "Bearer fake" },
    pathParameters: { projectId },
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: `/projects/${projectId}/invoices`,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "test-request-id",
      routeKey: "GET /projects/{projectId}/invoices",
      stage: "$default",
      time: "",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  } as any;

  it("should return empty list when no invoices exist for project", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [],
      Count: 0,
    });

    const result = await handler(baseGetEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body!);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.projectId).toBe(projectId);
  });

  it("should return invoices with normalized fields", async () => {
    const mockInvoices = [
      {
        pk: `PROJECT#${projectId}`,
        sk: "INVOICE#INV-123",
        invoiceId: "INV-123",
        projectId,
        lineItemId: "MOD-LEAD",
        amount: 100000,
        month: 10,
        status: "Pending",
        vendor: "__other__",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01T00:00:00.000Z",
        uploaded_by: "test@example.com",
        uploaded_at: "2026-01-01T10:00:00.000Z",
      },
      {
        pk: `PROJECT#${projectId}`,
        sk: "INVOICE#INV-456",
        invoiceId: "INV-456",
        projectId,
        lineItemId: "MOD-ING",
        amount: 50000,
        month: 11,
        status: "Matched",
        vendor: "Acme Corp",
        invoiceNumber: "INV-002",
        invoiceDate: "2026-02-01T00:00:00.000Z",
        uploaded_by: "test@example.com",
        uploaded_at: "2026-02-01T10:00:00.000Z",
      },
    ];

    mockDdbSend.mockResolvedValueOnce({
      Items: mockInvoices,
      Count: mockInvoices.length,
    });

    const result = await handler(baseGetEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body!);

    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);

    // Verify first invoice
    expect(body.data[0]).toMatchObject({
      id: "INV-123",
      project_id: projectId,
      line_item_id: "MOD-LEAD",
      amount: 100000,
      month: 10,
      status: "Pending",
      vendor: "__other__",
    });

    // Verify second invoice
    expect(body.data[1]).toMatchObject({
      id: "INV-456",
      project_id: projectId,
      line_item_id: "MOD-ING",
      amount: 50000,
      month: 11,
      status: "Matched",
      vendor: "Acme Corp",
    });
  });
});
