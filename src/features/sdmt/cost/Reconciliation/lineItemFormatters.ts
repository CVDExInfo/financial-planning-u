// src/features/sdmt/cost/Reconciliation/lineItemFormatters.ts
/**
 * Line Item Label Formatters
 * 
 * Utilities for formatting line item labels in reconciliation and forecast views.
 * Separates primary hierarchical information from secondary metadata for better UX.
 * 
 * UPDATED: Now uses canonical taxonomy from @/lib/rubros
 * to ensure consistent display of rubros across all forms.
 */

import type { LineItem } from "@/types/domain";
import { canonicalizeRubroId } from "@/lib/rubros";
import { getTaxonomyEntry } from "@/lib/rubros";

// Helper type for extended line items with Spanish property names
// This supports both Spanish (categoria, linea_codigo, tipo_costo) and English property names
type ExtendedLineItem = LineItem & {
  categoria?: string;
  linea_codigo?: string;
  tipo_costo?: string;
};

export interface LineItemLabelOptions {
  showHierarchy?: boolean;
  showCode?: boolean;
  showType?: boolean;
  showPeriod?: boolean;
}

export interface FormattedLineItemLabel {
  primary: string;
  secondary: string;
  tooltip: string;
}

/**
 * Format line item display with structured primary and secondary information.
 * 
 * Uses canonical taxonomy from @/lib/rubros to ensure
 * consistent display format: ${linea_codigo} — ${linea_gasto}
 * 
 * Primary: Code and canonical description from taxonomy
 * Secondary: Category and type metadata
 * 
 * @example
 * Input: { id: "MOD-PMO" } // Will lookup canonical taxonomy
 * Output: {
 *   primary: "MOD-PMO — Project Manager",
 *   secondary: "Category: Mano de Obra Directa · Type: OPEX",
 *   tooltip: "MOD-PMO — Project Manager [Mano de Obra Directa] • OPEX"
 * }
 */
export function formatLineItemDisplay(
  item?: LineItem,
  month?: number,
  options: LineItemLabelOptions = {
    showHierarchy: true,
    showCode: true,
    showType: true,
    showPeriod: true,
  }
): FormattedLineItemLabel {
  if (!item) {
    return {
      primary: "Line item",
      secondary: "",
      tooltip: "Line item",
    };
  }

  const extended = item as ExtendedLineItem;
  
  // Try to get canonical taxonomy definition first
  const canonicalId = canonicalizeRubroId(item.id);
  const canonical = canonicalId ? getTaxonomyEntry(canonicalId) : null;
  
  // Prefer canonical data, fallback to item properties
  const lineaCodigo = canonical?.linea_codigo || extended.linea_codigo?.trim() || item.id;
  const lineaGasto = canonical?.linea_gasto || item.description?.trim() || item.id;
  const categoria = canonical?.categoria || extended.categoria?.trim() || item.category?.trim();
  const tipoCosto = canonical?.tipo_costo || extended.tipo_costo?.trim();

  // Build primary label: canonical format ${linea_codigo} — ${linea_gasto}
  const primaryParts: string[] = [];
  
  if (options.showCode && lineaCodigo) {
    primaryParts.push(lineaCodigo);
  }
  
  if (lineaGasto) {
    primaryParts.push(lineaGasto);
  }

  const primary = primaryParts.join(" — ") || "Line item";

  // Build secondary label: category, type, period metadata
  const secondaryParts: string[] = [];

  if (options.showHierarchy && categoria) {
    secondaryParts.push(`Category: ${categoria}`);
  }

  if (options.showType && tipoCosto) {
    secondaryParts.push(`Type: ${tipoCosto}`);
  }

  if (options.showPeriod && typeof month === "number" && Number.isFinite(month)) {
    secondaryParts.push(`Period: Month ${month}`);
  }

  const secondary = secondaryParts.join(" · ");

  // Build tooltip with full information
  const categoryPart = categoria ? ` [${categoria}]` : "";
  const tipoCostoSuffix = tipoCosto ? ` • ${tipoCosto}` : "";
  const periodSuffix =
    options.showPeriod && typeof month === "number" && Number.isFinite(month)
      ? ` (Month ${month})`
      : "";
  
  const tooltip = `${lineaCodigo} — ${lineaGasto?.trim() || "Line item"}${categoryPart}${tipoCostoSuffix}${periodSuffix}`;

  return { primary, secondary, tooltip };
}

/**
 * Format a simple line item label using canonical taxonomy.
 * 
 * Uses canonical taxonomy to ensure consistent format: ${linea_codigo} — ${linea_gasto}
 * Falls back to legacy format if canonical taxonomy is not found.
 * 
 * @example
 * Input: { id: "MOD-PMO" }
 * Output: "MOD-PMO — Project Manager"
 * 
 * @param item - Line item to format
 * @param fallbackId - Fallback ID if item is undefined
 * @returns Formatted label string
 */
export function formatRubroLabel(item?: LineItem, fallbackId?: string): string {
  if (!item) return fallbackId || "Line item";
  
  // Try to get canonical taxonomy definition first
  const canonicalId = canonicalizeRubroId(item.id);
  const canonical = canonicalId ? getTaxonomyEntry(canonicalId) : null;
  
  if (canonical) {
    // Use canonical format: ${linea_codigo} — ${linea_gasto}
    return `${canonical.linea_codigo} — ${canonical.linea_gasto}`;
  }
  
  // Fallback to legacy format if canonical not found
  const extended = item as ExtendedLineItem;
  const category = (extended.categoria || item.category)?.trim();
  const description = item.description?.trim() || fallbackId || "Line item";
  const lineaCodigo = extended.linea_codigo?.trim();
  const tipoCosto = extended.tipo_costo?.trim();
  const categoryLabel = category || "General";
  const codePart = lineaCodigo || item.id || fallbackId || "";
  const tipoCostoSuffix = tipoCosto ? ` • ${tipoCosto}` : "";
  
  return `${categoryLabel} — ${description}${codePart ? ` [${codePart}]` : ""}${tipoCostoSuffix}`;
}

/**
 * Format line item label with period (Month N).
 */
export function formatMatrixLabel(
  item?: LineItem,
  month?: number,
  fallbackId?: string
): string {
  const base = formatRubroLabel(item, fallbackId);
  return typeof month === "number" && Number.isFinite(month)
    ? `${base} (Month ${month})`
    : base;
}

/**
 * Extract friendly filename from storage key or path.
 * 
 * @example
 * Input: "docs/P-abc123.../Screenshot 2025-12-04.png"
 * Output: "Screenshot 2025-12-04.png"
 * 
 * Input: "Screenshot 2025-12-04.png"
 * Output: "Screenshot 2025-12-04.png"
 */
export function extractFriendlyFilename(
  storageKey?: string,
  originalName?: string
): string {
  if (originalName) return originalName;
  if (!storageKey) return "Pending document";

  // Extract filename from storage path (e.g., "docs/P-xxx/file.pdf" -> "file.pdf")
  const parts = storageKey.split("/");
  const filename = parts[parts.length - 1];
  
  return filename || storageKey;
}
