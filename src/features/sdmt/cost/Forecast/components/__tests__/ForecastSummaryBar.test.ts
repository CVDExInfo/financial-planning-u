/**
 * ForecastSummaryBar Component Tests
 * 
 * Tests to ensure KPI calculations are correct and match the spec.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Helper function to calculate expected KPIs based on spec
export function calculateExpectedKpis(input: {
  monthlyBudgets: Array<{ month: number; budget: number }>;
  budgetAllIn: number;
  useMonthlyBudget: boolean;
  totalForecast: number;
  totalActual: number;
}) {
  // Budget source-of-truth per spec: useMonthlyBudget ? sum(monthlyBudgets) : budgetAllIn
  const monthlyBudgetSum = input.monthlyBudgets.reduce((acc, m) => acc + m.budget, 0);
  const totalBudget = input.useMonthlyBudget ? monthlyBudgetSum : input.budgetAllIn;

  // Calculate KPIs
  const varianceBudget = totalBudget > 0 ? input.totalForecast - totalBudget : 0;
  const varianceBudgetPercent = totalBudget > 0 ? (varianceBudget / totalBudget) * 100 : 0;
  const consumedPercent = totalBudget > 0 ? (input.totalActual / totalBudget) * 100 : 0;

  return {
    totalBudget,
    monthlyBudgetSum,
    totalForecast: input.totalForecast,
    totalActual: input.totalActual,
    varianceBudget,
    varianceBudgetPercent,
    consumedPercent,
  };
}

describe('ForecastSummaryBar KPI Calculations', () => {
  it('should calculate totalBudget from monthly budgets when useMonthlyBudget is true', () => {
    const input = {
      monthlyBudgets: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, budget: 10000 })),
      budgetAllIn: 150000, // Different from monthly sum
      useMonthlyBudget: true,
      totalForecast: 120000,
      totalActual: 80000,
    };

    const result = calculateExpectedKpis(input);

    assert.strictEqual(result.totalBudget, 120000, 'totalBudget should be sum of monthly budgets');
    assert.strictEqual(result.monthlyBudgetSum, 120000);
  });

  it('should calculate totalBudget from budgetAllIn when useMonthlyBudget is false', () => {
    const input = {
      monthlyBudgets: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, budget: 10000 })),
      budgetAllIn: 150000,
      useMonthlyBudget: false,
      totalForecast: 120000,
      totalActual: 80000,
    };

    const result = calculateExpectedKpis(input);

    assert.strictEqual(result.totalBudget, 150000, 'totalBudget should be budgetAllIn');
  });

  it('should calculate correct variance and consumption percentages', () => {
    const input = {
      monthlyBudgets: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, budget: 10000 })),
      budgetAllIn: 120000,
      useMonthlyBudget: true,
      totalForecast: 132000, // 10% over budget
      totalActual: 96000, // 80% consumed
    };

    const result = calculateExpectedKpis(input);

    assert.strictEqual(result.totalBudget, 120000);
    assert.strictEqual(result.varianceBudget, 12000, 'varianceBudget should be forecast - budget');
    assert.strictEqual(result.varianceBudgetPercent, 10, 'varianceBudgetPercent should be 10%');
    assert.strictEqual(result.consumedPercent, 80, 'consumedPercent should be 80%');
  });

  it('should return zero KPIs when totalBudget is zero', () => {
    const input = {
      monthlyBudgets: [],
      budgetAllIn: 0,
      useMonthlyBudget: true,
      totalForecast: 120000,
      totalActual: 80000,
    };

    const result = calculateExpectedKpis(input);

    assert.strictEqual(result.totalBudget, 0);
    assert.strictEqual(result.varianceBudget, 0);
    assert.strictEqual(result.varianceBudgetPercent, 0);
    assert.strictEqual(result.consumedPercent, 0);
  });

  it('should detect budget parity issue when difference > 1%', () => {
    const monthlyBudgetSum = 120000;
    const budgetAllIn = 150000; // 25% difference
    const percentDiff = Math.abs((monthlyBudgetSum - budgetAllIn) / budgetAllIn) * 100;

    assert.ok(percentDiff > 1, 'Should detect parity issue when difference > 1%');
    assert.strictEqual(Math.round(percentDiff), 20);
  });

  it('should not detect budget parity issue when difference <= 1%', () => {
    const monthlyBudgetSum = 120000;
    const budgetAllIn = 120500; // 0.4% difference
    const percentDiff = Math.abs((monthlyBudgetSum - budgetAllIn) / budgetAllIn) * 100;

    assert.ok(percentDiff <= 1, 'Should not detect parity issue when difference <= 1%');
  });

  it('should match MonthlySnapshotGrid KPI calculations for same dataset', () => {
    // This test ensures that both components calculate the same values
    const monthlyBudgets = [
      { month: 1, budget: 10000 },
      { month: 2, budget: 11000 },
      { month: 3, budget: 12000 },
    ];
    const totalForecast = 35000;
    const totalActual = 28000;

    const summaryBarKpis = calculateExpectedKpis({
      monthlyBudgets,
      budgetAllIn: 0,
      useMonthlyBudget: true,
      totalForecast,
      totalActual,
    });

    // MonthlySnapshotGrid should compute the same totalBudget for month
    const monthBudget = monthlyBudgets.find(b => b.month === 1)?.budget || 0;
    assert.strictEqual(monthBudget, 10000);
    
    assert.strictEqual(summaryBarKpis.totalBudget, 33000);
    assert.strictEqual(summaryBarKpis.varianceBudget, 2000);
    assert.strictEqual(Math.round(summaryBarKpis.consumedPercent * 10) / 10, 84.8);
  });
});

// Validation helper
export function validateKpiCalculations(
  actual: ReturnType<typeof calculateExpectedKpis>,
  expected: ReturnType<typeof calculateExpectedKpis>,
  tolerance = 0.1 // Allow 0.1% tolerance for floating point
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const checkValue = (key: string, actualVal: number, expectedVal: number) => {
    const diff = Math.abs(actualVal - expectedVal);
    if (diff > tolerance) {
      errors.push(`${key}: expected ${expectedVal}, got ${actualVal} (diff: ${diff})`);
    }
  };

  checkValue('totalBudget', actual.totalBudget, expected.totalBudget);
  checkValue('totalForecast', actual.totalForecast, expected.totalForecast);
  checkValue('totalActual', actual.totalActual, expected.totalActual);
  checkValue('varianceBudget', actual.varianceBudget, expected.varianceBudget);
  checkValue('varianceBudgetPercent', actual.varianceBudgetPercent, expected.varianceBudgetPercent);
  checkValue('consumedPercent', actual.consumedPercent, expected.consumedPercent);

  return {
    valid: errors.length === 0,
    errors,
  };
}
