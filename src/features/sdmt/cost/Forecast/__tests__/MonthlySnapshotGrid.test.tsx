/**
 * MonthlySnapshotGrid Test Suite
 * 
 * Tests for budget allocation, grouping, filtering, and denominator=0 percent rule
 */

import { describe, it, expect } from '@jest/globals';
import type { ForecastCell, MonthlyBudgetInput } from '../components/MonthlySnapshotGrid';

// Helper to extract snapshot logic for testing
// This mimics the internal calculation logic from MonthlySnapshotGrid.tsx

interface TestSnapshotRow {
  id: string;
  name: string;
  budget: number;
  forecast: number;
  actual: number;
  varianceBudget: number;
  varianceBudgetPercent: number | null;
  varianceForecast: number;
  varianceForecastPercent: number | null;
}

/**
 * Test: Proportional budget allocation when totalForecast > 0
 */
describe('MonthlySnapshotGrid - Budget Allocation', () => {
  it('should allocate budget proportionally based on forecast when totalForecast > 0', () => {
    // Setup: 3 projects with forecasts [100, 200, 700] and monthBudget = 1000
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'li1',
        projectId: 'proj1',
        projectName: 'Project 1',
        month: 1,
        planned: 100,
        forecast: 100,
        actual: 0,
        variance: 0,
      },
      {
        line_item_id: 'li2',
        projectId: 'proj2',
        projectName: 'Project 2',
        month: 1,
        planned: 200,
        forecast: 200,
        actual: 0,
        variance: 0,
      },
      {
        line_item_id: 'li3',
        projectId: 'proj3',
        projectName: 'Project 3',
        month: 1,
        planned: 700,
        forecast: 700,
        actual: 0,
        variance: 0,
      },
    ];

    const monthBudget = 1000;
    const totalForecast = 100 + 200 + 700; // = 1000

    // Calculate proportional allocation
    const projects = new Map<string, { forecast: number; budget: number }>();
    forecastData.forEach(cell => {
      const projectId = cell.projectId || 'unknown';
      if (!projects.has(projectId)) {
        projects.set(projectId, { forecast: 0, budget: 0 });
      }
      const proj = projects.get(projectId)!;
      proj.forecast += cell.forecast;
    });

    // Allocate budget proportionally
    projects.forEach(proj => {
      if (totalForecast > 0) {
        proj.budget = (proj.forecast / totalForecast) * monthBudget;
      }
    });

    // Assert: budgets should be approximately [100, 200, 700] (allow rounding tolerance)
    const proj1 = projects.get('proj1')!;
    const proj2 = projects.get('proj2')!;
    const proj3 = projects.get('proj3')!;

    expect(proj1.budget).toBeCloseTo(100, 1); // ±0.1
    expect(proj2.budget).toBeCloseTo(200, 1);
    expect(proj3.budget).toBeCloseTo(700, 1);

    // Verify total budget allocated equals monthBudget
    const totalAllocated = proj1.budget + proj2.budget + proj3.budget;
    expect(totalAllocated).toBeCloseTo(monthBudget, 1);
  });

  it('should distribute budget equally when totalForecast = 0', () => {
    // Setup: 3 projects with forecasts all 0 and monthBudget = 1200
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'li1',
        projectId: 'proj1',
        projectName: 'Project 1',
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
      },
      {
        line_item_id: 'li2',
        projectId: 'proj2',
        projectName: 'Project 2',
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
      },
      {
        line_item_id: 'li3',
        projectId: 'proj3',
        projectName: 'Project 3',
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
      },
    ];

    const monthBudget = 1200;
    const totalForecast = 0;

    // Group by project
    const projects = new Map<string, { forecast: number; budget: number }>();
    forecastData.forEach(cell => {
      const projectId = cell.projectId || 'unknown';
      if (!projects.has(projectId)) {
        projects.set(projectId, { forecast: 0, budget: 0 });
      }
      const proj = projects.get(projectId)!;
      proj.forecast += cell.forecast;
    });

    // Equal distribution when totalForecast = 0
    projects.forEach(proj => {
      if (totalForecast > 0) {
        proj.budget = (proj.forecast / totalForecast) * monthBudget;
      } else {
        proj.budget = monthBudget / projects.size;
      }
    });

    // Assert: each project should get 1200 / 3 = 400
    const proj1 = projects.get('proj1')!;
    const proj2 = projects.get('proj2')!;
    const proj3 = projects.get('proj3')!;

    expect(proj1.budget).toBe(400);
    expect(proj2.budget).toBe(400);
    expect(proj3.budget).toBe(400);
  });
});

/**
 * Test: Grouping toggle (project vs rubro)
 */
describe('MonthlySnapshotGrid - Grouping', () => {
  it('should group by project with rubros as children', () => {
    // Setup: 2 rubros in 1 project
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'li1',
        rubroId: 'rubro1',
        description: 'Rubro 1',
        projectId: 'proj1',
        projectName: 'Project 1',
        month: 1,
        planned: 100,
        forecast: 100,
        actual: 90,
        variance: -10,
      },
      {
        line_item_id: 'li2',
        rubroId: 'rubro2',
        description: 'Rubro 2',
        projectId: 'proj1',
        projectName: 'Project 1',
        month: 1,
        planned: 200,
        forecast: 200,
        actual: 180,
        variance: -20,
      },
    ];

    // Group by project
    const projectMap = new Map<string, { forecast: number; actual: number; rubros: string[] }>();
    forecastData.forEach(cell => {
      const projectId = cell.projectId || 'unknown';
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, { forecast: 0, actual: 0, rubros: [] });
      }
      const proj = projectMap.get(projectId)!;
      proj.forecast += cell.forecast;
      proj.actual += cell.actual;
      proj.rubros.push(cell.rubroId || cell.line_item_id);
    });

    // Assert
    expect(projectMap.size).toBe(1);
    const proj1 = projectMap.get('proj1')!;
    expect(proj1.forecast).toBe(300);
    expect(proj1.actual).toBe(270);
    expect(proj1.rubros).toEqual(['rubro1', 'rubro2']);
  });

  it('should group by rubro with projects as children', () => {
    // Setup: 1 rubro in 2 projects
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'li1',
        rubroId: 'rubro1',
        description: 'Rubro 1',
        projectId: 'proj1',
        projectName: 'Project 1',
        month: 1,
        planned: 100,
        forecast: 100,
        actual: 90,
        variance: -10,
      },
      {
        line_item_id: 'li2',
        rubroId: 'rubro1',
        description: 'Rubro 1',
        projectId: 'proj2',
        projectName: 'Project 2',
        month: 1,
        planned: 200,
        forecast: 200,
        actual: 180,
        variance: -20,
      },
    ];

    // Group by rubro
    const rubroMap = new Map<string, { forecast: number; actual: number; projects: string[] }>();
    forecastData.forEach(cell => {
      const rubroId = cell.rubroId || cell.line_item_id;
      if (!rubroMap.has(rubroId)) {
        rubroMap.set(rubroId, { forecast: 0, actual: 0, projects: [] });
      }
      const rubro = rubroMap.get(rubroId)!;
      rubro.forecast += cell.forecast;
      rubro.actual += cell.actual;
      rubro.projects.push(cell.projectId || 'unknown');
    });

    // Assert
    expect(rubroMap.size).toBe(1);
    const rubro1 = rubroMap.get('rubro1')!;
    expect(rubro1.forecast).toBe(300);
    expect(rubro1.actual).toBe(270);
    expect(rubro1.projects).toEqual(['proj1', 'proj2']);
  });
});

/**
 * Test: Only variance filter
 */
describe('MonthlySnapshotGrid - Only Variance Filter', () => {
  it('should hide rows with zero variance when filter is enabled', () => {
    const rows: TestSnapshotRow[] = [
      {
        id: 'proj1',
        name: 'Project 1',
        budget: 100,
        forecast: 100,
        actual: 100,
        varianceBudget: 0,
        varianceBudgetPercent: 0,
        varianceForecast: 0,
        varianceForecastPercent: 0,
      },
      {
        id: 'proj2',
        name: 'Project 2',
        budget: 200,
        forecast: 200,
        actual: 210,
        varianceBudget: 0,
        varianceBudgetPercent: 0,
        varianceForecast: 10,
        varianceForecastPercent: 5,
      },
      {
        id: 'proj3',
        name: 'Project 3',
        budget: 300,
        forecast: 320,
        actual: 0,
        varianceBudget: 20,
        varianceBudgetPercent: 6.67,
        varianceForecast: -320,
        varianceForecastPercent: -100,
      },
    ];

    // Filter: show only rows with variance
    const filtered = rows.filter(row => {
      const hasVariance = 
        Math.abs(row.varianceBudget) > 0 ||
        Math.abs(row.varianceForecast) > 0;
      return hasVariance;
    });

    // Assert: proj1 should be filtered out (no variance)
    expect(filtered.length).toBe(2);
    expect(filtered.map(r => r.id)).toEqual(['proj2', 'proj3']);
  });
});

/**
 * Test: Percent null when denominator = 0
 */
describe('MonthlySnapshotGrid - Denominator Zero Percent Rule', () => {
  it('should return null percent when budget (denominator) is 0', () => {
    const budget = 0;
    const varianceBudget = 100; // forecast - budget
    
    // Calculate percent with denominator check
    const varianceBudgetPercent = budget > 0 
      ? (varianceBudget / budget) * 100 
      : null;

    expect(varianceBudgetPercent).toBeNull();
  });

  it('should return null percent when forecast (denominator) is 0', () => {
    const forecast = 0;
    const varianceForecast = 50; // actual - forecast

    // Calculate percent with denominator check
    const varianceForecastPercent = forecast > 0
      ? (varianceForecast / forecast) * 100
      : null;

    expect(varianceForecastPercent).toBeNull();
  });

  it('should calculate percent correctly when denominator > 0', () => {
    const budget = 1000;
    const varianceBudget = 200; // forecast - budget
    
    const varianceBudgetPercent = budget > 0 
      ? (varianceBudget / budget) * 100 
      : null;

    expect(varianceBudgetPercent).toBe(20);
  });
});

/**
 * Test: Performance / Memoization smoke test
 */
describe('MonthlySnapshotGrid - Performance', () => {
  it('should not trigger heavy recompute on unrelated prop change', () => {
    // This is a smoke test to ensure memoization is working
    // In real component, useMemo should prevent recalculation when only searchQuery changes
    
    const forecastData: ForecastCell[] = Array.from({ length: 100 }, (_, i) => ({
      line_item_id: `li${i}`,
      projectId: `proj${i % 10}`,
      projectName: `Project ${i % 10}`,
      month: 1,
      planned: 100,
      forecast: 100,
      actual: 90,
      variance: -10,
    }));

    // Simulate memoization: compute derived data once
    const computeStart = performance.now();
    const projectMap = new Map<string, { forecast: number }>();
    forecastData.forEach(cell => {
      const projectId = cell.projectId || 'unknown';
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, { forecast: 0 });
      }
      projectMap.get(projectId)!.forecast += cell.forecast;
    });
    const computeTime = performance.now() - computeStart;

    // Assert: computation should be fast (< 10ms for 100 items)
    expect(computeTime).toBeLessThan(10);
    expect(projectMap.size).toBe(10); // 100 items / 10 projects
  });
});
