/**
 * Metrics calculation helpers for MOD and labor vs indirect costs
 */

import { LaborVsIndirectMetrics } from './types';

/**
 * Calculate labor share percentages and totals for plan/forecast/actual
 * 
 * Labor Share = MOD / (MOD + Indirect Costs)
 * 
 * Safe handling:
 * - Returns undefined if denominator is 0 or both components are missing
 * - Returns 1.0 if only MOD exists (100% labor)
 * - Returns 0.0 if only indirect costs exist (0% labor)
 * 
 * @param params Object with optional MOD and indirect cost values for each kind
 * @returns LaborVsIndirectMetrics with calculated shares (0-1 floats)
 */
export function calculateLaborVsIndirect(params: {
  planMOD?: number;
  forecastMOD?: number;
  actualMOD?: number;
  planIndirect?: number;
  forecastIndirect?: number;
  actualIndirect?: number;
}): LaborVsIndirectMetrics {
  const {
    planMOD,
    forecastMOD,
    actualMOD,
    planIndirect,
    forecastIndirect,
    actualIndirect,
  } = params;

  // Helper to safely calculate share
  const calculateShare = (mod?: number, indirect?: number): number | undefined => {
    const m = mod ?? 0;
    const i = indirect ?? 0;
    const total = m + i;

    if (total === 0) {
      // Both missing or both zero
      return undefined;
    }

    return m / total;
  };

  // Calculate totals
  const totalPlan = ((planMOD ?? 0) + (planIndirect ?? 0)) || undefined;
  const totalForecast = ((forecastMOD ?? 0) + (forecastIndirect ?? planIndirect ?? 0)) || undefined;
  const totalActual = ((actualMOD ?? 0) + (actualIndirect ?? 0)) || undefined;

  return {
    laborSharePlan: calculateShare(planMOD, planIndirect),
    laborShareForecast: calculateShare(forecastMOD, forecastIndirect ?? planIndirect),
    laborShareActual: calculateShare(actualMOD, actualIndirect),
    totalPlan,
    totalForecast,
    totalActual,
    planMOD,
    forecastMOD,
    actualMOD,
    planIndirect,
    forecastIndirect: forecastIndirect ?? planIndirect,
    actualIndirect,
  };
}

/**
 * Aggregate multiple LaborVsIndirectMetrics into a single summary
 * Useful for rolling up project-level metrics to portfolio level
 * 
 * @param metrics Array of individual metrics to aggregate
 * @returns Aggregated metrics with recalculated shares
 */
export function aggregateLaborVsIndirect(
  metrics: LaborVsIndirectMetrics[]
): LaborVsIndirectMetrics {
  const summed = metrics.reduce(
    (acc, curr) => ({
      planMOD: (acc.planMOD ?? 0) + (curr.planMOD ?? 0),
      forecastMOD: (acc.forecastMOD ?? 0) + (curr.forecastMOD ?? 0),
      actualMOD: (acc.actualMOD ?? 0) + (curr.actualMOD ?? 0),
      planIndirect: (acc.planIndirect ?? 0) + (curr.planIndirect ?? 0),
      forecastIndirect: (acc.forecastIndirect ?? 0) + (curr.forecastIndirect ?? 0),
      actualIndirect: (acc.actualIndirect ?? 0) + (curr.actualIndirect ?? 0),
    }),
    {
      planMOD: 0,
      forecastMOD: 0,
      actualMOD: 0,
      planIndirect: 0,
      forecastIndirect: 0,
      actualIndirect: 0,
    }
  );

  // Recalculate shares on summed values
  return calculateLaborVsIndirect(summed);
}
