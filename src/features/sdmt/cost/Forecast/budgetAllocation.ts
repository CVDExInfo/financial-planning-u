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
  // New fields for monthly budget support
  budgetEntered?: number; // Explicitly entered monthly budget (if provided)
  isEstimated?: boolean; // True if budgetAllocated was auto-filled, false if entered
}

// Input type for functions that compute allocations
export interface MonthlyData {
  month: number;
  planned: number;
  forecast: number;
  actual: number;
}

// Monthly budget input from user (Finance/PMO)
export interface MonthlyBudgetInput {
  month: number; // 1-12
  budget: number; // Budget amount for this month
}

// Runway metrics for a given month
export interface RunwayMetrics {
  month: number;
  budgetForMonth: number;
  actualForMonth: number;
  varianceForMonth: number; // actual - budget
  isOverBudget: boolean;
  remainingAnnualBudget: number; // Annual budget minus sum of actuals up to this month
  remainingMonthlyBudget: number; // Sum of monthly budgets for remaining months
  percentConsumed: number; // Percentage of annual budget consumed
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
  monthlyTotals: MonthlyData[]
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
  projectMonthlyData: Map<string, MonthlyData[]>
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
  projectMonthlyData: Map<string, MonthlyData[]>,
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
): MonthlyData[] {
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

/**
 * Allocate budget with monthly budget inputs (Finance-entered budgets)
 * 
 * When Finance provides specific monthly budgets, use those as source of truth.
 * For months without entered budgets, auto-fill using remaining annual / remaining months.
 * 
 * @param annualBudget - Total annual budget (reference/check)
 * @param monthlyBudgetInputs - Array of explicitly entered monthly budgets
 * @param monthlyTotals - Monthly data for all 12 months
 * @returns Array of 12 monthly allocations with budgetEntered and isEstimated flags
 */
export function allocateBudgetWithMonthlyInputs(
  annualBudget: number,
  monthlyBudgetInputs: MonthlyBudgetInput[],
  monthlyTotals: MonthlyData[]
): MonthlyAllocation[] {
  // Create a map of entered budgets
  const enteredBudgets = new Map<number, number>();
  monthlyBudgetInputs.forEach(input => {
    if (input.budget > 0) {
      enteredBudgets.set(input.month, input.budget);
    }
  });

  // Calculate total entered and how much is left
  const totalEntered = Array.from(enteredBudgets.values()).reduce((sum, b) => sum + b, 0);
  const remaining = Math.max(0, annualBudget - totalEntered);
  const monthsWithoutBudget = 12 - enteredBudgets.size;

  // Allocate budgets
  return monthlyTotals.map(m => {
    const enteredBudget = enteredBudgets.get(m.month);
    
    if (enteredBudget !== undefined) {
      // Use entered budget
      return {
        ...m,
        budgetAllocated: enteredBudget,
        budgetEntered: enteredBudget,
        isEstimated: false,
      };
    } else {
      // Auto-fill using remaining budget distributed by planned or equally
      let estimated = 0;
      if (monthsWithoutBudget > 0) {
        // Try to distribute proportionally by planned
        const monthsData = monthlyTotals.filter(mt => !enteredBudgets.has(mt.month));
        const totalPlannedRemaining = monthsData.reduce((sum, mt) => sum + (mt.planned || 0), 0);
        
        if (totalPlannedRemaining > 0) {
          // Proportional allocation
          estimated = remaining * ((m.planned || 0) / totalPlannedRemaining);
        } else {
          // Equal distribution
          estimated = remaining / monthsWithoutBudget;
        }
      }
      
      return {
        ...m,
        budgetAllocated: estimated,
        budgetEntered: undefined,
        isEstimated: true,
      };
    }
  });
}

/**
 * Calculate runway metrics for each month showing remaining budget
 * and impact of actuals on future months
 * 
 * @param annualBudget - Total annual budget
 * @param monthlyAllocations - Monthly allocations with actual spending
 * @returns Array of runway metrics per month
 */
export function calculateRunwayMetrics(
  annualBudget: number,
  monthlyAllocations: MonthlyAllocation[]
): RunwayMetrics[] {
  let cumulativeActual = 0;
  
  return monthlyAllocations.map(allocation => {
    cumulativeActual += allocation.actual || 0;
    
    const budgetForMonth = allocation.budgetAllocated;
    const actualForMonth = allocation.actual || 0;
    const varianceForMonth = actualForMonth - budgetForMonth;
    const isOverBudget = varianceForMonth > 0;
    
    // Remaining annual budget after this month's actuals
    const remainingAnnualBudget = Math.max(0, annualBudget - cumulativeActual);
    
    // Remaining monthly budget (sum of budgets for future months)
    const futureMonthsBudget = monthlyAllocations
      .filter(m => m.month > allocation.month)
      .reduce((sum, m) => sum + m.budgetAllocated, 0);
    const remainingMonthlyBudget = Math.max(0, futureMonthsBudget);
    
    const percentConsumed = annualBudget > 0 ? (cumulativeActual / annualBudget) * 100 : 0;
    
    return {
      month: allocation.month,
      budgetForMonth,
      actualForMonth,
      varianceForMonth,
      isOverBudget,
      remainingAnnualBudget,
      remainingMonthlyBudget,
      percentConsumed,
    };
  });
}
