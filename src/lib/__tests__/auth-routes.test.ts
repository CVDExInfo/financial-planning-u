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
    "/",
    "/profile",
    "/pmo/prefactura/estimator",
    "/pmo/projects/123",
  ];
  const blocked = [
    "/catalog/rubros",
    "/sdmt/cost/catalog",
    "/sdmt/cost/forecast",
    "/sdmt/cost/reconciliation",
    "/sdmt/cost/changes",
    "/adjustments",
    "/projects",
    "/rules",
  ];

  it("allows only the estimator for PM (no SDMT routes)", () => {
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

describe("SDMT role route visibility", () => {
  const role: UserRole = "SDMT";
  const allowed = [
    "/",
    "/profile",
    "/sdmt/cost/catalog",
    "/sdmt/cost/forecast",
    "/sdmt/cost/reconciliation",
    "/sdmt/cost/changes",
    "/sdmt/cost/cashflow",
    "/sdmt/cost/scenarios",
    "/catalog/rubros",
    "/catalog/costos",
    "/rules",
    "/projects",
    "/projects/list",
    "/projects/123",
    "/adjustments",
    "/adjustments/list",
    "/adjustments/edit/456",
    "/providers",
    "/providers/list",
    "/providers/view/789",
    "/cashflow",
    "/scenarios",
    "/payroll/actuals",
  ];
  const blocked = [
    "/pmo/prefactura/estimator", // PMO-only route
  ];

  it("allows full access to SDMT cost management routes", () => {
    allowed.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        true,
        `${route} should be allowed for SDMT`,
      );
    });

    blocked.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        false,
        `${route} should be blocked for SDMT`,
      );
    });
  });

  it("defaults SDMT users to the catalog route", () => {
    assert.equal(getDefaultRouteForRole(role), "/sdmt/cost/catalog");
  });
});

describe("EXEC_RO role route visibility", () => {
  const role: UserRole = "EXEC_RO";
  const allowed = [
    "/sdmt/cost/catalog",
    "/sdmt/cost/forecast",
    "/sdmt/cost/reconciliation",
    "/sdmt/cost/changes",
    "/sdmt/cost/cashflow",
    "/pmo/prefactura/estimator",
    "/catalog/rubros",
    "/rules",
  ];

  it("allows read-only access to all PMO and SDMT routes", () => {
    allowed.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        true,
        `${route} should be allowed for EXEC_RO`,
      );
    });
  });

  it("defaults EXEC_RO users to the cashflow dashboard", () => {
    assert.equal(getDefaultRouteForRole(role), "/sdmt/cost/cashflow");
  });
});

describe("PMO role route visibility", () => {
  const role: UserRole = "PMO";
  const allowed = [
    "/pmo/prefactura/estimator",
    "/pmo/projects/123",
  ];
  const blocked = [
    "/sdmt/cost/catalog",
    "/sdmt/cost/forecast",
    "/sdmt/cost/reconciliation",
    "/sdmt/cost/changes",
    "/catalog/rubros", // Finanzas routes blocked for PMO
    "/payroll/actuals", // Payroll actuals blocked for PMO
    "/projects", // SDMT projects route blocked for PMO
  ];

  it("restricts PMO users to PMO workspace only", () => {
    allowed.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        true,
        `${route} should be allowed for PMO`,
      );
    });

    blocked.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        false,
        `${route} should be blocked for PMO`,
      );
    });
  });

  it("defaults PMO users to the estimator route", () => {
    assert.equal(getDefaultRouteForRole(role), "/pmo/prefactura/estimator");
  });
});

describe("SDM_FIN role route visibility", () => {
  const role: UserRole = "SDM_FIN";
  const allowed = [
    "/",
    "/profile",
    "/sdmt/cost/catalog",
    "/sdmt/cost/forecast",
    "/sdmt/cost/reconciliation",
    "/sdmt/cost/changes",
    "/catalog/rubros",
    "/rules",
    "/projects",
    "/projects/123",
    "/adjustments",
    "/providers",
    "/cashflow",
    "/scenarios",
    "/payroll/actuals",
  ];
  const blocked = [
    "/pmo/prefactura/estimator", // PMO-only route
  ];

  it("allows SDM_FIN users full access to SDMT and payroll routes", () => {
    allowed.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        true,
        `${route} should be allowed for SDM_FIN`,
      );
    });

    blocked.forEach((route) => {
      assert.equal(
        canAccessRoute(normalizeAppPath(route), role),
        false,
        `${route} should be blocked for SDM_FIN`,
      );
    });
  });
});
