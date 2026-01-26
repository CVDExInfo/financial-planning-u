/**
 * Rubros Library - Consolidated exports for DashboardV2
 * 
 * This module provides canonical rubro taxonomy utilities and normalization functions
 * for consistent rubro ID handling across the application.
 * 
 * Key responsibilities:
 * - Canonical rubro ID resolution
 * - Legacy ID mapping
 * - Taxonomy lookups
 * - Rubro normalization
 */

// Re-export all canonical taxonomy utilities
export {
  // Core normalization functions
  normalizeRubroId,
  getCanonicalRubroId,
  getTaxonomyById,
  normalizeKey,
  
  // Taxonomy data and lookups
  CANONICAL_RUBROS_TAXONOMY,
  TAXONOMY_BY_ID,
  LEGACY_RUBRO_ID_MAP,
  CANONICAL_ALIASES,
  LABOR_CANONICAL_KEYS,
  LABOR_CANONICAL_KEYS_SET,
  
  // Validation functions
  isValidRubroId,
  isLegacyRubroId,
  
  // Query functions
  getAllCanonicalIds,
  getRubrosByCategory,
  getAllCategories,
  getActiveRubros,
  
  // Types
  type CanonicalRubroTaxonomy,
  type TipoCosto,
  type TipoEjecucion,
} from './canonical-taxonomy';

// Re-export taxonomy helpers
export {
  getCategoryForRubroId,
  groupRubrosByCategory,
  formatRubroName,
} from './taxonomyHelpers';

/**
 * ForecastRubrosAdapter
 * 
 * Adapter for transforming forecast data with canonical rubro resolution.
 * Used in DashboardV2 to ensure all rubro IDs are canonical before display.
 */
export class ForecastRubrosAdapter {
  /**
   * Normalize an array of forecast items to use canonical rubro IDs
   * 
   * @param items - Forecast items with potentially legacy rubro IDs
   * @returns Normalized items with canonical rubro IDs
   */
  static normalizeItems<T extends { rubro_id?: string }>(items: T[]): (T & { 
    rubro_id_canonical: string;
    rubro_id_original?: string;
    rubro_normalization_warning?: string;
  })[] {
    const { normalizeRubroId } = require('./canonical-taxonomy');
    
    return items.map(item => {
      if (!item.rubro_id) {
        return {
          ...item,
          rubro_id_canonical: '',
          rubro_normalization_warning: 'Missing rubro_id',
        };
      }
      
      const normalized = normalizeRubroId(item.rubro_id);
      
      return {
        ...item,
        rubro_id_canonical: normalized.canonicalId,
        rubro_id_original: normalized.isLegacy ? item.rubro_id : undefined,
        rubro_normalization_warning: normalized.warning,
      };
    });
  }
  
  /**
   * Group forecast items by canonical rubro ID
   * 
   * @param items - Forecast items
   * @returns Map of canonical rubro ID to array of items
   */
  static groupByCanonicalRubro<T extends { rubro_id?: string }>(
    items: T[]
  ): Map<string, T[]> {
    const { getCanonicalRubroId } = require('./canonical-taxonomy');
    const grouped = new Map<string, T[]>();
    
    for (const item of items) {
      const canonicalId = getCanonicalRubroId(item.rubro_id) || 'UNKNOWN';
      const existing = grouped.get(canonicalId) || [];
      existing.push(item);
      grouped.set(canonicalId, existing);
    }
    
    return grouped;
  }
  
  /**
   * Deduplicate forecast items by canonical rubro ID + month
   * Keeps the most recently updated item when duplicates exist
   * 
   * @param items - Forecast items with month and optional last_updated
   * @returns Deduplicated items
   */
  static deduplicateByRubroAndMonth<T extends { 
    rubro_id?: string; 
    month: number;
    last_updated?: string;
  }>(items: T[]): T[] {
    const { getCanonicalRubroId } = require('./canonical-taxonomy');
    const map = new Map<string, T>();
    
    for (const item of items) {
      const canonicalId = getCanonicalRubroId(item.rubro_id) || 'UNKNOWN';
      const key = `${canonicalId}:${item.month}`;
      
      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
        continue;
      }
      
      // Keep the most recent item (by last_updated timestamp)
      if (item.last_updated && existing.last_updated) {
        if (new Date(item.last_updated) > new Date(existing.last_updated)) {
          map.set(key, item);
        }
      } else if (item.last_updated) {
        // Prefer items with last_updated over those without
        map.set(key, item);
      }
    }
    
    return Array.from(map.values());
  }
  
  /**
   * Enrich forecast items with taxonomy metadata
   * 
   * @param items - Forecast items
   * @returns Items enriched with category, tipo_costo, etc.
   */
  static enrichWithTaxonomy<T extends { rubro_id?: string }>(items: T[]): (T & {
    categoria?: string;
    categoria_codigo?: string;
    tipo_costo?: string;
    tipo_ejecucion?: string;
    linea_gasto?: string;
  })[] {
    const { getTaxonomyById } = require('./canonical-taxonomy');
    
    return items.map(item => {
      const taxonomy = getTaxonomyById(item.rubro_id);
      
      if (!taxonomy) {
        return item;
      }
      
      return {
        ...item,
        categoria: taxonomy.categoria,
        categoria_codigo: taxonomy.categoria_codigo,
        tipo_costo: taxonomy.tipo_costo,
        tipo_ejecucion: taxonomy.tipo_ejecucion,
        linea_gasto: taxonomy.linea_gasto,
      };
    });
  }
}
