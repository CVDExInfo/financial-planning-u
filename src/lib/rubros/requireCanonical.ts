/**
 * Strict canonical rubro enforcement helper
 * 
 * This module provides a strict enforcement mechanism for canonical rubros.
 * All DynamoDB writes MUST use this helper to ensure only canonical linea_codigo
 * values from data/rubros.taxonomy.json are persisted.
 * 
 * NO EXCEPTIONS - fail loudly if the rubro cannot be canonicalized.
 */

import { canonicalizeRubroId } from "@/lib/rubros";

/**
 * Return canonical linea_codigo (UPPERCASE), or throw if not found.
 * No silent fallbacks allowed.
 * 
 * This is the REQUIRED function for all DynamoDB writes involving rubros.
 * 
 * @param raw - Raw rubro identifier (can be legacy ID, alias, human-readable label, etc.)
 * @returns Canonical linea_codigo in UPPERCASE (e.g., "MOD-SDM", "MOD-LEAD")
 * @throws Error if the rubro cannot be mapped to a canonical ID
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
 * ```
 */
export function requireCanonicalRubro(raw?: string): string {
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) {
    throw new Error(
      `[rubro] Unknown or non-canonical rubro id: "${String(raw)}" — operation blocked. ` +
      `All rubros must exist in data/rubros.taxonomy.json`
    );
  }
  return canonical;
}
