import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { UserRole } from "@/types/domain";

let canAccessRoute: typeof import("@/lib/auth")["canAccessRoute"];
let getDefaultRouteForRole: typeof import("@/lib/auth")["getDefaultRouteForRole"];
let normalizeAppPath: typeof import("@/lib/auth")["normalizeAppPath"];
const originalImportMeta = (globalThis as any).import;

before(async () => {
  (globalThis as any).import = { meta: { env: { VITE_FINZ_ENABLED: "true" } } } as unknown as ImportMeta;
  const auth = await import("@/lib/auth");
  canAccessRoute = auth.canAccessRoute;
  getDefaultRouteForRole = auth.getDefaultRouteForRole;
  normalizeAppPath = auth.normalizeAppPath;
});

after(() => {
  (globalThis as any).import = originalImportMeta;
});

describe("PM role route visibility", () => {
  const role: UserRole = "PM";
  const allowed = [
    "/pmo/prefactura/estimator",
    "/catalog/rubros",
    "/sdmt/cost/catalog",
  ];
  const blocked = [
    "/sdmt/cost/forecast",
    "/sdmt/cost/reconciliation",
    "/sdmt/cost/changes",
    "/adjustments",
  ];

  it("allows only the estimator and catalog views for PM", () => {
    allowed.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        true,
        `${route} should be allowed for PM`,
      );
    });

    blocked.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        false,
        `${route} should be blocked for PM`,
      );
    });
  });

  it("defaults PM users to the estimator route", () => {
    assert.equal(getDefaultRouteForRole(role), "/pmo/prefactura/estimator");
  });
});
