import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeProjectForUI } from "@/modules/finanzas/projects/normalizeProject";

// Provide a minimal import.meta.env for modules that expect Vite env vars
if (!(globalThis as any).import?.meta?.env) {
  (globalThis as any).import = {
    meta: {
      env: {
        VITE_USE_MOCKS: "true",
        VITE_SKIP_AUTH: "true",
        VITE_API_BASE_URL: "http://localhost",
      },
    },
  } as unknown as ImportMeta;
  (globalThis as any).import.meta = (globalThis as any).import.meta;
}

const baseProject = {
  id: "P-123",
  code: "P-123",
  name: "Project Alpha",
  client: "ACME",
  mod_total: 1000,
  currency: "USD",
};

describe("normalizeProjectForUI", () => {
  it("maps baseline acceptance metadata", () => {
    const normalized = normalizeProjectForUI({
      ...baseProject,
      baseline_id: "base_abc",
      baseline_status: "accepted",
      accepted_by: "owner@example.com",
      baseline_accepted_at: "2024-01-02T00:00:00.000Z",
    });

    assert.equal(normalized.baseline_id, "base_abc");
    assert.equal(normalized.baseline_status, "accepted");
    assert.equal(normalized.accepted_by, "owner@example.com");
    assert.equal(normalized.baseline_accepted_at, "2024-01-02T00:00:00.000Z");
  });

  it("maps baseline_status as 'handed_off' when present", () => {
    const normalized = normalizeProjectForUI({
      ...baseProject,
      baseline_id: "base_xyz",
      baseline_status: "handed_off",
    });

    assert.equal(normalized.baseline_id, "base_xyz");
    assert.equal(normalized.baseline_status, "handed_off");
    assert.equal(normalized.accepted_by, null);
    assert.equal(normalized.baseline_accepted_at, null);
  });

  it("falls back gracefully when acceptance metadata is missing", () => {
    const normalized = normalizeProjectForUI(baseProject);
    assert.equal(normalized.baseline_id, undefined);
    assert.equal(normalized.baseline_status, null);
    assert.equal(normalized.accepted_by, null);
    assert.equal(normalized.baseline_accepted_at, null);
  });
});
