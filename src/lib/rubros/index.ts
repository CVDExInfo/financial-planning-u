/**
 * src/lib/rubros/index.ts
 *
 * Public frontend helpers for the canonical rubros taxonomy.
 *
 * Frontend code should import everything from "@/lib/rubros".
 * Do NOT import internals from "@/lib/rubros/canonical-taxonomy".
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
  // Keep low-level exports out of the public surface by default.
} from "./canonical-taxonomy";

import { getRubroById as _getRubroById } from "./taxonomyHelpers";

export type { CanonicalRubroTaxonomy, TipoCosto, TipoEjecucion } from "./canonical-taxonomy";

/* ===========================================================================
 * Public frontend helper functions
 * ======================================================================== */

/**
 * Canonicalize a rubro ID for frontend use.
 *
 * Accepts legacy aliases, slugs, human-readable labels, or canonical ids,
 * and returns the canonical `linea_codigo` (uppercased) when available.
 * Returns `undefined` if no canonical mapping found.
 */
export function canonicalizeRubroId(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const canonical = _getCanonicalRubroId(raw);
    if (!canonical) return undefined;
    return String(canonical).toUpperCase();
  } catch (err) {
    if ((import.meta as any)?.env?.DEV) {
      console.warn("[canonicalizeRubroId] failed to canonicalize:", raw, err);
    }
    return undefined;
  }
}

/**
 * Return the user-facing description for a rubro (prefer taxonomy.descripcion,
 * fall back to linea_gasto).
 */
export function rubroDescriptionFor(raw?: string): string | undefined {
  if (!raw) return undefined;
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) return undefined;

  const tax = getTaxonomyById(canonical);
  if (tax) return tax.descripcion ?? tax.linea_gasto ?? undefined;

  // Fallback to taxonomyHelpers (if taxonomyById didn't find it)
  const byId = _getRubroById(canonical);
  if (byId) return byId.descripcion ?? byId.linea_gasto ?? undefined;

  return undefined;
}

/**
 * Find a rubro item by linea_codigo (canonical id).
 */
export function findRubroByLineaCodigo(lineaCodigo?: string) {
  if (!lineaCodigo) return undefined;
  const canonical = canonicalizeRubroId(lineaCodigo);
  if (!canonical) return undefined;

  const tax = getTaxonomyById(canonical);
  if (tax) return tax;

  return _getRubroById(canonical);
}

/**
 * Get taxonomy entry by raw input (safe wrapper).
 * Always canonicalizes before lookup.
 */
export function getTaxonomyEntry(raw?: string) {
  if (!raw) return null;
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) return null;
  return getTaxonomyById(canonical);
}

/**
 * Return the canonical taxonomy array (use sparingly).
 */
export function allRubros() {
  return CANONICAL_RUBROS_TAXONOMY;
}

/* ===========================================================================
 * Lightweight re-exports & constants for frontend
 *
 * Export only the things the UI legitimately needs. Keep internals hidden.
 * ======================================================================== */

/**
 * Keep the exact name expected by existing code (used in useSDMTForecastData).
 * This is the canonical taxonomy array loaded by canonical-taxonomy.ts.
 */
export const CANONICAL_RUBROS_TAXONOMY = CANONICAL_RUBROS_TAXONOMY;

/**
 * Labor rubros consts
 */
export const LABOR_RUBROS = LABOR_CANONICAL_KEYS;
export const LABOR_RUBROS_SET = LABOR_CANONICAL_KEYS_SET;

/**
 * Aliases map (human-readable → canonical)
 */
export const RUBRO_ALIASES = CANONICAL_ALIASES;

/**
 * Convenience category helpers
 */
export const getAllRubrosCategories = getAllCategories;
export const getRubrosForCategory = getRubrosByCategory;

/**
 * Active rubros access
 */
export const ACTIVE_RUBROS = getActiveRubros;

/* ===========================================================================
 * Backwards-compatible small re-exports (explicit)
 * If you need more low-level functions in frontend, add a deliberate re-export.
 * ======================================================================== */

export { isValidRubroId as isValidRubroId } from "./canonical-taxonomy";

/* ===========================================================================
 * Types
 * ======================================================================== */

export type { CanonicalRubroTaxonomy } from "./canonical-taxonomy";

/* ===========================================================================
 * Internal note
 * - Frontend code: import from "@/lib/rubros".
 * - Server code (services/finanzas-api) may import "./canonical-taxonomy" directly.
 * ======================================================================== */
