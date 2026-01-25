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

import { getCanonicalRubroId } from "@/lib/rubros/canonical-taxonomy";
import { getRubroById } from "@/lib/rubros/taxonomyHelpers";
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
 * 1. Resolves canonical linea_codigo from rubroId or role
 * 2. Fetches taxonomy metadata for the canonical ID
 * 3. Populates line_item_id, descripcion, categoria, and rubro_canonical
 * 4. Preserves user-entered description if present
 * 
 * @param item - Labor estimate from UI
 * @returns Normalized labor estimate ready for server submission
 */
export function normalizeLaborEstimate(item: LaborEstimate): NormalizedLaborEstimate {
  // Resolve canonical ID from rubroId or role field
  const canonical = getCanonicalRubroId(item.rubroId || item.role || "") || item.rubroId;
  
  // Fetch taxonomy entry for metadata
  const tax = canonical ? getRubroById(canonical) : null;
  
  // Build normalized estimate
  return {
    ...item,
    // DB fields (must match server expectations)
    line_item_id: canonical,
    linea_codigo: canonical,
    descripcion: (item as any).description || tax?.descripcion || tax?.linea_gasto || item.role || "",
    categoria: (item as any).category || tax?.categoria || "",
    rubro_canonical: canonical,
    // Preserve UI fields for compatibility
    description: (item as any).description || tax?.descripcion || tax?.linea_gasto || item.role || "",
    category: (item as any).category || tax?.categoria || "",
  };
}

/**
 * Normalize a NonLabor estimate to canonical DB shape
 * 
 * This function:
 * 1. Resolves canonical linea_codigo from rubroId
 * 2. Fetches taxonomy metadata for the canonical ID
 * 3. Populates line_item_id, descripcion, categoria, and rubro_canonical
 * 4. Preserves user-entered description if present
 * 
 * @param item - NonLabor estimate from UI
 * @returns Normalized non-labor estimate ready for server submission
 */
export function normalizeNonLaborEstimate(item: NonLaborEstimate): NormalizedNonLaborEstimate {
  // Resolve canonical ID from rubroId
  const canonical = getCanonicalRubroId(item.rubroId || "") || item.rubroId;
  
  // Fetch taxonomy entry for metadata
  const tax = canonical ? getRubroById(canonical) : null;
  
  // Build normalized estimate
  return {
    ...item,
    // DB fields (must match server expectations)
    line_item_id: canonical,
    descripcion: item.description || tax?.descripcion || tax?.linea_gasto || "",
    categoria: item.category || tax?.categoria || "",
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
