/**
 * Strict canonical rubro enforcement helper (Backend)
 * 
 * This module provides a strict enforcement mechanism for canonical rubros.
 * All DynamoDB writes MUST use this helper to ensure only canonical linea_codigo
 * values from data/rubros.taxonomy.json are persisted.
 * 
 * NO EXCEPTIONS - fail loudly if the rubro cannot be canonicalized.
 */

import { getCanonicalRubroId, getTaxonomyById } from './canonical-taxonomy';

/**
 * Return canonical linea_codigo (UPPERCASE), or throw if not found.
 * No silent fallbacks allowed.
 * 
 * This is the REQUIRED function for all DynamoDB writes involving rubros.
 * 
 * Validates both:
 * 1. Raw input can be canonicalized (legacy ID, alias, or canonical ID)
 * 2. Taxonomy entry exists for the canonical ID
 * 
 * @param raw - Raw rubro identifier (can be legacy ID, alias, human-readable label, etc.)
 * @returns Canonical linea_codigo in UPPERCASE (e.g., "MOD-SDM", "MOD-LEAD")
 * @throws Error if input is missing, cannot be canonicalized, or taxonomy entry is missing
 * 
 * @example
 * ```ts
 * // Valid canonical ID
 * requireCanonicalRubro("MOD-SDM") // Returns "MOD-SDM"
 * 
 * // Valid alias
 * requireCanonicalRubro("mod-lead-ingeniero-delivery") // Returns "MOD-LEAD"
 * 
 * // Invalid/unknown ID
 * requireCanonicalRubro("INVALID-RUBRO") // Throws Error
 * 
 * // Missing input
 * requireCanonicalRubro() // Throws Error
 * ```
 */
/**
 * Get canonical linea_codigo or null if not found (tolerant version).
 * Use this for UI/test/fallback code where you want graceful degradation.
 * 
 * For DynamoDB writes, use requireCanonicalRubro() instead (strict).
 * 
 * @param raw - Raw rubro identifier (can be legacy ID, alias, human-readable label, etc.)
 * @returns Canonical linea_codigo in UPPERCASE (e.g., "MOD-SDM") or null if not found
 * 
 * @example
 * ```ts
 * // Valid canonical ID
 * getCanonicalRubroOrNull("MOD-SDM") // Returns "MOD-SDM"
 * 
 * // Valid alias
 * getCanonicalRubroOrNull("mod-lead-ingeniero-delivery") // Returns "MOD-LEAD"
 * 
 * // Invalid/unknown ID
 * getCanonicalRubroOrNull("INVALID-RUBRO") // Returns null
 * 
 * // Missing input
 * getCanonicalRubroOrNull() // Returns null
 * ```
 */
export function getCanonicalRubroOrNull(raw?: string): string | null {
  if (!raw) {
    return null;
  }
  
  const canonical = getCanonicalRubroId(raw);
  if (!canonical) {
    return null;
  }
  
  const tax = getTaxonomyById(canonical);
  if (!tax || !tax.linea_codigo) {
    return null;
  }
  
  return String(tax.linea_codigo).trim().toUpperCase();
}

export function requireCanonicalRubro(raw?: string): string {
  if (!raw) {
    throw new Error('[rubro] missing input');
  }
  
  const canonical = getCanonicalRubroId(raw) || null;
  if (!canonical) {
    throw new Error(`[rubro] Unknown rubro (no canonical mapping): "${raw}"`);
  }
  
  const tax = getTaxonomyById(canonical);
  if (!tax || !tax.linea_codigo) {
    throw new Error(`[rubro] Taxonomy missing for canonical id: "${canonical}"`);
  }
  
  return String(tax.linea_codigo).trim().toUpperCase();
}
