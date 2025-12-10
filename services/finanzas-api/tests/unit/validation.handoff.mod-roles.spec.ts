/**
 * Test suite for MOD roles alignment in handoff validation
 * Validates the 6 client-approved MOD roles
 */

import { z } from "zod";
import { HandoffSchema, MOD_ROLES, MODRolesSchema } from "../../src/validation/handoff";

describe("MOD Roles Validation", () => {
  describe("MOD_ROLES constant", () => {
    it("should contain exactly 6 approved roles", () => {
      expect(MOD_ROLES).toHaveLength(6);
    });

    it("should include all client-approved roles", () => {
      expect(MOD_ROLES).toContain('Ingeniero Delivery');
      expect(MOD_ROLES).toContain('Ingeniero Soporte N1');
      expect(MOD_ROLES).toContain('Ingeniero Soporte N2');
      expect(MOD_ROLES).toContain('Ingeniero Soporte N3');
      expect(MOD_ROLES).toContain('Service Delivery Manager');
      expect(MOD_ROLES).toContain('Project Manager');
    });
  });

  describe("MODRolesSchema", () => {
    it("should accept valid role percentages", () => {
      const validRoles = {
        'Ingeniero Delivery': 20,
        'Ingeniero Soporte N1': 15,
        'Ingeniero Soporte N2': 15,
        'Ingeniero Soporte N3': 10,
        'Service Delivery Manager': 25,
        'Project Manager': 15,
      };

      const result = MODRolesSchema.parse(validRoles);
      expect(result).toEqual(validRoles);
    });

    it("should accept partial role allocation", () => {
      const partialRoles = {
        'Ingeniero Delivery': 30,
        'Service Delivery Manager': 70,
      };

      expect(() => MODRolesSchema.parse(partialRoles)).not.toThrow();
    });

    it("should reject percentages over 100", () => {
      const invalidRoles = {
        'Ingeniero Delivery': 101,
      };

      expect(() => MODRolesSchema.parse(invalidRoles)).toThrow();
    });

    it("should reject negative percentages", () => {
      const invalidRoles = {
        'Ingeniero Soporte N1': -5,
      };

      expect(() => MODRolesSchema.parse(invalidRoles)).toThrow();
    });

    it("should accept zero percentage", () => {
      const rolesWithZero = {
        'Ingeniero Delivery': 0,
        'Service Delivery Manager': 100,
      };

      expect(() => MODRolesSchema.parse(rolesWithZero)).not.toThrow();
    });
  });

  describe("HandoffSchema with mod_roles", () => {
    const baseHandoff = {
      mod_total: 12240000,
      aceptado_por: "pm.lead@ikusi.com",
      fecha_handoff: "2024-12-15",
      notas: "Proyecto de plataforma IA",
    };

    it("should accept handoff with new mod_roles structure", () => {
      const handoffWithRoles = {
        ...baseHandoff,
        mod_roles: {
          'Ingeniero Delivery': 20,
          'Ingeniero Soporte N1': 20,
          'Ingeniero Soporte N2': 15,
          'Ingeniero Soporte N3': 10,
          'Service Delivery Manager': 20,
          'Project Manager': 15,
        },
      };

      expect(() => HandoffSchema.parse(handoffWithRoles)).not.toThrow();
    });

    it("should accept handoff with legacy pct fields", () => {
      const legacyHandoff = {
        ...baseHandoff,
        pct_ingenieros: 85,
        pct_sdm: 15,
      };

      expect(() => HandoffSchema.parse(legacyHandoff)).not.toThrow();
    });

    it("should accept handoff with both new and legacy fields", () => {
      const mixedHandoff = {
        ...baseHandoff,
        mod_roles: {
          'Ingeniero Delivery': 30,
          'Service Delivery Manager': 70,
        },
        pct_ingenieros: 85,
        pct_sdm: 15,
      };

      expect(() => HandoffSchema.parse(mixedHandoff)).not.toThrow();
    });

    it("should accept handoff without any role breakdown", () => {
      const minimalHandoff = {
        mod_total: 12240000,
      };

      expect(() => HandoffSchema.parse(minimalHandoff)).not.toThrow();
    });

    it("should validate role percentages in mod_roles", () => {
      const invalidHandoff = {
        ...baseHandoff,
        mod_roles: {
          'Ingeniero Delivery': 150, // Invalid: over 100
        },
      };

      expect(() => HandoffSchema.parse(invalidHandoff)).toThrow();
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain compatibility with existing handoff data", () => {
      const existingHandoff = {
        mod_total: 12240000,
        pct_ingenieros: 85,
        pct_sdm: 15,
        aceptado_por: "pm.lead@ikusi.com",
        fecha_handoff: "2024-12-15",
        notas: "Proyecto de plataforma IA",
      };

      const result = HandoffSchema.parse(existingHandoff);
      expect(result.pct_ingenieros).toBe(85);
      expect(result.pct_sdm).toBe(15);
      expect(result.mod_roles).toBeUndefined();
    });
  });
});
