import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureCategory } from "../rubros-category-utils";
import type { LineItem } from "@/types/domain";

/**
 * Integration test for rubro category enrichment
 * 
 * This test simulates the data flow from API to UI to ensure
 * labor roles are properly categorized as 'Mano de Obra Directa'
 */

describe("Rubro Category Integration", () => {
  it("enriches line items from API with correct labor category", () => {
    // Simulate line items coming from API with missing categories
    const rawLineItems: Partial<LineItem>[] = [
      {
        id: "RUBRO-001",
        description: "Ingeniero Senior Backend",
        category: undefined, // Missing category
        one_time: false,
        recurring: true,
        qty: 1,
        unit_cost: 5000,
        currency: "USD",
        start_month: 1,
        end_month: 12,
      },
      {
        id: "RUBRO-002",
        description: "Service Delivery Manager",
        category: "Sin categoría", // Invalid category
        one_time: false,
        recurring: true,
        qty: 1,
        unit_cost: 6000,
        currency: "USD",
        start_month: 1,
        end_month: 12,
      },
      {
        id: "RUBRO-003",
        description: "Project Manager",
        category: "", // Empty category
        one_time: false,
        recurring: true,
        qty: 1,
        unit_cost: 5500,
        currency: "USD",
        start_month: 1,
        end_month: 12,
      },
      {
        id: "RUBRO-004",
        description: "Cloud Infrastructure License",
        category: "", // Non-labor item
        one_time: false,
        recurring: true,
        qty: 1,
        unit_cost: 2000,
        currency: "USD",
        start_month: 1,
        end_month: 12,
      },
    ];

    // Apply enrichment (simulating what happens in useProjectLineItems and normalizeLineItem)
    const enrichedItems = rawLineItems.map(item => 
      ensureCategory(item as LineItem)
    );

    // Verify labor roles are correctly categorized
    assert.equal(
      enrichedItems[0].category,
      "Mano de Obra Directa",
      "Ingeniero should be categorized as Mano de Obra Directa"
    );

    assert.equal(
      enrichedItems[1].category,
      "Mano de Obra Directa",
      "Service Delivery Manager should be categorized as Mano de Obra Directa"
    );

    assert.equal(
      enrichedItems[2].category,
      "Mano de Obra Directa",
      "Project Manager should be categorized as Mano de Obra Directa"
    );

    // Verify non-labor item is not changed
    assert.equal(
      enrichedItems[3].category,
      "",
      "Non-labor item should keep empty category (not force-assigned)"
    );
  });

  it("preserves existing valid categories for labor roles", () => {
    const lineItem: Partial<LineItem> = {
      id: "RUBRO-005",
      description: "Ingeniero Junior",
      category: "Mano de Obra Indirecta", // Valid category, even if not ideal
      one_time: false,
      recurring: true,
      qty: 1,
      unit_cost: 3000,
      currency: "USD",
      start_month: 1,
      end_month: 12,
    };

    const enriched = ensureCategory(lineItem as LineItem);

    // Should preserve the existing category even though it's a labor role
    assert.equal(
      enriched.category,
      "Mano de Obra Indirecta",
      "Should preserve existing valid category"
    );
  });

  it("handles role information from subtype field", () => {
    const lineItem: Partial<LineItem> = {
      id: "RUBRO-006",
      description: "Resource", // Generic description
      subtype: "Project Manager", // Role in subtype
      category: "",
      one_time: false,
      recurring: true,
      qty: 1,
      unit_cost: 5500,
      currency: "USD",
      start_month: 1,
      end_month: 12,
    };

    const enriched = ensureCategory(lineItem as LineItem);

    assert.equal(
      enriched.category,
      "Mano de Obra Directa",
      "Should detect labor role from subtype field"
    );
  });

  it("handles mixed case and extra whitespace in descriptions", () => {
    const lineItems: Partial<LineItem>[] = [
      {
        id: "RUBRO-007",
        description: "  INGENIERO LIDER  ", // Uppercase with whitespace
        category: "",
        one_time: false,
        recurring: true,
        qty: 1,
        unit_cost: 7000,
        currency: "USD",
        start_month: 1,
        end_month: 12,
      },
      {
        id: "RUBRO-008",
        description: "service delivery Manager", // Mixed case
        category: "sin categoría", // Lowercase variant
        one_time: false,
        recurring: true,
        qty: 1,
        unit_cost: 6500,
        currency: "USD",
        start_month: 1,
        end_month: 12,
      },
    ];

    const enriched = lineItems.map(item => ensureCategory(item as LineItem));

    assert.equal(
      enriched[0].category,
      "Mano de Obra Directa",
      "Should handle uppercase and whitespace"
    );

    assert.equal(
      enriched[1].category,
      "Mano de Obra Directa",
      "Should handle mixed case and lowercase 'sin categoría'"
    );
  });
});
