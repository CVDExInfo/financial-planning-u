/**
 * Budget Simulation Utilities
 * Pure functions for applying budget simulation overlay to forecast data
 * NO SIDE EFFECTS - all functions are pure transformations
 */

export interface BudgetSimulationState {
  enabled: boolean;
  budgetTotal: number | '';
  factor: number; // projection factor (e.g., 1.0 = 100%)
  estimatedOverride?: number | '';
}

export interface ForecastMetrics {
  totalPlanned: number;
  totalForecast: number;
  totalActual: number;
  totalVariance: number;
  variancePercentage: number;
  actualVariance: number;
  actualVariancePercentage: number;
}

export interface SimulatedMetrics extends ForecastMetrics {
  budgetTotal: number;
  budgetUtilization: number; // percentage
  budgetVarianceProjected: number; // budgetTotal - projectedTotal
  budgetVariancePlanned: number; // budgetTotal - plannedTotal
  pctUsedActual: number; // actualTotal / budgetTotal
}

export interface MonthlyTrend {
  month: number;
  Planned: number;
  Forecast: number;
  Actual: number;
}

export interface SimulatedMonthlyTrend extends MonthlyTrend {
  Budget: number; // flat budget line distributed across months
}

// Constants
const MONTHS_PER_YEAR = 12;

/**
 * Sanitize numeric input from user input fields
 * Accepts: "1,000", "1 000", "$1000", etc.
 * Returns: numeric value or 0 if invalid
 */
export function sanitizeNumericInput(input: string | number | ''): number {
  if (input === '' || input === null || input === undefined) {
    return 0;
  }
  
  if (typeof input === 'number') {
    return isNaN(input) ? 0 : input;
  }
  
  // Remove $, commas, spaces
  const cleaned = input.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Clamp projection factor to reasonable range (0.5 - 2.0)
 * to prevent chart blowups
 */
export function clampFactor(factor: number): number {
  return Math.max(0.5, Math.min(2.0, factor));
}

/**
 * Calculate budget utilization metrics
 */
export function calculateBudgetMetrics(
  baseMetrics: ForecastMetrics,
  budgetTotal: number
): SimulatedMetrics {
  const budgetVarianceProjected = budgetTotal - baseMetrics.totalForecast;
  const budgetVariancePlanned = budgetTotal - baseMetrics.totalPlanned;
  const pctUsedActual = budgetTotal > 0 ? (baseMetrics.totalActual / budgetTotal) * 100 : 0;
  const budgetUtilization = budgetTotal > 0 ? (baseMetrics.totalForecast / budgetTotal) * 100 : 0;

  return {
    ...baseMetrics,
    budgetTotal,
    budgetUtilization,
    budgetVarianceProjected,
    budgetVariancePlanned,
    pctUsedActual,
  };
}

/**
 * Apply budget simulation to monthly trends
 * Adds a flat "Budget" line series across all months
 */
export function applyBudgetToTrends(
  monthlyTrends: MonthlyTrend[],
  budgetTotal: number
): SimulatedMonthlyTrend[] {
  // Distribute budget evenly across months
  const budgetPerMonth = budgetTotal / MONTHS_PER_YEAR;
  
  return monthlyTrends.map(trend => ({
    ...trend,
    Budget: budgetPerMonth,
  }));
}

/**
 * Calculate estimated projection based on actual to date and remaining planned
 * Formula: estimated = actualToDate + (remainingPlanned * factor)
 * Falls back to current projected if calculation can't be performed
 */
export function calculateEstimatedProjection(
  actualToDate: number,
  plannedTotal: number,
  projectedTotal: number,
  factor: number
): number {
  if (plannedTotal <= 0 || actualToDate < 0) {
    // If no valid planned data, fall back to current projected
    return projectedTotal;
  }
  
  // Remaining planned = total planned - assumed portion used for actuals
  // Simple heuristic: remaining = plannedTotal - actualToDate
  const remainingPlanned = Math.max(0, plannedTotal - actualToDate);
  
  // Apply factor to remaining
  const estimated = actualToDate + (remainingPlanned * factor);
  
  return estimated;
}

/**
 * Main simulation function: applies budget overlay to base forecast model
 * This is the primary entry point for simulation logic
 * 
 * @param baseMetrics - Original metrics calculated from forecast data
 * @param simState - Current simulation state from UI
 * @returns Enhanced metrics with budget simulation applied
 */
export function applyBudgetSimulation(
  baseMetrics: ForecastMetrics,
  simState: BudgetSimulationState
): SimulatedMetrics {
  if (!simState.enabled) {
    // Simulation disabled - return base metrics with zero budget
    return calculateBudgetMetrics(baseMetrics, 0);
  }
  
  // Sanitize and validate inputs
  const budgetTotal = sanitizeNumericInput(simState.budgetTotal);
  
  if (budgetTotal <= 0) {
    // Invalid budget - treat as disabled
    return calculateBudgetMetrics(baseMetrics, 0);
  }
  
  // Apply factor to forecast if estimated override is not set
  let adjustedForecast = baseMetrics.totalForecast;
  
  if (simState.estimatedOverride) {
    const override = sanitizeNumericInput(simState.estimatedOverride);
    if (override > 0) {
      adjustedForecast = override;
    }
  } else if (simState.factor !== 1.0) {
    // Apply factor-based adjustment
    const factor = clampFactor(simState.factor);
    adjustedForecast = calculateEstimatedProjection(
      baseMetrics.totalActual,
      baseMetrics.totalPlanned,
      baseMetrics.totalForecast,
      factor
    );
  }
  
  // Calculate adjusted metrics
  const adjustedMetrics: ForecastMetrics = {
    ...baseMetrics,
    totalForecast: adjustedForecast,
    totalVariance: adjustedForecast - baseMetrics.totalPlanned,
    variancePercentage: baseMetrics.totalPlanned > 0 
      ? ((adjustedForecast - baseMetrics.totalPlanned) / baseMetrics.totalPlanned) * 100 
      : 0,
  };
  
  return calculateBudgetMetrics(adjustedMetrics, budgetTotal);
}

/**
 * Validation helper: check if simulation state is valid
 */
export function isValidSimulationState(simState: BudgetSimulationState): boolean {
  if (!simState.enabled) {
    return true; // Disabled state is always valid
  }
  
  const budgetTotal = sanitizeNumericInput(simState.budgetTotal);
  return budgetTotal > 0;
}
