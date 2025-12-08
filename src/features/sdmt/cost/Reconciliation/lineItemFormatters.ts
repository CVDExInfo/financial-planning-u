// src/features/sdmt/cost/Reconciliation/lineItemFormatters.ts
/**
 * Line Item Label Formatters
 * 
 * Utilities for formatting line item labels in reconciliation and forecast views.
 * Separates primary hierarchical information from secondary metadata for better UX.
 */

import type { LineItem } from "@/types/domain";

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
 * Primary: Category hierarchy and description
 * Secondary: Code, type, and period metadata
 * 
 * @example
 * Input: { categoria: "Infraestructura / Nube", description: "Data Center", linea_codigo: "INF-CLOUD", tipo_costo: "OPEX" }
 * Output: {
 *   primary: "Infraestructura / Nube — Data Center",
 *   secondary: "Code: INF-CLOUD · Type: OPEX",
 *   tooltip: "Infraestructura / Nube — Data Center [INF-CLOUD] • OPEX"
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
  const category = (extended.categoria || item.category)?.trim();
  const description = item.description?.trim() || "";
  const lineaCodigo = extended.linea_codigo?.trim();
  const tipoCosto = extended.tipo_costo?.trim();

  // Build primary label: category hierarchy and description
  const categoryLabel = category || "General";
  const primaryParts: string[] = [];
  
  if (options.showHierarchy && categoryLabel) {
    primaryParts.push(categoryLabel);
  }
  
  if (description) {
    primaryParts.push(description);
  }

  const primary = primaryParts.join(" — ") || "Line item";

  // Build secondary label: code, type, period metadata
  const secondaryParts: string[] = [];

  if (options.showCode && lineaCodigo) {
    secondaryParts.push(`Code: ${lineaCodigo}`);
  }

  if (options.showType && tipoCosto) {
    secondaryParts.push(`Type: ${tipoCosto}`);
  }

  if (options.showPeriod && typeof month === "number" && Number.isFinite(month)) {
    secondaryParts.push(`Period: Month ${month}`);
  }

  const secondary = secondaryParts.join(" · ");

  // Build tooltip with full information (legacy format for consistency)
  const codePart = lineaCodigo ? ` [${lineaCodigo}]` : "";
  const tipoCostoSuffix = tipoCosto ? ` • ${tipoCosto}` : "";
  const periodSuffix =
    options.showPeriod && typeof month === "number" && Number.isFinite(month)
      ? ` (Month ${month})`
      : "";
  
  const tooltip = `${categoryLabel} — ${description || "Line item"}${codePart}${tipoCostoSuffix}${periodSuffix}`;

  return { primary, secondary, tooltip };
}

/**
 * Format a simple line item label (legacy format for backwards compatibility).
 * Use formatLineItemDisplay() for new implementations.
 */
export function formatRubroLabel(item?: LineItem, fallbackId?: string): string {
  if (!item) return fallbackId || "Line item";
  
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
