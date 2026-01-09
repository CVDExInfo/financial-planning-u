import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import httpClient, { HttpError } from "@/lib/http-client";
import { finanzasClient } from "@/api/finanzasClient";

const mockStorage = {
  getItem: (_key: string) => "token",
  setItem: (_key: string, _value: string) => undefined,
  removeItem: (_key: string) => undefined,
};

describe("finanzasClient budget 404 gating", () => {
  let originalGet: typeof httpClient.get;

  beforeEach(() => {
    originalGet = httpClient.get.bind(httpClient);
    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).sessionStorage = mockStorage;
  });

  afterEach(() => {
    (httpClient as any).get = originalGet;
  });

  it("returns null for annual all-in budget on 404", async () => {
    (httpClient as any).get = async () => {
      throw new HttpError(404, "Not Found", "");
    };

    const result = await finanzasClient.getAllInBudget(2025);
    assert.equal(result, null);
  });

  it("returns null for budget overview on 404", async () => {
    (httpClient as any).get = async () => {
      throw new HttpError(404, "Not Found", "");
    };

    const result = await finanzasClient.getAllInBudgetOverview(2025);
    assert.equal(result, null);
  });

  it("returns null for monthly budgets on 404", async () => {
    (httpClient as any).get = async () => {
      throw new HttpError(404, "Not Found", "");
    };

    const result = await finanzasClient.getAllInBudgetMonthly(2025);
    assert.equal(result, null);
  });
});
