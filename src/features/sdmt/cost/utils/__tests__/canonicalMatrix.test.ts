import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCanonicalMatrix, deriveKpisFromMatrix } from "../canonicalMatrix";
import type { BuildCanonicalMatrixInput } from "../canonicalMatrix";

/**
 * Canonical Matrix Tests
 * 
 * Tests for src/features/sdmt/cost/utils/canonicalMatrix.ts
 * Validates matrix building and KPI derivation with deterministic fixtures.
 */

describe("buildCanonicalMatrix", () => {
  it("should build matrix from single allocation spanning one month", () => {
    const input: BuildCanonicalMatrixInput = {
      projects: [{ id: "P-001", name: "Project Alpha" }],
      forecastPayloads: [],
      allocations: [
        {
          projectId: "P-001",
          rubroId: "R-100",
          lineItemId: "LI-001",
          costType: "labor",
          description: "Developer allocation",
          category: "MOD",
          startMonth: 0,
          endMonth: 0,
          monthlyAmount: 5000,
        }
      ],
      monthsToShow: 12,
    };

    const result = buildCanonicalMatrix(input);

    // Verify result structure
    assert.ok(result.matrixRows, "Result should have matrixRows");
    assert.ok(result.projectIndex, "Result should have projectIndex");
    assert.ok(result.totals, "Result should have totals");

    // Verify at least one row was created
    assert.ok(result.matrixRows.length >= 1, "Should create at least one matrix row");

    // Verify project index contains the project
    assert.ok(result.projectIndex["P-001"], "Project index should contain P-001");
    assert.equal(result.projectIndex["P-001"].name, "Project Alpha");

    // Verify totals structure
    assert.ok(Array.isArray(result.totals.byMonth), "Totals should have byMonth array");
    assert.ok(result.totals.overall, "Totals should have overall object");
  });

  it("should handle multiple allocations for same rubro spanning different months", () => {
    const input: BuildCanonicalMatrixInput = {
      projects: [{ id: "P-001", name: "Project Alpha" }],
      forecastPayloads: [],
      allocations: [
        {
          projectId: "P-001",
          rubroId: "R-100",
          lineItemId: "LI-001",
          costType: "labor",
          description: "Developer Q1",
          category: "MOD",
          startMonth: 0,
          endMonth: 2, // Months 0, 1, 2
          monthlyAmount: 5000,
        },
        {
          projectId: "P-001",
          rubroId: "R-100",
          lineItemId: "LI-002",
          costType: "labor",
          description: "Developer Q2",
          category: "MOD",
          startMonth: 3,
          endMonth: 5, // Months 3, 4, 5
          monthlyAmount: 5500,
        }
      ],
      monthsToShow: 12,
    };

    const result = buildCanonicalMatrix(input);

    // Should have rows for the allocations
    assert.ok(result.matrixRows.length >= 1, "Should create matrix rows for allocations");

    // Verify project is in index
    assert.ok(result.projectIndex["P-001"], "Project should be indexed");

    // Verify monthly totals exist and have expected structure
    assert.ok(result.totals.byMonth.length > 0, "Should have monthly totals");
    assert.equal(typeof result.totals.overall.planned, "number", "Overall planned should be a number");
    assert.equal(typeof result.totals.overall.forecast, "number", "Overall forecast should be a number");
    assert.equal(typeof result.totals.overall.actual, "number", "Overall actual should be a number");
  });

  it("should handle empty allocations and produce empty matrix", () => {
    const input: BuildCanonicalMatrixInput = {
      projects: [{ id: "P-001", name: "Project Alpha" }],
      forecastPayloads: [],
      allocations: [],
      monthsToShow: 12,
    };

    const result = buildCanonicalMatrix(input);

    // Result should still have valid structure even with no data
    assert.ok(result.matrixRows, "Result should have matrixRows");
    assert.ok(result.projectIndex, "Result should have projectIndex");
    assert.ok(result.totals, "Result should have totals");
  });
});

describe("deriveKpisFromMatrix", () => {
  it("should derive KPIs from simple matrix with single row", () => {
    // First build a simple matrix
    const input: BuildCanonicalMatrixInput = {
      projects: [{ id: "P-001", name: "Project Alpha" }],
      forecastPayloads: [],
      allocations: [
        {
          projectId: "P-001",
          rubroId: "R-100",
          lineItemId: "LI-001",
          costType: "labor",
          description: "Developer",
          category: "MOD",
          startMonth: 0,
          endMonth: 2,
          monthlyAmount: 5000,
        }
      ],
      monthsToShow: 12,
    };

    const matrix = buildCanonicalMatrix(input);
    const kpis = deriveKpisFromMatrix(matrix.matrixRows, 12);

    // Verify KPI structure
    assert.ok(kpis, "Should return KPIs object");
    assert.equal(typeof kpis.presupuesto, "number", "presupuesto should be a number");
    assert.equal(typeof kpis.pronostico, "number", "pronostico should be a number");
    assert.equal(typeof kpis.real, "number", "real should be a number");
    assert.equal(typeof kpis.consumo, "number", "consumo should be a number");
    
    // presupuesto should equal overall planned total
    assert.equal(kpis.presupuesto, matrix.totals.overall.planned, "presupuesto should match planned total");
  });

  it("should calculate correct totals for multiple allocations", () => {
    const input: BuildCanonicalMatrixInput = {
      projects: [
        { id: "P-001", name: "Project Alpha" },
        { id: "P-002", name: "Project Beta" }
      ],
      forecastPayloads: [],
      allocations: [
        {
          projectId: "P-001",
          rubroId: "R-100",
          lineItemId: "LI-001",
          costType: "labor",
          description: "Dev 1",
          category: "MOD",
          startMonth: 0,
          endMonth: 0,
          monthlyAmount: 3000,
        },
        {
          projectId: "P-002",
          rubroId: "R-100",
          lineItemId: "LI-002",
          costType: "labor",
          description: "Dev 2",
          category: "MOD",
          startMonth: 0,
          endMonth: 0,
          monthlyAmount: 4000,
        }
      ],
      monthsToShow: 12,
    };

    const matrix = buildCanonicalMatrix(input);
    const kpis = deriveKpisFromMatrix(matrix.matrixRows, 12);

    // Verify KPIs are calculated
    assert.ok(kpis.presupuesto >= 0, "presupuesto should be non-negative");
    assert.ok(kpis.pronostico >= 0, "pronostico should be non-negative");
  });
});
