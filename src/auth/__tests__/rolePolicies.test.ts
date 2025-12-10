import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ROLE_GROUPS,
  PAGE_ROLE_REQUIREMENTS,
  userHasAnyRole,
  formatRequiredRoles,
} from "../rolePolicies";
import type { UserRole } from "@/types/domain";

describe("Role Groups", () => {
  it("defines SDMT full access group", () => {
    assert.deepStrictEqual(ROLE_GROUPS.sdmtFullAccess, ["SDMT"]);
  });

  it("defines PM estimator access group", () => {
    assert.deepStrictEqual(ROLE_GROUPS.pmEstimatorAccess, ["PM", "PMO"]);
  });

  it("defines EXEC_RO read-only group", () => {
    assert.deepStrictEqual(ROLE_GROUPS.execReadOnly, ["EXEC_RO"]);
  });

  it("defines VENDOR minimal access group", () => {
    assert.deepStrictEqual(ROLE_GROUPS.vendorMinimal, ["VENDOR"]);
  });
});

describe("Page Role Requirements", () => {
  it("requires SDMT role for SDMT cost catalog", () => {
    assert.deepStrictEqual(
      PAGE_ROLE_REQUIREMENTS.sdmtCostCatalog,
      ["SDMT"]
    );
  });

  it("requires SDMT role for SDMT cost forecast", () => {
    assert.deepStrictEqual(
      PAGE_ROLE_REQUIREMENTS.sdmtCostForecast,
      ["SDMT"]
    );
  });

  it("requires SDMT role for SDMT cost changes", () => {
    assert.deepStrictEqual(
      PAGE_ROLE_REQUIREMENTS.sdmtCostChanges,
      ["SDMT"]
    );
  });

  it("allows SDMT, PM, and PMO for estimator wizard", () => {
    const roles = PAGE_ROLE_REQUIREMENTS.pmoEstimatorWizard;
    assert.ok(roles.includes("SDMT"));
    assert.ok(roles.includes("PM"));
    assert.ok(roles.includes("PMO"));
  });

  it("allows SDMT, PM, PMO, and VENDOR for catalog rubros", () => {
    const roles = PAGE_ROLE_REQUIREMENTS.catalogRubros;
    assert.ok(roles.includes("SDMT"));
    assert.ok(roles.includes("PM"));
    assert.ok(roles.includes("PMO"));
    assert.ok(roles.includes("VENDOR"));
  });
});

describe("userHasAnyRole", () => {
  it("returns true when user has one of the required roles", () => {
    const userRoles: UserRole[] = ["PM", "EXEC_RO"];
    const requiredRoles: UserRole[] = ["PM", "PMO"];
    assert.strictEqual(userHasAnyRole(userRoles, requiredRoles), true);
  });

  it("returns false when user has none of the required roles", () => {
    const userRoles: UserRole[] = ["VENDOR"];
    const requiredRoles: UserRole[] = ["PM", "PMO", "SDMT"];
    assert.strictEqual(userHasAnyRole(userRoles, requiredRoles), false);
  });

  it("returns true when no roles are required (empty array)", () => {
    const userRoles: UserRole[] = ["VENDOR"];
    const requiredRoles: UserRole[] = [];
    assert.strictEqual(userHasAnyRole(userRoles, requiredRoles), true);
  });

  it("returns true when required roles is undefined", () => {
    const userRoles: UserRole[] = ["VENDOR"];
    const requiredRoles = undefined;
    assert.strictEqual(userHasAnyRole(userRoles, requiredRoles), true);
  });

  it("returns false when user has no roles but roles are required", () => {
    const userRoles: UserRole[] = [];
    const requiredRoles: UserRole[] = ["SDMT"];
    assert.strictEqual(userHasAnyRole(userRoles, requiredRoles), false);
  });

  it("returns false when user roles is undefined but roles are required", () => {
    const userRoles = undefined;
    const requiredRoles: UserRole[] = ["SDMT"];
    assert.strictEqual(userHasAnyRole(userRoles, requiredRoles), false);
  });

  it("returns true for SDMT user accessing SDMT pages", () => {
    const userRoles: UserRole[] = ["SDMT"];
    const requiredRoles = PAGE_ROLE_REQUIREMENTS.sdmtCostCatalog;
    assert.strictEqual(userHasAnyRole(userRoles, requiredRoles), true);
  });

  it("returns false for PM user accessing SDMT-only pages", () => {
    const userRoles: UserRole[] = ["PM"];
    const requiredRoles = PAGE_ROLE_REQUIREMENTS.sdmtCostForecast;
    assert.strictEqual(userHasAnyRole(userRoles, requiredRoles), false);
  });
});

describe("formatRequiredRoles", () => {
  it("formats multiple roles with comma separation", () => {
    const roles: UserRole[] = ["SDMT", "PM", "PMO"];
    assert.strictEqual(
      formatRequiredRoles(roles),
      "SDMT, PM, PMO"
    );
  });

  it("formats single role", () => {
    const roles: UserRole[] = ["SDMT"];
    assert.strictEqual(formatRequiredRoles(roles), "SDMT");
  });

  it("returns default message for empty array", () => {
    const roles: UserRole[] = [];
    assert.strictEqual(
      formatRequiredRoles(roles),
      "Access is determined by your assigned role"
    );
  });

  it("returns default message for undefined", () => {
    assert.strictEqual(
      formatRequiredRoles(undefined),
      "Access is determined by your assigned role"
    );
  });
});
