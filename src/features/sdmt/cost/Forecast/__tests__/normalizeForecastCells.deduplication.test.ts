/**
 * normalizeForecastCells Deduplication Test Suite
 *
 * Tests to ensure:
 * 1. Duplicate forecast cells (same projectId, rubroId, month) are merged
 * 2. Numeric values (planned, forecast, actual) are summed
 * 3. Non-numeric fields prefer non-empty values
 * 4. matchingIds arrays are merged without duplicates
 * 5. Debug mode logs deduplication statistics
 *
 * This test suite validates the fix for duplicate forecast cell issues
 * mentioned in the SDMT Forecast validation requirements.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { normalizeForecastCells } from "@/features/sdmt/cost/utils/dataAdapters";

/**
 * Test: Basic deduplication of identical cells
 */
describe("normalizeForecastCells - Basic Deduplication", () => {
  it("should merge duplicate cells with same projectId, rubroId, and month", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
        actual: 95,
      },
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 50,
        forecast: 55,
        actual: 45,
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    // Should have only one cell after deduplication
    assert.strictEqual(result.length, 1, "Should have exactly one deduplicated cell");

    // Values should be summed
    assert.strictEqual(result[0].planned, 150, "Planned should be 100 + 50 = 150");
    assert.strictEqual(result[0].forecast, 165, "Forecast should be 110 + 55 = 165");
    assert.strictEqual(result[0].actual, 140, "Actual should be 95 + 45 = 140");
    assert.strictEqual(result[0].variance, 15, "Variance should be forecast - planned = 15");
  });

  it("should keep separate cells for different months", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
        actual: 95,
      },
      {
        line_item_id: "RB0001",
        month: 2,
        planned: 100,
        forecast: 110,
        actual: 95,
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    // Should have two cells (different months)
    assert.strictEqual(result.length, 2, "Should have two cells for different months");
  });

  it("should keep separate cells for different rubroIds", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
        actual: 95,
      },
      {
        line_item_id: "RB0002",
        month: 1,
        planned: 100,
        forecast: 110,
        actual: 95,
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    // Should have two cells (different rubros)
    assert.strictEqual(result.length, 2, "Should have two cells for different rubros");
  });
});

/**
 * Test: Merging non-numeric fields
 */
describe("normalizeForecastCells - Non-numeric Field Merging", () => {
  it("should prefer non-empty variance_reason", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
        variance_reason: "",
      },
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 50,
        forecast: 55,
        variance_reason: "Budget adjustment",
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(
      result[0].variance_reason,
      "Budget adjustment",
      "Should prefer non-empty variance_reason"
    );
  });

  it("should prefer non-empty notes", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
        notes: "",
      },
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 50,
        forecast: 55,
        notes: "Updated forecast",
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].notes, "Updated forecast", "Should prefer non-empty notes");
  });

  it("should prefer more recent last_updated timestamp", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
        last_updated: "2024-01-01T00:00:00Z",
        updated_by: "user1",
      },
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 50,
        forecast: 55,
        last_updated: "2024-01-15T00:00:00Z",
        updated_by: "user2",
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(
      result[0].last_updated,
      "2024-01-15T00:00:00Z",
      "Should prefer more recent timestamp"
    );
    assert.strictEqual(result[0].updated_by, "user2", "Should use updated_by from more recent cell");
  });
});

/**
 * Test: matchingIds array merging
 */
describe("normalizeForecastCells - matchingIds Merging", () => {
  it("should merge matchingIds arrays without duplicates", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        rubroId: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
      },
      {
        line_item_id: "RB0001",
        rubroId: "RUBRO#RB0001",
        month: 1,
        planned: 50,
        forecast: 55,
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    assert.strictEqual(result.length, 1);
    assert.ok(
      result[0].matchingIds && result[0].matchingIds.length > 0,
      "Should have merged matchingIds"
    );
    
    // Check that there are no duplicates
    const uniqueIds = new Set(result[0].matchingIds);
    assert.strictEqual(
      uniqueIds.size,
      result[0].matchingIds!.length,
      "matchingIds should not contain duplicates"
    );
  });
});

/**
 * Test: Edge cases
 */
describe("normalizeForecastCells - Edge Cases", () => {
  it("should skip cells with invalid month during deduplication", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        month: 0, // Invalid month
        planned: 100,
        forecast: 110,
      },
      {
        line_item_id: "RB0002",
        month: 1,
        planned: 100,
        forecast: 110,
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    // Should only have the valid cell
    assert.strictEqual(result.length, 1, "Should skip invalid month during deduplication");
    assert.strictEqual(result[0].line_item_id, "RB0002");
  });

  it("should skip cells with no line_item_id during deduplication", () => {
    const cells = [
      {
        line_item_id: "",
        month: 1,
        planned: 100,
        forecast: 110,
      },
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    // Should only have the valid cell
    assert.strictEqual(result.length, 1, "Should skip empty line_item_id during deduplication");
    assert.strictEqual(result[0].line_item_id, "RB0001");
  });

  it("should handle zero values correctly in summation", () => {
    const cells = [
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
      },
      {
        line_item_id: "RB0001",
        month: 1,
        planned: 100,
        forecast: 110,
        actual: 95,
      },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].planned, 100, "Should handle zero values in summation");
    assert.strictEqual(result[0].forecast, 110);
    assert.strictEqual(result[0].actual, 95);
  });
});

/**
 * Test: Complex scenario with multiple duplicates
 */
describe("normalizeForecastCells - Complex Scenarios", () => {
  it("should handle multiple duplicates across different rubros and months", () => {
    const cells = [
      { line_item_id: "RB0001", month: 1, planned: 100, forecast: 110 },
      { line_item_id: "RB0001", month: 1, planned: 50, forecast: 55 },
      { line_item_id: "RB0001", month: 2, planned: 100, forecast: 110 },
      { line_item_id: "RB0002", month: 1, planned: 200, forecast: 220 },
      { line_item_id: "RB0002", month: 1, planned: 100, forecast: 110 },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    // Should have 3 cells:
    // - RB0001 month 1 (merged)
    // - RB0001 month 2 (single)
    // - RB0002 month 1 (merged)
    assert.strictEqual(result.length, 3, "Should have 3 cells after deduplication");

    const rb0001m1 = result.find((c) => c.line_item_id === "RB0001" && c.month === 1);
    const rb0001m2 = result.find((c) => c.line_item_id === "RB0001" && c.month === 2);
    const rb0002m1 = result.find((c) => c.line_item_id === "RB0002" && c.month === 1);

    assert.ok(rb0001m1, "Should have RB0001 month 1");
    assert.ok(rb0001m2, "Should have RB0001 month 2");
    assert.ok(rb0002m1, "Should have RB0002 month 1");

    assert.strictEqual(rb0001m1!.planned, 150, "RB0001 month 1 should be merged");
    assert.strictEqual(rb0001m2!.planned, 100, "RB0001 month 2 should be single");
    assert.strictEqual(rb0002m1!.planned, 300, "RB0002 month 1 should be merged");
  });

  it("should handle triple duplicates", () => {
    const cells = [
      { line_item_id: "RB0001", month: 1, planned: 100, forecast: 110 },
      { line_item_id: "RB0001", month: 1, planned: 50, forecast: 55 },
      { line_item_id: "RB0001", month: 1, planned: 25, forecast: 28 },
    ];

    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: false,
    });

    assert.strictEqual(result.length, 1, "Should merge all three duplicates into one");
    assert.strictEqual(result[0].planned, 175, "Should sum all three planned values");
    assert.strictEqual(result[0].forecast, 193, "Should sum all three forecast values");
  });
});

/**
 * Test: Debug mode logging
 */
describe("normalizeForecastCells - Debug Mode", () => {
  it("should log deduplication statistics when debugMode is true", () => {
    const cells = [
      { line_item_id: "RB0001", month: 1, planned: 100, forecast: 110 },
      { line_item_id: "RB0001", month: 1, planned: 50, forecast: 55 },
    ];

    // This test just verifies the function runs without error in debug mode
    // In a real environment, we'd capture console.log output
    const result = normalizeForecastCells(cells, {
      projectId: "P-TEST-001",
      debugMode: true,
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].planned, 150);
  });
});
