import ApiService from "@/lib/api";
import type { ForecastCell, InvoiceDoc } from "@/types/domain";
import forecastDefault from "@/mocks/forecast.json" assert { type: "json" };
import forecastFintech from "@/mocks/forecast-fintech.json" assert { type: "json" };
import forecastRetail from "@/mocks/forecast-retail.json" assert { type: "json" };
import invoicesDefault from "@/mocks/invoices.json" assert { type: "json" };
import invoicesFintech from "@/mocks/invoices-fintech.json" assert { type: "json" };
import invoicesRetail from "@/mocks/invoices-retail.json" assert { type: "json" };
import { normalizeRubroId } from "@/features/sdmt/cost/utils/dataAdapters";
import { getCanonicalRubroId } from "@/lib/rubros/canonical-taxonomy";

export type ForecastPayload = {
  data: ForecastCell[];
  projectId: string;
  months: number;
  generatedAt: string;
  source: "api" | "mock";
};

const envSource =
  (typeof import.meta !== "undefined" && (import.meta as any)?.env) ||
  (typeof process !== "undefined" ? (process.env as Record<string, any>) : {});

const isMockEnabled = () => String(envSource?.VITE_USE_MOCKS || "false") === "true";

const pickForecastMock = (projectId: string | undefined) => {
  if (!projectId) return forecastDefault as ForecastCell[];
  const upper = projectId.toUpperCase();
  if (upper.includes("FIN") || upper.includes("TEK")) return forecastFintech as ForecastCell[];
  if (upper.includes("RET")) return forecastRetail as ForecastCell[];
  return forecastDefault as ForecastCell[];
};

const pickInvoiceMock = (projectId: string | undefined) => {
  if (!projectId) return invoicesDefault as InvoiceDoc[];
  const upper = projectId.toUpperCase();
  if (upper.includes("FIN") || upper.includes("TEK")) return invoicesFintech as InvoiceDoc[];
  if (upper.includes("RET")) return invoicesRetail as InvoiceDoc[];
  return invoicesDefault as InvoiceDoc[];
};

export async function getForecastPayload(
  projectId: string,
  months?: number,
): Promise<ForecastPayload> {
  if (isMockEnabled()) {
    const cells = pickForecastMock(projectId);
    return {
      data: (cells as ForecastCell[]).map((cell) => ({
        ...cell,
        line_item_id: normalizeRubroId(cell.line_item_id),
      })),
      projectId,
      months: Number.isFinite(months) ? (months as number) : 12,
      generatedAt: new Date("2024-12-15T12:00:00Z").toISOString(),
      source: "mock",
    };
  }

  const payload = await ApiService.getForecastPayload(projectId, months);
  return {
    data: payload.data.map((cell) => ({
      ...cell,
      line_item_id: normalizeRubroId(cell.line_item_id),
    })),
    projectId: payload.projectId,
    months: payload.months,
    generatedAt: payload.generated_at,
    source: "api",
  };
}

export async function getProjectInvoices(projectId: string): Promise<InvoiceDoc[]> {
  if (isMockEnabled()) {
    const invoices = pickInvoiceMock(projectId);
    return (invoices as InvoiceDoc[]).map((invoice) => {
      const normalizedLineItemId = normalizeRubroId(invoice.line_item_id);
      
      // Annotate invoice with canonical rubro ID for improved matching
      // This ensures invoices can be matched to forecast rows using canonical taxonomy
      const rubroId = invoice.rubroId || invoice.rubro_id || normalizedLineItemId;
      const canonicalRubroId = rubroId ? getCanonicalRubroId(rubroId) : null;
      
      return {
        ...invoice,
        line_item_id: normalizedLineItemId,
        // Add canonical rubro ID if available (for taxonomy-aligned matching)
        ...(canonicalRubroId && { rubro_canonical: canonicalRubroId }),
      };
    });
  }

  const invoices = await ApiService.getInvoices(projectId);
  return invoices.map((invoice) => {
    const normalizedLineItemId = normalizeRubroId(invoice.line_item_id);
    
    // Annotate invoice with canonical rubro ID for improved matching
    // This ensures invoices can be matched to forecast rows using canonical taxonomy
    const rubroId = invoice.rubroId || invoice.rubro_id || normalizedLineItemId;
    const canonicalRubroId = rubroId ? getCanonicalRubroId(rubroId) : null;
    
    return {
      ...invoice,
      line_item_id: normalizedLineItemId,
      // Add canonical rubro ID if available (for taxonomy-aligned matching)
      ...(canonicalRubroId && { rubro_canonical: canonicalRubroId }),
    };
  });
}
