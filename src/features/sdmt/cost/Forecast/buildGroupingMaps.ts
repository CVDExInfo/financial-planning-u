/**
 * buildGroupingMaps - Universal grouping helper for both portfolio and single-project views
 * 
 * This helper consolidates the grouping logic previously gated by isPortfolioView,
 * allowing ForecastRubrosTable to work correctly in both modes.
 */

import type { ForecastCell, LineItem } from '@/types/domain';

export interface RubroData {
  rubroId: string;
  description: string;
  category: string;
  byMonth: Record<number, { forecast: number; actual: number; planned: number }>;
  overall: {
    forecast: number;
    actual: number;
    planned: number;
    varianceForecast: number;
    varianceActual: number;
    percentConsumption: number;
  };
}

export interface Totals {
  byMonth: Record<number, { forecast: number; actual: number; planned: number }>;
  overall: {
    forecast: number;
    actual: number;
    planned: number;
    varianceForecast: number;
    varianceActual: number;
    percentConsumption: number;
  };
}

export interface RubroTaxonomy {
  [rubroId: string]: {
    category?: string;
    description?: string;
    order?: number;
  };
}

/**
 * Normalize rubro key for matching
 * Strips hash suffix, lowercases, removes non-alphanumeric chars
 * Uses the same normalization pattern as computeForecastFromAllocations.ts
 * TODO: Consider extracting to shared utility module to avoid duplication
 */
const normalizeRubroKey = (s?: string): string => {
  if (!s) return '';
  return s
    .toString()
    .split('#')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
};

/**
 * Build grouping maps for forecast data
 * Works for both portfolio and single-project views
 */
export function buildGroupingMaps(opts: {
  forecastRows: ForecastCell[];
  taxonomy: RubroTaxonomy;
  viewMode: 'portfolio' | 'project';
  projectId?: string;
}): {
  categoryMap: Map<string, RubroData[]>;
  rubroMap: Map<string, RubroData>;
  totalsMap: Map<string, Totals>;
} {
  const { forecastRows, taxonomy, viewMode, projectId } = opts;

  const categoryMap = new Map<string, RubroData[]>();
  const rubroMap = new Map<string, RubroData>();
  const totalsMap = new Map<string, Totals>();

  // First pass: group by rubro and category
  const categoryRubrosMap = new Map<string, Map<string, RubroData>>();

  forecastRows.forEach(cell => {
    // Extract rubro ID (try multiple field names)
    const rubroId = cell.line_item_id || (cell as any).rubroId || (cell as any).sk || 'UNKNOWN';
    const normalizedKey = normalizeRubroKey(rubroId);
    
    // Lookup taxonomy for category and description
    const taxonomyEntry = taxonomy[rubroId] || taxonomy[normalizedKey];
    
    // Determine category
    const category = 
      (cell as any).category || 
      taxonomyEntry?.category || 
      'UNMAPPED';
    
    // Determine description
    const description = 
      (cell as any).description || 
      taxonomyEntry?.description || 
      `Allocation ${rubroId}`;
    
    const month = cell.month;

    // Initialize category if needed
    if (!categoryRubrosMap.has(category)) {
      categoryRubrosMap.set(category, new Map());
      totalsMap.set(category, {
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

    const categoryRubros = categoryRubrosMap.get(category)!;
    const categoryTotals = totalsMap.get(category)!;

    // Initialize rubro if needed
    if (!categoryRubros.has(rubroId)) {
      const rubroData: RubroData = {
        rubroId,
        description,
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
      };
      categoryRubros.set(rubroId, rubroData);
      rubroMap.set(rubroId, rubroData);
    }

    const rubro = categoryRubros.get(rubroId)!;

    // Initialize month if needed
    if (!rubro.byMonth[month]) {
      rubro.byMonth[month] = { forecast: 0, actual: 0, planned: 0 };
    }
    if (!categoryTotals.byMonth[month]) {
      categoryTotals.byMonth[month] = { forecast: 0, actual: 0, planned: 0 };
    }

    // Accumulate monthly totals
    rubro.byMonth[month].forecast += cell.forecast || 0;
    rubro.byMonth[month].actual += cell.actual || 0;
    rubro.byMonth[month].planned += cell.planned || 0;

    categoryTotals.byMonth[month].forecast += cell.forecast || 0;
    categoryTotals.byMonth[month].actual += cell.actual || 0;
    categoryTotals.byMonth[month].planned += cell.planned || 0;

    // Accumulate overall totals
    rubro.overall.forecast += cell.forecast || 0;
    rubro.overall.actual += cell.actual || 0;
    rubro.overall.planned += cell.planned || 0;

    categoryTotals.overall.forecast += cell.forecast || 0;
    categoryTotals.overall.actual += cell.actual || 0;
    categoryTotals.overall.planned += cell.planned || 0;
  });

  // Second pass: calculate variances and percentages
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

  totalsMap.forEach(categoryTotals => {
    categoryTotals.overall.varianceForecast = 
      categoryTotals.overall.forecast - categoryTotals.overall.planned;
    categoryTotals.overall.varianceActual = 
      categoryTotals.overall.actual - categoryTotals.overall.planned;
    categoryTotals.overall.percentConsumption =
      categoryTotals.overall.forecast > 0
        ? (categoryTotals.overall.actual / categoryTotals.overall.forecast) * 100
        : 0;
  });

  // Third pass: sort rubros by taxonomy order or alphabetically
  categoryRubrosMap.forEach((rubros, category) => {
    const rubrosArray = Array.from(rubros.values());
    
    // Sort by taxonomy order if available, otherwise by rubroId
    rubrosArray.sort((a, b) => {
      const aOrder = taxonomy[a.rubroId]?.order ?? 999;
      const bOrder = taxonomy[b.rubroId]?.order ?? 999;
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      return a.rubroId.localeCompare(b.rubroId);
    });
    
    categoryMap.set(category, rubrosArray);
  });

  return {
    categoryMap,
    rubroMap,
    totalsMap,
  };
}
