import { useMemo } from 'react';
import {
  ForecastCell,
  GroupingMode,
  SnapshotRow,
  CostTypeFilter,
  deriveCostType,
} from '../monthlySnapshotTypes';
import { isLabor } from '@/lib/rubros-category-utils';

interface UseMonthlySnapshotDataParams {
  forecastData: ForecastCell[];
  lineItems: Array<{ id: string; category?: string; projectId?: string; description?: string }>;
  useMonthlyBudget: boolean;
  actualMonthIndex: number;
  groupingMode: GroupingMode;
  monthBudget: number | null;
  searchQuery: string;
  showOnlyVariance: boolean;
  costTypeFilter: CostTypeFilter;
}

export interface CostBreakdown {
  laborTotal: number;
  nonLaborTotal: number;
  laborPct: number;
  nonLaborPct: number;
}

interface FilterParams {
  rows: SnapshotRow[];
  costTypeFilter: CostTypeFilter;
  searchQuery: string;
  showOnlyVariance: boolean;
}

export interface MonthlySnapshotDataResult {
  snapshotRows: SnapshotRow[];
  filteredRows: SnapshotRow[];
  sortedRows: SnapshotRow[];
  summaryTotals: {
    totalBudget: number;
    totalForecast: number;
    totalActual: number;
  };
  summaryForMonth: {
    budget: number;
    forecast: number;
    actual: number;
    consumoPct: number;
    varianceAbs: number;
    variancePct: number;
  };
  costBreakdown: CostBreakdown;
}

export function useMonthlySnapshotData({
  forecastData,
  lineItems,
  useMonthlyBudget,
  actualMonthIndex,
  groupingMode,
  monthBudget,
  searchQuery,
  showOnlyVariance,
  costTypeFilter,
}: UseMonthlySnapshotDataParams): MonthlySnapshotDataResult {
  const lineItemCategoryMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    lineItems.forEach((item) => {
      if (item.id) {
        map.set(item.id, item.category);
      }
      if (item.projectId && !map.has(item.projectId)) {
        map.set(item.projectId, item.category);
      }
    });
    return map;
  }, [lineItems]);

  const snapshotRows = useMemo(() => {
    return buildSnapshotRows({
      forecastData,
      actualMonthIndex,
      groupingMode,
      monthBudget,
      useMonthlyBudget,
      lineItemCategoryMap,
    });
  }, [forecastData, actualMonthIndex, groupingMode, monthBudget, useMonthlyBudget, lineItemCategoryMap]);

  const filteredRows = useMemo(() => {
    return filterSnapshotRows({ rows: snapshotRows, costTypeFilter, searchQuery, showOnlyVariance });
  }, [snapshotRows, costTypeFilter, searchQuery, showOnlyVariance]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => Math.abs(b.varianceBudget) - Math.abs(a.varianceBudget));
  }, [filteredRows]);

  const summaryTotals = useMemo(() => {
    return calculateSummaryTotals(sortedRows);
  }, [sortedRows]);

  const summaryForMonth = useMemo(() => {
    return calculateSummaryForMonth(summaryTotals);
  }, [summaryTotals]);

  const costBreakdown = useMemo(() => {
    return calculateCostBreakdown(filteredRows);
  }, [filteredRows]);

  return {
    snapshotRows,
    filteredRows,
    sortedRows,
    summaryTotals,
    summaryForMonth,
    costBreakdown,
  };
}

interface BuildSnapshotRowsParams {
  forecastData: ForecastCell[];
  actualMonthIndex: number;
  groupingMode: GroupingMode;
  monthBudget: number | null;
  useMonthlyBudget: boolean;
  lineItemCategoryMap: Map<string, string | undefined>;
}

export function buildSnapshotRows({
  forecastData,
  actualMonthIndex,
  groupingMode,
  monthBudget,
  useMonthlyBudget,
  lineItemCategoryMap,
}: BuildSnapshotRowsParams): SnapshotRow[] {
  const monthData = forecastData.filter((cell) => cell.month === actualMonthIndex);

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const totalActual = monthData.reduce((sum, cell) => sum + (cell.actual || 0), 0);
    const totalForecast = monthData.reduce((sum, cell) => sum + (cell.forecast || 0), 0);
    const missingCategoryCount = monthData.filter(
      (c) =>
        !c.category &&
        !lineItemCategoryMap.get(c.line_item_id) &&
        !lineItemCategoryMap.get(c.rubroId || c.line_item_id)
    ).length;
    console.log(
      `[useMonthlySnapshotData] monthDataLen=${monthData.length}, totalActual=${totalActual}, totalForecast=${totalForecast}, month=${actualMonthIndex}, missingCategoryCount=${missingCategoryCount}`
    );
  }

  if (groupingMode === 'project') {
    const projectMap = new Map<string, SnapshotRow>();

    monthData.forEach((cell) => {
      const projectId = cell.projectId || 'unknown';
      const projectName = cell.projectName || 'Proyecto desconocido';
      const rubroId = cell.rubroId || cell.line_item_id;
      const rubroName = cell.description || 'Sin descripción';
      const resolvedCategory = cell.category || lineItemCategoryMap.get(cell.line_item_id) || lineItemCategoryMap.get(rubroId);
      
      // Prefer explicit category, but fall back to descriptive fields when category missing.
      // Fallback order: cell.description → rubroName → cell.projectName → empty string
      const fallbackText = cell.description || rubroName || cell.projectName || '';
      const costType = deriveCostType(resolvedCategory, fallbackText);

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          id: projectId,
          name: projectName,
          code: projectId,
          budget: 0,
          forecast: 0,
          actual: 0,
          varianceBudget: 0,
          varianceBudgetPercent: null,
          varianceForecast: 0,
          varianceForecastPercent: null,
          status: 'Sin Datos',
          children: [],
        });
      }

      const projectRow = projectMap.get(projectId)!;
      projectRow.forecast += cell.forecast || 0;
      projectRow.actual += cell.actual || 0;

      const childRow: SnapshotRow = {
        id: `${projectId}-${rubroId}`,
        name: rubroName,
        code: rubroId,
        budget: 0,
        forecast: cell.forecast || 0,
        actual: cell.actual || 0,
        varianceBudget: 0,
        varianceBudgetPercent: null,
        varianceForecast: (cell.actual || 0) - (cell.forecast || 0),
        varianceForecastPercent:
          (cell.forecast || 0) > 0 ? (((cell.actual || 0) - (cell.forecast || 0)) / (cell.forecast || 0)) * 100 : null,
        status: 'Sin Presupuesto',
        parentId: projectId,
        projectId,
        rubroId,
        category: resolvedCategory,
        costType,
      };

      projectRow.children!.push(childRow);
    });

    const totalForecast = Array.from(projectMap.values()).reduce((sum, row) => sum + row.forecast, 0);

    projectMap.forEach((projectRow) => {
      if (monthBudget && monthBudget > 0) {
        if (totalForecast > 0) {
          projectRow.budget = (projectRow.forecast / totalForecast) * monthBudget;
        } else {
          projectRow.budget = monthBudget / projectMap.size || 0;
        }
      }

      projectRow.varianceBudget = projectRow.forecast - projectRow.budget;
      projectRow.varianceBudgetPercent = projectRow.budget > 0 ? (projectRow.varianceBudget / projectRow.budget) * 100 : null;
      projectRow.varianceForecast = projectRow.actual - projectRow.forecast;
      projectRow.varianceForecastPercent = projectRow.forecast > 0 ? (projectRow.varianceForecast / projectRow.forecast) * 100 : null;
      projectRow.status = determineStatus(projectRow.budget, projectRow.forecast, projectRow.actual, useMonthlyBudget);
    });

    return Array.from(projectMap.values());
  }

  const rubroMap = new Map<string, SnapshotRow>();

  monthData.forEach((cell) => {
    const rubroId = cell.rubroId || cell.line_item_id;
    const rubroName = cell.description || cell.category || 'Sin categoría';
    const projectId = cell.projectId || 'unknown';
    const projectName = cell.projectName || 'Proyecto desconocido';
    const resolvedCategory = cell.category || lineItemCategoryMap.get(cell.line_item_id) || lineItemCategoryMap.get(rubroId);
    
    // Prefer explicit category, but fall back to descriptive fields when category missing.
    // Fallback order: cell.description → projectName → rubroName → empty string
    const fallbackText = cell.description || projectName || rubroName || '';
    const costType = deriveCostType(resolvedCategory, fallbackText);

    if (!rubroMap.has(rubroId)) {
      rubroMap.set(rubroId, {
        id: rubroId,
        name: rubroName,
        code: rubroId,
        budget: 0,
        forecast: 0,
        actual: 0,
        varianceBudget: 0,
        varianceBudgetPercent: null,
        varianceForecast: 0,
        varianceForecastPercent: null,
        status: 'Sin Datos',
        children: [],
        category: resolvedCategory,
        costType,
      });
    }

    const rubroRow = rubroMap.get(rubroId)!;
    rubroRow.forecast += cell.forecast || 0;
    rubroRow.actual += cell.actual || 0;

    const projectRow: SnapshotRow = {
      id: `${rubroId}-${projectId}`,
      name: projectName,
      code: projectId,
      budget: 0,
      forecast: cell.forecast || 0,
      actual: cell.actual || 0,
      varianceBudget: 0,
      varianceBudgetPercent: null,
      varianceForecast: (cell.actual || 0) - (cell.forecast || 0),
      varianceForecastPercent:
        (cell.forecast || 0) > 0 ? (((cell.actual || 0) - (cell.forecast || 0)) / (cell.forecast || 0)) * 100 : null,
      status: 'Sin Presupuesto',
      parentId: rubroId,
      projectId,
      rubroId,
    };

    rubroRow.children!.push(projectRow);
  });

  const totalForecast = Array.from(rubroMap.values()).reduce((sum, row) => sum + row.forecast, 0);

  rubroMap.forEach((rubroRow) => {
    if (monthBudget && monthBudget > 0) {
      if (totalForecast > 0) {
        rubroRow.budget = (rubroRow.forecast / totalForecast) * monthBudget;
      } else {
        rubroRow.budget = monthBudget / rubroMap.size || 0;
      }
    }

    rubroRow.varianceBudget = rubroRow.forecast - rubroRow.budget;
    rubroRow.varianceBudgetPercent = rubroRow.budget > 0 ? (rubroRow.varianceBudget / rubroRow.budget) * 100 : null;
    rubroRow.varianceForecast = rubroRow.actual - rubroRow.forecast;
    rubroRow.varianceForecastPercent = rubroRow.forecast > 0 ? (rubroRow.varianceForecast / rubroRow.forecast) * 100 : null;
    rubroRow.status = determineStatus(rubroRow.budget, rubroRow.forecast, rubroRow.actual, useMonthlyBudget);
  });

  return Array.from(rubroMap.values());
}

export function filterSnapshotRows({ rows, costTypeFilter, searchQuery, showOnlyVariance }: FilterParams): SnapshotRow[] {
  let workingRows = [...rows];

  if (costTypeFilter !== 'all') {
    workingRows = workingRows
      .map((row) => filterRowByCostType(row, costTypeFilter))
      .filter((row): row is SnapshotRow => row !== null);
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    workingRows = workingRows.filter((row) => {
      const matchesParent = row.name.toLowerCase().includes(query) || row.code?.toLowerCase().includes(query);
      const matchesChild = row.children?.some((child) => child.name.toLowerCase().includes(query) || child.code?.toLowerCase().includes(query));
      return matchesParent || matchesChild;
    });
  }

  if (showOnlyVariance) {
    workingRows = workingRows.filter((row) => {
      const hasVariance = Math.abs(row.varianceBudget) > 0 || Math.abs(row.varianceForecast) > 0;
      const childVariance = row.children?.some((child) => Math.abs(child.varianceBudget) > 0 || Math.abs(child.varianceForecast) > 0);
      return hasVariance || childVariance;
    });
  }

  return workingRows;
}

const filterRowByCostType = (row: SnapshotRow, costTypeFilter: CostTypeFilter): SnapshotRow | null => {
  if (row.children && row.children.length > 0) {
    const filteredChildren = row.children
      .map((child) => filterRowByCostType(child, costTypeFilter))
      .filter((child): child is SnapshotRow => child !== null);

    if (filteredChildren.length > 0) {
      return { ...row, children: filteredChildren };
    }
    return null;
  }

  if (row.costType === undefined) {
    // Try to infer from name/code using same labor heuristics
    const inferredLabor = isLabor(undefined, row.name) || isLabor(undefined, row.code);
    if (costTypeFilter === 'labor' && inferredLabor) return row;
    if (costTypeFilter === 'non-labor' && !inferredLabor) return row;
    return costTypeFilter === 'all' ? row : null;
  }

  if (costTypeFilter === 'labor' && row.costType === 'labor') return row;
  if (costTypeFilter === 'non-labor' && row.costType === 'non-labor') return row;

  return null;
};

export const determineStatus = (
  budget: number,
  forecast: number,
  actual: number,
  useMonthlyBudget: boolean,
): SnapshotRow['status'] => {
  if (!useMonthlyBudget || budget === 0) {
    if (forecast === 0 && actual === 0) return 'Sin Datos';
    return 'Sin Presupuesto';
  }

  const consumptionPercent = (actual / budget) * 100;
  const forecastOverBudget = forecast > budget;

  if (forecastOverBudget || consumptionPercent > 100) {
    return 'Sobre Presupuesto';
  }

  if (consumptionPercent > 90) {
    return 'En Riesgo';
  }

  return 'En Meta';
};

const calculateSummaryTotals = (rows: SnapshotRow[]) => {
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
  const totalForecast = rows.reduce((sum, row) => sum + row.forecast, 0);
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
  return { totalBudget, totalForecast, totalActual };
};

const calculateSummaryForMonth = ({ totalBudget, totalForecast, totalActual }: MonthlySnapshotDataResult['summaryTotals']) => {
  const consumoPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const varianceAbs = totalActual - totalBudget;
  const variancePct = totalBudget > 0 ? (varianceAbs / totalBudget) * 100 : 0;
  return { budget: totalBudget, forecast: totalForecast, actual: totalActual, consumoPct, varianceAbs, variancePct };
};

const calculateCostBreakdown = (rows: SnapshotRow[]): CostBreakdown => {
  let laborTotal = 0;
  let nonLaborTotal = 0;

  rows.forEach((row) => {
    const targets = row.children && row.children.length > 0 ? row.children : [row];
    targets.forEach((item) => {
      if (item.costType === 'labor') {
        laborTotal += item.forecast;
      } else if (item.costType === 'non-labor') {
        nonLaborTotal += item.forecast;
      }
    });
  });

  const total = laborTotal + nonLaborTotal;
  const laborPct = total > 0 ? (laborTotal / total) * 100 : 0;
  const nonLaborPct = total > 0 ? (nonLaborTotal / total) * 100 : 0;

  return {
    laborTotal,
    nonLaborTotal,
    laborPct,
    nonLaborPct,
  };
};
