import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { getAuthToken, buildHeaders } from "@/config/api";
import { AuthError } from "@/lib/errors";

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  } satisfies Storage;
};

const localStorageMock = createMemoryStorage();
const sessionStorageMock = createMemoryStorage();
(globalThis as any).window = {
  localStorage: localStorageMock,
  sessionStorage: sessionStorageMock,
};
(globalThis as any).localStorage = localStorageMock;
(globalThis as any).sessionStorage = sessionStorageMock;

function setStorage(key: string, value: string | null) {
  if (value === null) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
}

describe("Finanzas auth token resolution", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("prefers finz_access_token over id tokens", () => {
    setStorage("cv.jwt", "id-token-1");
    setStorage("finz_access_token", "access-token-1");
    assert.equal(getAuthToken(), "access-token-1");
  });

  it("falls back to legacy keys when access token is missing", () => {
    setStorage("idToken", "legacy-id");
    assert.equal(getAuthToken(), "legacy-id");
  });

  it("throws AuthError when headers require auth and token is missing", () => {
    assert.throws(() => buildHeaders(true), AuthError);
  });

  it("omits Authorization when auth skipped", () => {
    const headers = buildHeaders(false);
    assert.equal("Authorization" in headers, false);
  });
});
