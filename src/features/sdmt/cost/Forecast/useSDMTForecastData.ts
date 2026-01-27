/**
 * useSDMTForecastData Hook
 *
 * Centralizes all data loading and transform logic for SDMT Forecast view.
 * Handles:
 * - Loading baseline summary, rubros, and forecast data
 * - Robust fallback: if forecast empty, tries rubros + allocations
 * - Abort/stale response handling
 * - Save and refresh operations
 * - Materialization UI states (pending, materializing, materialized, failed)
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  transformLineItemsToForecast,
  type ForecastRow,
} from "./transformLineItemsToForecast";
import { getForecastPayload, getProjectInvoices } from "./forecastService";
import { getProjectRubros, getAllocations } from "@/api/finanzas";
import {
  computeForecastFromAllocations,
  type Allocation,
  type ExtendedLineItem,
} from "./computeForecastFromAllocations";
import type { LineItem } from "@/types/domain";
import finanzasClient from "@/api/finanzasClient";
import {
  CANONICAL_RUBROS_TAXONOMY,
  type CanonicalRubroTaxonomy,
  canonicalizeRubroId,
} from "@/lib/rubros";
import { buildTaxonomyMap, type TaxonomyEntry as TaxLookupEntry } from "./lib/taxonomyLookup";
import { normalizeRubroId } from "@/features/sdmt/cost/utils/dataAdapters";
import { lookupTaxonomyCanonical } from "./lib/lookupTaxonomyCanonical";

/**
 * Helper to normalize monthly budget data from API response to a monthlyMap
 * Converts months array [{month: "2026-01", amount: 1000000}, ...] to { 1: 1000000, 2: 6000000, ... }
 * 
 * @param budgetData - Budget response from API with months array
 * @returns Object mapping month index (1-12) to budget amount
 */
function normalizeBudgetMonths(budgetData: {
  months: Array<{ month: string; amount: number }>;
} | null): Record<number, number> {
  if (!budgetData || !Array.isArray(budgetData.months)) {
    return {};
  }

  const monthlyMap: Record<number, number> = {};
  
  for (const entry of budgetData.months) {
    if (!entry || typeof entry.month !== 'string' || typeof entry.amount !== 'number') {
      continue;
    }

    // Parse month string (format: YYYY-MM)
    const match = entry.month.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const monthNum = parseInt(match[2], 10);
      if (monthNum >= 1 && monthNum <= 12) {
        monthlyMap[monthNum] = entry.amount;
      }
    }
  }

  return monthlyMap;
}


/**
 * Helper to normalize strings for comparison (case-insensitive, whitespace-normalized)
 */
export const normalizeString = (s: any): string => {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
};


/**
 * Normalize invoice status from various field names and handle case-insensitivity
 * Supports common variants: status, invoice_status, state, status_code
 * 
 * @param inv - Invoice object
 * @returns Normalized status string (lowercase) or null if no status found
 */
const invoiceStatusNormalized = (inv: any): string | null => {
  const rawStatus = inv.status || inv.invoice_status || inv.state || inv.status_code;
  if (!rawStatus) return null;
  return rawStatus.toString().trim().toLowerCase();
};

// Build taxonomy from canonical source (the single source of truth)
const taxonomyByRubroId: Record<string, { description?: string; category?: string; isLabor?: boolean }> = {};
CANONICAL_RUBROS_TAXONOMY.forEach((taxonomy) => {
  const entry = {
    description: taxonomy.linea_gasto || taxonomy.descripcion,
    category: taxonomy.categoria,
    isLabor: taxonomy.categoria_codigo === 'MOD',
  };
  
  // Index by canonical ID
  taxonomyByRubroId[taxonomy.id] = entry;
  
  // Also index by linea_codigo if different from id
  if (taxonomy.linea_codigo && taxonomy.linea_codigo !== taxonomy.id) {
    taxonomyByRubroId[taxonomy.linea_codigo] = entry;
  }
  
  // Also index by linea_gasto for invoice matching (normalize to handle matching)
  // Note: Normalized keys may collide, but this is acceptable for fuzzy matching fallback
  // Primary matching still uses canonical IDs via canonicalizeRubroId()
  if (taxonomy.linea_gasto) {
    const normalizedLineaGasto = normalizeString(taxonomy.linea_gasto);
    if (import.meta.env.DEV && taxonomyByRubroId[normalizedLineaGasto]) {
      console.debug('[taxonomy] linea_gasto collision:', {
        key: normalizedLineaGasto,
        existing: taxonomyByRubroId[normalizedLineaGasto],
        new: entry,
      });
    }
    taxonomyByRubroId[normalizedLineaGasto] = entry;
  }
  
  // Also index by descripcion for invoice matching (normalize to handle matching)
  // Note: Normalized keys may collide, but this is acceptable for fuzzy matching fallback
  if (taxonomy.descripcion) {
    const normalizedDescripcion = normalizeString(taxonomy.descripcion);
    if (import.meta.env.DEV && taxonomyByRubroId[normalizedDescripcion]) {
      console.debug('[taxonomy] descripcion collision:', {
        key: normalizedDescripcion,
        existing: taxonomyByRubroId[normalizedDescripcion],
        new: entry,
      });
    }
    taxonomyByRubroId[normalizedDescripcion] = entry;
  }
});

export interface UseSDMTForecastDataParams {
  projectId: string;
  months?: number;
}

export interface UseSDMTForecastDataResult {
  loading: boolean;
  error: string | null;
  baseline: any | null; // BaselineSummary type
  rubros: LineItem[];
  forecastRows: ForecastRow[];
  refresh: () => void;
  saveForecast: (updatePayload: any) => Promise<void>;
  materializationPending: boolean;
  materializationTimeout: boolean;
  materializationFailed: boolean;
  retryMaterialization: () => void;
  dataSource:
    | "serverForecast"
    | "allocationsFallback"
    | "rubrosFallback"
    | null;
}

/**
 * Helper to check if baseline is materialized
 */
export const isMaterialized = (baseline: any): boolean => {
  return (
    baseline?.materializedAt || baseline?.materialization_status === "completed"
  );
};

/**
 * Helper to extract amount from invoice with various field names
 * Handles common variations: amount, total, monto
 */
const normalizeInvoiceAmount = (invoice: any): number => {
  return Number(invoice.amount || invoice.total || invoice.monto || 0);
};

/**
 * Helper to extract month from invoice with various field names
 * Handles common variations: month, calendar_month, period, periodKey
 */
const getInvoiceMonth = (invoice: any): any => {
  return invoice.month || invoice.calendar_month || invoice.period || invoice.periodKey;
};

/**
 * Normalize invoice month to match forecast cell month index
 * Handles numeric indices, YYYY-MM formats, YYYY-MM-DD (ISO dates), ISO datetimes, and M\d+ formats (M1, M01, M11, etc.)
 * Supports extended month ranges (1-60) for multi-year forecasts
 * 
 * @param invoiceMonth - Month value from invoice (could be number, "YYYY-MM", "YYYY-MM-DD", ISO datetime, or "M11" string)
 * @param baselineStartMonth - Optional baseline start month for relative indexing
 * @param debugMode - Optional flag to enable detailed logging
 * @returns Numeric month index (1-based, supports 1-60 range) or 0 if invalid
 */
export const normalizeInvoiceMonth = (invoiceMonth: any, baselineStartMonth?: number, debugMode?: boolean): number => {
  // If already a valid numeric month index, return it (extended range 1-60)
  if (typeof invoiceMonth === 'number' && invoiceMonth >= 1 && invoiceMonth <= 60) {
    return invoiceMonth;
  }
  
  // If string, try various formats
  if (typeof invoiceMonth === 'string') {
    // Try YYYY-MM format first
    const yymmMatch = invoiceMonth.match(/^(\d{4})-(\d{2})$/);
    if (yymmMatch) {
      const monthNum = parseInt(yymmMatch[2], 10);
      // If we have baseline start, could calculate relative index
      // For now, just return the month number (1-12)
      if (debugMode) {
        console.log('[normalizeInvoiceMonth] Parsed YYYY-MM:', { input: invoiceMonth, monthNum });
      }
      return monthNum;
    }
    
    // Try full ISO date format (YYYY-MM-DD)
    const isoMatch = invoiceMonth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const monthNum = parseInt(isoMatch[2], 10);
      if (debugMode) {
        console.log('[normalizeInvoiceMonth] Parsed ISO date:', { input: invoiceMonth, monthNum });
      }
      return monthNum;
    }
    
    // Try M\d+ format (M1, M01, M11, M12, m11, etc. - with optional leading zero)
    const mMatch = invoiceMonth.match(/^m\s*0?(\d{1,2})$/i);
    if (mMatch) {
      const mm = parseInt(mMatch[1], 10);
      if (mm >= 1 && mm <= 60) {
        if (debugMode) {
          console.log('[normalizeInvoiceMonth] Parsed M format:', { input: invoiceMonth, monthNum: mm });
        }
        return mm;
      }
    }
    
    // Try ISO datetime (e.g., 2026-01-20T12:34:56Z or similar)
    // Only attempt Date.parse if string looks like a datetime (contains 'T' or timestamp pattern)
    if (invoiceMonth.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(invoiceMonth)) {
      const isoDate = Date.parse(invoiceMonth);
      if (!isNaN(isoDate)) {
        const d = new Date(isoDate);
        const m = d.getUTCMonth() + 1; // getUTCMonth() returns 0-11, we need 1-12
        if (m >= 1 && m <= 12) {
          if (debugMode) {
            console.log('[normalizeInvoiceMonth] Parsed ISO datetime:', { input: invoiceMonth, monthNum: m });
          }
          return m;
        }
      }
    }
    
    // Try parsing as plain number string
    const parsed = parseInt(invoiceMonth, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) {
      if (debugMode) {
        console.log('[normalizeInvoiceMonth] Parsed numeric string:', { input: invoiceMonth, monthNum: parsed });
      }
      return parsed;
    }
  }
  
  if (debugMode) {
    console.warn('[normalizeInvoiceMonth] Failed to parse month:', { input: invoiceMonth });
  }
  
  return 0; // Invalid month
};

/**
 * Helper function for robust invoice matching with canonicalization
 * 
 * Matching rules (in order):
 * 1. projectId guard: If both present and different → no match
 * 2. line_item_id: Compare canonicalized line_item_id
 * 3. matchingIds array: Check if invoice ID is in cell's matching IDs
 * 4. canonical rubroId: Use canonicalizeRubroId to compare
 * 5. taxonomy lookup: Check if both resolve to same canonical taxonomy entry
 * 6. normalized description: Final fallback
 * 
 * @param inv - Invoice object
 * @param cell - Forecast row
 * @param taxonomyMap - Optional taxonomy map for robust lookup
 * @param taxonomyCache - Optional taxonomy cache for performance
 * @param debugMode - Optional flag to enable detailed logging
 * @returns true if invoice matches cell
 */
export const matchInvoiceToCell = (
  inv: any,
  cell: ForecastRow,
  taxonomyMap?: Map<string, TaxLookupEntry>,
  taxonomyCache?: Map<string, TaxLookupEntry | null>,
  debugMode?: boolean
): boolean => {
  if (!inv) return false;

  // Enhanced diagnostics (DEV only)
  const shouldLogDiagnostics = debugMode && import.meta.env.DEV;
  
  if (shouldLogDiagnostics) {
    console.debug('[matchInvoiceToCell] Starting match attempt:', {
      invoice: {
        line_item_id: inv.line_item_id,
        rubroId: inv.rubroId || inv.rubro_id,
        projectId: inv.projectId || inv.project_id || inv.project,
        month: getInvoiceMonth(inv),
        normalizedMonth: normalizeInvoiceMonth(getInvoiceMonth(inv), undefined, true),
        amount: normalizeInvoiceAmount(inv),
        status: invoiceStatusNormalized(inv),
        description: inv.description,
      },
      cell: {
        line_item_id: cell.line_item_id,
        rubroId: cell.rubroId,
        projectId: (cell as any).projectId || (cell as any).project_id || (cell as any).project,
        monthIndex: (cell as any).monthIndex || (cell as any).month,
        description: cell.description,
      }
    });
  }

  // 1) projectId guard: both present → must match
  // Normalize both camelCase and snake_case variants
  // Note: Using defensive field access since invoices may come from different sources
  // with varying field naming conventions (projectId vs project_id)
  const invProject = inv.projectId || inv.project_id || inv.project;
  const cellProject = (cell as any).projectId || (cell as any).project_id || (cell as any).project;
  if (invProject && cellProject && String(invProject) !== String(cellProject)) {
    if (shouldLogDiagnostics) {
      console.debug('[matchInvoiceToCell] FAIL: Project mismatch', { invProject, cellProject });
    }
    return false;
  }

  // 2) line_item_id: canonicalize and compare
  if (inv.line_item_id && cell.line_item_id) {
    const invLineId = normalizeRubroId(inv.line_item_id);
    const cellLineId = normalizeRubroId(cell.line_item_id);
    if (invLineId && cellLineId && invLineId === cellLineId) {
      if (shouldLogDiagnostics) {
        console.debug('[matchInvoiceToCell] ✓ MATCH via line_item_id:', { invLineId, cellLineId });
      }
      return true;
    }
  }

  // 3) matchingIds array: Check if invoice ID is in cell's matching IDs list
  // Support multiple invoice field variants: rubroId, rubro_id, line_item_id, linea_codigo, linea_id, descripcion
  const invRubroId = inv.rubroId || inv.rubro_id || inv.line_item_id || inv.linea_codigo || inv.linea_id;
  if (invRubroId && (cell as any).matchingIds) {
    const normalizedInvId = normalizeRubroId(invRubroId);
    const matchingIds = (cell as any).matchingIds as string[];
    
    // Try exact match first
    if (matchingIds.includes(normalizedInvId) || matchingIds.includes(invRubroId)) {
      if (shouldLogDiagnostics) {
        console.debug('[matchInvoiceToCell] ✓ MATCH via matchingIds:', { invRubroId, normalizedInvId, matchingIds });
      }
      return true;
    }
    
    // Try normalized versions of all matching IDs
    for (const matchId of matchingIds) {
      if (normalizeRubroId(matchId) === normalizedInvId) {
        if (shouldLogDiagnostics) {
          console.debug('[matchInvoiceToCell] ✓ MATCH via normalized matchingIds:', { matchId, normalizedInvId });
        }
        return true;
      }
    }
  }

  // 4) canonical rubroId: use rubro_canonical if available from backend, otherwise compute
  const cellRubroId = cell.rubroId || cell.line_item_id;
  
  // Prioritize rubro_canonical from backend (if present) for more reliable matching
  if (invRubroId && cellRubroId) {
    const invCanonical = inv.rubro_canonical || canonicalizeRubroId(invRubroId);
    const cellCanonical = canonicalizeRubroId(cellRubroId);
    if (invCanonical && cellCanonical && invCanonical === cellCanonical) {
      if (shouldLogDiagnostics) {
        console.debug('[matchInvoiceToCell] ✓ MATCH via canonical rubroId:', { 
          invRubroId, 
          invCanonical, 
          cellRubroId,
          cellCanonical 
        });
      }
      return true;
    }
  }

  // 5) taxonomy lookup: check if both resolve to same canonical entry
  // Support additional invoice fields: linea_gasto, descripcion
  if (taxonomyMap && taxonomyCache) {
    const invRow = {
      rubroId: invRubroId,
      line_item_id: inv.line_item_id,
      description: inv.description || inv.descripcion,
      linea_gasto: inv.linea_gasto,
    };
    const cellRow = {
      rubroId: cellRubroId,
      line_item_id: cell.line_item_id,
      description: cell.description,
    };
    
    const invTax = lookupTaxonomyCanonical(taxonomyMap, invRow, taxonomyCache);
    const cellTax = lookupTaxonomyCanonical(taxonomyMap, cellRow, taxonomyCache);
    
    if (invTax && cellTax && invTax.rubroId === cellTax.rubroId) {
      if (shouldLogDiagnostics) {
        console.debug('[matchInvoiceToCell] ✓ MATCH via taxonomy lookup:', { 
          invTaxRubroId: invTax.rubroId, 
          cellTaxRubroId: cellTax.rubroId 
        });
      }
      return true;
    }
  }

  // 6) normalized description: final fallback
  if (
    inv.description &&
    cell.description &&
    normalizeString(inv.description) === normalizeString(cell.description)
  ) {
    if (shouldLogDiagnostics) {
      console.debug('[matchInvoiceToCell] ✓ MATCH via normalized description:', { 
        inv: normalizeString(inv.description), 
        cell: normalizeString(cell.description) 
      });
    }
    return true;
  }

  // No match found - log reason
  if (shouldLogDiagnostics) {
    const reasons = [];
    if (!invRubroId || !cellRubroId) {
      reasons.push('Missing rubroId in invoice or cell');
    }
    if (invRubroId && cellRubroId) {
      const invCanonical = canonicalizeRubroId(invRubroId);
      const cellCanonical = canonicalizeRubroId(cellRubroId);
      if (invCanonical !== cellCanonical) {
        reasons.push(`Canonical mismatch: ${invCanonical} !== ${cellCanonical}`);
      }
    }
    if (!inv.description || !cell.description) {
      reasons.push('Missing description');
    }
    console.debug('[matchInvoiceToCell] ✗ NO MATCH', { 
      reasons,
      invRubroId,
      cellRubroId 
    });
  }

  return false;
};

const FORCE_ALLOC_PARAM = "forceAllocations";
const FORCE_ALLOC_STORAGE_KEY = "finz.forceAllocationsOverride";

/**
 * Valid invoice statuses for including in actuals calculation
 * These statuses indicate the invoice has been verified and should be counted
 */
const VALID_INVOICE_STATUSES = ['matched', 'paid', 'approved', 'posted', 'received', 'validated'] as const;

const parseBooleanFlag = (value: string | null): boolean => {
  if (value === null || value === undefined) return true;
  const normalized = value.toString().trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "force"
  );
};

const computeForceAllocationsOverride = (): boolean => {
  if (typeof window === "undefined") return false;
  if (!(import.meta as any)?.env?.DEV) return false;

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(FORCE_ALLOC_PARAM)) {
      const shouldForce = parseBooleanFlag(
        url.searchParams.get(FORCE_ALLOC_PARAM)
      );
      window.localStorage.setItem(
        FORCE_ALLOC_STORAGE_KEY,
        shouldForce ? "true" : "false"
      );
      return shouldForce;
    }
  } catch (err) {
    console.warn(
      "[useSDMTForecastData] Failed to parse forceAllocations param",
      err
    );
  }

  try {
    const stored = window.localStorage.getItem(FORCE_ALLOC_STORAGE_KEY);
    return stored ? parseBooleanFlag(stored) : false;
  } catch (err) {
    console.warn(
      "[useSDMTForecastData] Failed to read forceAllocations override from localStorage",
      err
    );
    return false;
  }
};

export function useSDMTForecastData({
  projectId,
  months = 12,
}: UseSDMTForecastDataParams): UseSDMTForecastDataResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<any>(null);
  const [rubros, setRubros] = useState<LineItem[]>([]);
  const [forecastRows, setForecastRows] = useState<ForecastRow[]>([]);
  const [materializationPending, setMaterializationPending] = useState(false);
  const [materializationTimeout, setMaterializationTimeout] = useState(false);
  const [materializationFailed, setMaterializationFailed] = useState(false);
  const [dataSource, setDataSource] = useState<
    "serverForecast" | "allocationsFallback" | "rubrosFallback" | null
  >(null);

  const latestRequestKey = useRef(0);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const forceAllocationsOverride = useMemo(
    () => computeForceAllocationsOverride(),
    []
  );
  
  // Create taxonomy map and cache once for the hook instance
  const taxonomyMap = useMemo(() => buildTaxonomyMap(taxonomyByRubroId), []);
  const taxonomyCache = useMemo(() => new Map<string, TaxLookupEntry | null>(), []);

  useEffect(() => {
    if (forceAllocationsOverride) {
      console.warn(
        "[useSDMTForecastData] forceAllocations override enabled (dev only) — server forecast will be bypassed"
      );
    }
  }, [forceAllocationsOverride]);

  const fetchAll = useCallback(async () => {
    if (!projectId) {
      setError("Project ID is required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setMaterializationFailed(false);

    const requestKey = ++latestRequestKey.current;

    // Abort any previous request
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    abortCtrlRef.current = new AbortController();

    try {
      // Load baseline summary
      let baselineResp = await finanzasClient.getBaselineSummary(projectId);
      if (latestRequestKey.current !== requestKey) {
        if ((import.meta as any)?.env?.DEV) {
          console.warn('[useSDMTForecastData] Dropping baseline response (stale request):', { 
            requestKey, 
            latestRequestKey: latestRequestKey.current,
            projectId 
          });
        }
        return; // stale
      }
      setBaseline(baselineResp);

      // Check if materialization is pending and poll if necessary
      const materialized = isMaterialized(baselineResp);

      if (!materialized) {
        setMaterializationPending(true);

        // Poll for materialization completion
        const pollMaterialization = async (): Promise<boolean> => {
          const maxAttempts = 12; // 12 attempts * 5 seconds = 60 seconds max
          let attempts = 0;

          while (attempts < maxAttempts) {
            attempts++;

            // Check if request was aborted
            if (abortCtrlRef.current?.signal.aborted) {
              return false;
            }

            // Check if already materialized
            if (isMaterialized(baselineResp)) {
              return true;
            }

            // Wait 5 seconds before next poll
            await new Promise((r) => setTimeout(r, 5000));

            // Check again if request was aborted after waiting
            if (abortCtrlRef.current?.signal.aborted) {
              return false;
            }

            // Re-fetch baseline summary
            try {
              baselineResp = await finanzasClient.getBaselineSummary(projectId);
              if (latestRequestKey.current !== requestKey) {
                if ((import.meta as any)?.env?.DEV) {
                  console.warn('[useSDMTForecastData] Dropping baseline poll response (stale request):', { 
                    requestKey, 
                    latestRequestKey: latestRequestKey.current 
                  });
                }
                return false; // stale
              }
              setBaseline(baselineResp);
            } catch (pollErr: any) {
              if (pollErr.name === "AbortError") {
                return false;
              }
              // Continue polling even if one fetch fails
              console.warn("[useSDMTForecastData] Polling error:", pollErr);
            }
          }

          return false; // Timeout
        };

        const materialized = await pollMaterialization();
        setMaterializationPending(false);

        if (!materialized) {
          setMaterializationTimeout(true);
          setMaterializationFailed(true);
          setLoading(false);
          return; // Don't proceed to load rubros if materialization timed out
        }
      }

      // Load rubros / line items (only after materialization completes or is already complete)
      const rubrosResp = await getProjectRubros(projectId);
      if (latestRequestKey.current !== requestKey) {
        if ((import.meta as any)?.env?.DEV) {
          console.warn('[useSDMTForecastData] Dropping rubros response (stale request):', { 
            requestKey, 
            latestRequestKey: latestRequestKey.current,
            rubrosCount: rubrosResp?.length || 0 
          });
        }
        return; // stale
      }
      setRubros(rubrosResp || []);

      // Enhanced logging for data validation vs DynamoDB
      console.log(
        `[useSDMTForecastData] ✅ Retrieved ${
          rubrosResp?.length || 0
        } rubros from DynamoDB for project ${projectId}`
      );
      if (rubrosResp && rubrosResp.length > 0) {
        console.log("[useSDMTForecastData] Sample rubro structure:", {
          id: rubrosResp[0].id,
          description: rubrosResp[0].description,
          category: rubrosResp[0].category,
          unit_cost: rubrosResp[0].unit_cost,
          qty: rubrosResp[0].qty,
          currency: rubrosResp[0].currency,
          start_month: rubrosResp[0].start_month,
          end_month: rubrosResp[0].end_month,
        });
      }

      // ROBUST FALLBACK FLOW
      // Step 1: Try to load server-side forecast
      const forecastPayload = await getForecastPayload(projectId, months);
      if (latestRequestKey.current !== requestKey) {
        if ((import.meta as any)?.env?.DEV) {
          console.warn('[useSDMTForecastData] Dropping forecast payload response (stale request):', { 
            requestKey, 
            latestRequestKey: latestRequestKey.current 
          });
        }
        return; // stale
      }

      let rows: ForecastRow[] = [];
      let usedFallback = false;
      let allocationsCount = 0; // Track for summary logging
      let chosenDataSource:
        | "serverForecast"
        | "allocationsFallback"
        | "rubrosFallback"
        | null = null;

      // Check if forecast has meaningful data
      const hasForecastData =
        forecastPayload.data && forecastPayload.data.length > 0;
      const hasCriticalCells =
        hasForecastData &&
        forecastPayload.data.some(
          (cell: any) => (cell.planned || 0) > 0 || (cell.forecast || 0) > 0
        );

      if (hasCriticalCells && !forceAllocationsOverride) {
        // Use server forecast - it has valid data
        rows = forecastPayload.data as ForecastRow[];
        chosenDataSource = "serverForecast";
        console.log(
          `[useSDMTForecastData] ✅ Using server forecast data (${rows.length} cells with critical data)`
        );
      } else {
        if (forceAllocationsOverride) {
          console.warn(
            "[useSDMTForecastData] forceAllocations override active — skipping server forecast response"
          );
        } else {
          console.warn(
            "[useSDMTForecastData] Server forecast empty or missing critical cells — trying fallback"
          );
        }

        // Step 2: Fallback - try to get allocations
        try {
          // Extract baselineId from the loaded baseline
          const extractedBaselineId = baselineResp?.baselineId || baselineResp?.id;
          
          console.log(
            `[useSDMTForecastData] Fetching allocations for projectId=${projectId}, baselineId=${extractedBaselineId || 'none'}`
          );
          
          const allocations = await getAllocations(projectId, extractedBaselineId);
          if (latestRequestKey.current !== requestKey) return; // stale

          allocationsCount = allocations?.length || 0;
          console.log(
            `[useSDMTForecastData] ✅ Retrieved ${allocationsCount} allocations from DynamoDB for project ${projectId}${extractedBaselineId ? `, baseline ${extractedBaselineId}` : ''}`
          );

          if (allocations && allocations.length > 0) {
            // Log sample allocation structure for DynamoDB validation
            console.log("[useSDMTForecastData] Sample allocation structure:", {
              month: allocations[0].month,
              amount: allocations[0].amount,
              rubroId: allocations[0].rubroId || allocations[0].rubro_id,
              projectId: allocations[0].projectId,
              planned: allocations[0].planned,
              forecast: allocations[0].forecast,
              actual: allocations[0].actual,
            });

            // Step 3: Compute minimal forecast from allocations
            console.log(
              `[useSDMTForecastData] Computing forecast from ${
                allocations.length
              } allocations + ${rubrosResp?.length || 0} rubros`
            );
            
            // Build taxonomy lookup from rubros for fallback enrichment
            const taxonomyByRubroId: Record<string, { description?: string; category?: string }> = {};
            rubrosResp?.forEach((rubro: LineItem) => {
              const extendedRubro = rubro as ExtendedLineItem;
              const id = extendedRubro.id ?? extendedRubro.line_item_id ?? extendedRubro.rubroId;
              if (id && (extendedRubro.description ?? extendedRubro.category)) {
                taxonomyByRubroId[id] = {
                  description: extendedRubro.description,
                  category: extendedRubro.category,
                };
              }
            });
            
            rows = computeForecastFromAllocations(
              allocations as Allocation[],
              rubrosResp,
              months,
              projectId,
              taxonomyByRubroId,
              taxonomyMap,
              taxonomyCache
            );
            console.log(
              `[useSDMTForecastData] ✅ Generated ${rows.length} forecast cells from allocations`
            );
            usedFallback = true;
            chosenDataSource = "allocationsFallback";
          } else if (rubrosResp && rubrosResp.length > 0) {
            // Final fallback: use rubros only (original behavior)
            console.warn(
              `[useSDMTForecastData] No allocations found — using ${rubrosResp.length} rubros only`
            );
            rows = transformLineItemsToForecast(rubrosResp, months, projectId, undefined, taxonomyByRubroId);
            console.log(
              `[useSDMTForecastData] ✅ Generated ${rows.length} forecast cells from rubros fallback`
            );
            usedFallback = true;
            chosenDataSource = "rubrosFallback";
          } else {
            // No data available at all
            console.error(
              "[useSDMTForecastData] ❌ No forecast, allocations, or rubros available"
            );
            setError(
              "No forecast data available. Please check baseline materialization."
            );
            setForecastRows([]);
            setLoading(false);
            return;
          }
        } catch (allocError: any) {
          console.warn(
            "[useSDMTForecastData] Allocations fallback failed:",
            allocError.message
          );

          // If allocations fail, still try rubros as final fallback
          if (rubrosResp && rubrosResp.length > 0) {
            console.warn(
              `[useSDMTForecastData] Allocations failed — using ${rubrosResp.length} rubros only`
            );
            rows = transformLineItemsToForecast(rubrosResp, months, projectId, undefined, taxonomyByRubroId);
            console.log(
              `[useSDMTForecastData] ✅ Generated ${rows.length} forecast cells from rubros fallback (after allocation error)`
            );
            usedFallback = true;
            chosenDataSource = "rubrosFallback";
          } else {
            console.error(
              "[useSDMTForecastData] ❌ All fallback options exhausted"
            );
            setError("No forecast data available. Allocation fallback failed.");
            setForecastRows([]);
            setLoading(false);
            return;
          }
        }
      }

      // Load and merge monthly budgets (budget values populate "P" - Presupuesto column)
      // Budget loading is best-effort: if it fails, we continue without budget data
      let budgetMonthlyMap: Record<number, number> = {};
      try {
        const currentYear = new Date().getFullYear();
        const budgetData = await finanzasClient.getAllInBudgetMonthly(currentYear);
        if (latestRequestKey.current !== requestKey) return; // stale
        
        if (budgetData) {
          budgetMonthlyMap = normalizeBudgetMonths(budgetData);
          console.log(
            `[useSDMTForecastData] ✅ Loaded monthly budgets for ${currentYear}:`,
            { monthCount: Object.keys(budgetMonthlyMap).length, budgetMonthlyMap }
          );
          
          // Merge budget amounts into forecast rows
          // Budget is a portfolio-level total, so we need to distribute it or show it at summary level
          // For now, we'll add a budget field to each row for the corresponding month
          // The UI can then aggregate these for portfolio totals
          for (const row of rows) {
            const monthBudget = budgetMonthlyMap[row.month];
            if (monthBudget !== undefined) {
              // Add budget to row - UI will aggregate these for portfolio-level budget display
              row.budget = monthBudget;
            }
          }
        } else {
          console.log(
            `[useSDMTForecastData] No monthly budgets found for ${currentYear}`
          );
        }
      } catch (budgetError: any) {
        // Budget loading is optional - continue if it fails
        console.warn(
          "[useSDMTForecastData] Failed to load budgets (continuing without):",
          budgetError.message
        );
      }

      // Load and merge invoices as actuals
      const invoices = await getProjectInvoices(projectId === 'ALL_PROJECTS' ? undefined : projectId);
      if (latestRequestKey.current !== requestKey) return; // stale

      const isDev = import.meta.env.DEV;
      
      if (isDev) {
        console.log(
          `[useSDMTForecastData] invoices fetched for project ${projectId}: ${
            invoices?.length || 0
          }`
        );
      }

      // Filter to valid invoice statuses (using normalized status helper)
      const validInvoices = invoices.filter((inv) => {
        const status = invoiceStatusNormalized(inv);
        return status && VALID_INVOICE_STATUSES.includes(status as typeof VALID_INVOICE_STATUSES[number]);
      });
      
      if (isDev) {
        console.log(
          `[useSDMTForecastData] valid invoices: ${validInvoices.length}`
        );
      }

      // Apply invoices to forecast rows
      let matchedInvoicesCount = 0;
      let unmatchedInvoicesCount = 0;
      let invalidMonthCount = 0;
      let fallbackMatchedCount = 0; // Track fallback matches for DEV logging
      const invalidMonthInvoices: any[] = [];
      const unmatchedInvoicesSample: any[] = [];
      
      for (const inv of validInvoices) {
        let matched = false;
        const invMonth = normalizeInvoiceMonth(getInvoiceMonth(inv), undefined, isDev);
        
        for (const row of rows) {
          // Use improved matching with taxonomy and debug mode
          if (matchInvoiceToCell(inv, row, taxonomyMap, taxonomyCache, isDev)) {
            // Also check month matches (defensive) - only match if invMonth is valid (> 0)
            // This ensures we don't accidentally match invoices with no month data
            if (invMonth > 0 && row.month === invMonth) {
              const invAmount = normalizeInvoiceAmount(inv);
              row.actual = (row.actual || 0) + invAmount;
              matchedInvoicesCount++;
              matched = true;
              break; // Stop after first match to prevent double-counting
            }
          }
        }
        
        // DEV-only fallback diagnostic: If invoice didn't match, log potential matches
        // This helps diagnose whether minor formatting differences are causing failures
        // NOTE: This is DIAGNOSTIC ONLY - it does NOT modify row.actual
        if (!matched && invMonth > 0 && isDev) {
          for (const row of rows) {
            if (row.month !== invMonth) continue;
            
            // Check if canonical rubro comparison would match
            const invRubroId = inv.rubroId || inv.rubro_id || inv.line_item_id;
            const rowRubroId = row.rubroId || row.line_item_id;
            
            if (invRubroId && rowRubroId) {
              const invCanonical = canonicalizeRubroId(invRubroId);
              const rowCanonical = canonicalizeRubroId(rowRubroId);
              
              if (invCanonical && rowCanonical && invCanonical === rowCanonical) {
                const invAmount = normalizeInvoiceAmount(inv);
                fallbackMatchedCount++;
                console.log(
                  `[useSDMTForecastData] DIAGNOSTIC: Would match via canonical rubro: inv.rubroId=${invRubroId} → ${invCanonical}, row.rubroId=${rowRubroId} → ${rowCanonical}, amount=${invAmount}`
                );
                break; // Only log first potential match
              }
            }
            
            // Check if normalized description comparison would match
            if (inv.description && row.description) {
              if (normalizeString(inv.description) === normalizeString(row.description)) {
                const invAmount = normalizeInvoiceAmount(inv);
                fallbackMatchedCount++;
                console.log(
                  `[useSDMTForecastData] DIAGNOSTIC: Would match via description: "${inv.description}" → "${row.description}", amount=${invAmount}`
                );
                break; // Only log first potential match
              }
            }
          }
        }
        
        if (!matched) {
          if (invMonth === 0) {
            // Invoice has no valid month - track for batch logging
            invalidMonthCount++;
            if (invalidMonthInvoices.length < 5) { // Keep first 5 for sample
              // Note: Using 'as any' for defensive field access since invoices may have
              // varying field names (rubroId vs rubro_id, projectId vs project_id) depending on source
              invalidMonthInvoices.push({
                line_item_id: inv.line_item_id,
                rubroId: (inv as any).rubroId || (inv as any).rubro_id,
                amount: normalizeInvoiceAmount(inv),
                rawMonth: getInvoiceMonth(inv),
                project_id: (inv as any).projectId || (inv as any).project_id,
                status: invoiceStatusNormalized(inv),
              });
            }
          } else {
            unmatchedInvoicesCount++;
            // Collect sample of unmatched invoices for debugging
            if (unmatchedInvoicesSample.length < 5) {
              // Note: Using 'as any' for defensive field access since invoices may have
              // varying field names depending on source
              unmatchedInvoicesSample.push({
                line_item_id: inv.line_item_id,
                rubroId: (inv as any).rubroId || (inv as any).rubro_id,
                description: (inv as any).description,
                month: invMonth,
                rawMonth: getInvoiceMonth(inv),
                project_id: (inv as any).projectId || (inv as any).project_id,
                status: invoiceStatusNormalized(inv),
                amount: normalizeInvoiceAmount(inv),
              });
            }
          }
        }
      }

      if (isDev) {
        console.log(
          `[useSDMTForecastData] matchedInvoices: ${matchedInvoicesCount}, unmatchedSample: ${JSON.stringify(unmatchedInvoicesSample)}`
        );
        
        if (fallbackMatchedCount > 0) {
          console.warn(
            `[useSDMTForecastData] DIAGNOSTIC: ${fallbackMatchedCount} invoices would match using relaxed rules (canonical/description). Primary matching may need improvement.`
          );
        }
        
        if (invalidMonthCount > 0) {
          console.warn(
            `[useSDMTForecastData] invalidMonthInvoiceSample: ${JSON.stringify(invalidMonthInvoices)}`
          );
        }
      }

      const rowsWithActuals = rows.map((cell) => {
        const actualAmount = cell.actual || 0;
        
        return {
          ...cell,
          // Calculate both variance types
          varianceActual: actualAmount > 0 ? actualAmount - cell.planned : null,
          varianceForecast:
            cell.forecast != null ? cell.forecast - cell.planned : null,
          // Legacy variance field for backward compatibility
          variance: actualAmount > 0 ? actualAmount - cell.planned : cell.forecast - cell.planned,
        };
      });

      setForecastRows(rowsWithActuals);

      // Update state with chosen data source (after all async operations)
      setDataSource(chosenDataSource);

      // Summary logging for data validation (use local variable for accuracy)
      if (isDev) {
        console.log("[useSDMTForecastData] 📊 Data Summary:", {
          projectId,
          rubrosRetrieved: rubrosResp?.length || 0,
          allocationsRetrieved: allocationsCount,
          forecastCellsGenerated: rowsWithActuals.length,
          invoicesRetrieved: invoices?.length || 0,
          validInvoices: validInvoices.length,
          matchedInvoices: matchedInvoicesCount,
          unmatchedInvoices: unmatchedInvoicesCount,
          invalidMonthInvoices: invalidMonthCount,
          dataSource: chosenDataSource,
          months,
          forceAllocationsOverride,
        });
      }

      if (usedFallback) {
        console.info("[useSDMTForecastData] Using fallback data source");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Ignore aborted requests
        return;
      }

      console.error("[useSDMTForecastData] Error loading data:", err);
      if (latestRequestKey.current === requestKey) {
        setError(err.message || "Failed to load forecast data");
        setMaterializationFailed(true);
      }
    } finally {
      if (latestRequestKey.current === requestKey) {
        setLoading(false);
      }
    }
  }, [projectId, months]);

  useEffect(() => {
    fetchAll();

    return () => {
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort();
      }
    };
  }, [fetchAll]);

  const refresh = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  const retryMaterialization = useCallback(() => {
    setMaterializationTimeout(false);
    setMaterializationFailed(false);
    fetchAll();
  }, [fetchAll]);

  const saveForecast = useCallback(
    async (updatePayload: any) => {
      // Minimal wrapper; forward to finanzasClient
      await finanzasClient.bulkUpsertForecast(projectId, updatePayload.items);
    },
    [projectId]
  );

  return {
    loading,
    error,
    baseline,
    rubros,
    forecastRows,
    refresh,
    saveForecast,
    materializationPending,
    materializationTimeout,
    materializationFailed,
    retryMaterialization,
    dataSource,
  };
}
