import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { BaselineError } from "@/lib/errors";
import {
  listMockBaselines,
  resetMockBaselines,
} from "@/mocks/baselineStore";
import type { BaselineCreateRequest } from "@/types/domain";

const originalImportMeta = (globalThis as any).import?.meta;
const originalFetch = global.fetch;
const originalLocalStorage = (globalThis as any).localStorage;
const originalSessionStorage = (globalThis as any).sessionStorage;
let ApiService: typeof import("@/lib/api").default;

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  } as Storage;
}

function setUseMocks(value: string) {
  process.env.VITE_USE_MOCKS = value;
  process.env.VITE_SKIP_AUTH = "true";
  (globalThis as any).import = {
    meta: {
      env: {
        VITE_USE_MOCKS: value,
        VITE_API_BASE_URL: "https://example.com",
        VITE_SKIP_AUTH: "true",
        DEV: false,
        MODE: "test",
      },
    },
  } as unknown as ImportMeta;
}

const sampleRequest: BaselineCreateRequest = {
  project_name: "Mock Project",
  project_description: "Test baseline",
  client_name: "Client",
  currency: "USD",
  start_date: "2024-01-01",
  duration_months: 12,
  contract_value: 10000,
  sdm_manager_name: "Laura Gómez",
  assumptions: ["All good"],
  created_by: "tester@example.com",
  labor_estimates: [
    {
      role: "Engineer",
      level: "Senior",
      fte_count: 1,
      hours_per_month: 160,
      start_month: 1,
      end_month: 3,
      hourly_rate: 100,
      on_cost_percentage: 20,
      currency: "USD",
    },
  ],
  non_labor_estimates: [
    {
      category: "Tools",
      description: "Software",
      amount: 500,
      currency: "USD",
      one_time: true,
      capex_flag: false,
    },
  ],
};

describe("ApiService.createBaseline", () => {
  beforeEach(async () => {
    resetMockBaselines();
    setUseMocks("false");
    global.fetch = originalFetch;
    (globalThis as any).localStorage = createMemoryStorage();
    (globalThis as any).sessionStorage = createMemoryStorage();
    process.env.VITE_API_BASE_URL = "https://example.com";
    ApiService = (await import("@/lib/api")).default;
  });

  it("uses mock baseline creation when VITE_USE_MOCKS=true", async () => {
    setUseMocks("true");
    let called = false;
    global.fetch = (async () => {
      called = true;
      throw new Error("fetch should not be called in mock mode");
    }) as any;

    const result = await ApiService.createBaseline(sampleRequest);

    assert.equal(result.baseline_id.startsWith("BL-MOCK"), true);
    assert.equal(called, false);
    assert.equal(listMockBaselines().length, 1);
  });

  it("maps 500 responses to a typed server error", async () => {
    setUseMocks("false");
    global.fetch = (async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: "internal", message: "boom" }),
    })) as any;

    await assert.rejects(ApiService.createBaseline(sampleRequest), (error) => {
      assert.ok(error instanceof BaselineError);
      const typed = error as BaselineError;
      assert.equal(typed.kind, "server");
      assert.equal(typed.httpStatus, 500);
      assert.equal(typed.code, "baseline.create.failed");
      return true;
    });
  });

  it("returns parsed baseline data on success", async () => {
    setUseMocks("false");
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          baseline_id: "BL-123",
          project_id: "PRJ-123",
          signature_hash: "sig-12345",
          total_amount: 1234,
          created_at: "2024-01-01T00:00:00Z",
        }),
    })) as any;

    const result = await ApiService.createBaseline(sampleRequest);
    assert.equal(result.baseline_id, "BL-123");
    assert.equal(result.project_id, "PRJ-123");
  });

  it("sends the service delivery manager name in the payload", async () => {
    setUseMocks("false");
    let capturedBody: any = null;
    global.fetch = (async (_url, init) => {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            baseline_id: "BL-123",
            project_id: "PRJ-123",
            signature_hash: "sig-12345",
            total_amount: 1234,
            created_at: "2024-01-01T00:00:00Z",
          }),
      } as any;
    }) as any;

    await ApiService.createBaseline(sampleRequest);
    assert.equal(capturedBody.sdm_manager_name, "Laura Gómez");
  });
});

after(() => {
  resetMockBaselines();
  if (originalImportMeta) {
    (globalThis as any).import = { meta: originalImportMeta } as any;
  } else {
    delete (globalThis as any).import;
  }
  global.fetch = originalFetch;
  if (originalLocalStorage) {
    (globalThis as any).localStorage = originalLocalStorage;
  } else {
    delete (globalThis as any).localStorage;
  }
  if (originalSessionStorage) {
    (globalThis as any).sessionStorage = originalSessionStorage;
  } else {
    delete (globalThis as any).sessionStorage;
  }
});
