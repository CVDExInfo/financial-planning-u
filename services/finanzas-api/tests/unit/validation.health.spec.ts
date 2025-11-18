// Mock the zod validation functions for testing
// Since validation is done via zod, we'll test with actual validation logic

import { z } from "zod";

const HealthResponseSchema = z.object({
  ok: z.boolean({
    invalid_type_error: "ok must be a boolean",
  }),
  status: z.enum(["ok", "UP", "healthy"]).optional(),
  env: z.enum(["dev", "stg", "prod"]).optional(),
  version: z.string().optional(),
});

describe("Health Validation", () => {
  describe("HealthResponseSchema", () => {
    it("should validate a complete valid health response", () => {
      const validData = {
        ok: true,
        status: "ok",
        env: "dev",
        version: "1.0.0",
      };

      const result = HealthResponseSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it("should validate with only required field (ok)", () => {
      const minimalData = {
        ok: true,
      };

      const result = HealthResponseSchema.parse(minimalData);
      expect(result.ok).toBe(true);
      expect(result.status).toBeUndefined();
      expect(result.env).toBeUndefined();
      expect(result.version).toBeUndefined();
    });

    it("should accept valid status values", () => {
      const data1 = { ok: true, status: "ok" };
      const data2 = { ok: true, status: "UP" };
      const data3 = { ok: true, status: "healthy" };

      expect(() => HealthResponseSchema.parse(data1)).not.toThrow();
      expect(() => HealthResponseSchema.parse(data2)).not.toThrow();
      expect(() => HealthResponseSchema.parse(data3)).not.toThrow();
    });

    it("should accept valid env values", () => {
      const data1 = { ok: true, env: "dev" };
      const data2 = { ok: true, env: "stg" };
      const data3 = { ok: true, env: "prod" };

      expect(() => HealthResponseSchema.parse(data1)).not.toThrow();
      expect(() => HealthResponseSchema.parse(data2)).not.toThrow();
      expect(() => HealthResponseSchema.parse(data3)).not.toThrow();
    });

    it("should reject missing ok field", () => {
      const invalidData = {
        status: "ok",
        env: "dev",
      };

      expect(() => HealthResponseSchema.parse(invalidData)).toThrow();
    });

    it("should reject non-boolean ok field", () => {
      const invalidData = {
        ok: "true", // string instead of boolean
        status: "ok",
      };

      expect(() => HealthResponseSchema.parse(invalidData)).toThrow();
    });

    it("should reject invalid status value", () => {
      const invalidData = {
        ok: true,
        status: "invalid",
      };

      expect(() => HealthResponseSchema.parse(invalidData)).toThrow();
    });

    it("should reject invalid env value", () => {
      const invalidData = {
        ok: true,
        env: "production", // should be 'prod'
      };

      expect(() => HealthResponseSchema.parse(invalidData)).toThrow();
    });
  });

  describe("safe parse", () => {
    it("should return success for valid data", () => {
      const validData = { ok: true };
      const result = HealthResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ok).toBe(true);
      }
    });

    it("should return failure for invalid data", () => {
      const invalidData = { ok: "not a boolean" };
      const result = HealthResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
