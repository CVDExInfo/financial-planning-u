import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeProjectsPayload } from "../finanzas-projects-helpers";

describe("normalizeProjectsPayload", () => {
  it("returns array contents from data wrapper", () => {
    const payload = { data: [{ id: "P-1" }, { id: "P-2" }] };

    const result = normalizeProjectsPayload(payload);

    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { id: "P-1" });
  });

  it("handles plain array responses", () => {
    const payload = [{ id: "P-3" }];

    const result = normalizeProjectsPayload(payload);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { id: "P-3" });
  });

  it("pulls nested items arrays when present", () => {
    const payload = { data: { items: [{ id: "P-4" }] } as any } as any;

    const result = normalizeProjectsPayload(payload);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { id: "P-4" });
  });

  it("preserves large project lists without trimming", () => {
    const payload = Array.from({ length: 120 }).map((_, idx) => ({ id: `P-${idx + 1}` }));

    const result = normalizeProjectsPayload(payload);

    assert.equal(result.length, 120);
    assert.equal(result[0].id, "P-1");
    assert.equal(result[119].id, "P-120");
  });
});
