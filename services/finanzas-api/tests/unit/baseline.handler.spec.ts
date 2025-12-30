import { describe, expect, it, jest } from "@jest/globals";
import { createBaseline, handler } from "../../src/handlers/baseline";
import * as auth from "../../src/lib/auth";
import * as dynamo from "../../src/lib/dynamo";
import * as queue from "../../src/lib/queue";
import * as seedLineItems from "../../src/lib/seed-line-items";

jest.mock("../../src/lib/auth");
jest.mock("../../src/lib/dynamo", () => ({
  ddb: {
    send: jest.fn(),
  },
  sendDdb: jest.fn(),
  tableName: jest.fn((table: string) => `test_${table}`),
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetCommand: jest.fn().mockImplementation((input) => ({ input })),
  ScanCommand: jest.fn().mockImplementation((input) => ({ input })),
}));
jest.mock("../../src/lib/queue", () => ({
  enqueueMaterialization: jest.fn(),
jest.mock("../../src/lib/seed-line-items", () => ({
  seedLineItemsFromBaseline: jest.fn(),
}));

describe("baseline handler CORS", () => {
  it("returns CORS headers when an auth error is thrown", async () => {
    (auth.ensureCanWrite as jest.Mock).mockImplementation(() => {
      const error = new Error("Access denied") as Error & {
        statusCode?: number;
        body?: string;
      };
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
    } as any);

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
    } as any);

    expect(response.statusCode).toBe(204);
    expect(response.headers).toBeDefined();
    expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
    expect(response.headers["Access-Control-Allow-Methods"]).toBeDefined();
    expect(response.body).toBe("");
  });

  it("creates baseline and includes seeding result", async () => {
    (auth.ensureCanWrite as jest.Mock).mockResolvedValue(undefined);
    (auth.getUserEmail as jest.Mock).mockResolvedValue("test@example.com");
    (dynamo.ddb.send as jest.Mock).mockResolvedValue({});
    (queue.enqueueMaterialization as jest.Mock).mockResolvedValue(undefined);
    (dynamo.sendDdb as jest.Mock).mockResolvedValue({});
    (seedLineItems.seedLineItemsFromBaseline as jest.Mock).mockResolvedValue({
      seeded: 2,
      skipped: false,
    });

    const response = await createBaseline({
      headers: { "Content-Type": "application/json" },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      httpMethod: "POST",
      path: "/baseline",
      body: JSON.stringify({
        project_name: "Seeded Baseline",
        labor_estimates: [
          {
            role: "Ingeniero Delivery",
            hours_per_month: 160,
            fte_count: 1,
            hourly_rate: 20,
            start_month: 1,
            end_month: 12,
          },
        ],
        non_labor_estimates: [],
      }),
    } as any);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body as string);
    expect(body.seeded).toBe(0);
    expect(body.seedQueued).toBe(true);
    expect(queue.enqueueMaterialization).toHaveBeenCalled();
    expect(seedLineItems.seedLineItemsFromBaseline).toHaveBeenCalled();
  });
});
