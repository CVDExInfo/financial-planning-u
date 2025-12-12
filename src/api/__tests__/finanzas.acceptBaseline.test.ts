import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import { acceptBaseline } from "../finanzas";

const originalFetch = global.fetch;

describe("acceptBaseline request contract", () => {
  beforeEach(() => {
    let lastBody: any = undefined;
    // @ts-expect-error - test double for fetch
    global.fetch = async (_url: string, init?: RequestInit) => {
      lastBody = init?.body;
      return {
        ok: true,
        status: 204,
        text: async () => "",
      } as any;
    };

    // expose lastBody for assertions
    (global as any).__lastAcceptBaselineBody = () => lastBody;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (global as any).__lastAcceptBaselineBody;
  });

  it("omits baseline_id from the payload", async () => {
    await acceptBaseline("P-123", {
      baseline_id: "BL-123",
      accepted_by: "tester@example.com",
    });

    const body = (global as any).__lastAcceptBaselineBody?.();
    assert.equal(typeof body, "string");
    const parsed = JSON.parse(body as string);
    assert.deepEqual(parsed, { accepted_by: "tester@example.com" });
  });

  it("sends no body when no audit fields are provided", async () => {
    await acceptBaseline("P-456");

    const body = (global as any).__lastAcceptBaselineBody?.();
    assert.equal(body, undefined);
  });
});
