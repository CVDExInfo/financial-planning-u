import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

const setMockFetch = (status: number, payload: Record<string, unknown> = {}) => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status,
      statusText: status === 404 ? "Not Found" : status === 405 ? "Method Not Allowed" : "Error",
      headers: { "Content-Type": "application/json" },
    });
};

const setStorageMocks = () => {
  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  } as Storage;
  (globalThis as unknown as { localStorage?: Storage }).localStorage = storage;
  (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage = storage;
};

describe("finanzasClient budget endpoints", () => {
  beforeEach(() => {
    process.env.VITE_API_BASE_URL = "http://example.com";
    process.env.VITE_API_JWT_TOKEN = "test-token";
    setStorageMocks();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    globalThis.fetch = originalFetch;
  });

  it("returns null for 404 budgets endpoints", async () => {
    setMockFetch(404);
    const { finanzasClient } = await import("../finanzasClient");

    const annual = await finanzasClient.getAllInBudget(2026);
    const overview = await finanzasClient.getAllInBudgetOverview(2026);
    const monthly = await finanzasClient.getAllInBudgetMonthly(2026);

    assert.equal(annual, null);
    assert.equal(overview, null);
    assert.equal(monthly, null);
  });

  it("returns null for 405 annual budget endpoint", async () => {
    setMockFetch(405);
    const { finanzasClient } = await import("../finanzasClient");

    const annual = await finanzasClient.getAllInBudget(2027);
    assert.equal(annual, null);
  });

  it("throws for non-404/405 errors", async () => {
    setMockFetch(403);
    const { finanzasClient } = await import("../finanzasClient");

    await assert.rejects(
      () => finanzasClient.getAllInBudget(2028),
      /HTTP 403/
    );
  });
});
