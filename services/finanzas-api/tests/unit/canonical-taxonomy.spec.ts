/**
 * Unit tests for Canonical Rubros Taxonomy
 * 
 * Validates that:
 * - Legacy IDs are correctly mapped to canonical IDs
 * - Canonical IDs are recognized as valid
 * - Unknown IDs are handled gracefully
 * - All mapping functions work correctly
 */

import {
  getCanonicalRubroId,
  isValidRubroId,
  isLegacyRubroId,
  normalizeRubroId,
  CANONICAL_IDS,
  LEGACY_RUBRO_ID_MAP,
} from "../../src/lib/canonical-taxonomy";

describe("canonical-taxonomy", () => {
  describe("getCanonicalRubroId", () => {
    it("should return canonical ID unchanged", () => {
      expect(getCanonicalRubroId("MOD-ING")).toBe("MOD-ING");
      expect(getCanonicalRubroId("GSV-REU")).toBe("GSV-REU");
      expect(getCanonicalRubroId("TEC-LIC-MON")).toBe("TEC-LIC-MON");
    });

    it("should map legacy RUBRO-### format to canonical", () => {
      expect(getCanonicalRubroId("RUBRO-001")).toBe("MOD-ING");
      expect(getCanonicalRubroId("RUBRO-002")).toBe("TEC-HW-FIELD");
      expect(getCanonicalRubroId("RUBRO-003")).toBe("TEC-LIC-MON");
    });

    it("should map legacy RB#### format to canonical", () => {
      expect(getCanonicalRubroId("RB0001")).toBe("MOD-ING");
      expect(getCanonicalRubroId("RB0017")).toBe("TEC-LIC-MON");
      expect(getCanonicalRubroId("RB0071")).toBe("INN-AUT");
    });

    it("should map extended RB legacy IDs without warnings", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      expect(getCanonicalRubroId("RB0075")).toBe("INF-RACK");
      expect(getCanonicalRubroId("RB0080")).toBe("INF-BCK");
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should map legacy seed format to canonical", () => {
      expect(getCanonicalRubroId("RUBRO-SENIOR-DEV")).toBe("MOD-LEAD");
      expect(getCanonicalRubroId("RUBRO-AWS-INFRA")).toBe("INF-CLOUD");
      expect(getCanonicalRubroId("RUBRO-LICENSE")).toBe("TEC-LIC-MON");
    });

    it("should return unknown ID unchanged with warning", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const result = getCanonicalRubroId("UNKNOWN-ID");
      expect(result).toBe("UNKNOWN-ID");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown rubro_id: UNKNOWN-ID")
      );
      consoleSpy.mockRestore();
    });
  });

  describe("isValidRubroId", () => {
    it("should validate canonical IDs", () => {
      expect(isValidRubroId("MOD-ING")).toBe(true);
      expect(isValidRubroId("GSV-REU")).toBe(true);
      expect(isValidRubroId("TEC-LIC-MON")).toBe(true);
    });

    it("should validate legacy IDs", () => {
      expect(isValidRubroId("RUBRO-001")).toBe(true);
      expect(isValidRubroId("RB0001")).toBe(true);
      expect(isValidRubroId("RUBRO-SENIOR-DEV")).toBe(true);
    });

    it("should reject unknown IDs", () => {
      expect(isValidRubroId("UNKNOWN-ID")).toBe(false);
      expect(isValidRubroId("INVALID-123")).toBe(false);
    });
  });

  describe("isLegacyRubroId", () => {
    it("should identify legacy IDs", () => {
      expect(isLegacyRubroId("RUBRO-001")).toBe(true);
      expect(isLegacyRubroId("RB0001")).toBe(true);
      expect(isLegacyRubroId("RUBRO-SENIOR-DEV")).toBe(true);
    });

    it("should not identify canonical IDs as legacy", () => {
      expect(isLegacyRubroId("MOD-ING")).toBe(false);
      expect(isLegacyRubroId("GSV-REU")).toBe(false);
    });

    it("should not identify unknown IDs as legacy", () => {
      expect(isLegacyRubroId("UNKNOWN-ID")).toBe(false);
    });
  });

  describe("normalizeRubroId", () => {
    it("should normalize canonical ID without warnings", () => {
      const result = normalizeRubroId("MOD-ING");
      expect(result.canonicalId).toBe("MOD-ING");
      expect(result.isLegacy).toBe(false);
      expect(result.isValid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it("should normalize legacy ID with warning", () => {
      const result = normalizeRubroId("RUBRO-001");
      expect(result.canonicalId).toBe("MOD-ING");
      expect(result.isLegacy).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain("Legacy rubro_id");
      expect(result.warning).toContain("RUBRO-001");
      expect(result.warning).toContain("MOD-ING");
    });

    it("should handle unknown ID with warning", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const result = normalizeRubroId("UNKNOWN-ID");
      expect(result.canonicalId).toBe("UNKNOWN-ID");
      expect(result.isLegacy).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.warning).toContain("Unknown rubro_id");
      consoleSpy.mockRestore();
    });
  });

  describe("taxonomy completeness", () => {
    it("should have 72 canonical IDs", () => {
      expect(CANONICAL_IDS.size).toBe(72);
    });

    it("should have all expected MOD rubros", () => {
      expect(CANONICAL_IDS.has("MOD-ING")).toBe(true);
      expect(CANONICAL_IDS.has("MOD-LEAD")).toBe(true);
      expect(CANONICAL_IDS.has("MOD-SDM")).toBe(true);
      expect(CANONICAL_IDS.has("MOD-PM")).toBe(true);
      expect(CANONICAL_IDS.has("MOD-OT")).toBe(true);
      expect(CANONICAL_IDS.has("MOD-CONT")).toBe(true);
      expect(CANONICAL_IDS.has("MOD-EXT")).toBe(true);
    });

    it("should have legacy mapping for all RB#### entries (RB0001-RB0071 plus extended IDs)", () => {
      // Sequential IDs RB0001-RB0071
      for (let i = 1; i <= 71; i++) {
        const legacyId = `RB${String(i).padStart(4, "0")}`;
        expect(LEGACY_RUBRO_ID_MAP[legacyId]).toBeDefined();
        expect(CANONICAL_IDS.has(LEGACY_RUBRO_ID_MAP[legacyId])).toBe(true);
      }
      
      // Additional extended IDs used in seed data
      const extendedIds = ['RB0075', 'RB0080'];
      extendedIds.forEach(legacyId => {
        expect(LEGACY_RUBRO_ID_MAP[legacyId]).toBeDefined();
        expect(CANONICAL_IDS.has(LEGACY_RUBRO_ID_MAP[legacyId])).toBe(true);
      });
    });

    it("should have legacy mapping for old RUBRO-### format", () => {
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-001"]).toBe("MOD-ING");
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-002"]).toBe("TEC-HW-FIELD");
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-003"]).toBe("TEC-LIC-MON");
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-004"]).toBe("GSV-REU");
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-005"]).toBe("GSV-TRN");
    });

    it("should have legacy mapping for seed format", () => {
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-SENIOR-DEV"]).toBe("MOD-LEAD");
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-AWS-INFRA"]).toBe("INF-CLOUD");
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-LICENSE"]).toBe("TEC-LIC-MON");
      expect(LEGACY_RUBRO_ID_MAP["RUBRO-CONSULTING"]).toBe("GSV-REU");
    });
  });

  describe("category coverage", () => {
    it("should include rubros from all expected categories", () => {
      const categories = new Set<string>();
      
      // Extract categories from canonical IDs by prefix
      CANONICAL_IDS.forEach((id) => {
        const prefix = id.split("-")[0];
        categories.add(prefix);
      });

      // Expected categories based on taxonomy
      const expectedCategories = [
        "MOD",  // Mano de Obra Directa
        "GSV",  // Gestión del Servicio
        "REM",  // Servicios Remotos / Campo
        "TEC",  // Equipos y Tecnología
        "INF",  // Infraestructura / Nube / Data Center
        "TEL",  // Telecomunicaciones
        "SEC",  // Seguridad y Cumplimiento
        "LOG",  // Logística y Repuestos
        "RIE",  // Riesgos y Penalizaciones
        "ADM",  // Administración / PMO / Prefactura
        "QLT",  // Calidad y Mejora Continua
        "PLT",  // Plataformas de Gestión
        "DEP",  // Depreciación y Amortización
        "NOC",  // NOC / Operación 24x7
        "COL",  // Colaboración / Productividad
        "VIA",  // Viajes Corporativos (no campo)
        "INV",  // Inventarios / Almacén
        "LIC",  // Licencias de Red y Seguridad
        "CTR",  // Cumplimiento Contractual
        "INN",  // Innovación y Roadmap
      ];

      expectedCategories.forEach((cat) => {
        expect(categories.has(cat)).toBe(true);
      });
    });
  });
});
