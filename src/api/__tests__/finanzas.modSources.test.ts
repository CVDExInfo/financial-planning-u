process.env.VITE_API_BASE_URL = "https://api.test";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

let finanzas: typeof import("../finanzas");
let originalFetch: any;

const buildFetchResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

beforeEach(async () => {
  originalFetch = global.fetch;
  finanzas = await import("../finanzas");
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("finanzas MOD source clients", () => {
  it("validates array responses and accepts wrapped arrays", async () => {
    // Test that wrapped response {data: []} is now accepted
    global.fetch = (async () => buildFetchResponse({ data: [{ month: "2025-01" }] })) as any;

    const rows = await finanzas.getPayroll("P-TEST");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { month: "2025-01" });
  });

  it("validates array responses and accepts bare arrays", async () => {
    // Test that bare array [] is accepted
    global.fetch = (async () => buildFetchResponse([{ month: "2025-01" }])) as any;

    const rows = await finanzas.getPayroll("P-TEST");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { month: "2025-01" });
  });

  it("gracefully handles non-array responses by returning empty array", async () => {
    let capturedUrl = "";
    global.fetch = (async (url: string) => {
      capturedUrl = url;
      return buildFetchResponse({ not: "an array" });
    }) as any;

    const rows = await finanzas.getPayroll("P-TEST");
    assert.equal(rows.length, 0);
    assert.ok(capturedUrl.includes("projectId=P-TEST"));
    assert.ok(capturedUrl.includes("project_id=P-TEST"));
  });

  it("returns parsed arrays for adjustments", async () => {
    global.fetch = (async () => buildFetchResponse([{ month: "2025-01" }])) as any;

    const rows = await finanzas.getAdjustments("P-TEST");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { month: "2025-01" });
  });

  it("supports baseline without project id parameter", async () => {
    let capturedUrl = "";
    global.fetch = (async (url: string) => {
      capturedUrl = url;
      return buildFetchResponse([]);
    }) as any;

    await finanzas.getBaseline();
    assert.ok(!capturedUrl.includes("projectId="));
  });
});
