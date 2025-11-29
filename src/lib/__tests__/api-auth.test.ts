import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getAuthToken, buildHeaders } from "@/config/api";
import { AuthError } from "@/lib/errors";

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
    expect(getAuthToken()).toBe("access-token-1");
  });

  it("falls back to legacy keys when access token is missing", () => {
    setStorage("idToken", "legacy-id");
    expect(getAuthToken()).toBe("legacy-id");
  });

  it("throws AuthError when headers require auth and token is missing", () => {
    expect(() => buildHeaders(true)).toThrow(AuthError);
  });

  it("omits Authorization when auth skipped", () => {
    const headers = buildHeaders(false);
    expect(headers).not.toHaveProperty("Authorization");
  });
});
