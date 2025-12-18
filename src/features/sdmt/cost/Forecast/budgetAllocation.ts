/**
 * Budget Allocation Utilities
 * Compute monthly budgets based on different allocation strategies
 */

export type AllocationStrategy = 'equal' | 'by_planned' | 'by_forecast';

export interface MonthlyBudget {
  month: number;
  budget: number;
}

export interface BudgetAllocation {
  monthlyBudgets: MonthlyBudget[];
  average: number;
  maxPressureMonth: { month: number; pressure: number } | null;
}

/**
 * Calculate monthly budget allocation based on strategy
 */
export function calculateMonthlyBudgets(
  annualBudget: number,
  strategy: AllocationStrategy,
  monthlyPlanned: number[],
  monthlyForecast: number[]
): BudgetAllocation {
  const monthlyBudgets: MonthlyBudget[] = [];
  
  if (annualBudget <= 0) {
    return {
      monthlyBudgets: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, budget: 0 })),
      average: 0,
      maxPressureMonth: null,
    };
  }

  switch (strategy) {
    case 'equal': {
      // Distribute equally across 12 months
      const monthlyAmount = annualBudget / 12;
      for (let i = 0; i < 12; i++) {
        monthlyBudgets.push({ month: i + 1, budget: monthlyAmount });
      }
      break;
    }

    case 'by_planned': {
      // Weight by planned monthly totals
      const totalPlanned = monthlyPlanned.reduce((sum, val) => sum + val, 0);
      if (totalPlanned > 0) {
        for (let i = 0; i < 12; i++) {
          const weight = monthlyPlanned[i] / totalPlanned;
          monthlyBudgets.push({ month: i + 1, budget: annualBudget * weight });
        }
      } else {
        // Fallback to equal if no planned data
        const monthlyAmount = annualBudget / 12;
        for (let i = 0; i < 12; i++) {
          monthlyBudgets.push({ month: i + 1, budget: monthlyAmount });
        }
      }
      break;
    }

    case 'by_forecast': {
      // Weight by forecast monthly totals
      const totalForecast = monthlyForecast.reduce((sum, val) => sum + val, 0);
      if (totalForecast > 0) {
        for (let i = 0; i < 12; i++) {
          const weight = monthlyForecast[i] / totalForecast;
          monthlyBudgets.push({ month: i + 1, budget: annualBudget * weight });
        }
      } else {
        // Fallback to equal if no forecast data
        const monthlyAmount = annualBudget / 12;
        for (let i = 0; i < 12; i++) {
          monthlyBudgets.push({ month: i + 1, budget: monthlyAmount });
        }
      }
      break;
    }
  }

  // Calculate average
  const average = monthlyBudgets.reduce((sum, mb) => sum + mb.budget, 0) / 12;

  // Find month with maximum pressure (highest forecast vs budget %)
  let maxPressureMonth: { month: number; pressure: number } | null = null;
  monthlyBudgets.forEach((mb, index) => {
    if (mb.budget > 0) {
      const pressure = (monthlyForecast[index] / mb.budget) * 100;
      if (!maxPressureMonth || pressure > maxPressureMonth.pressure) {
        maxPressureMonth = { month: mb.month, pressure };
      }
    }
  });

  return {
    monthlyBudgets,
    average,
    maxPressureMonth,
  };
}

/**
 * Calculate budget-based consumption KPIs
 */
export interface BudgetConsumptionKPIs {
  percentConsumedForecast: number;
  percentConsumedActual: number;
  varianceBudgetVsForecast: number;
  varianceBudgetVsActual: number;
}

export function calculateBudgetConsumption(
  annualBudget: number,
  totalForecast: number,
  totalActual: number
): BudgetConsumptionKPIs {
  if (annualBudget <= 0) {
    return {
      percentConsumedForecast: 0,
      percentConsumedActual: 0,
      varianceBudgetVsForecast: 0,
      varianceBudgetVsActual: 0,
    };
  }

  return {
    percentConsumedForecast: (totalForecast / annualBudget) * 100,
    percentConsumedActual: (totalActual / annualBudget) * 100,
    varianceBudgetVsForecast: annualBudget - totalForecast,
    varianceBudgetVsActual: annualBudget - totalActual,
  };
}
