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

  it("reads projects arrays from alternate keys", () => {
    const payload = { projects: [{ id: "P-5" }], results: [{ id: "P-6" }] };

    const result = normalizeProjectsPayload(payload);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { id: "P-5" });
  });

  it("supports DynamoDB-style Items payloads", () => {
    const payload = { Items: [{ id: "P-7" }, { id: "P-8" }] } as any;

    const result = normalizeProjectsPayload(payload);

    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { id: "P-7" });
  });

  it("detects nested payloads under body wrappers", () => {
    const payload = { body: { results: [{ id: "P-9" }] } } as any;

    const result = normalizeProjectsPayload(payload);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { id: "P-9" });
  });

  it("inspects nested data payloads within wrapped objects", () => {
    const payload = { body: { data: { projects: [{ id: "P-10" }] } } } as any;

    const result = normalizeProjectsPayload(payload);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { id: "P-10" });
  });
});
