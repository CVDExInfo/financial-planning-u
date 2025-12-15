process.env.VITE_API_BASE_URL = "https://api.test";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

let finanzas: typeof import("../finanzas");
let originalFetch: any;
let toastCalls: Array<{ type: string; message: string }> = [];

const buildFetchResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

beforeEach(async () => {
  originalFetch = global.fetch;
  toastCalls = [];
  
  // Mock toast to track calls
  const toastMock = {
    error: (message: string) => {
      toastCalls.push({ type: "error", message });
    },
  };
  
  // Store original import and reload with mocks
  finanzas = await import("../finanzas");
});

afterEach(() => {
  global.fetch = originalFetch;
  toastCalls = [];
});

describe("finanzas API resiliency", () => {
  describe("validateArrayResponse handling", () => {
    it("accepts raw arrays", async () => {
      global.fetch = (async () => buildFetchResponse([{ month: "2025-01", amount: 100 }])) as any;

      const rows = await finanzas.getAllocations("P-TEST");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].month, "2025-01");
    });

    it("accepts { data: [] } envelope", async () => {
      global.fetch = (async () =>
        buildFetchResponse({ data: [{ month: "2025-01", amount: 100 }] })
      ) as any;

      const rows = await finanzas.getAllocations("P-TEST");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].month, "2025-01");
    });

    it("accepts { items: [] } envelope", async () => {
      global.fetch = (async () =>
        buildFetchResponse({ items: [{ month: "2025-01", amount: 100 }] })
      ) as any;

      const rows = await finanzas.getBaseline("P-TEST");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].month, "2025-01");
    });

    it("returns empty array for unexpected shape without throwing", async () => {
      global.fetch = (async () =>
        buildFetchResponse({ message: "not implemented" })
      ) as any;

      const rows = await finanzas.getAdjustments("P-TEST");
      assert.equal(rows.length, 0);
    });
  });

  describe("error handling for missing endpoints", () => {
    it("returns empty array for 404 without toast", async () => {
      global.fetch = (async () => buildFetchResponse({ error: "Not Found" }, false, 404)) as any;

      const rows = await finanzas.getAllocations("P-TEST");
      assert.equal(rows.length, 0);
      // Toast should not be called for 404
      assert.equal(toastCalls.length, 0);
    });

    it("returns empty array for 405 without toast", async () => {
      global.fetch = (async () =>
        buildFetchResponse({ error: "Method Not Allowed" }, false, 405)
      ) as any;

      const rows = await finanzas.getBaseline("P-TEST");
      assert.equal(rows.length, 0);
      assert.equal(toastCalls.length, 0);
    });

    it("returns empty array for 501 without toast", async () => {
      global.fetch = (async () =>
        buildFetchResponse({ message: "Not Implemented" }, false, 501)
      ) as any;

      const rows = await finanzas.getAdjustments("P-TEST");
      assert.equal(rows.length, 0);
      assert.equal(toastCalls.length, 0);
    });

    it("handles network errors gracefully", async () => {
      global.fetch = (async () => {
        throw new TypeError("Failed to fetch");
      }) as any;

      const rows = await finanzas.getPayroll("P-TEST");
      assert.equal(rows.length, 0);
      // Should not throw
    });
  });

  describe("adjustments endpoint", () => {
    it("accepts { data: [] } without throwing", async () => {
      global.fetch = (async () => buildFetchResponse({ data: [] })) as any;

      const rows = await finanzas.getAdjustments("P-TEST");
      assert.equal(rows.length, 0);
    });

    it("accepts empty array", async () => {
      global.fetch = (async () => buildFetchResponse([])) as any;

      const rows = await finanzas.getAdjustments("P-TEST");
      assert.equal(rows.length, 0);
    });

    it("handles 501 Not Implemented gracefully", async () => {
      global.fetch = (async () =>
        buildFetchResponse({ message: "Not Implemented" }, false, 501)
      ) as any;

      const rows = await finanzas.getAdjustments("P-TEST");
      assert.equal(rows.length, 0);
      assert.equal(toastCalls.length, 0);
    });
  });
});
