import { describe, expect, it, jest } from "@jest/globals";
import { createBaseline } from "../../src/handlers/baseline";
import { ensureCanWrite } from "../../src/lib/auth";

jest.mock("../../src/lib/auth");

describe("baseline handler CORS", () => {
  it("returns CORS headers when an auth error is thrown", async () => {
    (ensureCanWrite as jest.Mock).mockImplementation(() => {
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
});
