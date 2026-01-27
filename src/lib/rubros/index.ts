/**
 * Unified Frontend Helper for Rubros
 * 
 * This module provides the PUBLIC API for rubros operations in the frontend.
 * It abstracts the canonical taxonomy implementation details and provides
 * a stable, user-friendly interface for UI components.
 * 
 * ⚠️ IMPORTANT: USE THIS MODULE for all frontend rubro operations.
 * DO NOT import from canonical-taxonomy directly in frontend code.
 * 
 * The canonical-taxonomy module is an internal implementation detail
 * that may change. This module provides the stable public contract.
 */

import { 
  getCanonicalRubroId, 
  getTaxonomyById,
  getActiveRubros,
  isValidRubroId,
  getAllCategories,
  getRubrosByCategory,
  CANONICAL_RUBROS_TAXONOMY,
  LABOR_CANONICAL_KEYS,
  LABOR_CANONICAL_KEYS_SET,
  CANONICAL_ALIASES,
  TAXONOMY_BY_ID,
  type CanonicalRubroTaxonomy,
  type TipoCosto,
  type TipoEjecucion,
} from './canonical-taxonomy';
import { getRubroById } from './taxonomyHelpers';

// =============================================================================
// PUBLIC API - Use these functions in frontend code
// =============================================================================

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
 * @returns Rubro taxonomy item or undefined if not found
 */
export function findRubroByLineaCodigo(lineaCodigo?: string): ReturnType<typeof getRubroById> {
  if (!lineaCodigo) return undefined;
  const canonical = canonicalizeRubroId(lineaCodigo);
  if (!canonical) return undefined;
  const result = getRubroById(canonical);
  return result ?? undefined;
}

/**
 * Get taxonomy entry by ID (public frontend API)
 * 
 * This is an alias for getTaxonomyById from canonical-taxonomy,
 * providing a clearer API name.
 * 
 * @param id - Canonical ID or legacy ID
 * @returns Full taxonomy entry or null
 */
export { getTaxonomyById as getTaxonomyEntry };

/**
 * Get all active rubros
 * 
 * @returns Array of all active canonical rubros
 */
export { getActiveRubros as allRubros };

/**
 * Check if a rubro ID is valid
 * 
 * @param rubroId - Rubro ID to validate
 * @returns true if valid, false otherwise
 */
export { isValidRubroId as isValidRubro };

/**
 * Also export as isValidRubroId for backward compatibility
 */
export { isValidRubroId };

// =============================================================================
// CONSTANTS - Re-exported for frontend use
// =============================================================================

/**
 * Complete canonical taxonomy array
 * Use sparingly - prefer the helper functions above
 */
export const ALL_RUBROS_TAXONOMY = CANONICAL_RUBROS_TAXONOMY;

/**
 * Set of canonical labor (MOD - Mano de Obra) rubro IDs
 * Used for fast labor classification in forecast and allocation logic
 */
export const LABOR_RUBROS_SET = LABOR_CANONICAL_KEYS_SET;

/**
 * Array of canonical labor rubro IDs
 */
export const LABOR_RUBROS = LABOR_CANONICAL_KEYS;

/**
 * Map of human-readable role names to canonical rubro IDs
 */
export const RUBRO_ALIASES = CANONICAL_ALIASES;

/**
 * Taxonomy lookup map (ID -> taxonomy entry)
 * Used for direct lookups in certain components
 */
export { TAXONOMY_BY_ID };

// =============================================================================
// HELPER FUNCTIONS - Re-exported for frontend use
// =============================================================================

/**
 * Get all available categories
 * 
 * @returns Array of category objects with code and name
 */
export { getAllCategories, getRubrosByCategory };

// =============================================================================
// TYPES - Re-exported for frontend use
// =============================================================================

export type { CanonicalRubroTaxonomy, TipoCosto, TipoEjecucion };
