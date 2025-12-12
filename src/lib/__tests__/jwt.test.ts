import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapGroupsToRoles } from "../jwt";
import { resolveFinanzasRole } from "../../hooks/permissions-helpers";

const asSet = (values: string[]) => new Set(values);

describe("mapGroupsToRoles", () => {
  it("maps admin to ADMIN role only", () => {
    const roles = mapGroupsToRoles(["admin"]);
    assert.deepEqual(asSet(roles), asSet(["ADMIN"]));
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

  it("ignores ikusi-acta-ui and returns empty (no default EXEC_RO)", () => {
    const roles = mapGroupsToRoles(["ikusi-acta-ui"]);
    assert.deepEqual(asSet(roles), asSet([]));
  });

  it("returns empty array for users with no recognized groups", () => {
    const roles = mapGroupsToRoles([]);
    assert.deepEqual(asSet(roles), asSet([]));
  });

  it("returns empty array for unrecognized groups", () => {
    const roles = mapGroupsToRoles(["UNKNOWN", "RANDOM"]);
    assert.deepEqual(asSet(roles), asSet([]));
  });

  it("maps explicit EXEC_RO group to EXEC_RO role", () => {
    const roles = mapGroupsToRoles(["EXEC_RO"]);
    assert.deepEqual(asSet(roles), asSet(["EXEC_RO"]));
  });

  it("maps exec-related groups to EXEC_RO role", () => {
    const roles1 = mapGroupsToRoles(["exec"]);
    assert.deepEqual(asSet(roles1), asSet(["EXEC_RO"]));
    
    const roles2 = mapGroupsToRoles(["director"]);
    assert.deepEqual(asSet(roles2), asSet(["EXEC_RO"]));
    
    const roles3 = mapGroupsToRoles(["manager"]);
    assert.deepEqual(asSet(roles3), asSet(["EXEC_RO"]));
  });

  it("ignores ikusi-acta-ui when mixed with valid groups", () => {
    const roles = mapGroupsToRoles(["FIN", "ikusi-acta-ui"]);
    assert.deepEqual(asSet(roles), asSet(["SDMT"]));
  });

  it("maps vendor group to VENDOR", () => {
    const roles = mapGroupsToRoles(["vendor"]);
    assert.deepEqual(asSet(roles), asSet(["VENDOR"]));
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
