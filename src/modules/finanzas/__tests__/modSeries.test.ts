/**
 * Unit tests for MOD chart data series builder
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toMonthKey,
  isModRow,
  buildModPerformanceSeries,
  type ModChartPoint,
} from "../projects/modSeries";

// ============================================================================
// Helper Tests
// ============================================================================

describe("toMonthKey", () => {
  it("should convert YYYY-MM-DD to YYYY-MM", () => {
    assert.strictEqual(toMonthKey("2025-01-15"), "2025-01");
    assert.strictEqual(toMonthKey("2024-12-31"), "2024-12");
  });

  it("should keep YYYY-MM as-is", () => {
    assert.strictEqual(toMonthKey("2025-01"), "2025-01");
    assert.strictEqual(toMonthKey("2024-12"), "2024-12");
  });

  it("should handle Date objects", () => {
    const date = new Date("2025-03-15");
    assert.strictEqual(toMonthKey(date), "2025-03");
  });

  it("should return null for invalid inputs", () => {
    assert.strictEqual(toMonthKey(""), null);
    assert.strictEqual(toMonthKey("invalid"), null);
    assert.strictEqual(toMonthKey(null), null);
    assert.strictEqual(toMonthKey(undefined), null);
  });

  it("should handle edge cases", () => {
    // "2025-1" could be parsed as a date, so it may succeed
    // Testing truly invalid formats
    assert.strictEqual(toMonthKey("25-01"), null); // Invalid format
    assert.strictEqual(toMonthKey("not-a-date"), null); // Invalid format
  });
});

describe("isModRow", () => {
  it("should return true for rows with MOD totals", () => {
    assert.strictEqual(isModRow({ totalActualMOD: 1000 }), true);
    assert.strictEqual(isModRow({ totalPlanMOD: 2000 }), true);
    assert.strictEqual(isModRow({ totalForecastMOD: 3000 }), true);
  });

  it("should detect MOD in category field", () => {
    assert.strictEqual(isModRow({ category: "MOD" }), true);
    assert.strictEqual(isModRow({ categoria: "Mano de Obra" }), true);
    assert.strictEqual(isModRow({ category: "Labor Cost" }), true);
  });

  it("should detect MOD in tipo_costo field", () => {
    assert.strictEqual(isModRow({ tipo_costo: "MOD" }), true);
    assert.strictEqual(isModRow({ tipoCosto: "mano de obra" }), true);
  });

  it("should detect MOD in rubro_name field", () => {
    assert.strictEqual(isModRow({ rubro_name: "MOD - Ingenieros" }), true);
    assert.strictEqual(isModRow({ rubroName: "Labor - Senior Devs" }), true);
  });

  it("should detect MOD in description field", () => {
    assert.strictEqual(isModRow({ description: "Payroll for engineers" }), true);
    assert.strictEqual(isModRow({ descripcion: "Nómina del equipo" }), true);
  });

  it("should detect MOD in rubro ID", () => {
    assert.strictEqual(isModRow({ rubroId: "RUBRO-MOD-001" }), true);
    assert.strictEqual(isModRow({ rubro_id: "labor-cost-eng" }), true);
  });

  it("should return false for non-MOD rows", () => {
    assert.strictEqual(isModRow({ category: "Hardware" }), false);
    assert.strictEqual(isModRow({ tipo_costo: "Equipment" }), false);
    assert.strictEqual(isModRow({ description: "Software licenses" }), false);
  });

  it("should return false for null/undefined", () => {
    assert.strictEqual(isModRow(null), false);
    assert.strictEqual(isModRow(undefined), false);
    assert.strictEqual(isModRow({}), false);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("buildModPerformanceSeries", () => {
  it("should return empty array when no data provided", () => {
    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: [],
    });

    assert.deepStrictEqual(result, []);
  });

  it("should build series from payroll dashboard data", () => {
    const payrollData = [
      {
        month: "2025-01",
        totalActualMOD: 10000,
        totalPlanMOD: 9000,
        totalForecastMOD: 9500,
        projectId: "P-001",
      },
      {
        month: "2025-02",
        totalActualMOD: 11000,
        totalPlanMOD: 10000,
        totalForecastMOD: 10500,
        projectId: "P-001",
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: payrollData,
      allocationsRows: [],
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].month, "2025-01");
    assert.strictEqual(result[0]["Actual Payroll MOD"], 10000);
    assert.strictEqual(result[1].month, "2025-02");
    assert.strictEqual(result[1]["Actual Payroll MOD"], 11000);
  });

  it("should filter by project ID correctly", () => {
    const payrollData = [
      { month: "2025-01", totalActualMOD: 10000, projectId: "P-001" },
      { month: "2025-01", totalActualMOD: 5000, projectId: "P-002" },
      { month: "2025-02", totalActualMOD: 11000, projectId: "P-001" },
    ];

    const result = buildModPerformanceSeries({
      selectedProjectId: "P-001",
      payrollDashboardRows: payrollData,
      allocationsRows: [],
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]["Actual Payroll MOD"], 10000);
    assert.strictEqual(result[1]["Actual Payroll MOD"], 11000);
  });

  it("should aggregate all projects when no project ID specified", () => {
    const payrollData = [
      { month: "2025-01", totalActualMOD: 10000, projectId: "P-001" },
      { month: "2025-01", totalActualMOD: 5000, projectId: "P-002" },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: payrollData,
      allocationsRows: [],
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]["Actual Payroll MOD"], 15000);
  });

  it("should handle allocations series", () => {
    const allocationsData = [
      {
        month: "2025-01",
        amount: 8000,
        category: "MOD",
        projectId: "P-001",
      },
      {
        month: "2025-02",
        amount: 8500,
        category: "MOD",
        projectId: "P-001",
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: allocationsData,
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]["Allocations MOD"], 8000);
    assert.strictEqual(result[1]["Allocations MOD"], 8500);
  });

  it("should expand multi-month allocations", () => {
    const allocationsData = [
      {
        startMonth: "2025-01",
        months: 3,
        monthlyAmount: 5000,
        category: "MOD",
        projectId: "P-001",
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: allocationsData,
    });

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].month, "2025-01");
    assert.strictEqual(result[0]["Allocations MOD"], 5000);
    assert.strictEqual(result[1].month, "2025-02");
    assert.strictEqual(result[1]["Allocations MOD"], 5000);
    assert.strictEqual(result[2].month, "2025-03");
    assert.strictEqual(result[2]["Allocations MOD"], 5000);
  });

  it("should handle baseline series", () => {
    const baselineData = [
      {
        month: "2025-01",
        totalPlanMOD: 9000,
        projectId: "P-001",
      },
      {
        month: "2025-02",
        totalPlanMOD: 9200,
        projectId: "P-001",
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: [],
      baselineRows: baselineData,
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]["Adjusted/Projected MOD"], 9000);
    assert.strictEqual(result[1]["Adjusted/Projected MOD"], 9200);
  });

  it("should apply adjustments over baseline (delta)", () => {
    const baselineData = [
      { month: "2025-01", totalPlanMOD: 10000, projectId: "P-001" },
      { month: "2025-02", totalPlanMOD: 10000, projectId: "P-001" },
    ];

    const adjustmentsData = [
      {
        month: "2025-01",
        monto: 2000,
        tipo: "delta",
        category: "MOD",
        projectId: "P-001",
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: [],
      baselineRows: baselineData,
      adjustmentsRows: adjustmentsData,
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]["Adjusted/Projected MOD"], 12000); // 10000 + 2000
    assert.strictEqual(result[1]["Adjusted/Projected MOD"], 10000); // No adjustment
  });

  it("should apply adjustments over baseline (absolute)", () => {
    const baselineData = [
      { month: "2025-01", totalPlanMOD: 10000, projectId: "P-001" },
    ];

    const adjustmentsData = [
      {
        month: "2025-01",
        monto: 12000,
        adjustmentType: "absolute",
        category: "MOD",
        projectId: "P-001",
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: [],
      baselineRows: baselineData,
      adjustmentsRows: adjustmentsData,
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]["Adjusted/Projected MOD"], 12000); // Override
  });

  it("should handle distributed adjustments", () => {
    const baselineData = [
      { month: "2025-01", totalPlanMOD: 10000, projectId: "P-001" },
      { month: "2025-02", totalPlanMOD: 10000, projectId: "P-001" },
    ];

    const adjustmentsData = [
      {
        projectId: "P-001",
        category: "MOD",
        tipo: "delta", // Explicitly mark as delta
        distribucion: [
          { mes: "2025-01", monto: 1000 },
          { mes: "2025-02", monto: 1500 },
        ],
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: [],
      baselineRows: baselineData,
      adjustmentsRows: adjustmentsData,
    });

    assert.strictEqual(result.length, 2);
    // Delta adjustments add to baseline
    assert.strictEqual(result[0]["Adjusted/Projected MOD"], 11000);
    assert.strictEqual(result[1]["Adjusted/Projected MOD"], 11500);
  });

  it("should sort months in ascending order", () => {
    const payrollData = [
      { month: "2025-03", totalActualMOD: 12000 },
      { month: "2025-01", totalActualMOD: 10000 },
      { month: "2025-02", totalActualMOD: 11000 },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: payrollData,
      allocationsRows: [],
    });

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].month, "2025-01");
    assert.strictEqual(result[1].month, "2025-02");
    assert.strictEqual(result[2].month, "2025-03");
  });

  it("should include complete month domain from all series", () => {
    const payrollData = [
      { month: "2025-01", totalActualMOD: 10000 },
    ];

    const allocationsData = [
      { month: "2025-02", amount: 8000, category: "MOD" },
    ];

    const baselineData = [
      { month: "2025-03", totalPlanMOD: 9000 },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: payrollData,
      allocationsRows: allocationsData,
      baselineRows: baselineData,
    });

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].month, "2025-01");
    assert.strictEqual(result[0]["Actual Payroll MOD"], 10000);
    assert.strictEqual(result[0]["Allocations MOD"], 0);
    assert.strictEqual(result[0]["Adjusted/Projected MOD"], 0);

    assert.strictEqual(result[1].month, "2025-02");
    assert.strictEqual(result[1]["Actual Payroll MOD"], 0);
    assert.strictEqual(result[1]["Allocations MOD"], 8000);
    assert.strictEqual(result[1]["Adjusted/Projected MOD"], 0);

    assert.strictEqual(result[2].month, "2025-03");
    assert.strictEqual(result[2]["Actual Payroll MOD"], 0);
    assert.strictEqual(result[2]["Allocations MOD"], 0);
    assert.strictEqual(result[2]["Adjusted/Projected MOD"], 9000);
  });

  it("should never return NaN values", () => {
    const payrollData = [
      { month: "2025-01", totalActualMOD: "invalid" },
      { month: "2025-02", totalActualMOD: null },
      // month: "2025-03" will not be included because totalActualMOD is undefined
      // and there's no other data to trigger month inclusion
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: payrollData,
      allocationsRows: [],
    });

    // Only months with actual data will be included
    assert.ok(result.length >= 2);
    for (const point of result) {
      assert.ok(!isNaN(point["Actual Payroll MOD"]));
      assert.ok(!isNaN(point["Allocations MOD"]));
      assert.ok(!isNaN(point["Adjusted/Projected MOD"]));
    }
  });

  it("should use custom MOD predicate when provided", () => {
    const payrollData = [
      { month: "2025-01", amount: 10000, customField: "LABOR" },
      { month: "2025-01", amount: 5000, customField: "OTHER" },
    ];

    const customPredicate = (row: any) => row.customField === "LABOR";

    const result = buildModPerformanceSeries({
      payrollDashboardRows: payrollData,
      allocationsRows: [],
      modRubrosPredicate: customPredicate,
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]["Actual Payroll MOD"], 10000);
  });

  it("should handle per-entry payroll rows with grouping", () => {
    const payrollData = [
      { paymentDate: "2025-01-05", amount: 5000, category: "MOD" },
      { paymentDate: "2025-01-20", amount: 5000, category: "MOD" },
      { paymentDate: "2025-02-05", amount: 6000, category: "MOD" },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: payrollData,
      allocationsRows: [],
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].month, "2025-01");
    assert.strictEqual(result[0]["Actual Payroll MOD"], 10000);
    assert.strictEqual(result[1].month, "2025-02");
    assert.strictEqual(result[1]["Actual Payroll MOD"], 6000);
  });

  it("should handle different project ID field variants", () => {
    const payrollData = [
      { month: "2025-01", totalActualMOD: 10000, project_id: "P-001" },
      { month: "2025-02", totalActualMOD: 11000, projectCode: "P-001" },
      { month: "2025-03", totalActualMOD: 12000, pk: "PROJECT#P-001" },
    ];

    const result = buildModPerformanceSeries({
      selectedProjectId: "P-001",
      payrollDashboardRows: payrollData,
      allocationsRows: [],
    });

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0]["Actual Payroll MOD"], 10000);
    assert.strictEqual(result[1]["Actual Payroll MOD"], 11000);
    assert.strictEqual(result[2]["Actual Payroll MOD"], 12000);
  });

  it("should return stable output with exact series keys", () => {
    const payrollData = [
      { month: "2025-01", totalActualMOD: 10000 },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: payrollData,
      allocationsRows: [],
    });

    assert.strictEqual(result.length, 1);
    
    const point = result[0];
    const keys = Object.keys(point);
    
    assert.ok(keys.includes("month"));
    assert.ok(keys.includes("Allocations MOD"));
    assert.ok(keys.includes("Adjusted/Projected MOD"));
    assert.ok(keys.includes("Actual Payroll MOD"));
    assert.strictEqual(keys.length, 4); // No extra keys
  });

  it("should handle allocation with unit_cost and qty", () => {
    const allocationsData = [
      {
        startMonth: "2025-01",
        unit_cost: 1000,
        qty: 5,
        months: 1, // Need months for expansion logic
        category: "MOD",
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: allocationsData,
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]["Allocations MOD"], 5000);
  });

  it("should handle month expansion across year boundaries", () => {
    const allocationsData = [
      {
        startMonth: "2024-11",
        months: 4,
        monthlyAmount: 1000,
        category: "MOD",
      },
    ];

    const result = buildModPerformanceSeries({
      payrollDashboardRows: [],
      allocationsRows: allocationsData,
    });

    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].month, "2024-11");
    assert.strictEqual(result[1].month, "2024-12");
    assert.strictEqual(result[2].month, "2025-01");
    assert.strictEqual(result[3].month, "2025-02");
  });
});
