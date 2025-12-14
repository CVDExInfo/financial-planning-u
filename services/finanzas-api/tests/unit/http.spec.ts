/**
 * Unit tests for HTTP response utilities
 * Tests that all responses include proper CORS headers
 */

import {
  ok,
  bad,
  serverError,
  notFound,
  unauthorized,
  noContent,
  defaultCorsHeaders,
} from "../../src/lib/http";

describe("HTTP Response Utilities - CORS Headers", () => {
  const origin = "https://d7t9x3j66yd8k.cloudfront.net";
  const event = { headers: { Origin: origin } } as unknown;

  beforeEach(() => {
    process.env.ALLOWED_ORIGIN = origin;
    delete process.env.ALLOW_CREDENTIALS;
  });

  it("should build default CORS headers with request origin", () => {
    const headers = defaultCorsHeaders(event as never);
    expect(headers["Access-Control-Allow-Origin"]).toBe(origin);
    expect(headers.Vary).toBe("Origin");
    expect(headers["Access-Control-Allow-Methods"]).toContain("OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toContain("X-Idempotency-Key");
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
    expect(headers).not.toHaveProperty("Access-Control-Allow-Credentials");
  });

  const expectedHeaders = () => defaultCorsHeaders(event as never);

  describe("ok()", () => {
    it("should return 200 with CORS headers", () => {
      const response = ok(event as never, { message: "test" });
      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual(expectedHeaders());
      expect(JSON.parse(response.body)).toEqual({ message: "test" });
    });

    it("should accept custom status code", () => {
      const response = ok(event as never, { id: "123" }, 201);
      expect(response.statusCode).toBe(201);
      expect(response.headers).toEqual(expectedHeaders());
    });
  });

  describe("bad()", () => {
    it("should return 400 with CORS headers", () => {
      const response = bad(event as never, "Invalid request");
      expect(response.statusCode).toBe(400);
      expect(response.headers).toEqual(expectedHeaders());
      expect(JSON.parse(response.body)).toEqual({ error: "Invalid request" });
    });

    it("should accept custom status code", () => {
      const response = bad(event as never, "Validation failed", 422);
      expect(response.statusCode).toBe(422);
      expect(response.headers).toEqual(expectedHeaders());
    });

    it("should accept error object", () => {
      const response = bad(event as never, { error: "test", code: "ERR_001" });
      expect(JSON.parse(response.body)).toEqual({ error: "test", code: "ERR_001" });
    });
  });

  describe("serverError()", () => {
    it("should return 500 with CORS headers", () => {
      const response = serverError(event as never);
      expect(response.statusCode).toBe(500);
      expect(response.headers).toEqual(expectedHeaders());
      expect(JSON.parse(response.body)).toEqual({ error: "Internal server error" });
    });

    it("should accept custom message", () => {
      const response = serverError(event as never, "Database connection failed");
      expect(JSON.parse(response.body)).toEqual({ error: "Database connection failed" });
    });
  });

  describe("notFound()", () => {
    it("should return 404 with CORS headers", () => {
      const response = notFound(event as never);
      expect(response.statusCode).toBe(404);
      expect(response.headers).toEqual(expectedHeaders());
      expect(JSON.parse(response.body)).toEqual({ error: "Resource not found" });
    });

    it("should accept custom message", () => {
      const response = notFound(event as never, "Project not found");
      expect(JSON.parse(response.body)).toEqual({ error: "Project not found" });
    });
  });

  describe("unauthorized()", () => {
    it("should return 401 with CORS headers", () => {
      const response = unauthorized(event as never);
      expect(response.statusCode).toBe(401);
      expect(response.headers).toEqual(expectedHeaders());
      expect(JSON.parse(response.body)).toEqual({ error: "Unauthorized" });
    });

    it("should accept custom message", () => {
      const response = unauthorized(event as never, "Token expired");
      expect(JSON.parse(response.body)).toEqual({ error: "Token expired" });
    });
  });

  describe("noContent()", () => {
    it("should return 204 with CORS headers", () => {
      const response = noContent(event as never);
      expect(response.statusCode).toBe(204);
      expect(response.headers).toEqual(expectedHeaders());
      expect(response.body).toBe("");
    });

    it("should accept custom status code", () => {
      const response = noContent(event as never, 200);
      expect(response.statusCode).toBe(200);
    });
  });

  describe("CORS headers consistency", () => {
    it("all response functions should return identical CORS headers", () => {
      const headers = expectedHeaders();
      const responses = [
        ok(event as never, { test: true }),
        bad(event as never, "error"),
        serverError(event as never),
        notFound(event as never),
        unauthorized(event as never),
        noContent(event as never),
      ];

      responses.forEach((response) => {
        expect(response.headers).toEqual(headers);
      });
    });

    it("CORS headers should be present on every response", () => {
      const responses = [
        ok(event as never, { test: true }),
        bad(event as never, "error"),
        serverError(event as never),
        notFound(event as never),
        unauthorized(event as never),
        noContent(event as never),
      ];

      responses.forEach((response) => {
        expect(response.headers).toHaveProperty("Access-Control-Allow-Origin");
        expect(response.headers).toHaveProperty("Access-Control-Allow-Methods");
        expect(response.headers).toHaveProperty("Access-Control-Allow-Headers");
        expect(response.headers).toHaveProperty("Access-Control-Max-Age");
      });
    });
  });
});
