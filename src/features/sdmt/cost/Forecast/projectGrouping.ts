/**
 * Project Grouping Utilities
 * 
 * Provides data structures and functions for grouping forecast data by project
 * Used in TODOS/ALL_PROJECTS mode for portfolio-level reporting grouped by project
 */

import type { ForecastCell, LineItem } from '@/types/domain';

export interface ProjectMonthTotals {
  forecast: number;
  actual: number;
  planned: number;
}

export interface ProjectOverallTotals extends ProjectMonthTotals {
  varianceForecast: number; // forecast - planned
  varianceActual: number; // actual - planned
  percentConsumption: number; // (actual / forecast) * 100
}

export interface ProjectTotals {
  projectId: string;
  projectName: string;
  byMonth: Record<number, ProjectMonthTotals>; // month (1-12) -> totals
  overall: ProjectOverallTotals;
}

export interface ProjectRubro {
  rubroId: string;
  description: string;
  projectId: string;
  projectName: string;
  category?: string;
  byMonth: Record<number, ProjectMonthTotals>;
  overall: ProjectOverallTotals;
}

/**
 * Build project totals from forecast data
 * Groups by project_id, computes monthly and overall totals
 */
export function buildProjectTotals(
  forecastData: ForecastCell[]
): Map<string, ProjectTotals> {
  const projectMap = new Map<string, ProjectTotals>();

  // Group data by project
  forecastData.forEach(cell => {
    const projectId = (cell as any).project_id || 'unknown-project';
    const projectName = (cell as any).project_name || 'Unknown Project';
    const month = cell.month;

    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, {
        projectId,
        projectName,
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

    const projectData = projectMap.get(projectId)!;

    // Initialize month if not exists
    if (!projectData.byMonth[month]) {
      projectData.byMonth[month] = {
        forecast: 0,
        actual: 0,
        planned: 0,
      };
    }

    // Accumulate monthly totals
    projectData.byMonth[month].forecast += cell.forecast || 0;
    projectData.byMonth[month].actual += cell.actual || 0;
    projectData.byMonth[month].planned += cell.planned || 0;

    // Accumulate overall totals
    projectData.overall.forecast += cell.forecast || 0;
    projectData.overall.actual += cell.actual || 0;
    projectData.overall.planned += cell.planned || 0;
  });

  // Calculate variances and percentages for each project
  projectMap.forEach(projectData => {
    projectData.overall.varianceForecast = 
      projectData.overall.forecast - projectData.overall.planned;
    projectData.overall.varianceActual = 
      projectData.overall.actual - projectData.overall.planned;
    projectData.overall.percentConsumption = 
      projectData.overall.forecast > 0
        ? (projectData.overall.actual / projectData.overall.forecast) * 100
        : 0;
  });

  return projectMap;
}

/**
 * Build project rubros from forecast data and line items
 * Groups rubros by project and line_item_id, computes monthly and overall totals per rubro
 */
export function buildProjectRubros(
  forecastData: ForecastCell[],
  lineItems: LineItem[]
): Map<string, ProjectRubro[]> {
  const projectRubrosMap = new Map<string, Map<string, ProjectRubro>>();

  // Group data by project and rubro
  forecastData.forEach(cell => {
    const projectId = (cell as any).project_id || 'unknown-project';
    const projectName = (cell as any).project_name || 'Unknown Project';
    const rubroId = cell.line_item_id;
    const month = cell.month;

    if (!projectRubrosMap.has(projectId)) {
      projectRubrosMap.set(projectId, new Map());
    }

    const projectRubros = projectRubrosMap.get(projectId)!;

    if (!projectRubros.has(rubroId)) {
      // Find line item for description
      const lineItem = lineItems.find(item => item.id === rubroId);
      const description = lineItem?.description || (cell as any).description || 'Unknown';
      const category = lineItem?.category || (cell as any).category;

      projectRubros.set(rubroId, {
        rubroId,
        description,
        projectId,
        projectName,
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

    const rubro = projectRubros.get(rubroId)!;

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
  projectRubrosMap.forEach(projectRubros => {
    projectRubros.forEach(rubro => {
      rubro.overall.varianceForecast = rubro.overall.forecast - rubro.overall.planned;
      rubro.overall.varianceActual = rubro.overall.actual - rubro.overall.planned;
      rubro.overall.percentConsumption = 
        rubro.overall.forecast > 0
          ? (rubro.overall.actual / rubro.overall.forecast) * 100
          : 0;
    });
  });

  // Convert to Map<projectId, ProjectRubro[]>
  const result = new Map<string, ProjectRubro[]>();
  projectRubrosMap.forEach((rubros, projectId) => {
    result.set(projectId, Array.from(rubros.values()));
  });

  return result;
}
