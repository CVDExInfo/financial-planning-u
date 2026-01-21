/**
 * Canonical Aliases for Rubros Taxonomy
 * 
 * This file contains explicit alias mappings for common role strings and
 * other free-text legacy values to canonical rubro IDs.
 * 
 * These aliases are used by the taxonomy lookup to resolve user-facing
 * strings (e.g., "Service Delivery Manager") to their canonical IDs (e.g., "MOD-SDM").
 * 
 * Note: Keys are normalized at lookup time, so only canonical forms are needed.
 * 
 * Added to fix: Console warnings for legitimate role strings that exist in
 * canonical taxonomy but weren't indexed by the client-side lookup.
 */

/**
 * Canonical aliases mapping common strings to canonical rubro IDs
 * Keys are normalized at lookup time (lowercase, diacritics removed, etc.)
 */
export const CANONICAL_ALIASES: Record<string, string> = {
  // Service Delivery Manager variants
  'Service Delivery Manager': 'MOD-SDM',
  'Service Delivery Mgr': 'MOD-SDM',
  'SDM': 'MOD-SDM',
  
  // Project Manager variants (maps to MOD-LEAD per canonical taxonomy)
  'Project Manager': 'MOD-LEAD',
  'PM': 'MOD-LEAD',
  
  // Ingeniero Delivery variants
  'Ingeniero Delivery': 'MOD-LEAD',
  'Ingeniero Lider': 'MOD-LEAD',
  
  // Engineer support variants
  'Ingeniero Soporte N1': 'MOD-ING',
  'Ingeniero Soporte N2': 'MOD-ING',
  'Ingeniero Soporte N3': 'MOD-ING',
};
