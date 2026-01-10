/**
 * ForecastSummaryBar Component Tests
 * 
 * Simple validation tests to ensure KPI calculations are correct.
 */

// Manual test scenarios for the ForecastSummaryBar component
// These tests can be run manually by inspecting the UI in TODOS mode

export const testScenarios = {
  /**
   * Test Case 1: Normal operation with monthly budget
   * 
   * Setup:
   * - isPortfolioView = true
   * - useMonthlyBudget = true
   * - monthlyBudgets = [{month: 1, budget: 10000}, {month: 2, budget: 15000}, ...]
   * - totalForecast = 120000
   * - totalActual = 80000
   * 
   * Expected Results:
   * - totalBudget = sum of all monthly budgets
   * - varianceBudget = totalForecast - totalBudget
   * - varianceBudgetPercent = (varianceBudget / totalBudget) * 100
   * - consumedPercent = (totalActual / totalBudget) * 100
   * 
   * Visual Validation:
   * - All KPI cards should show values
   * - Variance should show red if forecast > budget, green if forecast < budget
   * - Consumption should show red if > 100%, yellow if > 90%, green otherwise
   */
  normalOperation: {
    description: 'Normal operation with monthly budget',
    input: {
      monthlyBudgets: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, budget: 10000 })),
      totalForecast: 120000,
      totalActual: 80000,
      useMonthlyBudget: true,
    },
    expected: {
      totalBudget: 120000,
      varianceBudget: 0,
      varianceBudgetPercent: 0,
      consumedPercent: 66.7,
    },
  },

  /**
   * Test Case 2: Over budget scenario
   * 
   * Setup:
   * - totalBudget = 100000
   * - totalForecast = 120000 (20% over)
   * - totalActual = 110000 (10% over)
   * 
   * Expected Results:
   * - varianceBudget = +20000
   * - varianceBudgetPercent = +20%
   * - consumedPercent = 110%
   * 
   * Visual Validation:
   * - Variance badge should be RED
   * - Consumption should be RED with "Sobre presupuesto" badge
   */
  overBudget: {
    description: 'Over budget scenario',
    input: {
      monthlyBudgets: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, budget: 8333.33 })),
      totalForecast: 120000,
      totalActual: 110000,
      useMonthlyBudget: true,
    },
    expected: {
      totalBudget: 100000,
      varianceBudget: 20000,
      varianceBudgetPercent: 20,
      consumedPercent: 110,
    },
  },

  /**
   * Test Case 3: No budget configured
   * 
   * Setup:
   * - useMonthlyBudget = false
   * - totalForecast = 120000
   * - totalActual = 80000
   * 
   * Expected Results:
   * - totalBudget = 0
   * - All variance metrics should be 0
   * - UI should show "No definido" for budget
   * - Consumption and variance should show "—"
   * 
   * Visual Validation:
   * - Budget card shows "No definido"
   * - Warning message about no budget configured
   * - No division by zero errors
   */
  noBudget: {
    description: 'No budget configured',
    input: {
      monthlyBudgets: [],
      totalForecast: 120000,
      totalActual: 80000,
      useMonthlyBudget: false,
    },
    expected: {
      totalBudget: 0,
      varianceBudget: 0,
      varianceBudgetPercent: 0,
      consumedPercent: 0,
    },
  },

  /**
   * Test Case 4: Single project mode
   * 
   * Setup:
   * - isPortfolioView = false
   * 
   * Expected Results:
   * - summaryBarKpis should be null
   * - ForecastSummaryBar should NOT render
   * 
   * Visual Validation:
   * - KPI bar should be hidden in single-project view
   */
  singleProject: {
    description: 'Single project mode - bar should be hidden',
    input: {
      isPortfolioView: false,
    },
    expected: {
      summaryBarKpis: null,
      barRendered: false,
    },
  },
};

// Helper function to calculate expected values
export function calculateExpectedKpis(input: {
  monthlyBudgets: Array<{ month: number; budget: number }>;
  totalForecast: number;
  totalActual: number;
  useMonthlyBudget: boolean;
}) {
  const totalBudget = input.useMonthlyBudget
    ? input.monthlyBudgets.reduce((acc, m) => acc + m.budget, 0)
    : 0;

  const varianceBudget = totalBudget > 0 ? input.totalForecast - totalBudget : 0;
  const varianceBudgetPercent = totalBudget > 0 ? (varianceBudget / totalBudget) * 100 : 0;
  const consumedPercent = totalBudget > 0 ? (input.totalActual / totalBudget) * 100 : 0;

  return {
    totalBudget,
    totalForecast: input.totalForecast,
    totalActual: input.totalActual,
    varianceBudget,
    varianceBudgetPercent,
    consumedPercent,
  };
}

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
