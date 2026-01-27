/**
 * Canonical-first Taxonomy Lookup
 * 
 * Implements canonical-first taxonomy lookup with labor canonical override
 * and cache-all-candidates strategy for performance.
 */

import { normalizeKey, LABOR_RUBROS_SET, tolerantRubroLookup } from './taxonomyLookup';
import type { TaxonomyEntry, RubroRow } from './taxonomyLookup';

/**
 * Lookup taxonomy entry with canonical-first strategy
 * 
 * Lookup order:
 * 1. Strict canonical fast-path - any candidate present in cache or map
 * 2. Labor canonical override - if any candidate matches the canonical labor keys
 * 3. Tolerant fallback - reuse existing tolerantRubroLookup from PR #921
 * 
 * Important: Always cache under all candidate normalized keys for O(1) subsequent lookups
 * 
 * @param taxonomyMap - Map<string, Taxon> where keys are normalized strings
 * @param row - The rubro/allocation row to look up
 * @param cache - Map<string, Taxon|null> for caching lookups
 * @returns Taxonomy entry or null if not found
 */
export function lookupTaxonomyCanonical(
  taxonomyMap: Map<string, TaxonomyEntry>,
  row: RubroRow,
  cache: Map<string, TaxonomyEntry | null>
): TaxonomyEntry | null {
  const rawCandidates = [
    row.rubroId, 
    row.rubro_id, 
    row.line_item_id, 
    row.lineItemId, 
    row.name, 
    row.description
  ].filter(Boolean);

  const candidates = rawCandidates.map(c => normalizeKey(c as string));

  // 1) strict canonical fast-path - any candidate present in cache or map
  for (const k of candidates) {
    if (cache.has(k)) {
      const cached = cache.get(k);
      if (cached) return cached;
    }
    const tax = taxonomyMap.get(k);
    if (tax) {
      // cache under all candidate keys for consistency
      for (const ck of candidates) cache.set(ck, tax);
      return tax;
    }
  }

  // 2) labor canonical override: if any candidate matches the canonical labor keys (O(1) Set lookup)
  for (const k of candidates) {
    if (LABOR_RUBROS_SET.has(k)) {
      const synthetic: TaxonomyEntry = { 
        rubroId: 'MOD', 
        category: 'Mano de Obra (MOD)', 
        isLabor: true, 
        name: 'Mano de Obra (MOD)' 
      };
      for (const ck of candidates) cache.set(ck, synthetic);
      return synthetic;
    }
  }

  // 3) tolerant fallback (only once per unique input) - reuse existing tolerantRubroLookup from PR #921
  const tolerant = tolerantRubroLookup(row, taxonomyMap);
  for (const ck of candidates) cache.set(ck, tolerant ?? null);
  return tolerant ?? null;
}
