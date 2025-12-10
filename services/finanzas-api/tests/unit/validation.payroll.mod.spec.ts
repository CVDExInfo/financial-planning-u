/**
 * Test suite for MOD roles in payroll validation
 * Validates the desglose_roles field in PayrollIngestSchema
 */

import { PayrollIngestSchema } from "../../src/validation/payroll";
import { MOD_ROLES } from "../../src/constants/mod-roles";

describe("Payroll MOD Roles Validation", () => {
  describe("PayrollIngestSchema with desglose_roles", () => {
    const basePayload = {
      mes: "2025-01",
      nomina_total: 100000,
    };

    it("Test A - should accept valid payload with only desglose_roles", () => {
      const validPayload = {
        ...basePayload,
        desglose_roles: {
          "Ingeniero Delivery": 20000,
          "Ingeniero Soporte N1": 30000,
          "Service Delivery Manager": 50000,
        },
      };

      const result = PayrollIngestSchema.parse(validPayload);
      expect(result.desglose_roles).toBeDefined();
      expect(result.desglose_roles?.["Ingeniero Delivery"]).toBe(20000);
      expect(result.desglose_roles?.["Ingeniero Soporte N1"]).toBe(30000);
      expect(result.desglose_roles?.["Service Delivery Manager"]).toBe(50000);
    });

    it("should accept payload with all 6 MOD roles", () => {
      const allRolesPayload = {
        ...basePayload,
        desglose_roles: {
          "Ingeniero Delivery": 10000,
          "Ingeniero Soporte N1": 15000,
          "Ingeniero Soporte N2": 15000,
          "Ingeniero Soporte N3": 10000,
          "Service Delivery Manager": 25000,
          "Project Manager": 25000,
        },
      };

      const result = PayrollIngestSchema.parse(allRolesPayload);
      expect(result.desglose_roles).toBeDefined();
      
      // Verify all roles are present
      MOD_ROLES.forEach(role => {
        expect(result.desglose_roles?.[role]).toBeDefined();
      });
    });

    it("Test B - should accept payload with both desglose_roles and legacy desglose", () => {
      const mixedPayload = {
        ...basePayload,
        desglose_roles: {
          "Ingeniero Delivery": 20000,
          "Service Delivery Manager": 80000,
        },
        desglose: {
          ingenieros: 85000,
          sdm: 15000,
        },
      };

      expect(() => PayrollIngestSchema.parse(mixedPayload)).not.toThrow();
      const result = PayrollIngestSchema.parse(mixedPayload);
      
      // Both fields should be preserved
      expect(result.desglose_roles).toBeDefined();
      expect(result.desglose).toBeDefined();
      expect(result.desglose?.ingenieros).toBe(85000);
      expect(result.desglose_roles?.["Ingeniero Delivery"]).toBe(20000);
    });

    it("Test C - should reject invalid desglose_roles with non-numeric value", () => {
      const invalidPayload = {
        ...basePayload,
        desglose_roles: {
          "Ingeniero Delivery": "not-a-number" as any,
        },
      };

      expect(() => PayrollIngestSchema.parse(invalidPayload)).toThrow();
    });

    it("Test C - should reject negative amounts in desglose_roles", () => {
      const invalidPayload = {
        ...basePayload,
        desglose_roles: {
          "Ingeniero Delivery": -5000,
        },
      };

      expect(() => PayrollIngestSchema.parse(invalidPayload)).toThrow();
    });

    it("should accept zero amounts in desglose_roles", () => {
      const zeroPayload = {
        ...basePayload,
        desglose_roles: {
          "Ingeniero Delivery": 0,
          "Service Delivery Manager": 100000,
        },
      };

      expect(() => PayrollIngestSchema.parse(zeroPayload)).not.toThrow();
    });

    it("should accept payload with desglose_roles as optional field", () => {
      const minimalPayload = {
        ...basePayload,
      };

      const result = PayrollIngestSchema.parse(minimalPayload);
      expect(result.desglose_roles).toBeUndefined();
    });

    it("should accept empty desglose_roles object", () => {
      const emptyRolesPayload = {
        ...basePayload,
        desglose_roles: {},
      };

      expect(() => PayrollIngestSchema.parse(emptyRolesPayload)).not.toThrow();
    });

    it("should validate that desglose_roles uses only valid MOD role keys", () => {
      // This test verifies the schema structure matches MOD_ROLES
      const validPayload = {
        ...basePayload,
        desglose_roles: Object.fromEntries(
          MOD_ROLES.map((role, i) => [role, (i + 1) * 10000])
        ),
      };

      expect(() => PayrollIngestSchema.parse(validPayload)).not.toThrow();
    });
  });

  describe("Backward compatibility with legacy desglose", () => {
    it("should accept legacy payload with only desglose field", () => {
      const legacyPayload = {
        mes: "2025-01",
        nomina_total: 100000,
        desglose: {
          ingenieros: 85000,
          sdm: 15000,
        },
      };

      const result = PayrollIngestSchema.parse(legacyPayload);
      expect(result.desglose).toBeDefined();
      expect(result.desglose?.ingenieros).toBe(85000);
      expect(result.desglose?.sdm).toBe(15000);
      expect(result.desglose_roles).toBeUndefined();
    });

    it("should accept payload without any breakdown fields", () => {
      const minimalPayload = {
        mes: "2025-01",
        nomina_total: 100000,
      };

      const result = PayrollIngestSchema.parse(minimalPayload);
      expect(result.desglose).toBeUndefined();
      expect(result.desglose_roles).toBeUndefined();
    });
  });

  describe("MOD_ROLES constant consistency", () => {
    it("should use the centralized MOD_ROLES from constants module", () => {
      // Verify MOD_ROLES is imported and has expected values
      expect(MOD_ROLES).toHaveLength(6);
      expect(MOD_ROLES).toContain("Ingeniero Delivery");
      expect(MOD_ROLES).toContain("Ingeniero Soporte N1");
      expect(MOD_ROLES).toContain("Ingeniero Soporte N2");
      expect(MOD_ROLES).toContain("Ingeniero Soporte N3");
      expect(MOD_ROLES).toContain("Service Delivery Manager");
      expect(MOD_ROLES).toContain("Project Manager");
    });
  });
});
