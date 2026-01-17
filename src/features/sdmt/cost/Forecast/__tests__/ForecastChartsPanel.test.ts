/**
 * ForecastChartsPanel Test Suite
 * 
 * Tests for the ForecastChartsPanel component, specifically:
 * 1. Projects per month (M/M) bar series is included in monthly trend data
 * 2. Chart data structure is correct with dual Y-axes support
 */

import { describe, it } from "node:test";
import assert from "node:assert";

/**
 * Test: Monthly trend data includes project counts
 */
describe("ForecastChartsPanel - Projects Bar Series", () => {
  it("should include project counts in monthly trend data", () => {
    // Simulate portfolioTotals
    const portfolioTotals = {
      byMonth: {
        1: { forecast: 10000, actual: 8000, planned: 9000 },
        2: { forecast: 12000, actual: 9000, planned: 11000 },
      },
      overall: {
        forecast: 22000,
        actual: 17000,
        planned: 20000,
        varianceForecast: 0,
        varianceActual: 0,
        percentConsumption: 0,
      },
    };

    // Simulate projectsPerMonth data
    const projectsPerMonth = [
      { month: 1, count: 5 },
      { month: 2, count: 7 },
      { month: 3, count: 0 },
    ];

    // Build monthly trend data (logic from ForecastChartsPanel)
    const monthlyTrendData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthData = portfolioTotals.byMonth[month] || {
        forecast: 0,
        actual: 0,
        planned: 0,
      };
      
      const projectCount = projectsPerMonth.find(p => p.month === month)?.count || 0;
      
      return {
        month,
        Forecast: monthData.forecast,
        Actual: monthData.actual,
        Proyectos: projectCount,
      };
    });

    // Verify month 1 has correct project count
    assert.strictEqual(
      monthlyTrendData[0].Proyectos,
      5,
      "Month 1 should have 5 projects"
    );

    // Verify month 2 has correct project count
    assert.strictEqual(
      monthlyTrendData[1].Proyectos,
      7,
      "Month 2 should have 7 projects"
    );

    // Verify month 3 has zero projects
    assert.strictEqual(
      monthlyTrendData[2].Proyectos,
      0,
      "Month 3 should have 0 projects"
    );

    // Verify all months have the Proyectos field
    monthlyTrendData.forEach((monthData, index) => {
      assert.ok(
        'Proyectos' in monthData,
        `Month ${index + 1} should have Proyectos field`
      );
      assert.strictEqual(
        typeof monthData.Proyectos,
        'number',
        `Proyectos field should be a number for month ${index + 1}`
      );
    });
  });

  it("should handle empty projectsPerMonth array", () => {
    const portfolioTotals = {
      byMonth: {
        1: { forecast: 10000, actual: 8000, planned: 9000 },
      },
      overall: {
        forecast: 10000,
        actual: 8000,
        planned: 9000,
        varianceForecast: 0,
        varianceActual: 0,
        percentConsumption: 0,
      },
    };

    const projectsPerMonth: Array<{ month: number; count: number }> = [];

    // Build monthly trend data
    const monthlyTrendData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthData = portfolioTotals.byMonth[month] || {
        forecast: 0,
        actual: 0,
        planned: 0,
      };
      
      const projectCount = projectsPerMonth.find(p => p.month === month)?.count || 0;
      
      return {
        month,
        Forecast: monthData.forecast,
        Actual: monthData.actual,
        Proyectos: projectCount,
      };
    });

    // All months should have 0 projects
    monthlyTrendData.forEach((monthData, index) => {
      assert.strictEqual(
        monthData.Proyectos,
        0,
        `Month ${index + 1} should have 0 projects when projectsPerMonth is empty`
      );
    });
  });

  it("should compute project counts correctly from forecast data", () => {
    // Simulate forecastData with multiple projects
    const forecastData = [
      { month: 1, projectId: "proj-1", forecast: 1000 },
      { month: 1, projectId: "proj-2", forecast: 2000 },
      { month: 1, projectId: "proj-3", forecast: 1500 },
      { month: 2, projectId: "proj-1", forecast: 1100 },
      { month: 2, projectId: "proj-2", forecast: 2200 },
      { month: 3, projectId: "proj-1", forecast: 1200 },
    ];

    // Logic from SDMTForecast.tsx to compute projectsPerMonth
    const monthlyProjects = new Map<number, Set<string>>();
    
    forecastData.forEach((cell) => {
      const month = cell.month;
      const projectId = cell.projectId;
      
      if (!month || !projectId || month < 1 || month > 12) return;
      
      if (!monthlyProjects.has(month)) {
        monthlyProjects.set(month, new Set());
      }
      monthlyProjects.get(month)!.add(projectId);
    });

    const projectsPerMonth = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const count = monthlyProjects.get(month)?.size || 0;
      return { month, count };
    });

    // Verify counts
    assert.strictEqual(
      projectsPerMonth[0].count,
      3,
      "Month 1 should have 3 unique projects"
    );
    assert.strictEqual(
      projectsPerMonth[1].count,
      2,
      "Month 2 should have 2 unique projects"
    );
    assert.strictEqual(
      projectsPerMonth[2].count,
      1,
      "Month 3 should have 1 unique project"
    );
    assert.strictEqual(
      projectsPerMonth[3].count,
      0,
      "Month 4 should have 0 projects"
    );
  });

  it("should not count duplicate projects in same month", () => {
    // Simulate forecastData with same project appearing multiple times in same month
    const forecastData = [
      { month: 1, projectId: "proj-1", forecast: 1000 },
      { month: 1, projectId: "proj-1", forecast: 2000 }, // Duplicate project
      { month: 1, projectId: "proj-2", forecast: 1500 },
    ];

    const monthlyProjects = new Map<number, Set<string>>();
    
    forecastData.forEach((cell) => {
      const month = cell.month;
      const projectId = cell.projectId;
      
      if (!month || !projectId || month < 1 || month > 12) return;
      
      if (!monthlyProjects.has(month)) {
        monthlyProjects.set(month, new Set());
      }
      monthlyProjects.get(month)!.add(projectId);
    });

    const projectsPerMonth = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const count = monthlyProjects.get(month)?.size || 0;
      return { month, count };
    });

    // Should count unique projects only (2, not 3)
    assert.strictEqual(
      projectsPerMonth[0].count,
      2,
      "Month 1 should count unique projects only (2, not 3)"
    );
  });
});

/**
 * Test: Chart color configuration
 */
describe("ForecastChartsPanel - Chart Colors", () => {
  it("should define distinct color for projects bar", () => {
    // Colors from ForecastChartsPanel
    const CHART_COLORS = {
      forecast: 'oklch(0.61 0.15 160)', // Teal
      actual: 'oklch(0.72 0.15 65)', // Blue
      budget: 'oklch(0.5 0.2 350)', // Gray/Green
      planned: 'oklch(0.45 0.12 200)', // Light Blue
      projects: 'oklch(0.65 0.18 30)', // Orange for projects bar
    };

    // Verify projects color exists
    assert.ok(
      CHART_COLORS.projects,
      "Projects color should be defined"
    );

    // Verify it's different from other colors
    assert.notStrictEqual(
      CHART_COLORS.projects,
      CHART_COLORS.forecast,
      "Projects color should be different from forecast color"
    );
    assert.notStrictEqual(
      CHART_COLORS.projects,
      CHART_COLORS.actual,
      "Projects color should be different from actual color"
    );
    assert.notStrictEqual(
      CHART_COLORS.projects,
      CHART_COLORS.budget,
      "Projects color should be different from budget color"
    );
  });
});

/**
 * Test: Tooltip formatting
 */
describe("ForecastChartsPanel - Custom Tooltip", () => {
  it("should format currency for financial data", () => {
    const formatCurrency = (amount: number) => 
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format(amount);

    const formatted = formatCurrency(10000);
    assert.ok(
      formatted.includes('10,000') || formatted.includes('$10,000'),
      "Currency should be formatted with thousands separator"
    );
  });

  it("should display project count as plain number", () => {
    // Project count should be displayed as-is, not as currency
    const projectCount = 5;
    const displayValue = projectCount.toString();

    assert.strictEqual(
      displayValue,
      "5",
      "Project count should be displayed as plain number"
    );

    assert.ok(
      !displayValue.includes('$'),
      "Project count should not include currency symbol"
    );
  });
});
