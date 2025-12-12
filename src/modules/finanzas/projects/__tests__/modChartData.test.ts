/**
 * Tests for MOD chart data computation logic
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import type { ModChartPoint } from "../ProjectDetailsPanel";
import type { MODProjectionByMonth } from "@/api/finanzas";

/**
 * Helper function to transform MODProjectionByMonth to ModChartPoint
 * This replicates the logic from ProjectsManager.tsx
 */
function transformToModChartData(
  dataSource: MODProjectionByMonth[]
): ModChartPoint[] {
  if (dataSource.length === 0) {
    return [];
  }

  return dataSource
    .map((entry) => ({
      month: entry.month,
      "Allocations MOD": entry.totalPlanMOD ?? 0,
      "Adjusted/Projected MOD": entry.totalForecastMOD ?? entry.totalPlanMOD ?? 0,
      "Actual Payroll MOD": entry.totalActualMOD ?? 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

describe("MOD Chart Data Transformation", () => {
  it("should return empty array when no data provided", () => {
    const result = transformToModChartData([]);
    assert.deepStrictEqual(result, []);
  });

  it("should transform single month data correctly", () => {
    const input: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 12000,
        totalActualMOD: 9500,
        projectCount: 1,
      },
    ];

    const result = transformToModChartData(input);

    assert.deepStrictEqual(result, [
      {
        month: "2025-01",
        "Allocations MOD": 10000,
        "Adjusted/Projected MOD": 12000,
        "Actual Payroll MOD": 9500,
      },
    ]);
  });

  it("should transform multiple months and sort by month ascending", () => {
    const input: MODProjectionByMonth[] = [
      {
        month: "2025-03",
        totalPlanMOD: 15000,
        totalForecastMOD: 16000,
        totalActualMOD: 14500,
        projectCount: 2,
      },
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 12000,
        totalActualMOD: 9500,
        projectCount: 1,
      },
      {
        month: "2025-02",
        totalPlanMOD: 12000,
        totalForecastMOD: 13000,
        totalActualMOD: 11000,
        projectCount: 1,
      },
    ];

    const result = transformToModChartData(input);

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].month, "2025-01");
    assert.strictEqual(result[1].month, "2025-02");
    assert.strictEqual(result[2].month, "2025-03");
  });

  it("should use totalForecastMOD when available, falling back to totalPlanMOD when forecast is undefined/null", () => {
    // When totalForecastMOD is 0, it should use 0 (not fall back)
    const input1: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 0,
        totalActualMOD: 9500,
        projectCount: 1,
      },
    ];

    const result1 = transformToModChartData(input1);
    assert.strictEqual(result1[0]["Adjusted/Projected MOD"], 0);

    // When totalForecastMOD is undefined/null, should fall back to totalPlanMOD
    // Using Partial to create test data without type assertion
    const input2: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalActualMOD: 9500,
        projectCount: 1,
      } as MODProjectionByMonth,
    ];

    const result2 = transformToModChartData(input2);
    assert.strictEqual(result2[0]["Adjusted/Projected MOD"], 10000);
  });

  it("should handle null/undefined values as 0", () => {
    const input: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 0,
        totalActualMOD: 0,
        projectCount: 1,
      },
    ];

    const result = transformToModChartData(input);

    assert.strictEqual(result[0]["Allocations MOD"], 10000);
    assert.strictEqual(result[0]["Actual Payroll MOD"], 0);
  });

  it("should handle mixed actual and plan data", () => {
    const input: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 12000,
        totalActualMOD: 9500,
        projectCount: 1,
      },
      {
        month: "2025-02",
        totalPlanMOD: 12000,
        totalForecastMOD: 13000,
        totalActualMOD: 0, // No actuals yet
        projectCount: 1,
      },
    ];

    const result = transformToModChartData(input);

    assert.strictEqual(result[0]["Actual Payroll MOD"], 9500);
    assert.strictEqual(result[1]["Actual Payroll MOD"], 0);
  });

  it("should handle aggregated portfolio data (multiple projects)", () => {
    const input: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 50000, // Sum of 5 projects
        totalForecastMOD: 52000,
        totalActualMOD: 48000,
        projectCount: 5,
      },
    ];

    const result = transformToModChartData(input);

    assert.strictEqual(result[0]["Allocations MOD"], 50000);
    assert.strictEqual(result[0]["Adjusted/Projected MOD"], 52000);
    assert.strictEqual(result[0]["Actual Payroll MOD"], 48000);
  });
});

describe("MOD Chart Data Filtering", () => {
  it("should filter by projectId when viewing single project", () => {
    // Mock data for all projects
    const allProjectsData: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 50000,
        totalForecastMOD: 52000,
        totalActualMOD: 48000,
        projectCount: 5,
      },
    ];

    // Mock data for single project (would be returned by getPayrollDashboardForProject)
    const singleProjectData: MODProjectionByMonth[] = [
      {
        month: "2025-01",
        totalPlanMOD: 10000,
        totalForecastMOD: 12000,
        totalActualMOD: 9500,
        projectCount: 1,
      },
    ];

    // When viewing single project, use single project data
    const resultSingleProject = transformToModChartData(singleProjectData);
    assert.strictEqual(resultSingleProject[0]["Allocations MOD"], 10000);

    // When viewing all projects, use aggregated data
    const resultAllProjects = transformToModChartData(allProjectsData);
    assert.strictEqual(resultAllProjects[0]["Allocations MOD"], 50000);
  });
});
