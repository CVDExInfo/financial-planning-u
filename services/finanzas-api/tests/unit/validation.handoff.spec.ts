// Mock the zod validation functions for testing

import { z } from "zod";

const HandoffSchema = z.object({
  mod_total: z.number().min(0, "mod_total must be non-negative"),
  sdm_manager_name: z
    .string()
    .trim()
    .min(1, "sdm_manager_name must not be empty")
    .max(200, "sdm_manager_name cannot exceed 200 characters")
    .optional(),
  pct_ingenieros: z
    .number()
    .min(0)
    .max(100, "pct_ingenieros must be between 0 and 100"),
  pct_sdm: z.number().min(0).max(100, "pct_sdm must be between 0 and 100"),
  aceptado_por: z.string().email("aceptado_por must be a valid email"),
  fecha_handoff: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha_handoff must be in YYYY-MM-DD format"),
  notas: z.string().max(2000, "notas cannot exceed 2000 characters").optional(),
});

describe("Handoff Validation", () => {
  const validHandoff = {
    mod_total: 12240000,
    sdm_manager_name: "Laura Gómez",
    pct_ingenieros: 85,
    pct_sdm: 15,
    aceptado_por: "pm.lead@ikusi.com",
    fecha_handoff: "2024-12-15",
    notas: "Proyecto de plataforma IA",
  };

  describe("HandoffSchema", () => {
    it("should validate a complete valid handoff", () => {
      const result = HandoffSchema.parse(validHandoff);
      expect(result).toEqual(validHandoff);
    });

    it("should allow omitting sdm_manager_name for backwards compatibility", () => {
      const { sdm_manager_name: _sdm, ...legacy } = validHandoff;
      const result = HandoffSchema.parse(legacy);
      expect(result.sdm_manager_name).toBeUndefined();
    });

    it("should validate without optional notas field", () => {
      const { notas: _notas, ...minimalHandoff } = validHandoff;
      const result = HandoffSchema.parse(minimalHandoff);
      expect(result.notas).toBeUndefined();
    });

    it("should reject negative mod_total", () => {
      const invalidData = { ...validHandoff, mod_total: -1000 };
      expect(() => HandoffSchema.parse(invalidData)).toThrow();
    });

    it("should reject pct_ingenieros > 100", () => {
      const invalidData = { ...validHandoff, pct_ingenieros: 101 };
      expect(() => HandoffSchema.parse(invalidData)).toThrow();
    });

    it("should reject pct_ingenieros < 0", () => {
      const invalidData = { ...validHandoff, pct_ingenieros: -1 };
      expect(() => HandoffSchema.parse(invalidData)).toThrow();
    });

    it("should reject pct_sdm > 100", () => {
      const invalidData = { ...validHandoff, pct_sdm: 101 };
      expect(() => HandoffSchema.parse(invalidData)).toThrow();
    });

    it("should reject invalid email format", () => {
      const invalidData = { ...validHandoff, aceptado_por: "not-an-email" };
      expect(() => HandoffSchema.parse(invalidData)).toThrow();
    });

    it("should reject invalid date format", () => {
      const invalidData = { ...validHandoff, fecha_handoff: "12/15/2024" };
      expect(() => HandoffSchema.parse(invalidData)).toThrow();
    });

    it("should reject notas exceeding 2000 characters", () => {
      const longNotas = "x".repeat(2001);
      const invalidData = { ...validHandoff, notas: longNotas };
      expect(() => HandoffSchema.parse(invalidData)).toThrow();
    });

    it("should reject empty sdm_manager_name when provided", () => {
      const invalid = { ...validHandoff, sdm_manager_name: "" };
      expect(() => HandoffSchema.parse(invalid)).toThrow();
    });
  
    it("should accept 0% for percentages", () => {
      const edgeCaseData = {
        ...validHandoff,
        pct_ingenieros: 0,
        pct_sdm: 0,
      };
      expect(() => HandoffSchema.parse(edgeCaseData)).not.toThrow();
    });

    it("should accept 100% for percentages", () => {
      const edgeCaseData = {
        ...validHandoff,
        pct_ingenieros: 100,
        pct_sdm: 0,
      };
      expect(() => HandoffSchema.parse(edgeCaseData)).not.toThrow();
    });
  });
});
