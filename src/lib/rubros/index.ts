/**
 * Unified Frontend Helper for Rubros
 * 
 * This module provides the public API for rubros operations in the frontend.
 * It abstracts the canonical taxonomy implementation details and provides
 * a stable, user-friendly interface for UI components.
 * 
 * USE THIS MODULE for all frontend rubro operations instead of importing
 * from canonical-taxonomy directly.
 */

import { getCanonicalRubroId, type CanonicalRubroTaxonomy } from './canonical-taxonomy';
import { getRubroById } from './taxonomyHelpers';

/**
 * Canonicalize a rubro ID for use in API payloads
 * 
 * This is the public frontend function for normalizing rubro inputs.
 * It converts legacy/alias values into canonical IDs.
 * 
 * @param raw - Raw rubro identifier (can be legacy ID, alias, etc.)
 * @returns Canonical rubro ID or undefined if not found
 * 
 * @example
 * canonicalizeRubroId('MOD-PM') // returns 'MOD-LEAD'
 * canonicalizeRubroId('project-manager') // returns 'MOD-LEAD'
 * canonicalizeRubroId('MOD-ING') // returns 'MOD-ING'
 */
export function canonicalizeRubroId(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Delegate to the canonical taxonomy implementation
  return getCanonicalRubroId(raw) ?? undefined;
}

/**
 * Get the description for a rubro
 * 
 * @param raw - Raw rubro identifier
 * @returns Description string or undefined if not found
 */
export function rubroDescriptionFor(raw?: string): string | undefined {
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) return undefined;
  
  const rubro = getRubroById(canonical);
  return rubro?.descripcion ?? rubro?.linea_gasto;
}

/**
 * Find rubro by linea_codigo
 * 
 * @param lineaCodigo - Canonical linea_codigo or legacy ID
 * @returns Rubro taxonomy item or null if not found
 */
export function findRubroByLineaCodigo(lineaCodigo?: string): ReturnType<typeof getRubroById> {
  if (!lineaCodigo) return null;
  const canonical = canonicalizeRubroId(lineaCodigo);
  if (!canonical) return null;
  return getRubroById(canonical);
}

// Re-export types for convenience
export type { CanonicalRubroTaxonomy };
