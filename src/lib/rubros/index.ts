/**
 * Rubros Helper Functions - Single Source of Truth
 * 
 * This module provides a unified interface for working with the canonical
 * rubros taxonomy (data/rubros.taxonomy.json).
 * 
 * All rubro lookups, descriptions, and canonical ID resolution should use
 * these helper functions to ensure consistency across:
 * - PMO Estimator (Prefactura Labor/NonLabor steps)
 * - SDMT Cost Management (Forecast, Changes, Budget)
 * - Backend API (allocations, invoices, line items)
 */

import taxonomyData from '../../../data/rubros.taxonomy.json';
import { getCanonicalRubroId, getTaxonomyById } from './canonical-taxonomy';
import type { CanonicalRubroTaxonomy } from './canonical-taxonomy';

export type RubroItem = {
  linea_codigo: string;
  linea_gasto: string;
  descripcion?: string;
  categoria_codigo?: string;
  categoria?: string;
  tipo_costo?: string;
  tipo_ejecucion?: string;
  fuente_referencia?: string;
};

const items: RubroItem[] = (taxonomyData.items || []).map((item: any) => ({
  linea_codigo: item.linea_codigo,
  linea_gasto: item.linea_gasto,
  descripcion: item.descripcion,
  categoria_codigo: item.categoria_codigo,
  categoria: item.categoria,
  tipo_costo: item.tipo_costo,
  tipo_ejecucion: item.tipo_ejecucion,
  fuente_referencia: item.fuente_referencia,
}));

/**
 * Find rubro by linea_codigo (case-insensitive, normalized)
 * 
 * @param raw - Raw rubro identifier (can be legacy ID, linea_codigo, etc.)
 * @returns RubroItem or undefined if not found
 */
export function findRubroByLineaCodigo(raw: string): RubroItem | undefined {
  if (!raw) return undefined;
  const normalized = String(raw || '').trim().toUpperCase();
  
  // First try exact match
  const exactMatch = items.find(
    i => String(i.linea_codigo || '').toUpperCase() === normalized
  );
  if (exactMatch) return exactMatch;
  
  // Then try using canonical taxonomy resolution for legacy IDs
  const canonical = getCanonicalRubroId(raw);
  if (canonical) {
    return items.find(
      i => String(i.linea_codigo || '').toUpperCase() === canonical.toUpperCase()
    );
  }
  
  return undefined;
}

/**
 * Get canonical rubro ID from raw input
 * 
 * Normalizes legacy IDs, slugs, and human-readable names to canonical linea_codigo.
 * Returns the canonical ID (uppercase) or undefined if not found.
 * 
 * @param raw - Raw rubro identifier
 * @returns Canonical linea_codigo (e.g., 'MOD-LEAD') or undefined
 */
export function canonicalizeRubroId(raw: string): string | undefined {
  if (!raw) return undefined;
  const canonical = getCanonicalRubroId(raw);
  return canonical || undefined;
}

/**
 * Get human-readable description for a rubro
 * 
 * Returns the descripcion field from taxonomy, falling back to linea_gasto.
 * 
 * @param raw - Raw rubro identifier
 * @returns Description string or undefined
 */
export function rubroDescriptionFor(raw: string): string | undefined {
  if (!raw) return undefined;
  const found = findRubroByLineaCodigo(raw);
  return found?.descripcion ?? found?.linea_gasto;
}

/**
 * Get all rubros from taxonomy
 * 
 * @returns Array of all RubroItem entries
 */
export function allRubros(): RubroItem[] {
  return items;
}

/**
 * Get full taxonomy entry for a rubro
 * 
 * Returns the complete CanonicalRubroTaxonomy object with all metadata.
 * 
 * @param raw - Raw rubro identifier
 * @returns CanonicalRubroTaxonomy or null
 */
export function getTaxonomyEntry(raw: string): CanonicalRubroTaxonomy | null {
  if (!raw) return null;
  const canonical = canonicalizeRubroId(raw);
  if (!canonical) return null;
  return getTaxonomyById(canonical);
}

// Re-export commonly used functions from canonical-taxonomy for convenience
export {
  getCanonicalRubroId,
  getTaxonomyById,
  getAllCanonicalIds,
  isValidRubroId,
  isLegacyRubroId,
  normalizeRubroId,
  getRubrosByCategory,
  getAllCategories,
  getActiveRubros,
  CANONICAL_RUBROS_TAXONOMY,
  LABOR_CANONICAL_KEYS,
  LABOR_CANONICAL_KEYS_SET,
} from './canonical-taxonomy';

export type { CanonicalRubroTaxonomy } from './canonical-taxonomy';
