/**
 * Budget Allocation Tests
 * Validates pure functions for budget distribution across months and projects
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  allocateBudgetMonthly,
  allocateBudgetByProject,
  calculatePortfolioBudgetAllocation,
  calculateVariances,
  aggregateMonthlyTotals,
  allocateBudgetWithMonthlyInputs,
  calculateRunwayMetrics,
  type MonthlyAllocation,
  type MonthlyBudgetInput,
} from '../budgetAllocation';

describe('Budget Allocation Utils', () => {
  describe('allocateBudgetMonthly', () => {
    it('should allocate proportionally based on planned totals', () => {
      const annualBudget = 120000;
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: 10000, // Equal planned
        forecast: 11000,
        actual: 9000,
      }));

      const result = allocateBudgetMonthly(annualBudget, monthlyTotals);

      // Each month should get equal allocation
      result.forEach(m => {
        assert.strictEqual(m.budgetAllocated, 10000); // 120000 / 12
      });
    });

    it('should allocate proportionally with varying planned amounts', () => {
      const annualBudget = 120000;
      const monthlyTotals = [
        { month: 1, planned: 20000, forecast: 11000, actual: 9000 }, // 20% of total
        { month: 2, planned: 10000, forecast: 11000, actual: 9000 }, // 10% of total
        ...Array.from({ length: 10 }, (_, i) => ({
          month: i + 3,
          planned: 7000, // 7% each
          forecast: 7500,
          actual: 7000,
        })),
      ];
      // Total planned = 20000 + 10000 + (7000 * 10) = 100000

      const result = allocateBudgetMonthly(annualBudget, monthlyTotals);

      // First month gets 20% of budget
      assert.strictEqual(result[0].budgetAllocated, 24000); // 120000 * 0.2
      // Second month gets 10%
      assert.strictEqual(result[1].budgetAllocated, 12000); // 120000 * 0.1
      // Rest get 7% each
      assert.strictEqual(result[2].budgetAllocated, 8400); // 120000 * 0.07
    });

    it('should fallback to forecast distribution when planned is zero', () => {
      const annualBudget = 120000;
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: 0, // No planned data
        forecast: 10000, // Equal forecast
        actual: 0,
      }));

      const result = allocateBudgetMonthly(annualBudget, monthlyTotals);

      // Each month should get equal allocation based on forecast
      result.forEach(m => {
        assert.strictEqual(m.budgetAllocated, 10000); // 120000 / 12
      });
    });

    it('should fallback to equal distribution when both planned and forecast are zero', () => {
      const annualBudget = 120000;
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: 0,
        forecast: 0,
        actual: 0,
      }));

      const result = allocateBudgetMonthly(annualBudget, monthlyTotals);

      // Each month should get equal allocation (1/12)
      result.forEach(m => {
        assert.strictEqual(m.budgetAllocated, 10000); // 120000 / 12
      });
    });

    it('should return zero allocations when budget is zero or negative', () => {
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: 10000,
        forecast: 11000,
        actual: 9000,
      }));

      const result = allocateBudgetMonthly(0, monthlyTotals);

      result.forEach(m => {
        assert.strictEqual(m.budgetAllocated, 0);
      });
    });

    it('should throw error when monthlyTotals does not have 12 months', () => {
      const annualBudget = 120000;
      const monthlyTotals = [
        { month: 1, planned: 10000, forecast: 11000, actual: 9000 },
      ];

      assert.throws(
        () => allocateBudgetMonthly(annualBudget, monthlyTotals),
        /must have exactly 12 months/
      );
    });

    it('should handle months with null/undefined values', () => {
      const annualBudget = 120000;
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: i === 0 ? 20000 : (null as any), // First month has data
        forecast: 10000,
        actual: 0,
      }));

      const result = allocateBudgetMonthly(annualBudget, monthlyTotals);

      // First month should get all budget (only non-zero planned)
      assert.strictEqual(result[0].budgetAllocated, 120000);
      // Other months get 0
      result.slice(1).forEach(m => {
        assert.strictEqual(m.budgetAllocated, 0);
      });
    });
  });

  describe('allocateBudgetByProject', () => {
    it('should allocate budget proportionally across projects', () => {
      const annualBudget = 300000;
      const projectMonthlyData = new Map([
        [
          'proj1',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 5000, // 60000 total
            forecast: 5500,
            actual: 5000,
          })),
        ],
        [
          'proj2',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 10000, // 120000 total
            forecast: 11000,
            actual: 10000,
          })),
        ],
        [
          'proj3',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 5000, // 60000 total
            forecast: 5500,
            actual: 5000,
          })),
        ],
      ]);
      // Total planned across projects = 240000

      const result = allocateBudgetByProject(annualBudget, projectMonthlyData);

      // proj1: 60000/240000 = 25% → 75000
      assert.strictEqual(result.get('proj1'), 75000);
      // proj2: 120000/240000 = 50% → 150000
      assert.strictEqual(result.get('proj2'), 150000);
      // proj3: 60000/240000 = 25% → 75000
      assert.strictEqual(result.get('proj3'), 75000);
    });

    it('should distribute equally when no planned data exists', () => {
      const annualBudget = 300000;
      const projectMonthlyData = new Map([
        [
          'proj1',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 0,
            forecast: 5500,
            actual: 0,
          })),
        ],
        [
          'proj2',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 0,
            forecast: 11000,
            actual: 0,
          })),
        ],
        [
          'proj3',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 0,
            forecast: 5500,
            actual: 0,
          })),
        ],
      ]);

      const result = allocateBudgetByProject(annualBudget, projectMonthlyData);

      // Equal distribution
      assert.strictEqual(result.get('proj1'), 100000); // 300000 / 3
      assert.strictEqual(result.get('proj2'), 100000);
      assert.strictEqual(result.get('proj3'), 100000);
    });

    it('should return zero allocations when budget is zero', () => {
      const projectMonthlyData = new Map([
        [
          'proj1',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 5000,
            forecast: 5500,
            actual: 5000,
          })),
        ],
      ]);

      const result = allocateBudgetByProject(0, projectMonthlyData);

      assert.strictEqual(result.get('proj1'), 0);
    });

    it('should handle empty project map', () => {
      const annualBudget = 300000;
      const projectMonthlyData = new Map();

      const result = allocateBudgetByProject(annualBudget, projectMonthlyData);

      assert.strictEqual(result.size, 0);
    });
  });

  describe('calculatePortfolioBudgetAllocation', () => {
    it('should calculate complete allocation with monthly breakdown', () => {
      const annualBudget = 240000;
      const projectMonthlyData = new Map([
        [
          'proj1',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 5000,
            forecast: 5500,
            actual: 5000,
          })),
        ],
        [
          'proj2',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 10000,
            forecast: 11000,
            actual: 10000,
          })),
        ],
      ]);
      const projectNames = new Map([
        ['proj1', 'Project Alpha'],
        ['proj2', 'Project Beta'],
      ]);

      const result = calculatePortfolioBudgetAllocation(
        annualBudget,
        projectMonthlyData,
        projectNames
      );

      assert.strictEqual(result.length, 2);

      // Find Project Alpha
      const proj1 = result.find(p => p.projectId === 'proj1');
      assert.ok(proj1);
      assert.strictEqual(proj1.projectName, 'Project Alpha');
      assert.strictEqual(proj1.annualBudget, 80000); // 60000/180000 * 240000
      assert.strictEqual(proj1.monthlyAllocations.length, 12);
      // Each month should get equal share
      proj1.monthlyAllocations.forEach(m => {
        assert.ok(Math.abs(m.budgetAllocated - 80000 / 12) < 0.01);
      });

      // Find Project Beta
      const proj2 = result.find(p => p.projectId === 'proj2');
      assert.ok(proj2);
      assert.strictEqual(proj2.projectName, 'Project Beta');
      assert.strictEqual(proj2.annualBudget, 160000); // 120000/180000 * 240000
    });

    it('should handle missing project names', () => {
      const annualBudget = 120000;
      const projectMonthlyData = new Map([
        [
          'proj1',
          Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            planned: 10000,
            forecast: 11000,
            actual: 10000,
          })),
        ],
      ]);
      const projectNames = new Map(); // Empty names

      const result = calculatePortfolioBudgetAllocation(
        annualBudget,
        projectMonthlyData,
        projectNames
      );

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].projectName, 'Unknown Project');
    });
  });

  describe('calculateVariances', () => {
    it('should calculate variances correctly', () => {
      const allocation: MonthlyAllocation = {
        month: 1,
        budgetAllocated: 10000,
        planned: 9000,
        forecast: 11000,
        actual: 9500,
      };

      const result = calculateVariances(allocation);

      assert.strictEqual(result.varianceForecastVsBudget, 1000); // 11000 - 10000
      assert.strictEqual(result.varianceActualVsBudget, -500); // 9500 - 10000
      assert.strictEqual(result.percentConsumedActual, 95); // 9500 / 10000 * 100
    });

    it('should handle zero budget', () => {
      const allocation: MonthlyAllocation = {
        month: 1,
        budgetAllocated: 0,
        planned: 9000,
        forecast: 11000,
        actual: 9500,
      };

      const result = calculateVariances(allocation);

      assert.strictEqual(result.varianceForecastVsBudget, 11000);
      assert.strictEqual(result.varianceActualVsBudget, 9500);
      assert.strictEqual(result.percentConsumedActual, 0);
    });

    it('should calculate positive variance for over budget', () => {
      const allocation: MonthlyAllocation = {
        month: 1,
        budgetAllocated: 10000,
        planned: 9000,
        forecast: 12000,
        actual: 11000,
      };

      const result = calculateVariances(allocation);

      assert.strictEqual(result.varianceForecastVsBudget, 2000); // Over budget
      assert.strictEqual(result.varianceActualVsBudget, 1000); // Over budget
      // Use approximate equality for percentage due to floating point precision
      assert.ok(Math.abs(result.percentConsumedActual - 110) < 0.01); // Over 100%
    });
  });

  describe('aggregateMonthlyTotals', () => {
    it('should aggregate forecast cells by month', () => {
      const forecastCells = [
        { month: 1, planned: 1000, forecast: 1100, actual: 900 },
        { month: 1, planned: 2000, forecast: 2200, actual: 1800 },
        { month: 2, planned: 1500, forecast: 1650, actual: 1400 },
        { month: 12, planned: 3000, forecast: 3300, actual: 2900 },
      ];

      const result = aggregateMonthlyTotals(forecastCells);

      assert.strictEqual(result.length, 12);

      // Month 1 should have summed values
      assert.strictEqual(result[0].month, 1);
      assert.strictEqual(result[0].planned, 3000); // 1000 + 2000
      assert.strictEqual(result[0].forecast, 3300); // 1100 + 2200
      assert.strictEqual(result[0].actual, 2700); // 900 + 1800

      // Month 2
      assert.strictEqual(result[1].month, 2);
      assert.strictEqual(result[1].planned, 1500);

      // Month 3-11 should be zero
      for (let i = 2; i < 11; i++) {
        assert.strictEqual(result[i].planned, 0);
        assert.strictEqual(result[i].forecast, 0);
        assert.strictEqual(result[i].actual, 0);
      }

      // Month 12
      assert.strictEqual(result[11].month, 12);
      assert.strictEqual(result[11].planned, 3000);
    });

    it('should handle empty array', () => {
      const result = aggregateMonthlyTotals([]);

      assert.strictEqual(result.length, 12);
      result.forEach(m => {
        assert.strictEqual(m.planned, 0);
        assert.strictEqual(m.forecast, 0);
        assert.strictEqual(m.actual, 0);
      });
    });

    it('should handle null values in cells', () => {
      const forecastCells = [
        { month: 1, planned: 1000, forecast: null as any, actual: 900 },
        { month: 1, planned: null as any, forecast: 1100, actual: null as any },
      ];

      const result = aggregateMonthlyTotals(forecastCells);

      assert.strictEqual(result[0].planned, 1000);
      assert.strictEqual(result[0].forecast, 1100);
      assert.strictEqual(result[0].actual, 900);
    });
  });

  describe('allocateBudgetWithMonthlyInputs', () => {
    it('should use entered budgets and auto-fill remaining months', () => {
      const annualBudget = 120000;
      const monthlyBudgetInputs = [
        { month: 1, budget: 15000 },
        { month: 2, budget: 12000 },
        { month: 3, budget: 10000 },
      ];
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: 10000,
        forecast: 10000,
        actual: 0,
      }));

      const result = allocateBudgetWithMonthlyInputs(annualBudget, monthlyBudgetInputs, monthlyTotals);

      // First 3 months should use entered budgets
      assert.strictEqual(result[0].budgetAllocated, 15000);
      assert.strictEqual(result[0].budgetEntered, 15000);
      assert.strictEqual(result[0].isEstimated, false);
      
      assert.strictEqual(result[1].budgetAllocated, 12000);
      assert.strictEqual(result[1].isEstimated, false);
      
      assert.strictEqual(result[2].budgetAllocated, 10000);
      assert.strictEqual(result[2].isEstimated, false);

      // Remaining months should be auto-filled
      // Total entered = 37000, remaining = 83000, 9 months left
      assert.ok(result[3].isEstimated);
      assert.strictEqual(result[3].budgetEntered, undefined);
      // Should be roughly 83000/9 ≈ 9222 (or proportional)
      assert.ok(result[3].budgetAllocated > 0);
    });

    it('should handle all months entered', () => {
      const annualBudget = 120000;
      const monthlyBudgetInputs = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        budget: 10000,
      }));
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: 10000,
        forecast: 10000,
        actual: 0,
      }));

      const result = allocateBudgetWithMonthlyInputs(annualBudget, monthlyBudgetInputs, monthlyTotals);

      // All months should be entered, not estimated
      result.forEach((m, idx) => {
        assert.strictEqual(m.budgetAllocated, 10000);
        assert.strictEqual(m.budgetEntered, 10000);
        assert.strictEqual(m.isEstimated, false);
      });
    });

    it('should handle no entered budgets (fall back to auto-allocation)', () => {
      const annualBudget = 120000;
      const monthlyBudgetInputs: MonthlyBudgetInput[] = [];
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: 10000,
        forecast: 10000,
        actual: 0,
      }));

      const result = allocateBudgetWithMonthlyInputs(annualBudget, monthlyBudgetInputs, monthlyTotals);

      // All months should be estimated with equal distribution
      result.forEach(m => {
        assert.strictEqual(m.budgetAllocated, 10000); // 120000 / 12
        assert.strictEqual(m.budgetEntered, undefined);
        assert.strictEqual(m.isEstimated, true);
      });
    });
  });

  describe('calculateRunwayMetrics', () => {
    it('should calculate runway metrics correctly', () => {
      const annualBudget = 120000;
      const monthlyAllocations: MonthlyAllocation[] = [
        { month: 1, budgetAllocated: 10000, planned: 10000, forecast: 10000, actual: 9000 },
        { month: 2, budgetAllocated: 10000, planned: 10000, forecast: 10000, actual: 11000 },
        { month: 3, budgetAllocated: 10000, planned: 10000, forecast: 10000, actual: 10000 },
        ...Array.from({ length: 9 }, (_, i) => ({
          month: i + 4,
          budgetAllocated: 10000,
          planned: 10000,
          forecast: 10000,
          actual: 0,
        })),
      ];

      const result = calculateRunwayMetrics(annualBudget, monthlyAllocations);

      // Month 1: under budget
      assert.strictEqual(result[0].budgetForMonth, 10000);
      assert.strictEqual(result[0].actualForMonth, 9000);
      assert.strictEqual(result[0].varianceForMonth, -1000); // 9000 - 10000
      assert.strictEqual(result[0].isOverBudget, false);
      assert.strictEqual(result[0].remainingAnnualBudget, 111000); // 120000 - 9000

      // Month 2: over budget
      assert.strictEqual(result[1].budgetForMonth, 10000);
      assert.strictEqual(result[1].actualForMonth, 11000);
      assert.strictEqual(result[1].varianceForMonth, 1000); // 11000 - 10000
      assert.strictEqual(result[1].isOverBudget, true);
      assert.strictEqual(result[1].remainingAnnualBudget, 100000); // 120000 - 20000

      // Month 3: on budget
      assert.strictEqual(result[2].varianceForMonth, 0);
      assert.strictEqual(result[2].remainingAnnualBudget, 90000); // 120000 - 30000
      
      // Percent consumed should increase
      assert.ok(result[0].percentConsumed < result[1].percentConsumed);
      assert.ok(result[1].percentConsumed < result[2].percentConsumed);
    });

    it('should handle zero budget gracefully', () => {
      const annualBudget = 0;
      const monthlyAllocations: MonthlyAllocation[] = [
        { month: 1, budgetAllocated: 0, planned: 10000, forecast: 10000, actual: 5000 },
      ];

      const result = calculateRunwayMetrics(annualBudget, monthlyAllocations);

      assert.strictEqual(result[0].remainingAnnualBudget, 0);
      assert.strictEqual(result[0].percentConsumed, 0);
    });
  });
});
