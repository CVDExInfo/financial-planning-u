import { APIGatewayProxyEvent } from "aws-lambda";
import { createBaseline } from "../src/handlers/baseline";
import { handler as optionsHandler } from "../src/handlers/optionsHandler";

jest.mock("../src/lib/auth", () => ({
  ensureCanWrite: jest.fn().mockResolvedValue(undefined),
  ensureCanRead: jest.fn().mockResolvedValue(undefined),
  getUserEmail: jest.fn().mockResolvedValue("tester@example.com"),
}));

jest.mock("../src/lib/dynamo", () => {
  const mockSend = jest.fn();
  return {
    ddb: { send: mockSend },
    tableName: jest.fn(() => "prefacturas"),
    PutCommand: class {
      constructor(public input: unknown) {}
    },
    GetCommand: class {
      constructor(public input: unknown) {}
    },
    ScanCommand: class {
      constructor(public input: unknown) {}
    },
    __mockSend: mockSend,
  };
});

const { __mockSend: sendMock } = jest.requireMock("../src/lib/dynamo") as {
  __mockSend: jest.Mock;
};

describe("CORS headers", () => {
  const origin = "https://d7t9x3j66yd8k.cloudfront.net";

  const baseEvent: Partial<APIGatewayProxyEvent> = {
    headers: { Origin: origin },
    requestContext: { authorizer: { jwt: { claims: {} }, claims: {} } } as never,
  };

  beforeEach(() => {
    process.env.ALLOWED_ORIGIN = origin;
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  it("applies CORS headers on successful baseline responses", async () => {
    const response = await createBaseline({
      ...baseEvent,
      body: JSON.stringify({
        project_name: "Demo Project",
        labor_estimates: [
          {
            hours_per_month: 10,
            fte_count: 1,
            hourly_rate: 50,
            start_month: 1,
            end_month: 1,
          },
        ],
        non_labor_estimates: [],
      }),
    } as APIGatewayProxyEvent);

    expect(response.headers?.["Access-Control-Allow-Origin"]).toBe(origin);
  });

  it("applies CORS headers on baseline validation errors", async () => {
    const response = await createBaseline({
      ...baseEvent,
      body: "not-json",
    } as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(400);
    expect(response.headers?.["Access-Control-Allow-Origin"]).toBe(origin);
  });

  it("returns CORS headers for OPTIONS preflight", async () => {
    const response = await optionsHandler({
      headers: { Origin: origin },
    } as unknown as APIGatewayProxyEvent);

    expect(response.statusCode).toBe(204);
    expect(response.headers?.["Access-Control-Allow-Origin"]).toBe(origin);
  });
});
