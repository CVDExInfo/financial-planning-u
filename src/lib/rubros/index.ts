/**
 * src/lib/rubros/index.ts
 *
 * Public frontend helpers for Rubros (canonical taxonomy).
 *
 * IMPORTANT:
 * - Use exports from THIS module in frontend code.
 * - Do NOT import from ./canonical-taxonomy directly in UI/feature modules.
 *   That file is an internal implementation detail and may change.
 */

import {
  // core helpers
  getCanonicalRubroId as _getCanonicalRubroId,
  getTaxonomyById as _getTaxonomyById,
  isValidRubroId as _isValidRubroId,

  // catalog helpers
  getAllCategories,
  getRubrosByCategory,
  getActiveRubros,

  // constants
  CANONICAL_RUBROS_TAXONOMY,
  TAXONOMY_BY_ID,
  LABOR_CANONICAL_KEYS,
  LABOR_CANONICAL_KEYS_SET,
  CANONICAL_ALIASES,

  // types
  type CanonicalRubroTaxonomy,
  type TipoCosto,
  type TipoEjecucion,
} from "./canonical-taxonomy";

import { getRubroById as _getRubroById } from "./taxonomyHelpers";

export type { CanonicalRubroTaxonomy, TipoCosto, TipoEjecucion } from "./canonical-taxonomy";

// Export strict enforcement helper
export { requireCanonicalRubro } from "./requireCanonical";

/* ===========================================================================
 * Public frontend helper functions
 * ===========================================================================
 */

/**
 * Canonicalize a rubro ID for frontend use.
 *
 * Accepts legacy aliases, slugs, human-readable labels, or canonical ids,
 * and returns the canonical `linea_codigo` (uppercased) when available.
 *
 * Returns `undefined` if no canonical mapping found.
 */
export function canonicalizeRubroId(raw?: string): string | undefined {
  if (!raw) return undefined;

  try {
    const canonical = _getCanonicalRubroId(String(raw));
    if (!canonical) return undefined;
    return String(canonical).trim().toUpperCase();
  } catch (err) {
    // Defensive: do not throw in UI; log and return undefined
    if ((import.meta as any)?.env?.DEV) {
      console.warn("[canonicalizeRubroId] failed:", raw, err);
    }
    return undefined;
  }
}

/**
 * Back-compat / convenience: canonical-taxonomy naming
 * (kept because parts of the codebase already use this name).
 *
 * Returns `null` when no mapping found.
 */
export function getCanonicalRubroId(raw?: string): string | null {
  return canonicalizeRubroId(raw) ?? null;
}

/**
 * Back-compat / convenience: canonical-taxonomy naming
 * (lookup taxonomy entry by canonical id, but accepts raw too).
 */
export function getCanonicalRubroById(rawOrId?: string): CanonicalRubroTaxonomy | null {
  const canonical = canonicalizeRubroId(rawOrId);
  if (!canonical) return null;
  return _getTaxonomyById(canonical);
}

/**
 * Get taxonomy entry by canonical ID (or return null if missing).
 *
 * Use this when you ALREADY have a canonical ID (e.g., after canonicalizeRubroId()).
 */
export function getTaxonomyById(id?: string): CanonicalRubroTaxonomy | null {
  if (!id) return null;
  const key = String(id).trim().toUpperCase();
  return _getTaxonomyById(key);
}

/**
 * Get a taxonomy entry from any raw input.
 * Canonicalizes first, then returns the taxonomy entry or null.
 *
 * Preferred when the input can be legacy/unknown/raw.
 */
export function getTaxonomyEntry(raw?: string): CanonicalRubroTaxonomy | null {
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) return null;

  const tax = _getTaxonomyById(canonical);
  if (tax) return tax;

  // Fallback to taxonomyHelpers if needed (older shape) - convert through unknown
  const fallback = _getRubroById(canonical);
  return (fallback as unknown as CanonicalRubroTaxonomy | undefined) ?? null;
}

/**
 * Return the user-facing description for a rubro
 * (prefer taxonomy.descripcion, fall back to linea_gasto).
 */
export function rubroDescriptionFor(raw?: string): string | undefined {
  const tax = getTaxonomyEntry(raw);
  return tax?.descripcion ?? tax?.linea_gasto ?? undefined;
}

/**
 * Find a rubro taxonomy item by linea_codigo (canonical id).
 * Accepts canonical or legacy id; returns the taxonomy object (or undefined).
 */
export function findRubroByLineaCodigo(lineaCodigo?: string): CanonicalRubroTaxonomy | undefined {
  const canonical = canonicalizeRubroId(lineaCodigo);
  if (!canonical) return undefined;

  const tax = _getTaxonomyById(canonical);
  if (tax) return tax;

  // Fallback - convert through unknown to avoid type errors
  const fallback = _getRubroById(canonical);
  return fallback as unknown as CanonicalRubroTaxonomy | undefined;
}

/**
 * Return all rubros (canonical taxonomy array).
 * Use sparingly in UI.
 */
export function allRubros(): CanonicalRubroTaxonomy[] {
  return CANONICAL_RUBROS_TAXONOMY;
}

/**
 * Validate a rubro ID (canonical or raw).
 * If raw is passed, it will be canonicalized first.
 */
export function isValidRubroId(raw?: string): boolean {
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) return false;
  return _isValidRubroId(canonical);
}

/**
 * Alias for isValidRubroId - validates a rubro ID
 */
export function isValidRubro(raw?: string): boolean {
  return isValidRubroId(raw);
}

/* ===========================================================================
 * Convenience exports (safe for UI use)
 * ======================================================================== */

export const ALL_RUBROS_TAXONOMY = CANONICAL_RUBROS_TAXONOMY;

export const LABOR_RUBROS = LABOR_CANONICAL_KEYS;
export const LABOR_RUBROS_SET = LABOR_CANONICAL_KEYS_SET;

export const RUBRO_ALIASES = CANONICAL_ALIASES;

export const getAllRubrosCategories = getAllCategories;
export const getRubrosForCategory = getRubrosByCategory;

/**
 * Prefer calling `getActiveRubros()` (function) so behavior stays consistent
 * if the implementation becomes dynamic.
 */
export { getActiveRubros };

/* ===========================================================================
 * Backwards-compatible re-exports (minimize breakage while refactoring)
 * ======================================================================== */

// Some modules still expect these names:
export {
  CANONICAL_RUBROS_TAXONOMY,
  TAXONOMY_BY_ID,
  LABOR_CANONICAL_KEYS,
  LABOR_CANONICAL_KEYS_SET,
  CANONICAL_ALIASES,
  getAllCategories,
  getRubrosByCategory,
};
