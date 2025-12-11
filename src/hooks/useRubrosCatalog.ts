/**
 * React hooks for accessing canonical rubros taxonomy
 * 
 * These hooks provide access to the rubros catalog for use in
 * PMO Estimator and SDMT components.
 */

import { useState, useEffect } from 'react';
import {
  fetchRubrosCatalog,
  fetchLaborRubros,
  fetchNonLaborRubros,
  type RubroMeta,
} from '@/api/helpers/rubros';

export interface UseRubrosCatalogResult {
  /** Array of rubros */
  rubros: RubroMeta[];
  /** Whether rubros are being loaded */
  loading: boolean;
  /** Any error that occurred */
  error: Error | null;
}

/**
 * Generic hook for fetching rubros with different fetch functions
 * Reduces code duplication across specific rubro hooks
 * 
 * @param fetchFn - Async function that fetches rubros
 * @param errorMessage - Error message to use if fetch fails
 * @returns Object containing rubros array, loading state, and error state
 */
function useRubrosGeneric(
  fetchFn: () => Promise<RubroMeta[]>,
  errorMessage: string
): UseRubrosCatalogResult {
  const [rubros, setRubros] = useState<RubroMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadRubros = async () => {
      try {
        setLoading(true);
        const data = await fetchFn();
        if (mounted) {
          setRubros(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(errorMessage));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadRubros();

    return () => {
      mounted = false;
    };
  }, [fetchFn, errorMessage]);

  return { rubros, loading, error };
}

/**
 * Hook to get all rubros from the canonical taxonomy
 * 
 * @returns Object containing rubros array, loading state, and error state
 */
export function useRubrosCatalog(): UseRubrosCatalogResult {
  return useRubrosGeneric(fetchRubrosCatalog, 'Failed to load rubros');
}

/**
 * Hook to get only labor rubros (MOD category)
 * 
 * @returns Object containing labor rubros array, loading state, and error state
 */
export function useLaborRubros(): UseRubrosCatalogResult {
  return useRubrosGeneric(fetchLaborRubros, 'Failed to load labor rubros');
}

/**
 * Hook to get only non-labor rubros (all categories except MOD)
 * 
 * @returns Object containing non-labor rubros array, loading state, and error state
 */
export function useNonLaborCatalog(): UseRubrosCatalogResult {
  return useRubrosGeneric(fetchNonLaborRubros, 'Failed to load non-labor rubros');
}
