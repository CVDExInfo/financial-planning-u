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
  type CanonicalRubroTaxonomy 
} from "@/lib/rubros/canonical-taxonomy";
import { buildTaxonomyMap, type TaxonomyEntry as TaxLookupEntry } from "./lib/taxonomyLookup";

// Build taxonomy from canonical source (the single source of truth)
const taxonomyByRubroId: Record<string, { description?: string; category?: string; isLabor?: boolean }> = {};
CANONICAL_RUBROS_TAXONOMY.forEach((taxonomy) => {
  taxonomyByRubroId[taxonomy.id] = {
    description: taxonomy.linea_gasto || taxonomy.descripcion,
    category: taxonomy.categoria,
    isLabor: taxonomy.categoria_codigo === 'MOD',
  };
  
  // Also index by linea_codigo if different from id
  if (taxonomy.linea_codigo && taxonomy.linea_codigo !== taxonomy.id) {
    taxonomyByRubroId[taxonomy.linea_codigo] = {
      description: taxonomy.linea_gasto || taxonomy.descripcion,
      category: taxonomy.categoria,
      isLabor: taxonomy.categoria_codigo === 'MOD',
    };
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
 * Helper to normalize strings for comparison (case-insensitive, whitespace-normalized)
 */
export const normalizeString = (s: any): string => {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
};

/**
 * Normalize invoice month to match forecast cell month index
 * Handles both numeric month indices (1-12) and YYYY-MM string formats
 * 
 * @param invoiceMonth - Month value from invoice (could be number or "YYYY-MM" string)
 * @param baselineStartMonth - Optional baseline start month for relative indexing
 * @returns Numeric month index (1-based) or 0 if invalid
 */
export const normalizeInvoiceMonth = (invoiceMonth: any, baselineStartMonth?: number): number => {
  // If already a valid numeric month index, return it
  if (typeof invoiceMonth === 'number' && invoiceMonth >= 1 && invoiceMonth <= 60) {
    return invoiceMonth;
  }
  
  // If string in YYYY-MM format, extract month number
  if (typeof invoiceMonth === 'string') {
    const match = invoiceMonth.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const monthNum = parseInt(match[2], 10);
      // If we have baseline start, could calculate relative index
      // For now, just return the month number (1-12)
      return monthNum;
    }
    
    // Try parsing as plain number string
    const parsed = parseInt(invoiceMonth, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) {
      return parsed;
    }
  }
  
  return 0; // Invalid month
};

/**
 * Helper function for robust invoice matching
 */
export const matchInvoiceToCell = (inv: any, cell: ForecastRow): boolean => {
  if (!inv) return false;

  // Priority 1: Match by line_item_id
  if (inv.line_item_id && inv.line_item_id === cell.line_item_id) {
    return true;
  }

  // Priority 2: Match by rubroId
  if (inv.rubroId && inv.rubroId === cell.rubroId) {
    return true;
  }

  // Priority 3: Match by normalized description
  if (
    inv.description &&
    cell.description &&
    normalizeString(inv.description) === normalizeString(cell.description)
  ) {
    return true;
  }

  return false;
};

const FORCE_ALLOC_PARAM = "forceAllocations";
const FORCE_ALLOC_STORAGE_KEY = "finz.forceAllocationsOverride";

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
      if (latestRequestKey.current !== requestKey) return; // stale
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
              if (latestRequestKey.current !== requestKey) return false; // stale
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
      if (latestRequestKey.current !== requestKey) return; // stale
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
      if (latestRequestKey.current !== requestKey) return; // stale

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

      // Load and merge invoices as actuals
      const invoices = await getProjectInvoices(projectId);
      if (latestRequestKey.current !== requestKey) return; // stale

      console.log(
        `[useSDMTForecastData] ✅ Retrieved ${
          invoices?.length || 0
        } invoices for project ${projectId}`
      );

      const matchedInvoices = invoices.filter(
        (inv) => inv.status === "Matched"
      );
      console.log(
        `[useSDMTForecastData] Found ${matchedInvoices.length} matched invoices (status='Matched')`
      );

      const rowsWithActuals = rows.map((cell) => {
        const matchedInvoice = matchedInvoices.find((inv) => {
          // Match by line item/rubro AND normalized month
          const invoiceMonth = normalizeInvoiceMonth(inv.month);
          return matchInvoiceToCell(inv, cell) && invoiceMonth === cell.month;
        });

        if (matchedInvoice) {
          const actualAmount = matchedInvoice.amount || 0;
          return {
            ...cell,
            actual: actualAmount,
            // Calculate both variance types
            varianceActual: actualAmount - cell.planned,
            varianceForecast:
              cell.forecast != null ? cell.forecast - cell.planned : null,
            // Legacy variance field for backward compatibility
            variance: actualAmount - cell.planned,
          };
        }

        // No matched invoice - calculate variance based on forecast vs planned
        return {
          ...cell,
          varianceActual: null, // No actual data
          varianceForecast:
            cell.forecast != null ? cell.forecast - cell.planned : null,
          variance: cell.forecast - cell.planned,
        };
      });

      setForecastRows(rowsWithActuals);

      // Update state with chosen data source (after all async operations)
      setDataSource(chosenDataSource);

      // Summary logging for data validation (use local variable for accuracy)
      console.log("[useSDMTForecastData] 📊 Data Summary:", {
        projectId,
        rubrosRetrieved: rubrosResp?.length || 0,
        allocationsRetrieved: allocationsCount,
        forecastCellsGenerated: rowsWithActuals.length,
        invoicesRetrieved: invoices?.length || 0,
        matchedInvoices: matchedInvoices.length,
        dataSource: chosenDataSource,
        months,
        forceAllocationsOverride,
      });

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
