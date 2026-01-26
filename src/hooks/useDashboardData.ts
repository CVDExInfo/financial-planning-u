/**
 * useDashboardData Hook
 * 
 * React Query hook for DashboardV2 data management
 * Supports both portfolio and single-project views with intelligent caching
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import finanzasClient from '@/api/finanzasClient';
import { ForecastRubrosAdapter } from '@/lib/rubros';
import type { PortfolioForecastData, DashboardDataOptions } from './types';

// Query key factory for cache management
const dashboardKeys = {
  all: ['dashboardData'] as const,
  portfolio: (year: number, months: number, filters?: Record<string, unknown>) =>
    ['dashboardData', 'portfolio', year, months, filters] as const,
  project: (projectId: string, months: number) =>
    ['dashboardData', 'project', projectId, months] as const,
};

/**
 * Portfolio-level forecast data type
 */
export interface PortfolioForecastData {
  metadata: {
    generatedAt: string;
    year: number;
    months: number;
    currency: string;
    filters?: {
      projectIds?: string[];
      rubroIds?: string[];
    };
  };
  summary: {
    totalPlanned: number;
    totalActual: number;
    totalForecast: number;
    variance: number;
    variancePercent: number;
    runwayMonths?: number;
    budgetUtilization?: number;
  };
  rubros: Array<{
    canonicalId: string;
    name: string;
    category: string;
    monthlyData: Array<{
      monthIndex: number;
      monthLabel: string;
      planned: number;
      actual: number;
      forecast: number;
      variance: number;
    }>;
    totals: {
      totalPlanned: number;
      totalActual: number;
      totalForecast: number;
      totalVariance: number;
    };
    last_updated?: string;
  }>;
  projects: Array<{
    projectId: string;
    projectName: string;
    rubros: Array<{
      canonicalId: string;
      name: string;
      category: string;
      monthlyData: Array<{
        monthIndex: number;
        monthLabel: string;
        planned: number;
        actual: number;
        forecast: number;
        variance: number;
      }>;
      totals: {
        totalPlanned: number;
        totalActual: number;
        totalForecast: number;
        totalVariance: number;
      };
      last_updated?: string;
    }>;
    totals: {
      totalPlanned: number;
      totalActual: number;
      totalForecast: number;
      totalVariance: number;
    };
  }>;
}

/**
 * Dashboard data options
 */
export interface DashboardDataOptions {
  /** View mode: 'portfolio' for all projects, 'project' for single project */
  viewMode: 'portfolio' | 'project';
  /** Project ID (required when viewMode is 'project') */
  projectId?: string;
  /** Number of months to fetch (1-60) */
  months: number;
  /** Fiscal year */
  year: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Filter by specific project IDs (portfolio mode only) */
  filterProjectIds?: string[];
  /** Filter by specific rubro IDs */
  filterRubroIds?: string[];
}

/**
 * Fetch portfolio-level forecast data
 */
async function fetchPortfolioForecast(
  year: number,
  months: number,
  options?: {
    projectIds?: string[];
    rubroIds?: string[];
  }
): Promise<PortfolioForecastData> {
  const data = await finanzasClient.getPortfolioForecast(year, months, options);
  
  // Data integrity checks
  const now = new Date();
  const generatedAt = new Date(data.metadata.generatedAt);
  const ageMinutes = (now.getTime() - generatedAt.getTime()) / 1000 / 60;
  
  if (ageMinutes > 5) {
    console.warn(
      `[DashboardV2] Portfolio forecast data is ${ageMinutes.toFixed(1)} minutes old. Consider cache refresh.`
    );
  }
  
  // Validate canonical rubro IDs
  const hasLegacyRubros = data.rubros.some(r => {
    const normalized = ForecastRubrosAdapter.normalizeItems([{ rubro_id: r.canonicalId }]);
    return normalized[0]?.rubro_normalization_warning;
  });
  
  if (hasLegacyRubros) {
    console.warn('[DashboardV2] Response contains legacy or non-canonical rubro IDs');
  }
  
  return data;
}

/**
 * Fetch single-project forecast data
 * 
 * Note: This uses the existing SDMTForecast data fetching logic for consistency
 * until the backend implements a dedicated single-project endpoint.
 */
async function fetchProjectForecast(
  projectId: string,
  months: number
): Promise<PortfolioForecastData> {
  // Import dynamically to avoid circular dependencies
  const { getForecastPayload } = await import('@/features/sdmt/cost/Forecast/forecastService');
  
  const rawData = await getForecastPayload(projectId, months);
  
  // Transform to match PortfolioForecastData shape
  // This is a simplified adapter - full implementation would need
  // to aggregate rubros, calculate totals, etc.
  // For now, we'll throw a not-implemented error
  throw new Error('Single-project mode not yet implemented in DashboardV2. Use portfolio mode.');
}

/**
 * useDashboardData Hook
 * 
 * Primary data hook for DashboardV2 with intelligent caching and normalization
 * 
 * @param options - Dashboard data options
 * @returns React Query result with dashboard data
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useDashboardData({
 *   viewMode: 'portfolio',
 *   year: 2024,
 *   months: 12,
 *   enabled: true,
 * });
 * ```
 */
export function useDashboardData(
  options: DashboardDataOptions
): UseQueryResult<PortfolioForecastData, Error> {
  const {
    viewMode,
    projectId,
    months,
    year,
    enabled = true,
    filterProjectIds,
    filterRubroIds,
  } = options;

  // Validate inputs
  if (viewMode === 'project' && !projectId) {
    throw new Error('projectId is required when viewMode is "project"');
  }

  if (months < 1 || months > 60) {
    throw new Error('months must be between 1 and 60');
  }

  // Build query key based on view mode
  const queryKey = useMemo(() => {
    if (viewMode === 'portfolio') {
      const filters = {
        ...(filterProjectIds?.length ? { projectIds: filterProjectIds } : {}),
        ...(filterRubroIds?.length ? { rubroIds: filterRubroIds } : {}),
      };
      return dashboardKeys.portfolio(year, months, Object.keys(filters).length > 0 ? filters : undefined);
    } else {
      return dashboardKeys.project(projectId!, months);
    }
  }, [viewMode, year, months, projectId, filterProjectIds, filterRubroIds]);

  // Execute query
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (viewMode === 'portfolio') {
        return fetchPortfolioForecast(year, months, {
          projectIds: filterProjectIds,
          rubroIds: filterRubroIds,
        });
      } else {
        return fetchProjectForecast(projectId!, months);
      }
    },
    enabled,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't auto-refetch on window focus
    retry: 2, // Retry failed requests twice
  });

  return query;
}

/**
 * Hook to invalidate dashboard data cache
 * Useful after bulk updates or data mutations
 * 
 * @example
 * ```tsx
 * const invalidate = useInvalidateDashboardData();
 * 
 * // After bulk upsert:
 * await mutateBulkUpsert(items);
 * invalidate(); // Refresh dashboard data
 * ```
 */
export function useInvalidateDashboardData() {
  const { useQueryClient } = require('@tanstack/react-query');
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };
}
