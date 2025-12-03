import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { deleteProjectRubro, postProjectRubros } from "../helpers/rubros";

type FetchCall = { url?: string; init?: RequestInit };

const recordedCalls: FetchCall[] = [];

const installBrowserShims = () => {
  (import.meta as any).env = {
    VITE_API_BASE_URL: "https://api.example.com",
    VITE_USE_MOCKS: "false",
    DEV: false,
    PROD: false,
    VITE_API_JWT_TOKEN: "",
  };

  const storage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };

  (globalThis as any).localStorage = storage;
  (globalThis as any).sessionStorage = storage;
};

beforeEach(() => {
  installBrowserShims();
  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    recordedCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => "{}",
    } as Response;
  };
});

afterEach(() => {
  recordedCalls.length = 0;
  delete (globalThis as any).fetch;
});

describe("addProjectRubro", () => {
  it("wraps single rubroId into rubroIds[] entries while preserving fields", async () => {
    await postProjectRubros(
      "P-123",
      {
        rubroId: "R-001",
        qty: 1,
        unitCost: 1250,
        type: "Recurring",
        duration: "M1-M12",
      },
      { apiBase: "https://api.example.com", headers: {} , fetchImpl: (globalThis as any).fetch },
    );

    assert.equal(recordedCalls.length, 1);
    const body = JSON.parse((recordedCalls[0].init?.body as string) ?? "{}");

    assert.deepEqual(
      body.rubroIds,
      [
        {
          rubroId: "R-001",
          qty: 1,
          unitCost: 1250,
          type: "Recurring",
          duration: "M1-M12",
        },
      ],
      "rubroIds should be wrapped in an array of detailed entries",
    );
    assert.ok(!("rubroId" in body), "payload should not include rubroId key");
    assert.match(recordedCalls[0].url ?? "", /\/projects\/P-123\/rubros$/);
  });
});

describe("deleteProjectRubro", () => {
  it("calls DELETE on project rubro and falls back to catalog mount", async () => {
    let callCount = 0;
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      recordedCalls.push({ url, init });
      callCount += 1;
      if (callCount === 1) {
        return { ok: false, status: 404, text: async () => "" } as Response;
      }
      return { ok: true, status: 200, text: async () => "" } as Response;
    };

    await deleteProjectRubro(
      "P-456",
      "R-999",
      { apiBase: "https://api.example.com", headers: {}, fetchImpl: (globalThis as any).fetch },
    );

    assert.equal(recordedCalls.length, 2);
    assert.equal(recordedCalls[0].init?.method, "DELETE");
    assert.match(recordedCalls[0].url ?? "", /\/projects\/P-456\/rubros\/R-999$/);
    assert.match(recordedCalls[1].url ?? "", /\/projects\/P-456\/catalog\/rubros\/R-999$/);
  });
});

