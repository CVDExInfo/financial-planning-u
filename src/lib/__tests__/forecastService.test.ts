import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import type { ForecastCell } from "@/types/domain";

const originalImportMeta = (globalThis as any).import?.meta;
let forecastService: typeof import("@/features/sdmt/cost/Forecast/forecastService");
let ApiService: typeof import("@/lib/api").default;

function setUseMocks(value: string) {
  process.env.VITE_USE_MOCKS = value;
  process.env.VITE_API_BASE_URL = "https://example.com";
  (globalThis as any).import = {
    meta: {
      env: {
        VITE_USE_MOCKS: value,
        VITE_API_BASE_URL: "https://example.com",
        DEV: false,
        MODE: "test",
      },
    },
  } as unknown as ImportMeta;
}

const sampleCell: ForecastCell = {
  line_item_id: "RUBRO#123",
  month: 1,
  planned: 100,
  forecast: 120,
  actual: 0,
  variance: 20,
  last_updated: "",
  updated_by: "tester",
};

describe("forecastService", () => {
  beforeEach(async () => {
    setUseMocks("false");
    forecastService = await import("@/features/sdmt/cost/Forecast/forecastService");
    ApiService = (await import("@/lib/api")).default;
  });

  it("uses mock payloads when VITE_USE_MOCKS=true", async () => {
    setUseMocks("true");
    (ApiService as any).getForecastPayload = async () => {
      throw new Error("API should not be called in mock mode");
    };

    const payload = await forecastService.getForecastPayload("PRJ-MOCK", 12);
    assert.equal(payload.source, "mock");
    assert.ok(payload.data.length > 0);
  });

  it("normalizes API payload when mocks are disabled", async () => {
    setUseMocks("false");
    (ApiService as any).getForecastPayload = async () => ({
      data: [sampleCell],
      projectId: "PRJ-API",
      months: 12,
      generated_at: "2024-01-01T00:00:00Z",
    });

    const payload = await forecastService.getForecastPayload("PRJ-API", 12);
    assert.equal(payload.source, "api");
    assert.equal(payload.data[0].line_item_id, "123");
    assert.equal(payload.generatedAt, "2024-01-01T00:00:00Z");
  });
});

after(() => {
  if (originalImportMeta) {
    (globalThis as any).import = { meta: originalImportMeta } as any;
  }
});
