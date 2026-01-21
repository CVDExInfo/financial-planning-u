/**
 * Cost Categories and Line Items Adapter
 * 
 * This module provides the COST_CATEGORIES UI shape by building it from the
 * canonical rubros taxonomy. This ensures the Catalog UI and backend Forecast
 * lookups use the same source of truth, preventing mismatches and blank data.
 * 
 * Source: Adapted from canonical-taxonomy.ts (single source of truth)
 */

import {
  CANONICAL_RUBROS_TAXONOMY,
  type CanonicalRubroTaxonomy,
  type TipoEjecucion,
  type TipoCosto,
} from '@/lib/rubros/canonical-taxonomy';

export interface CostCategory {
  codigo: string;
  nombre: string;
  lineas: CostLineItem[];
}

export interface CostLineItem {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo_ejecucion: TipoEjecucion;
  tipo_costo: TipoCosto;
  fuente_referencia: string;
}
/**
 * Build cost categories from canonical taxonomy
 * Groups canonical entries by categoria_codigo and builds the UI structure
 */
function buildCostCategories(
  taxonomy: CanonicalRubroTaxonomy[]
): CostCategory[] {
  const categoryMap = new Map<string, CostCategory>();

  // Group by category and build line items
  for (const item of taxonomy) {
    if (!item.isActive) continue; // Only include active rubros

    // Canonical taxonomy should always have these fields
    // If they're missing, it indicates a data quality issue that should be fixed at the source
    if (!item.categoria_codigo || !item.categoria) {
      console.warn(
        '[cost-categories] Skipping canonical entry with missing category fields:',
        item.id
      );
      continue;
    }

    const categoryCode = item.categoria_codigo;
    
    if (!categoryMap.has(categoryCode)) {
      categoryMap.set(categoryCode, {
        codigo: categoryCode,
        nombre: item.categoria,
        lineas: [],
      });
    }

    const category = categoryMap.get(categoryCode)!;
    // linea_codigo should always equal id in canonical taxonomy, but using id is more explicit
    category.lineas.push({
      codigo: item.id,
      nombre: item.linea_gasto,
      descripcion: item.descripcion,
      tipo_ejecucion: item.tipo_ejecucion,
      tipo_costo: item.tipo_costo,
      fuente_referencia: item.fuente_referencia,
    });
  }

  // Convert map to array and sort by category code
  return Array.from(categoryMap.values()).sort((a, b) =>
    a.codigo.localeCompare(b.codigo)
  );
}

/**
 * COST_CATEGORIES - Built from canonical taxonomy
 * This ensures UI and backend use the same source of truth
 */
export const COST_CATEGORIES: CostCategory[] =
  buildCostCategories(CANONICAL_RUBROS_TAXONOMY);

/**
 * Helper functions - backward compatible with existing Catalog imports
 */
export function getCategoryByCode(codigo: string): CostCategory | undefined {
  return COST_CATEGORIES.find((cat) => cat.codigo === codigo);
}

export function getLineItemByCode(
  codigo: string
): { category: CostCategory; lineItem: CostLineItem } | undefined {
  for (const category of COST_CATEGORIES) {
    const lineItem = category.lineas.find((l) => l.codigo === codigo);
    if (lineItem) {
      return { category, lineItem };
    }
  }
  return undefined;
}

export function getCategoryNames(): string[] {
  return COST_CATEGORIES.map((cat) => cat.nombre);
}

export function getCategoryCodes(): string[] {
  return COST_CATEGORIES.map((cat) => cat.codigo);
}
