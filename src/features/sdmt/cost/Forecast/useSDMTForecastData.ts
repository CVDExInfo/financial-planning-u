/**
 * useSDMTForecastData Hook
 * 
 * Centralizes all data loading and transform logic for SDMT Forecast view.
 * Handles:
 * - Loading baseline summary, rubros, and forecast data
 * - Fallback transformation when server forecast is empty
 * - Abort/stale response handling
 * - Save and refresh operations
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { transformLineItemsToForecast, type ForecastRow } from './transformLineItemsToForecast';
import { getForecastPayload, getProjectInvoices } from './forecastService';
import { getProjectRubros } from '@/api/finanzas';
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
    
    const requestKey = ++latestRequestKey.current;
    
    // Abort any previous request
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    abortCtrlRef.current = new AbortController();

    try {
      // Load baseline summary
      const baselineResp = await finanzasClient.getBaselineSummary(projectId);
      if (latestRequestKey.current !== requestKey) return; // stale
      setBaseline(baselineResp);

      // Load rubros / line items
      const rubrosResp = await getProjectRubros(projectId);
      if (latestRequestKey.current !== requestKey) return; // stale
      setRubros(rubrosResp || []);

      // Load server-side forecast
      const forecastPayload = await getForecastPayload(projectId, months);
      if (latestRequestKey.current !== requestKey) return; // stale

      let rows: ForecastRow[];
      if (forecastPayload.data && forecastPayload.data.length > 0) {
        // Use server forecast
        rows = forecastPayload.data as ForecastRow[];
      } else {
        // Fallback: use line items to generate forecast
        console.warn('[useSDMTForecastData] Server forecast empty — using rubros fallback');
        rows = transformLineItemsToForecast(rubrosResp || [], months, projectId);
      }

      // Load and merge invoices as actuals
      const invoices = await getProjectInvoices(projectId);
      if (latestRequestKey.current !== requestKey) return; // stale
      
      const matchedInvoices = invoices.filter(inv => inv.status === 'Matched');
      
      const rowsWithActuals = rows.map(cell => {
        const matchedInvoice = matchedInvoices.find(
          inv => inv.line_item_id === cell.line_item_id && inv.month === cell.month
        );
        
        if (matchedInvoice) {
          const actualAmount = matchedInvoice.amount || 0;
          return {
            ...cell,
            actual: actualAmount,
            // Variance is actual vs planned (not forecast vs planned)
            variance: actualAmount - cell.planned,
          };
        }
        
        // No matched invoice - keep default variance (forecast vs planned)
        return {
          ...cell,
          variance: cell.forecast - cell.planned,
        };
      });

      setForecastRows(rowsWithActuals);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignore aborted requests
        return;
      }
      
      console.error('[useSDMTForecastData] Error loading data:', err);
      if (latestRequestKey.current === requestKey) {
        setError(err.message || 'Failed to load forecast data');
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
  };
}
