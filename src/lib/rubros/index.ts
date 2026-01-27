/**
 * src/lib/rubros/index.ts
 *
 * Public frontend helpers for Rubros (canonical taxonomy).
 *
 * IMPORTANT:
 * - Use the functions exported from this module in frontend code.
 * - Do NOT import implementation internals from ./canonical-taxonomy directly
 *   in UI/feature code. The canonical-taxonomy module is an internal
 *   implementation detail and may change.
 */

import {
  getCanonicalRubroId as _getCanonicalRubroId,
  getTaxonomyById,
  getAllCategories,
  getRubrosByCategory,
  CANONICAL_RUBROS_TAXONOMY,
  LABOR_CANONICAL_KEYS,
  LABOR_CANONICAL_KEYS_SET,
  CANONICAL_ALIASES,
  getActiveRubros,
  // (other low-level functions/constants may exist - do not re-export them unless required)
} from "./canonical-taxonomy";

import { getRubroById as _getRubroById } from "./taxonomyHelpers";

export type { CanonicalRubroTaxonomy, TipoCosto, TipoEjecucion } from "./canonical-taxonomy";

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
    // Delegate to low-level implementation and normalize case
    const canonical = _getCanonicalRubroId(raw);
    if (!canonical) return undefined;
    return String(canonical).toUpperCase();
  } catch (err) {
    // Defensive: do not throw in UI; log and return undefined
    if ((import.meta as any)?.env?.DEV) {
      console.warn("[canonicalizeRubroId] failed to canonicalize:", raw, err);
    }
    return undefined;
  }
}

/**
 * Return the user-facing description for a rubro (prefer taxonomy.descripcion,
 * fall back to linea_gasto).
 *
 * Accepts either canonical id or legacy alias - canonicalization happens inside.
 */
export function rubroDescriptionFor(raw?: string): string | undefined {
  if (!raw) return undefined;
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) return undefined;

  // Try taxonomy helper first
  const tax = getTaxonomyById(canonical);
  if (tax) {
    return tax.descripcion ?? tax.linea_gasto ?? undefined;
  }

  // Fallback to taxonomy helper from taxonomyHelpers if available
  const byId = _getRubroById(canonical);
  if (byId) {
    return byId.descripcion ?? byId.linea_gasto ?? undefined;
  }

  return undefined;
}

/**
 * Find a rubro taxonomy item by linea_codigo (canonical id).
 *
 * Accepts canonical or legacy id; returns the taxonomy object (or undefined).
 */
export function findRubroByLineaCodigo(lineaCodigo?: string) {
  if (!lineaCodigo) return undefined;
  const canonical = canonicalizeRubroId(lineaCodigo);
  if (!canonical) return undefined;

  // Prefer canonical taxonomy lookup
  const tax = getTaxonomyById(canonical);
  if (tax) return tax;

  // Fallback to taxonomyHelpers
  return _getRubroById(canonical);
}

/**
 * Get a taxonomy entry by id (public alias).
 *
 * NOTE: It is recommended to canonicalize inputs first via canonicalizeRubroId(raw)
 * before calling this helper when dealing with legacy IDs or slugs.
 */
export function getTaxonomyEntry(raw?: string) {
  if (!raw) return null;
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) return null;
  return getTaxonomyById(canonical);
}

/**
 * Return all rubros (canonical taxonomy array).
 * Use sparingly in UI (prefetching/pagination preferred for very large taxonomies).
 */
export function allRubros() {
  return CANONICAL_RUBROS_TAXONOMY;
}

/* ===========================================================================
 * Re-exports and constants for frontend use
 *
 * These are provided for convenience. Prefer the helpers above for behavior.
 * ======================================================================== */

/**
 * Export canonical taxonomy (use sparingly).
 */
export const ALL_RUBROS_TAXONOMY = CANONICAL_RUBROS_TAXONOMY;

/**
 * Labor rubros constants and sets
 */
export const LABOR_RUBROS = LABOR_CANONICAL_KEYS;
export const LABOR_RUBROS_SET = LABOR_CANONICAL_KEYS_SET;

/**
 * Human readable alias map for quick mapping (use for suggestion lists, etc.)
 */
export const RUBRO_ALIASES = CANONICAL_ALIASES;

/**
 * Re-export convenience category functions
 * (these are safe and UI-focused helpers)
 */
export const getAllRubrosCategories = getAllCategories;
export const getRubrosForCategory = getRubrosByCategory;

/**
 * Active rubros (if the canonical module supports it)
 */
export const ACTIVE_RUBROS = getActiveRubros;

/* ===========================================================================
 * Backwards-compatible aliases & exports
 * (Keep these small and mark deprecated if you want)
 * ======================================================================== */

/**
 * isValidRubro - check if a rubro id is valid (delegates to canonical-taxonomy)
 * NOTE: if you need to call the low-level function directly, prefer canonicalizeRubroId
 */
export { isValidRubroId as isValidRubroId } from "./canonical-taxonomy";

/* ===========================================================================
 * Types
 * ======================================================================== */

export type { CanonicalRubroTaxonomy } from "./canonical-taxonomy";

/* ===========================================================================
 * Internal note:
 * - Do not import `./canonical-taxonomy` directly from UI code.
 * - If a frontend module absolutely needs low-level constants, add a small,
 *   deliberate re-export above and document the intent.
 * ======================================================================== */
