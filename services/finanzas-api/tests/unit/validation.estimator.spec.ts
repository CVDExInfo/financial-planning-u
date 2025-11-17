// Mock the zod validation functions for testing

import { z } from "zod";

const EstimatorItemSchema = z.object({
  id: z.string().regex(/^est_[a-z0-9]{10}$/),
  projectId: z.string().regex(/^(proj_[a-z0-9]{10}|P-[A-Z0-9-]+)$/),
  baselineId: z.string().optional(),
  rubroId: z.string(),
  nombre: z.string(),
  tier: z.enum(["Go", "Gold", "Premium", "Platinum", "Star"]).optional(),
  quantity: z.number().min(0),
  unitCost: z.number().min(0),
  totalCost: z.number().min(0),
  period: z.number().int().positive().optional(),
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  endMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  committed: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

describe("Estimator Validation", () => {
  const validEstimatorItem = {
    id: "est_abc1234567", // exactly 10 chars after est_
    projectId: "P-GOLDEN-1",
    baselineId: "BL-1763192300497",
    rubroId: "RB0001",
    nombre: "Ingenieros Gold - 48 meses",
    tier: "Gold",
    quantity: 3,
    unitCost: 85000,
    totalCost: 12240000,
    period: 48,
    startMonth: "2025-01",
    endMonth: "2028-12",
    committed: true,
    createdAt: "2025-01-10T10:00:00Z",
  };

  describe("EstimatorItemSchema", () => {
    it("should validate a complete valid estimator item", () => {
      const result = EstimatorItemSchema.parse(validEstimatorItem);
      expect(result).toEqual(validEstimatorItem);
    });

    it("should accept valid tier values", () => {
      const tiers = ["Go", "Gold", "Premium", "Platinum", "Star"];
      tiers.forEach((tier) => {
        const data = { ...validEstimatorItem, tier };
        expect(() => EstimatorItemSchema.parse(data)).not.toThrow();
      });
    });

    it("should reject invalid tier value", () => {
      const invalidData = { ...validEstimatorItem, tier: "Invalid" };
      expect(() => EstimatorItemSchema.parse(invalidData)).toThrow();
    });

    it("should reject negative quantity", () => {
      const invalidData = { ...validEstimatorItem, quantity: -1 };
      expect(() => EstimatorItemSchema.parse(invalidData)).toThrow();
    });

    it("should reject negative unitCost", () => {
      const invalidData = { ...validEstimatorItem, unitCost: -100 };
      expect(() => EstimatorItemSchema.parse(invalidData)).toThrow();
    });

    it("should accept zero quantity", () => {
      const data = { ...validEstimatorItem, quantity: 0 };
      expect(() => EstimatorItemSchema.parse(data)).not.toThrow();
    });

    it("should reject invalid month format for startMonth", () => {
      const invalidData = { ...validEstimatorItem, startMonth: "01-2025" };
      expect(() => EstimatorItemSchema.parse(invalidData)).toThrow();
    });

    it("should reject invalid estimator ID pattern", () => {
      const invalidData = { ...validEstimatorItem, id: "invalid_id" };
      expect(() => EstimatorItemSchema.parse(invalidData)).toThrow();
    });

    it("should accept valid project ID patterns", () => {
      const validProjectIds = ["proj_abc1234567", "P-GOLDEN-1", "P-TEST-123"];
      validProjectIds.forEach((projectId) => {
        const data = { ...validEstimatorItem, projectId };
        expect(() => EstimatorItemSchema.parse(data)).not.toThrow();
      });
    });
  });
});
