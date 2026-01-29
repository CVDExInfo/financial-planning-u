/**
 * Extract baseline estimates from various baseline structure shapes
 * 
 * Supports:
 * - baseline.fields.labor_estimates / baseline.fields.non_labor_estimates
 * - baseline.payload.labor_estimates / baseline.payload.non_labor_estimates
 * - baseline.labor_estimates / baseline.non_labor_estimates (direct)
 * 
 * Returns empty arrays if estimates not found (non-fatal).
 */

export type BaselineLaborEstimate = {
  rubroId?: string;
  role?: string;
  level?: string;
  hours_per_month?: number;
  fte_count?: number;
  hourly_rate?: number;
  rate?: number;
  on_cost_percentage?: number;
  start_month?: number;
  end_month?: number;
};

export type BaselineNonLaborEstimate = {
  rubroId?: string;
  category?: string;
  description?: string;
  amount?: number;
  vendor?: string;
  one_time?: boolean;
  start_month?: number;
  end_month?: number;
};

export interface ExtractedEstimates {
  labor: BaselineLaborEstimate[];
  nonLabor: BaselineNonLaborEstimate[];
}

/**
 * Extract labor and non-labor estimates from baseline
 * Handles multiple structure shapes and returns empty arrays if not found
 */
export function extractBaselineEstimates(baseline: any): ExtractedEstimates {
  if (!baseline || typeof baseline !== 'object') {
    return { labor: [], nonLabor: [] };
  }

  // Check multiple possible locations for estimates
  const fields = baseline.fields || {};
  const payload = baseline.payload || {};
  
  // Try fields first, then payload, then direct on baseline
  const labor = fields.labor_estimates || 
                payload.labor_estimates || 
                baseline.labor_estimates || 
                [];
                
  const nonLabor = fields.non_labor_estimates || 
                   payload.non_labor_estimates || 
                   baseline.non_labor_estimates || 
                   [];
  
  return {
    labor: Array.isArray(labor) ? labor : [],
    nonLabor: Array.isArray(nonLabor) ? nonLabor : []
  };
}

/**
 * Check if baseline has any estimates
 */
export function hasEstimates(baseline: any): boolean {
  const { labor, nonLabor } = extractBaselineEstimates(baseline);
  return labor.length > 0 || nonLabor.length > 0;
}
