import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOD_ROLES } from "@/modules/modRoles";

describe("MOD Roles from Rubros Taxonomy", () => {
  it("includes Ingeniero Delivery role", () => {
    assert.ok(MOD_ROLES.includes("Ingeniero Delivery"));
  });

  it("includes all support engineer levels", () => {
    assert.ok(MOD_ROLES.includes("Ingeniero Soporte N1"));
    assert.ok(MOD_ROLES.includes("Ingeniero Soporte N2"));
    assert.ok(MOD_ROLES.includes("Ingeniero Soporte N3"));
  });

  it("includes Service Delivery Manager role", () => {
    assert.ok(MOD_ROLES.includes("Service Delivery Manager"));
  });

  it("includes Project Manager role", () => {
    assert.ok(MOD_ROLES.includes("Project Manager"));
  });

  it("has exactly 6 MOD roles", () => {
    assert.strictEqual(MOD_ROLES.length, 6);
  });

  it("does not include generic software engineering roles", () => {
    const genericRoles = [
      "Frontend Developer",
      "Backend Developer",
      "Full Stack Developer",
      "DevOps Engineer",
      "UI/UX Designer",
      "Business Analyst",
      "Technical Lead",
      "Architect",
      "QA Engineer",
    ];

    genericRoles.forEach(role => {
      assert.ok(!MOD_ROLES.includes(role as any), 
        `MOD_ROLES should not include generic role: ${role}`);
    });
  });
});

/**
 * Note: useModRoles is a React hook and would require React Testing Library
 * to test properly. The hook itself is simple - it just wraps the MOD_ROLES
 * constant. The important part tested here is that MOD_ROLES contains the
 * correct client-approved roles from the Rubros taxonomy.
 */
