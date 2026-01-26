/**
 * normalizeForServer.ts
 * 
 * Helper utilities to ensure all forecast/invoice/allocation payloads sent to the server
 * use canonical rubro IDs (linea_codigo) and include proper taxonomy metadata.
 * 
 * This enforces client-side canonicalization for determinism and reduces server-side
 * transformation complexity.
 */

import { getCanonicalRubroId, getTaxonomyById } from "@/lib/rubros/canonical-taxonomy";

/**
 * Interface representing a generic forecast row that can be normalized
 */
export interface ForecastRowInput {
  rubroId?: string;
  line_item_id?: string;
  linea_codigo?: string;
  description?: string;
  descripcion?: string;
  category?: string;
  categoria?: string;
  rubro_canonical?: string;
  [key: string]: any; // Allow other fields to pass through
}

/**
 * Interface representing the normalized output
 */
export interface NormalizedForecastRow {
  line_item_id: string;
  linea_codigo: string;
  descripcion: string;
  categoria: string;
  rubro_canonical: string;
  [key: string]: any;
}

/**
 * Normalize a forecast row for server transmission
 * 
 * This function:
 * 1. Extracts the rubro ID from various possible field names
 * 2. Maps it to the canonical linea_codigo
 * 3. Populates description and category from taxonomy if not provided
 * 4. Ensures rubro_canonical field is set
 * 
 * @param row - The forecast row to normalize
 * @returns Normalized row with canonical fields
 */
export function normalizeForecastRowForServer(row: ForecastRowInput): NormalizedForecastRow {
  // Get the raw rubro ID from any of the possible field names
  const rawRubroId = row.rubroId || row.line_item_id || row.linea_codigo || '';
  
  // Get the canonical ID
  const canonical = getCanonicalRubroId(rawRubroId) || rawRubroId;
  
  // Get taxonomy entry for metadata
  const tax = canonical ? getTaxonomyById(canonical) : null;
  
  // Warn if rubro ID doesn't map to canonical taxonomy (data quality issue)
  if (rawRubroId && !getCanonicalRubroId(rawRubroId) && import.meta.env.DEV) {
    console.warn(
      `[normalizeForServer] Unknown rubro ID '${rawRubroId}' not found in canonical taxonomy. ` +
      `This may indicate a data quality issue. The ID will be preserved as-is.`
    );
  }
  
  // Build normalized row
  return {
    ...row,
    line_item_id: canonical,
    linea_codigo: canonical,
    descripcion: row.description || row.descripcion || tax?.linea_gasto || tax?.descripcion || "",
    categoria: row.category || row.categoria || tax?.categoria || "",
    rubro_canonical: canonical,
  };
}

/**
 * Normalize an array of forecast rows for server transmission
 * 
 * @param rows - Array of forecast rows to normalize
 * @returns Array of normalized rows
 */
export function normalizeForecastRowsForServer(rows: ForecastRowInput[]): NormalizedForecastRow[] {
  return rows.map(normalizeForecastRowForServer);
}

/**
 * Normalize allocation/invoice payload for server
 * 
 * Similar to normalizeForecastRowForServer but for allocation/invoice payloads
 * that may have different field structures
 * 
 * @param payload - The payload to normalize
 * @returns Normalized payload
 */
export function normalizeAllocationPayload(payload: ForecastRowInput): NormalizedForecastRow {
  return normalizeForecastRowForServer(payload);
}
