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

import { useEffect, useRef, useState, useCallback } from 'react';
import { transformLineItemsToForecast, type ForecastRow } from './transformLineItemsToForecast';
import { getForecastPayload, getProjectInvoices } from './forecastService';
import { getProjectRubros, getAllocations } from '@/api/finanzas';
import type { LineItem } from '@/types/domain';
import finanzasClient from '@/api/finanzasClient';

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
}

/**
 * Helper to check if baseline is materialized
 */
export const isMaterialized = (baseline: any): boolean => {
  return baseline?.materializedAt || baseline?.materialization_status === 'completed';
};

/**
 * Helper to normalize strings for comparison (case-insensitive, whitespace-normalized)
 */
export const normalizeString = (s: any): string => {
  return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
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
  if (inv.description && cell.description && 
      normalizeString(inv.description) === normalizeString(cell.description)) {
    return true;
  }
  
  return false;
};

/**
 * Compute minimal forecast from allocations data
 * 
 * When server forecast is empty but allocations exist, this creates a basic
 * forecast grid showing month totals from allocation data.
 * 
 * @param allocations - Allocation records from /allocations endpoint
 * @param rubros - Line items from /rubros endpoint (for enrichment)
 * @param months - Number of months to generate
 * @param projectId - Project identifier
 * @returns Array of forecast cells with month totals
 */
function computeForecastFromAllocations(
  allocations: any[],
  rubros: LineItem[],
  months: number,
  projectId?: string
): ForecastRow[] {
  if (!allocations || allocations.length === 0) {
    return [];
  }

  // Group allocations by month and rubroId
  const allocationMap = new Map<string, { month: number; amount: number; rubroId?: string }[]>();
  
  allocations.forEach(alloc => {
    // Parse month from allocation (could be "2025-01" format or month number)
    let monthNum = 0;
    if (typeof alloc.month === 'number') {
      monthNum = alloc.month;
    } else if (typeof alloc.month === 'string') {
      const match = alloc.month.match(/\d{4}-(\d{2})/);
      if (match) {
        monthNum = parseInt(match[1], 10);
      }
    }
    
    if (monthNum >= 1 && monthNum <= 12) {
      const rubroId = alloc.rubroId || alloc.rubro_id || alloc.line_item_id || 'UNKNOWN';
      const key = `${rubroId}-${monthNum}`;
      
      if (!allocationMap.has(key)) {
        allocationMap.set(key, []);
      }
      
      allocationMap.get(key)!.push({
        month: monthNum,
        amount: Number(alloc.amount || 0),
        rubroId,
      });
    }
  });

  // Create forecast cells from aggregated allocations
  const forecastCells: ForecastRow[] = [];
  
  allocationMap.forEach((allocList, key) => {
    if (allocList.length === 0) return;
    
    const firstAlloc = allocList[0];
    const totalAmount = allocList.reduce((sum, a) => sum + a.amount, 0);
    const rubroId = firstAlloc.rubroId || 'UNKNOWN';
    
    // Try to find matching rubro for metadata
    const matchingRubro = rubros.find(r => 
      r.id === rubroId || 
      r.rubroId === rubroId ||
      r.rubro_id === rubroId
    );
    
    forecastCells.push({
      line_item_id: rubroId,
      rubroId: rubroId,
      description: matchingRubro?.description || matchingRubro?.nombre || `Allocation ${rubroId}`,
      category: matchingRubro?.category || matchingRubro?.categoria || 'Allocations',
      month: firstAlloc.month,
      planned: totalAmount,
      forecast: totalAmount,
      actual: 0,
      variance: 0,
      last_updated: new Date().toISOString(),
      updated_by: 'system-allocations',
      projectId,
    });
  });

  return forecastCells;
}

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
  
  const latestRequestKey = useRef(0);
  const abortCtrlRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    if (!projectId) {
      setError('Project ID is required');
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
            
            // Check if already materialized
            if (isMaterialized(baselineResp)) {
              return true;
            }
            
            // Wait 5 seconds before next poll
            await new Promise(r => setTimeout(r, 5000));
            
            // Re-fetch baseline summary
            try {
              baselineResp = await finanzasClient.getBaselineSummary(projectId, { signal: abortCtrlRef.current?.signal });
              if (latestRequestKey.current !== requestKey) return false; // stale
              setBaseline(baselineResp);
            } catch (pollErr: any) {
              if (pollErr.name === 'AbortError') {
                return false;
              }
              // Continue polling even if one fetch fails
              console.warn('[useSDMTForecastData] Polling error:', pollErr);
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

      // ROBUST FALLBACK FLOW
      // Step 1: Try to load server-side forecast
      const forecastPayload = await getForecastPayload(projectId, months);
      if (latestRequestKey.current !== requestKey) return; // stale

      let rows: ForecastRow[] = [];
      let usedFallback = false;

      // Check if forecast has meaningful data
      const hasForecastData = forecastPayload.data && forecastPayload.data.length > 0;
      const hasCriticalCells = hasForecastData && 
        forecastPayload.data.some((cell: any) => 
          (cell.planned || 0) > 0 || (cell.forecast || 0) > 0
        );

      if (hasCriticalCells) {
        // Use server forecast - it has valid data
        rows = forecastPayload.data as ForecastRow[];
        console.log('[useSDMTForecastData] Using server forecast data');
      } else {
        console.warn('[useSDMTForecastData] Server forecast empty or missing critical cells — trying fallback');
        
        // Step 2: Fallback - try to get allocations
        const allocations = await getAllocations(projectId);
        if (latestRequestKey.current !== requestKey) return; // stale
        
        if (allocations && allocations.length > 0) {
          // Step 3: Compute minimal forecast from allocations
          console.log('[useSDMTForecastData] Computing forecast from allocations:', allocations.length);
          rows = computeForecastFromAllocations(allocations, rubrosResp, months, projectId);
          usedFallback = true;
        } else if (rubrosResp && rubrosResp.length > 0) {
          // Final fallback: use rubros only (original behavior)
          console.warn('[useSDMTForecastData] No allocations found — using rubros only');
          rows = transformLineItemsToForecast(rubrosResp, months, projectId);
          usedFallback = true;
        } else {
          // No data available at all
          console.error('[useSDMTForecastData] No forecast, allocations, or rubros available');
          setError('No forecast data available. Please check baseline materialization.');
          setForecastRows([]);
          setLoading(false);
          return;
        }
      }

      // Load and merge invoices as actuals
      const invoices = await getProjectInvoices(projectId);
      if (latestRequestKey.current !== requestKey) return; // stale
      
      const matchedInvoices = invoices.filter(inv => inv.status === 'Matched');
      
      const rowsWithActuals = rows.map(cell => {
        const matchedInvoice = matchedInvoices.find(
          inv => matchInvoiceToCell(inv, cell) && inv.month === cell.month
        );
        
        if (matchedInvoice) {
          const actualAmount = matchedInvoice.amount || 0;
          return {
            ...cell,
            actual: actualAmount,
            // Calculate both variance types
            varianceActual: actualAmount - cell.planned,
            varianceForecast: cell.forecast != null ? cell.forecast - cell.planned : null,
            // Legacy variance field for backward compatibility
            variance: actualAmount - cell.planned,
          };
        }
        
        // No matched invoice - calculate variance based on forecast vs planned
        return {
          ...cell,
          varianceActual: null, // No actual data
          varianceForecast: cell.forecast != null ? cell.forecast - cell.planned : null,
          variance: cell.forecast - cell.planned,
        };
      });

      setForecastRows(rowsWithActuals);
      
      if (usedFallback) {
        console.info('[useSDMTForecastData] Using fallback data source');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignore aborted requests
        return;
      }
      
      console.error('[useSDMTForecastData] Error loading data:', err);
      if (latestRequestKey.current === requestKey) {
        setError(err.message || 'Failed to load forecast data');
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

  const saveForecast = useCallback(async (updatePayload: any) => {
    // Minimal wrapper; forward to finanzasClient
    return finanzasClient.bulkUpsertForecast(projectId, updatePayload.items);
  }, [projectId]);

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
  };
}
