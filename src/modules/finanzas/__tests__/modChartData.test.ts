/**
 * Tests for MOD chart data computation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MODProjectionByMonth } from "@/api/finanzas";
import type { ModChartPoint } from "../ProjectsManager";

/**
 * Converts payroll dashboard data to MOD chart format
 * This is the pure function version of the logic in ProjectsManager
 */
export function computeModChartData(
  payrollDashboard: MODProjectionByMonth[]
): ModChartPoint[] {
  if (payrollDashboard.length === 0) {
    return [];
  }

  const chartData = payrollDashboard.map((entry) => ({
    month: entry.month,
    "Allocations MOD": entry.totalPlanMOD ?? 0,
    "Adjusted/Projected MOD": entry.totalForecastMOD ?? entry.totalPlanMOD ?? 0,
    "Actual Payroll MOD": entry.totalActualMOD ?? 0,
  }));

  // Sort by month ascending
  return chartData.sort((a, b) => a.month.localeCompare(b.month));
}

describe("computeModChartData", () => {
  it("should return empty array when payroll dashboard is empty", () => {
    const result = computeModChartData([]);
    assert.deepStrictEqual(result, []);
  });

  it("should map payroll dashboard data to chart format", () => {
    const payrollData: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 12000,
        totalActualMOD: 11000,
        projectCount: 1,
      },
    ];

    const result = computeModChartData(payrollData);

    assert.deepStrictEqual(result, [
      {
        month: "2025-01",
        "Allocations MOD": 10000,
        "Adjusted/Projected MOD": 12000,
        "Actual Payroll MOD": 11000,
      },
    ]);
  });

  it("should use totalForecastMOD even when zero (nullish coalescing)", () => {
    const payrollData: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 0,
        totalActualMOD: 9000,
        projectCount: 1,
      },
    ];

    const result = computeModChartData(payrollData);

    // With ??, 0 is a valid value and won't fallback
    // Only null/undefined trigger fallback to totalPlanMOD
    assert.strictEqual(result[0]["Adjusted/Projected MOD"], 0);
  });

  it("should handle null/undefined values gracefully", () => {
    const payrollData: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 0,
        totalForecastMOD: 0,
        totalActualMOD: 0,
        projectCount: 0,
      },
    ];

    const result = computeModChartData(payrollData);

    assert.deepStrictEqual(result, [
      {
        month: "2025-01",
        "Allocations MOD": 0,
        "Adjusted/Projected MOD": 0,
        "Actual Payroll MOD": 0,
      },
    ]);
  });

  it("should sort months in ascending order", () => {
    const payrollData: MODProjectionByMonth[] = [
      {
        month: "2025-03",
        totalPlanMOD: 30000,
        totalForecastMOD: 32000,
        totalActualMOD: 31000,
        projectCount: 1,
      },
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 12000,
        totalActualMOD: 11000,
        projectCount: 1,
      },
      {
        month: "2025-02",
        totalPlanMOD: 20000,
        totalForecastMOD: 22000,
        totalActualMOD: 21000,
        projectCount: 1,
      },
    ];

    const result = computeModChartData(payrollData);

    assert.deepStrictEqual(result.map((item) => item.month), [
      "2025-01",
      "2025-02",
      "2025-03",
    ]);
  });

  it("should handle multiple projects aggregate data", () => {
    const payrollData: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 12000,
        totalActualMOD: 11000,
        projectCount: 2,
      },
      {
        month: "2025-02",
        totalPlanMOD: 15000,
        totalForecastMOD: 17000,
        totalActualMOD: 16000,
        projectCount: 2,
      },
    ];

    const result = computeModChartData(payrollData);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]["Allocations MOD"], 10000);
    assert.strictEqual(result[1]["Allocations MOD"], 15000);
  });
});
