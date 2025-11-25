import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapGroupsToRoles } from "../jwt";
import { resolveFinanzasRole } from "../../hooks/permissions-helpers";

const asSet = (values: string[]) => new Set(values);

describe("mapGroupsToRoles", () => {
  it("maps admin to PMO and EXEC_RO", () => {
    const roles = mapGroupsToRoles(["admin"]);
    assert.deepEqual(asSet(roles), asSet(["PMO", "EXEC_RO"]));
  });

  it("maps FIN to SDMT", () => {
    const roles = mapGroupsToRoles(["FIN"]);
    assert.deepEqual(asSet(roles), asSet(["SDMT"]));
  });

  it("maps AUD to SDMT", () => {
    const roles = mapGroupsToRoles(["AUD"]);
    assert.deepEqual(asSet(roles), asSet(["SDMT"]));
  });

  it("maps SDT to SDMT", () => {
    const roles = mapGroupsToRoles(["SDT"]);
    assert.deepEqual(asSet(roles), asSet(["SDMT"]));
  });

  it("maps acta-ui vendor group to VENDOR", () => {
    const roles = mapGroupsToRoles(["ikusi-acta-ui"]);
    assert.deepEqual(asSet(roles), asSet(["VENDOR"]));
  });

  it("maps mixed FIN + vendor groups to both roles", () => {
    const roles = mapGroupsToRoles(["FIN", "ikusi-acta-ui"]);
    assert.deepEqual(asSet(roles), asSet(["SDMT", "VENDOR"]));
  });
});

describe("resolveFinanzasRole", () => {
  it("prefers highest-priority role from groups", () => {
    const role = resolveFinanzasRole(["FIN", "ikusi-acta-ui"], null, []);
    assert.equal(role, "SDMT");
  });

  it("falls back to currentRole when no groups are present", () => {
    const role = resolveFinanzasRole([], "EXEC_RO", []);
    assert.equal(role, "EXEC_RO");
  });

  it("falls back to first available role when groups are empty", () => {
    const role = resolveFinanzasRole([], null, ["VENDOR", "EXEC_RO"]);
    assert.equal(role, "VENDOR");
  });
});
