/**
 * Budget Allocation Utilities
 * Pure functions for distributing annual budget across months and projects
 * following proportional allocation strategy based on Planned totals
 * NO SIDE EFFECTS - all functions are pure transformations
 */

export interface MonthlyAllocation {
  month: number; // 1-12
  budgetAllocated: number;
  planned: number;
  forecast: number;
  actual: number;
}

export interface ProjectBudgetAllocation {
  projectId: string;
  projectName: string;
  annualBudget: number;
  monthlyAllocations: MonthlyAllocation[];
}

/**
 * Allocate annual budget across 12 months proportionally based on monthly planned totals
 * 
 * Strategy:
 * 1. If plannedTotalYear > 0: Proportional allocation based on planned
 *    budgetAllocated[m] = annualBudget * (plannedMonth[m] / plannedTotalYear)
 * 2. Else if forecastTotalYear > 0: Proportional allocation based on forecast
 * 3. Else: Equal distribution (annualBudget / 12)
 * 
 * @param annualBudget - Total budget for the year
 * @param monthlyTotals - Array of 12 monthly totals with planned, forecast, actual
 * @returns Array of 12 monthly allocations with budgetAllocated filled in
 */
export function allocateBudgetMonthly(
  annualBudget: number,
  monthlyTotals: Array<{ month: number; planned: number; forecast: number; actual: number }>
): MonthlyAllocation[] {
  // Validate inputs
  if (annualBudget <= 0) {
    return monthlyTotals.map(m => ({
      ...m,
      budgetAllocated: 0,
    }));
  }

  if (!monthlyTotals || monthlyTotals.length !== 12) {
    throw new Error('monthlyTotals must have exactly 12 months');
  }

  // Calculate total planned across all months
  const plannedTotalYear = monthlyTotals.reduce((sum, m) => sum + (m.planned || 0), 0);
  
  // Strategy 1: Proportional based on planned
  if (plannedTotalYear > 0) {
    return monthlyTotals.map(m => ({
      ...m,
      budgetAllocated: annualBudget * ((m.planned || 0) / plannedTotalYear),
    }));
  }

  // Strategy 2: Fallback to proportional based on forecast
  const forecastTotalYear = monthlyTotals.reduce((sum, m) => sum + (m.forecast || 0), 0);
  if (forecastTotalYear > 0) {
    return monthlyTotals.map(m => ({
      ...m,
      budgetAllocated: annualBudget * ((m.forecast || 0) / forecastTotalYear),
    }));
  }

  // Strategy 3: Final fallback - equal distribution
  const budgetPerMonth = annualBudget / 12;
  return monthlyTotals.map(m => ({
    ...m,
    budgetAllocated: budgetPerMonth,
  }));
}

/**
 * Allocate annual portfolio budget across individual projects
 * proportionally based on each project's planned total
 * 
 * @param annualBudget - Total portfolio budget for the year
 * @param projectMonthlyData - Map of projectId to their monthly data
 * @returns Map of projectId to their annual budget allocation
 */
export function allocateBudgetByProject(
  annualBudget: number,
  projectMonthlyData: Map<string, Array<{ month: number; planned: number; forecast: number; actual: number }>>
): Map<string, number> {
  const allocations = new Map<string, number>();

  if (annualBudget <= 0 || projectMonthlyData.size === 0) {
    // Return zero allocation for all projects
    projectMonthlyData.forEach((_, projectId) => {
      allocations.set(projectId, 0);
    });
    return allocations;
  }

  // Calculate total planned for each project
  const projectPlannedTotals = new Map<string, number>();
  let portfolioPlannedTotal = 0;

  projectMonthlyData.forEach((monthlyData, projectId) => {
    const projectPlanned = monthlyData.reduce((sum, m) => sum + (m.planned || 0), 0);
    projectPlannedTotals.set(projectId, projectPlanned);
    portfolioPlannedTotal += projectPlanned;
  });

  // Allocate budget proportionally
  if (portfolioPlannedTotal > 0) {
    projectPlannedTotals.forEach((projectPlanned, projectId) => {
      const projectBudget = annualBudget * (projectPlanned / portfolioPlannedTotal);
      allocations.set(projectId, projectBudget);
    });
  } else {
    // Equal distribution fallback if no planned data
    const budgetPerProject = annualBudget / projectMonthlyData.size;
    projectMonthlyData.forEach((_, projectId) => {
      allocations.set(projectId, budgetPerProject);
    });
  }

  return allocations;
}

/**
 * Calculate complete portfolio budget allocation with monthly breakdown per project
 * 
 * @param annualBudget - Total portfolio budget
 * @param projectMonthlyData - Map of projectId to monthly data arrays
 * @param projectNames - Map of projectId to project names
 * @returns Array of project budget allocations with monthly breakdown
 */
export function calculatePortfolioBudgetAllocation(
  annualBudget: number,
  projectMonthlyData: Map<string, Array<{ month: number; planned: number; forecast: number; actual: number }>>,
  projectNames: Map<string, string>
): ProjectBudgetAllocation[] {
  // First allocate budget to each project
  const projectBudgets = allocateBudgetByProject(annualBudget, projectMonthlyData);

  // Then allocate each project's budget across its months
  const results: ProjectBudgetAllocation[] = [];

  projectBudgets.forEach((projectBudget, projectId) => {
    const monthlyData = projectMonthlyData.get(projectId);
    if (!monthlyData) return;

    const monthlyAllocations = allocateBudgetMonthly(projectBudget, monthlyData);

    results.push({
      projectId,
      projectName: projectNames.get(projectId) || 'Unknown Project',
      annualBudget: projectBudget,
      monthlyAllocations,
    });
  });

  return results;
}

/**
 * Calculate variance between actual/forecast and allocated budget
 * Positive variance = over budget, Negative = under budget
 */
export function calculateVariances(allocation: MonthlyAllocation): {
  varianceForecastVsBudget: number;
  varianceActualVsBudget: number;
  percentConsumedActual: number;
} {
  const varianceForecastVsBudget = allocation.forecast - allocation.budgetAllocated;
  const varianceActualVsBudget = allocation.actual - allocation.budgetAllocated;
  const percentConsumedActual = allocation.budgetAllocated > 0 
    ? (allocation.actual / allocation.budgetAllocated) * 100 
    : 0;

  return {
    varianceForecastVsBudget,
    varianceActualVsBudget,
    percentConsumedActual,
  };
}

/**
 * Helper to create monthly data structure from forecast cells
 * Groups by month and sums planned/forecast/actual
 */
export function aggregateMonthlyTotals(
  forecastCells: Array<{ month: number; planned: number; forecast: number; actual: number }>
): Array<{ month: number; planned: number; forecast: number; actual: number }> {
  const monthlyMap = new Map<number, { planned: number; forecast: number; actual: number }>();

  // Initialize all 12 months
  for (let month = 1; month <= 12; month++) {
    monthlyMap.set(month, { planned: 0, forecast: 0, actual: 0 });
  }

  // Aggregate cells by month
  forecastCells.forEach(cell => {
    const existing = monthlyMap.get(cell.month);
    if (existing) {
      existing.planned += cell.planned || 0;
      existing.forecast += cell.forecast || 0;
      existing.actual += cell.actual || 0;
    }
  });

  // Convert to array
  return Array.from(monthlyMap.entries()).map(([month, totals]) => ({
    month,
    ...totals,
  }));
}
