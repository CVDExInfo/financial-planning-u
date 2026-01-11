import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureCategory, isLabor, normalizeCategory } from "../rubros-category-utils";
import type { LineItem } from "@/types/domain";

// Helper to create a minimal LineItem for testing
function createLineItem(overrides: Partial<LineItem> = {}): LineItem {
  return {
    id: "test-id",
    category: "",
    description: "Test Item",
    one_time: false,
    recurring: true,
    qty: 1,
    unit_cost: 1000,
    currency: "USD",
    start_month: 1,
    end_month: 12,
    amortization: "none",
    capex_flag: false,
    indexation_policy: "none",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    created_by: "test-user",
    ...overrides,
  };
}

describe("ensureCategory", () => {
  it("sets category to 'Mano de Obra Directa' for Ingeniero role with undefined category", () => {
    const lineItem = createLineItem({
      category: undefined as any,
      description: "Ingeniero Senior",
    });

    const result = ensureCategory(lineItem);

    assert.equal(result.category, "Mano de Obra Directa");
  });

  it("sets category to 'Mano de Obra Directa' for Service Delivery Manager with empty category", () => {
    const lineItem = createLineItem({
      category: "",
      description: "Service Delivery Manager",
    });

    const result = ensureCategory(lineItem);

    assert.equal(result.category, "Mano de Obra Directa");
  });

  it("sets category to 'Mano de Obra Directa' for Project Manager with 'Sin categoría'", () => {
    const lineItem = createLineItem({
      category: "Sin categoría",
      description: "Project Manager",
    });

    const result = ensureCategory(lineItem);

    assert.equal(result.category, "Mano de Obra Directa");
  });

  it("handles case-insensitive role matching for 'INGENIERO LIDER'", () => {
    const lineItem = createLineItem({
      category: "",
      description: "INGENIERO LIDER",
    });

    const result = ensureCategory(lineItem);

    assert.equal(result.category, "Mano de Obra Directa");
  });

  it("preserves existing valid category for non-labor roles", () => {
    const lineItem = createLineItem({
      category: "Gastos Generales",
      description: "Office Supplies",
    });

    const result = ensureCategory(lineItem);

    assert.equal(result.category, "Gastos Generales");
    assert.equal(result, lineItem); // Should return same object if unchanged
  });

  it("does not change category for labor role if already has valid category", () => {
    const lineItem = createLineItem({
      category: "Mano de Obra Indirecta",
      description: "Ingeniero Junior",
    });

    const result = ensureCategory(lineItem);

    // Preserves the existing category even though it's a labor role
    assert.equal(result.category, "Mano de Obra Indirecta");
    assert.equal(result, lineItem); // Should return same object if unchanged
  });

  it("does not set category for non-labor role with empty category", () => {
    const lineItem = createLineItem({
      category: "",
      description: "Software License",
    });

    const result = ensureCategory(lineItem);

    assert.equal(result.category, "");
    assert.equal(result, lineItem); // Should return same object if unchanged
  });

  it("is idempotent - multiple calls produce same result", () => {
    const lineItem = createLineItem({
      category: undefined as any,
      description: "Ingeniero",
    });

    const firstPass = ensureCategory(lineItem);
    const secondPass = ensureCategory(firstPass);
    const thirdPass = ensureCategory(secondPass);

    assert.equal(firstPass.category, "Mano de Obra Directa");
    assert.equal(secondPass.category, "Mano de Obra Directa");
    assert.equal(thirdPass.category, "Mano de Obra Directa");
    // After first pass, subsequent passes should return the same object
    assert.equal(secondPass, firstPass);
    assert.equal(thirdPass, secondPass);
  });

  it("handles role field when present", () => {
    const lineItem = createLineItem({
      category: "",
      description: "Team Member",
    }) as LineItem & { role?: string };
    
    lineItem.role = "Service Delivery Manager";

    const result = ensureCategory(lineItem);

    assert.equal(result.category, "Mano de Obra Directa");
  });

  it("handles subtype field for role detection", () => {
    const lineItem = createLineItem({
      category: "",
      subtype: "Project Manager",
      description: "Resource",
    });

    const result = ensureCategory(lineItem);

    assert.equal(result.category, "Mano de Obra Directa");
  });
});

describe("isLabor", () => {
  it("returns true for exact category match", () => {
    assert.equal(isLabor("Mano de Obra Directa", undefined), true);
  });

  it("returns true for category match with different casing", () => {
    assert.equal(isLabor("mano de obra directa", undefined), true);
    assert.equal(isLabor("MANO DE OBRA DIRECTA", undefined), true);
  });

  it("returns true for category match with extra whitespace", () => {
    assert.equal(isLabor("  Mano de Obra Directa  ", undefined), true);
  });

  it("returns true for labor role when category is missing", () => {
    assert.equal(isLabor(undefined, "Ingeniero"), true);
    assert.equal(isLabor("", "Service Delivery Manager"), true);
  });

  it("returns false for non-labor category", () => {
    assert.equal(isLabor("Gastos Generales", undefined), false);
  });

  it("returns false when both category and role are missing", () => {
    assert.equal(isLabor(undefined, undefined), false);
    assert.equal(isLabor("", ""), false);
  });

  it("prioritizes category over role when both present", () => {
    // If category says it's labor, that takes precedence
    assert.equal(isLabor("Mano de Obra Directa", "Office Supplies"), true);
    // If category says it's not labor, that takes precedence
    assert.equal(isLabor("Gastos Generales", "Ingeniero"), false);
  });
});

describe("normalizeCategory", () => {
  it("trims whitespace and lowercases", () => {
    assert.equal(normalizeCategory("  Mano de Obra Directa  "), "mano de obra directa");
  });

  it("handles undefined", () => {
    assert.equal(normalizeCategory(undefined), "");
  });

  it("handles empty string", () => {
    assert.equal(normalizeCategory(""), "");
  });
});
