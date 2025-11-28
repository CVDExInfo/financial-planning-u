import { handler } from "../src/handlers/projects";
import { ddb } from "../src/lib/dynamo";
import { ensureCanWrite } from "../src/lib/auth";

type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> };

type ApiEvent = Mutable<Parameters<typeof handler>[0]>;

jest.mock("../src/lib/auth", () => ({
  ensureCanWrite: jest.fn(async () => undefined),
  ensureCanRead: jest.fn(async () => undefined),
}));

jest.mock("../src/lib/dynamo", () => {
  const actual = jest.requireActual("../src/lib/dynamo");
  return {
    ...actual,
    ddb: { send: jest.fn() },
    tableName: jest.fn((key: string) => `test-${key}`),
  };
});

const mockDdbSend = ddb.send as jest.Mock;
const mockEnsureCanWrite = ensureCanWrite as jest.Mock;

describe("projects handler POST", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
    mockEnsureCanWrite.mockClear();
  });

  const baseEvent: ApiEvent = {
    version: "2.0",
    routeKey: "POST /projects",
    rawPath: "/projects",
    rawQueryString: "",
    headers: { authorization: "Bearer fake" },
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "POST",
        path: "/projects",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
      requestId: "id",
      routeKey: "POST /projects",
      stage: "$default",
      time: "",
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
    body: "",
  } as any;

  it("accepts the UI payload, normalizes it, and writes to Dynamo + audit log", async () => {
    mockDdbSend.mockResolvedValue({});

    const payload = {
      name: "Proyecto Demo",
      code: "PROJ-2025-001",
      client: "Cliente Uno",
      start_date: "2025-01-15",
      end_date: "2025-06-30",
      currency: "USD",
      mod_total: "125000.50",
      description: "Proyecto de prueba",
    };

    const response = await handler({
      ...baseEvent,
      body: JSON.stringify(payload),
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.name).toBe(payload.name);
    expect(body.client).toBe(payload.client);
    expect(body.mod_total).toBeCloseTo(125000.5);
    expect(body.codigo || body.code).toBe(payload.code);
    expect(mockDdbSend).toHaveBeenCalledTimes(2);
  });

  it("returns a 422 with validation details for invalid payloads instead of a 500", async () => {
    mockDdbSend.mockResolvedValue({});

    const invalidPayload = {
      name: "",
      code: "BAD",
      client: "",
      start_date: "2025-04-01",
      end_date: "2025-03-01", // end before start
      currency: "USD",
      mod_total: -5,
    };

    const response = await handler({
      ...baseEvent,
      body: JSON.stringify(invalidPayload),
    });

    expect(response.statusCode).toBe(422);
    const parsed = JSON.parse(response.body);
    expect(parsed.error).toMatch(/end_date|mod_total|code/i);
    expect(mockDdbSend).not.toHaveBeenCalled();
  });

  it("returns a 500 when DynamoDB rejects the write (e.g., IAM/AccessDenied)", async () => {
    mockDdbSend.mockRejectedValueOnce(Object.assign(new Error("AccessDenied"), {
      name: "AccessDeniedException",
    }));

    const payload = {
      name: "Proyecto Demo",
      code: "PROJ-2025-001",
      client: "Cliente Uno",
      start_date: "2025-01-15",
      end_date: "2025-06-30",
      currency: "USD",
      mod_total: "125000.50",
      description: "Proyecto de prueba",
    };

    const response = await handler({
      ...baseEvent,
      body: JSON.stringify(payload),
    });

    expect(response.statusCode).toBe(500);
    const parsed = JSON.parse(response.body);
    expect(parsed.error).toMatch(/internal server error/i);
    expect(mockDdbSend).toHaveBeenCalledTimes(1);
  });
});
