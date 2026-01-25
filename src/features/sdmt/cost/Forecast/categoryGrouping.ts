/**
 * Category Grouping Utilities
 * 
 * Provides data structures and functions for grouping forecast data by category
 * Used in TODOS/ALL_PROJECTS mode for portfolio-level reporting
 */

import type { ForecastCell, LineItem } from '@/types/domain';
import { getTaxonomyById } from '@/lib/rubros/canonical-taxonomy';
import { normalizeForecastCells } from '../utils/dataAdapters';

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
 * 
 * Note: Deduplicates input data before processing to ensure accurate totals
 */
export function buildCategoryTotals(
  forecastData: ForecastCell[]
): Map<string, CategoryTotals> {
  // Deduplicate input data first to prevent double-counting
  const dedupedData = normalizeForecastCells(forecastData);
  
  const categoryMap = new Map<string, CategoryTotals>();

  // Group data by category
  dedupedData.forEach(cell => {
    const rubroId = cell.line_item_id;
    const month = cell.month;
    
    // Try to resolve category from canonical taxonomy if not present on cell
    let category = (cell as any).category;
    if (!category) {
      const taxonomy = getTaxonomyById(rubroId);
      if (taxonomy) {
        category = taxonomy.categoria;
      }
    }
    if (!category) {
      category = 'Sin categoría';
    }

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
 * 
 * Note: Deduplicates input data before processing to ensure accurate totals
 */
export function buildCategoryRubros(
  forecastData: ForecastCell[],
  lineItems: LineItem[]
): Map<string, CategoryRubro[]> {
  // Deduplicate input data first to prevent double-counting
  const dedupedData = normalizeForecastCells(forecastData);
  
  const categoryRubrosMap = new Map<string, Map<string, CategoryRubro>>();

  // Group data by category and rubro
  dedupedData.forEach(cell => {
    const rubroId = cell.line_item_id;
    const month = cell.month;
    
    // Try to resolve category and description from canonical taxonomy first
    const taxonomy = getTaxonomyById(rubroId);
    
    // Priority chain for category: cell.category -> taxonomy.categoria -> lineItem.category -> 'Sin categoría'
    let category = (cell as any).category;
    if (!category && taxonomy) {
      category = taxonomy.categoria;
    }
    if (!category) {
      const lineItem = lineItems.find(item => item.id === rubroId);
      category = lineItem?.category;
    }
    if (!category) {
      category = 'Sin categoría';
    }

    if (!categoryRubrosMap.has(category)) {
      categoryRubrosMap.set(category, new Map());
    }

    const categoryRubros = categoryRubrosMap.get(category)!;

    if (!categoryRubros.has(rubroId)) {
      // Priority chain for description: lineItem.description -> cell.description -> taxonomy.linea_gasto -> 'Unknown'
      const lineItem = lineItems.find(item => item.id === rubroId);
      let description = lineItem?.description || (cell as any).description;
      if (!description && taxonomy) {
        description = taxonomy.linea_gasto || taxonomy.descripcion;
      }
      if (!description) {
        description = 'Unknown';
      }
      
      // Priority chain for isLabor: cell.isLabor -> taxonomy (MOD categoria) -> lineItem.isLabor -> category check
      const isLabor = (cell as any).isLabor ?? 
                     (taxonomy?.categoria_codigo === 'MOD' ? true : undefined) ?? 
                     (lineItem as any)?.isLabor ?? 
                     category?.toLowerCase().includes('mano de obra');

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
 * 
 * Note: Deduplicates input data before processing to ensure accurate totals
 */
export function buildPortfolioTotals(forecastData: ForecastCell[]): PortfolioTotals {
  // Deduplicate input data first to prevent double-counting
  const dedupedData = normalizeForecastCells(forecastData);
  
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

  dedupedData.forEach(cell => {
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
