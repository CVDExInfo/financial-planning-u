/**
 * Normalize Estimates - Canonical Rubro Mapping
 * 
 * This module provides normalization functions to ensure PMO Estimator data
 * is stored with canonical rubro IDs and complete taxonomy metadata before
 * being sent to the server or saved to the database.
 * 
 * This fixes reconciliation issues by ensuring:
 * - line_item_id === canonical linea_codigo (e.g., "MOD-LEAD", not "mod-lead-ingeniero")
 * - descripcion is populated from taxonomy
 * - categoria is populated from taxonomy
 * - rubro_canonical is set for tracking
 */

import { findRubroByLineaCodigo, requireCanonicalRubro } from "@/lib/rubros";
import type { LaborEstimate, NonLaborEstimate } from "@/types/domain";


/**
 * Extended LaborEstimate with DB fields for server submission
 */
export interface NormalizedLaborEstimate extends LaborEstimate {
  line_item_id: string | null;
  linea_codigo: string | null;
  descripcion: string;
  categoria: string;
  rubro_canonical: string | null;
  description?: string; // Add for UI compatibility
  category?: string; // Add for UI compatibility
}

/**
 * Extended NonLaborEstimate with DB fields for server submission
 */
export interface NormalizedNonLaborEstimate extends NonLaborEstimate {
  line_item_id: string | null;
  descripcion: string;
  categoria: string;
  rubro_canonical: string | null;
}

/**
 * Normalize a Labor estimate to canonical DB shape
 * 
 * This function:
 * 1. STRICTLY resolves canonical linea_codigo from rubroId or role (throws if invalid)
 * 2. Fetches taxonomy metadata for the canonical ID
 * 3. Populates line_item_id, descripcion, categoria, and rubro_canonical
 * 4. Prioritizes taxonomy descripcion over user-entered description
 * 
 * @param item - Labor estimate from UI
 * @returns Normalized labor estimate ready for server submission
 * @throws Error if rubroId/role cannot be mapped to canonical taxonomy
 */
export function normalizeLaborEstimate(item: LaborEstimate): NormalizedLaborEstimate {
  // CRITICAL: Strictly require canonical ID - no fallbacks, fail loudly
  const canonical = requireCanonicalRubro(item.rubroId || item.role || "");
  
  // Fetch taxonomy entry for metadata using unified rubros helper
  const tax = findRubroByLineaCodigo(canonical);
  
  // Build normalized estimate
  return {
    ...item,
    // DB fields (must match server expectations)
    line_item_id: canonical,
    linea_codigo: canonical,
    descripcion: tax?.descripcion || tax?.linea_gasto || (item as any).description || item.role || "",
    categoria: tax?.categoria || (item as any).category || "",
    rubro_canonical: canonical,
    // Preserve UI fields for compatibility
    description: tax?.descripcion || tax?.linea_gasto || (item as any).description || item.role || "",
    category: tax?.categoria || (item as any).category || "",
  };
}

/**
 * Normalize a NonLabor estimate to canonical DB shape
 * 
 * This function:
 * 1. STRICTLY resolves canonical linea_codigo from rubroId (throws if invalid)
 * 2. Fetches taxonomy metadata for the canonical ID
 * 3. Populates line_item_id, descripcion, categoria, and rubro_canonical
 * 4. Prioritizes taxonomy descripcion over user-entered description
 * 
 * @param item - NonLabor estimate from UI
 * @returns Normalized non-labor estimate ready for server submission
 * @throws Error if rubroId cannot be mapped to canonical taxonomy
 */
export function normalizeNonLaborEstimate(item: NonLaborEstimate): NormalizedNonLaborEstimate {
  // CRITICAL: Strictly require canonical ID - no fallbacks, fail loudly
  const canonical = requireCanonicalRubro(item.rubroId || "");
  
  // Fetch taxonomy entry for metadata using unified rubros helper
  const tax = findRubroByLineaCodigo(canonical);
  
  // Build normalized estimate
  return {
    ...item,
    // DB fields (must match server expectations)
    line_item_id: canonical,
    descripcion: tax?.descripcion || tax?.linea_gasto || item.description || "",
    categoria: tax?.categoria || item.category || "",
    rubro_canonical: canonical,
  };
}

/**
 * Normalize an array of labor estimates
 * 
 * @param estimates - Array of labor estimates
 * @returns Array of normalized labor estimates
 */
export function normalizeLaborEstimates(estimates: LaborEstimate[]): NormalizedLaborEstimate[] {
  return estimates.map(normalizeLaborEstimate);
}

/**
 * Normalize an array of non-labor estimates
 * 
 * @param estimates - Array of non-labor estimates
 * @returns Array of normalized non-labor estimates
 */
export function normalizeNonLaborEstimates(estimates: NonLaborEstimate[]): NormalizedNonLaborEstimate[] {
  return estimates.map(normalizeNonLaborEstimate);
}
