import { describe, expect, it, jest } from "@jest/globals";
import { createBaseline, handler } from "../../src/handlers/baseline";
import { ensureCanWrite } from "../../src/lib/auth";

const mockSend = jest.fn();

jest.mock("node:crypto", () => {
  const actual = jest.requireActual("node:crypto");
  return {
    ...actual,
    randomUUID: jest.fn(() => "12345678-1234-1234-1234-123456789abc"),
  };
});

jest.mock("../../src/lib/auth");
jest.mock("../../src/lib/dynamo", () => {
  const PutCommand = jest.fn().mockImplementation((input) => ({ input }));
  return {
    ddb: { send: mockSend },
    PutCommand,
    tableName: jest.fn((name) => `test-${name}`),
  };
});

describe("baseline handler CORS", () => {
  it("returns CORS headers when an auth error is thrown", async () => {
    const ensureCanWriteMock = ensureCanWrite;
    ensureCanWriteMock.mockImplementation(() => {
      const error = new Error("Access denied");
      error.statusCode = 401;
      error.body = "Unauthorized";
      throw error;
    });

    const response = await createBaseline({
      headers: {},
      requestContext: {
        authorizer: { jwt: { claims: {} } },
      },
      body: "{}",
      httpMethod: "POST",
      path: "/baseline",
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers).toBeDefined();
    expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
    expect(response.headers["Access-Control-Allow-Methods"]).toContain("OPTIONS");
  });

  it("handles OPTIONS preflight request without crashing", async () => {
    const response = await handler({
      headers: { Origin: "https://example.com" },
      requestContext: {
        authorizer: { jwt: { claims: {} } },
      },
      httpMethod: "OPTIONS",
      path: "/baseline",
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers).toBeDefined();
    expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
    expect(response.headers["Access-Control-Allow-Methods"]).toBeDefined();
    expect(response.body).toBe("");
  });
});

describe("baseline creation PK/SK invariants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
    const ensureCanWriteMock = ensureCanWrite;
    ensureCanWriteMock.mockResolvedValue(undefined);
  });

  it("generates a unique project_id and protects baseline keys", async () => {
    const response = await createBaseline({
      headers: {},
      requestContext: { authorizer: { jwt: { claims: { email: "tester@example.com" } } } },
      body: JSON.stringify({
        project_name: "Baseline Collision Test",
        labor_estimates: [
          { role: "Dev", hours_per_month: 10, fte_count: 1, hourly_rate: 10, start_month: 1, end_month: 1 },
        ],
        non_labor_estimates: [],
      }),
      httpMethod: "POST",
      path: "/baseline",
    });

    expect(response.statusCode).toBe(201);

    const putCalls = mockSend.mock.calls.map((call) => call[0].input);
    const prefacturaWrite = putCalls.find((c) => c.TableName === "test-prefacturas" && String(c.Item?.pk).startsWith("PROJECT#"));
    const metadataWrite = putCalls.find((c) => c.Item?.pk === `BASELINE#base_123456781234`);

    expect(prefacturaWrite).toBeDefined();
    expect(prefacturaWrite?.Item?.pk).toBe("PROJECT#P-12345678123412341234123456789abc");
    expect(prefacturaWrite?.Item?.sk).toBe("BASELINE#base_123456781234");
    expect(prefacturaWrite?.ConditionExpression).toContain("attribute_not_exists");

    expect(metadataWrite).toBeDefined();
    expect(metadataWrite?.Item?.sk).toBe("METADATA");
    expect(metadataWrite?.ConditionExpression).toContain("attribute_not_exists");
  });
});
