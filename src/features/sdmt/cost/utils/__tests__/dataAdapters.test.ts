import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeLineItemFromApi } from "../dataAdapters";

describe("normalizeLineItemFromApi - category canonicalization", () => {
  it("should categorize items with 'Mano de Obra' as Labor", () => {
    const raw = {
      rubro_id: "TEST-001",
      categoria: "Mano de Obra",
      descripcion: "Engineer",
      unit_cost: 5000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Labor");
  });

  it("should categorize Project Manager as Labor", () => {
    const raw = {
      rubro_id: "TEST-002",
      description: "Project Manager",
      categoria: "",
      unit_cost: 8000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Labor");
  });

  it("should categorize Service Delivery Manager as Labor", () => {
    const raw = {
      rubro_id: "TEST-003",
      description: "Service Delivery Manager",
      unit_cost: 9000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Labor");
  });

  it("should categorize Ingeniero roles as Labor", () => {
    const testCases = [
      { descripcion: "Ingeniero Senior", expected: "Labor" },
      { descripcion: "Ingeniero Soporte N1", expected: "Labor" },
      { descripcion: "Ingeniero Soporte N2", expected: "Labor" },
      { descripcion: "Ingeniero Soporte N3", expected: "Labor" },
      { descripcion: "Ingeniera Junior", expected: "Labor" },
      { role: "Ingeniero Delivery", expected: "Labor" },
    ];

    for (const testCase of testCases) {
      const raw = {
        rubro_id: "TEST-ING",
        ...testCase,
        unit_cost: 5000,
      };
      
      const result = normalizeLineItemFromApi(raw);
      
      assert.strictEqual(
        result.category,
        testCase.expected,
        `Expected ${JSON.stringify(testCase)} to be categorized as ${testCase.expected}`
      );
    }
  });

  it("should detect labor from subtype field", () => {
    const raw = {
      rubro_id: "TEST-004",
      tipo_costo: "Project Manager",
      descripcion: "Resource allocation",
      unit_cost: 7000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Labor");
  });

  it("should NOT categorize non-labor items as Labor", () => {
    const raw = {
      rubro_id: "TEST-005",
      categoria: "Equipos y Tecnología",
      descripcion: "Server Hardware",
      unit_cost: 10000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Equipos y Tecnología");
    assert.notStrictEqual(result.category, "Labor");
  });

  it("should handle mixed-case labor keywords", () => {
    const testCases = [
      { description: "ENGINEER LEAD", expected: "Labor" },
      { categoria: "Labor Cost", expected: "Labor" },
      { description: "support engineer", expected: "Labor" },
    ];

    for (const testCase of testCases) {
      const raw = {
        rubro_id: "TEST-CASE",
        ...testCase,
        unit_cost: 5000,
      };
      
      const result = normalizeLineItemFromApi(raw);
      
      assert.strictEqual(result.category, testCase.expected);
    }
  });

  it("should categorize SDM abbreviation as Labor", () => {
    const raw = {
      rubro_id: "TEST-006",
      description: "SDM",
      unit_cost: 9000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Labor");
  });

  it("should categorize PM abbreviation as Labor", () => {
    const raw = {
      rubro_id: "TEST-007",
      role: "PM",
      descripcion: "Project oversight",
      unit_cost: 8000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Labor");
  });

  it("should preserve description field mapping", () => {
    const raw = {
      rubro_id: "TEST-008",
      nombre: "Ingeniero Senior",
      unit_cost: 6000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.description, "Ingeniero Senior");
    assert.strictEqual(result.category, "Labor");
  });

  it("should fallback to 'Rubro' for non-labor items without category", () => {
    const raw = {
      rubro_id: "TEST-009",
      descripcion: "Office Supplies",
      unit_cost: 500,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Rubro");
  });

  it("should handle FTE keyword as Labor indicator", () => {
    const raw = {
      rubro_id: "TEST-010",
      categoria: "FTE Cost",
      descripcion: "Full-time equivalent",
      unit_cost: 5500,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Labor");
  });

  it("should handle MOD abbreviation as Labor indicator", () => {
    const raw = {
      rubro_id: "TEST-011",
      categoria: "MOD",
      descripcion: "Direct labor",
      unit_cost: 5000,
    };
    
    const result = normalizeLineItemFromApi(raw);
    
    assert.strictEqual(result.category, "Labor");
  });
});

describe("normalizeForecastCells - deduplication", () => {
  it("should deduplicate cells with same canonical rubro ID and month", async () => {
    const { normalizeForecastCells } = await import("../dataAdapters");
    
    const cells = [
      {
        line_item_id: "RB0001", // Legacy ID for MOD-ING
        month: 1,
        planned: 1000,
        forecast: 1100,
        actual: 900,
      },
      {
        line_item_id: "MOD-ING", // Canonical ID
        month: 1,
        planned: 2000,
        forecast: 2200,
        actual: 1800,
      },
    ];
    
    const result = normalizeForecastCells(cells);
    
    // Should merge into single cell
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].line_item_id, "MOD-ING");
    assert.strictEqual(result[0].month, 1);
    assert.strictEqual(result[0].planned, 3000); // 1000 + 2000
    assert.strictEqual(result[0].forecast, 3300); // 1100 + 2200
    assert.strictEqual(result[0].actual, 2700); // 900 + 1800
  });

  it("should not deduplicate cells with same rubro but different months", async () => {
    const { normalizeForecastCells } = await import("../dataAdapters");
    
    const cells = [
      {
        line_item_id: "MOD-ING",
        month: 1,
        planned: 1000,
        forecast: 1100,
        actual: 900,
      },
      {
        line_item_id: "MOD-ING",
        month: 2,
        planned: 2000,
        forecast: 2200,
        actual: 1800,
      },
    ];
    
    const result = normalizeForecastCells(cells);
    
    // Should NOT merge - different months
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].month, 1);
    assert.strictEqual(result[1].month, 2);
  });

  it("should merge matchingIds arrays when deduplicating", async () => {
    const { normalizeForecastCells } = await import("../dataAdapters");
    
    const cells = [
      {
        line_item_id: "RB0001",
        rubro_id: "RUBRO-001",
        month: 3,
        planned: 500,
        forecast: 600,
      },
      {
        line_item_id: "MOD-ING",
        linea_codigo: "MOD-ING",
        month: 3,
        planned: 1500,
        forecast: 1600,
      },
    ];
    
    const result = normalizeForecastCells(cells);
    
    assert.strictEqual(result.length, 1);
    assert.ok(Array.isArray(result[0].matchingIds));
    // Should contain all variations
    assert.ok(result[0].matchingIds!.includes("MOD-ING"));
    // Should have multiple matching IDs from both cells
    assert.ok(result[0].matchingIds!.length >= 3);
  });

  it("should skip cells with invalid month values", async () => {
    const { normalizeForecastCells } = await import("../dataAdapters");
    
    const cells = [
      {
        line_item_id: "MOD-ING",
        month: 0, // Invalid
        planned: 1000,
      },
      {
        line_item_id: "MOD-ING",
        month: 61, // Invalid (> 60)
        planned: 2000,
      },
      {
        line_item_id: "MOD-ING",
        month: 5, // Valid
        planned: 3000,
      },
    ];
    
    const result = normalizeForecastCells(cells);
    
    // Should only keep the valid cell
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].month, 5);
    assert.strictEqual(result[0].planned, 3000);
  });

  it("should include canonical ID in matchingIds for better invoice matching", async () => {
    const { normalizeForecastCells } = await import("../dataAdapters");
    
    const cells = [
      {
        line_item_id: "RB0003", // Legacy ID for MOD-SDM
        month: 6,
        planned: 5000,
        forecast: 5500,
      },
    ];
    
    const result = normalizeForecastCells(cells);
    
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].line_item_id, "MOD-SDM"); // Canonicalized
    assert.ok(result[0].matchingIds!.includes("MOD-SDM")); // Canonical ID
    assert.ok(result[0].matchingIds!.includes("RB0003")); // Original legacy ID
  });
});
