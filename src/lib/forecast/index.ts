/**
 * Forecast Library - Consolidated exports for DashboardV2
 * 
 * This module provides reusable forecast calculation and budget allocation functions
 * extracted from SDMTForecast for use across the application.
 * 
 * Key responsibilities:
 * - Forecast totals and variance calculations
 * - Budget allocation (proportional and monthly)
 * - Runway metrics
 * - Data aggregation
 */

// Re-export analytics functions (computeTotals, computeVariance)
export * from './analytics';

// Re-export budget allocation functions from SDMTForecast feature
// These are already well-tested pure functions that can be reused
export {
  allocateBudgetMonthly,
  allocateBudgetWithMonthlyInputs,
  calculateRunwayMetrics,
  type MonthlyAllocation,
  type MonthlyData,
  type MonthlyBudgetInput,
  type RunwayMetrics,
  type ProjectBudgetAllocation,
} from '@/features/sdmt/cost/Forecast/budgetAllocation';

// Re-export budget simulation functions for trend application
export {
  applyBudgetToTrends,
  applyBudgetSimulation,
  type SimulatedMonthlyMetrics,
  type BudgetSimulationState,
} from '@/features/sdmt/cost/Forecast/budgetSimulation';

// Additional aggregation helper for DashboardV2
import type { ForecastTotalsInput, TotalsResult } from './analytics';
import { computeTotals } from './analytics';

/**
 * Aggregate monthly totals from multiple projects/rubros
 * 
 * @param rows - Array of forecast data rows (can be from multiple projects/rubros)
 * @param months - Array of month indices to include (e.g., [1, 2, 3, ...12])
 * @returns Aggregated totals by month and overall
 */
export function aggregateMonthlyTotals(
  rows: ForecastTotalsInput[],
  months?: number[]
): TotalsResult {
  return computeTotals(rows, months || []);
}

/**
 * Helper to convert monthly data to format expected by allocation functions
 * 
 * @param byMonth - Record of monthly totals keyed by month number
 * @param monthCount - Number of months to include (default: 12)
 * @returns Array of MonthlyData for allocation functions
 */
export function prepareMonthlyDataForAllocation(
  byMonth: Record<number, { planned: number; forecast: number; actual: number }>,
  monthCount = 12
): Array<{ month: number; planned: number; forecast: number; actual: number }> {
  return Array.from({ length: monthCount }, (_, i) => {
    const month = i + 1;
    const data = byMonth[month] || { planned: 0, forecast: 0, actual: 0 };
    return {
      month,
      planned: data.planned,
      forecast: data.forecast,
      actual: data.actual,
    };
  });
}
