import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.VITE_API_BASE_URL ||= "http://localhost";
process.env.VITE_SKIP_AUTH = "true";

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

// Polyfill localStorage for auth helpers invoked by the API client
// @ts-expect-error - Node test environment shim
global.localStorage = global.localStorage || noopStorage;
// @ts-expect-error - Node test environment shim
global.sessionStorage = global.sessionStorage || noopStorage;

const { default: ApiService } = await import("../api");
import type { ForecastCell } from "@/types/domain";

const cells: ForecastCell[] = [
  {
    line_item_id: "LI-1",
    month: 1,
    planned: 10,
    forecast: 12,
    actual: 8,
    variance: -4,
    last_updated: "2024-01-01T00:00:00Z",
    updated_by: "tester@example.com",
  },
  {
    line_item_id: "LI-2",
    month: 2,
    planned: 15,
    forecast: 16,
    actual: 14,
    variance: -2,
    last_updated: "2024-01-02T00:00:00Z",
    updated_by: "tester@example.com",
  },
];

describe("ApiService.fetchForecastPayload coercion", () => {
  const originalRequest = (ApiService as any).request;
  const originalDelay = (ApiService as any).delay;

  beforeEach(() => {
    (ApiService as any).delay = async () => {};
  });

  afterEach(() => {
    (ApiService as any).request = originalRequest;
    (ApiService as any).delay = originalDelay;
  });

  const callWithPayload = async (payload: unknown) => {
    (ApiService as any).request = async () => payload;
    const result = await (ApiService as any).fetchForecastPayload("P-UNIT", 6);
    return result;
  };

  it("coerces forecast cells across the supported envelope shapes", async () => {
    const shapes: unknown[] = [
      cells,
      { data: cells },
      { items: cells },
      { data: { items: cells } },
      { data: { data: cells } },
    ];

    for (const payload of shapes) {
      const result = await callWithPayload(payload);
      assert.equal(result.data.length, cells.length, `shape ${JSON.stringify(payload)}`);
      assert.deepEqual(result.data, cells);
      assert.equal(result.projectId, "P-UNIT");
      assert.equal(result.months, 6);
      assert.ok(result.generated_at);
    }
  });

  it("respects months returned by the API when present", async () => {
    const result = await callWithPayload({ data: cells, months: 24 });
    assert.equal(result.months, 24);
  });
});
