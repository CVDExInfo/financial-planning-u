import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AuthError } from "@/lib/errors";
import { loadProvidersWithHandler } from "@/modules/finanzas/providers.helpers";

describe("Providers auth handling", () => {
  it("routes 403 responses through auth handler instead of shape errors", async () => {
    let authRedirected = false;

    const result = await loadProvidersWithHandler(
      () => Promise.reject(new AuthError("FORBIDDEN", "forbidden", 403)),
      () => {
        authRedirected = true;
      },
    );

    assert.equal(result.providers.length, 0);
    assert.equal(authRedirected, true);
    assert.match(result.error || "", /permiso|autenticaci/i);
    assert.ok(!/Invalid providers response/i.test(result.error || ""));
  });
});
