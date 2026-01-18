/**
 * Category Grouping Utilities
 * 
 * Provides data structures and functions for grouping forecast data by category
 * Used in TODOS/ALL_PROJECTS mode for portfolio-level reporting
 */

import type { ForecastCell, LineItem } from '@/types/domain';

export interface CategoryMonthTotals {
  forecast: number;
  actual: number;
  planned: number;
}

export interface CategoryOverallTotals extends CategoryMonthTotals {
  varianceForecast: number; // forecast - planned
  varianceActual: number; // actual - planned
  percentConsumption: number; // (actual / forecast) * 100
}

export interface CategoryTotals {
  category: string;
  byMonth: Record<number, CategoryMonthTotals>; // month (1-12) -> totals
  overall: CategoryOverallTotals;
}

export interface PortfolioTotals {
  byMonth: Record<number, CategoryMonthTotals>;
  overall: CategoryOverallTotals;
}

export interface CategoryRubro {
  rubroId: string;
  description: string;
  category: string;
  isLabor?: boolean;
  byMonth: Record<number, CategoryMonthTotals>;
  overall: CategoryOverallTotals;
}

/**
 * Build category totals from forecast data
 * Groups by category, computes monthly and overall totals
 */
export function buildCategoryTotals(
  forecastData: ForecastCell[]
): Map<string, CategoryTotals> {
  const categoryMap = new Map<string, CategoryTotals>();

  // Group data by category
  forecastData.forEach(cell => {
    const category = (cell as any).category || 'Sin categoría';
    const month = cell.month;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        byMonth: {},
        overall: {
          forecast: 0,
          actual: 0,
          planned: 0,
          varianceForecast: 0,
          varianceActual: 0,
          percentConsumption: 0,
        },
      });
    }

    const categoryData = categoryMap.get(category)!;

    // Initialize month if not exists
    if (!categoryData.byMonth[month]) {
      categoryData.byMonth[month] = {
        forecast: 0,
        actual: 0,
        planned: 0,
      };
    }

    // Accumulate monthly totals
    categoryData.byMonth[month].forecast += cell.forecast || 0;
    categoryData.byMonth[month].actual += cell.actual || 0;
    categoryData.byMonth[month].planned += cell.planned || 0;

    // Accumulate overall totals
    categoryData.overall.forecast += cell.forecast || 0;
    categoryData.overall.actual += cell.actual || 0;
    categoryData.overall.planned += cell.planned || 0;
  });

  // Calculate variances and percentages for each category
  categoryMap.forEach(categoryData => {
    categoryData.overall.varianceForecast = 
      categoryData.overall.forecast - categoryData.overall.planned;
    categoryData.overall.varianceActual = 
      categoryData.overall.actual - categoryData.overall.planned;
    categoryData.overall.percentConsumption = 
      categoryData.overall.forecast > 0
        ? (categoryData.overall.actual / categoryData.overall.forecast) * 100
        : 0;
  });

  return categoryMap;
}

/**
 * Build category rubros from forecast data and line items
 * Groups rubros by category, computes monthly and overall totals per rubro
 */
export function buildCategoryRubros(
  forecastData: ForecastCell[],
  lineItems: LineItem[]
): Map<string, CategoryRubro[]> {
  const categoryRubrosMap = new Map<string, Map<string, CategoryRubro>>();

  // Group data by category and rubro
  forecastData.forEach(cell => {
    const category = (cell as any).category || 'Sin categoría';
    const rubroId = cell.line_item_id;
    const month = cell.month;

    if (!categoryRubrosMap.has(category)) {
      categoryRubrosMap.set(category, new Map());
    }

    const categoryRubros = categoryRubrosMap.get(category)!;

    if (!categoryRubros.has(rubroId)) {
      // Find line item for description
      const lineItem = lineItems.find(item => item.id === rubroId);
      const description = lineItem?.description || (cell as any).description || 'Unknown';
      const isLabor = (cell as any).isLabor ?? (lineItem as any)?.isLabor ?? category?.toLowerCase().includes('mano de obra');

      categoryRubros.set(rubroId, {
        rubroId,
        description,
        category,
        isLabor,
        byMonth: {},
        overall: {
          forecast: 0,
          actual: 0,
          planned: 0,
          varianceForecast: 0,
          varianceActual: 0,
          percentConsumption: 0,
        },
      });
    }

    const rubro = categoryRubros.get(rubroId)!;

    // Initialize month if not exists
    if (!rubro.byMonth[month]) {
      rubro.byMonth[month] = {
        forecast: 0,
        actual: 0,
        planned: 0,
      };
    }

    // Accumulate monthly totals
    rubro.byMonth[month].forecast += cell.forecast || 0;
    rubro.byMonth[month].actual += cell.actual || 0;
    rubro.byMonth[month].planned += cell.planned || 0;

    // Accumulate overall totals
    rubro.overall.forecast += cell.forecast || 0;
    rubro.overall.actual += cell.actual || 0;
    rubro.overall.planned += cell.planned || 0;
  });

  // Calculate variances and percentages for each rubro
  categoryRubrosMap.forEach(categoryRubros => {
    categoryRubros.forEach(rubro => {
      rubro.overall.varianceForecast = rubro.overall.forecast - rubro.overall.planned;
      rubro.overall.varianceActual = rubro.overall.actual - rubro.overall.planned;
      rubro.overall.percentConsumption = 
        rubro.overall.forecast > 0
          ? (rubro.overall.actual / rubro.overall.forecast) * 100
          : 0;
    });
  });

  // Convert to Map<category, CategoryRubro[]>
  const result = new Map<string, CategoryRubro[]>();
  categoryRubrosMap.forEach((rubros, category) => {
    result.set(category, Array.from(rubros.values()));
  });

  return result;
}

/**
 * Build portfolio-level totals (across all categories)
 */
export function buildPortfolioTotals(forecastData: ForecastCell[]): PortfolioTotals {
  const portfolioTotals: PortfolioTotals = {
    byMonth: {},
    overall: {
      forecast: 0,
      actual: 0,
      planned: 0,
      varianceForecast: 0,
      varianceActual: 0,
      percentConsumption: 0,
    },
  };

  forecastData.forEach(cell => {
    const month = cell.month;

    // Initialize month if not exists
    if (!portfolioTotals.byMonth[month]) {
      portfolioTotals.byMonth[month] = {
        forecast: 0,
        actual: 0,
        planned: 0,
      };
    }

    // Accumulate monthly totals
    portfolioTotals.byMonth[month].forecast += cell.forecast || 0;
    portfolioTotals.byMonth[month].actual += cell.actual || 0;
    portfolioTotals.byMonth[month].planned += cell.planned || 0;

    // Accumulate overall totals
    portfolioTotals.overall.forecast += cell.forecast || 0;
    portfolioTotals.overall.actual += cell.actual || 0;
    portfolioTotals.overall.planned += cell.planned || 0;
  });

  // Calculate variances and percentages
  portfolioTotals.overall.varianceForecast = 
    portfolioTotals.overall.forecast - portfolioTotals.overall.planned;
  portfolioTotals.overall.varianceActual = 
    portfolioTotals.overall.actual - portfolioTotals.overall.planned;
  portfolioTotals.overall.percentConsumption = 
    portfolioTotals.overall.forecast > 0
      ? (portfolioTotals.overall.actual / portfolioTotals.overall.forecast) * 100
      : 0;

  return portfolioTotals;
}

/**
 * Build cumulative data for cumulative charts
 */
export function buildCumulativeData(
  portfolioTotals: PortfolioTotals,
  monthlyBudgets: Array<{ month: number; budget: number }> = []
): Array<{
  month: number;
  cumForecast: number;
  cumActual: number;
  cumBudget: number;
}> {
  const cumulativeData: Array<{
    month: number;
    cumForecast: number;
    cumActual: number;
    cumBudget: number;
  }> = [];

  let cumForecast = 0;
  let cumActual = 0;
  let cumBudget = 0;

  for (let month = 1; month <= 12; month++) {
    const monthData = portfolioTotals.byMonth[month];
    if (monthData) {
      cumForecast += monthData.forecast;
      cumActual += monthData.actual;
    }

    // Add budget if available
    const budgetForMonth = monthlyBudgets.find(b => b.month === month);
    if (budgetForMonth) {
      cumBudget += budgetForMonth.budget;
    }

    cumulativeData.push({
      month,
      cumForecast,
      cumActual,
      cumBudget,
    });
  }

  return cumulativeData;
}
