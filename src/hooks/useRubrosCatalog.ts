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
 * Hook to get all rubros from the canonical taxonomy
 * 
 * @returns Object containing rubros array, loading state, and error state
 */
export function useRubrosCatalog(): UseRubrosCatalogResult {
  const [rubros, setRubros] = useState<RubroMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadRubros = async () => {
      try {
        setLoading(true);
        const data = await fetchRubrosCatalog();
        if (mounted) {
          setRubros(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load rubros'));
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
  }, []);

  return { rubros, loading, error };
}

/**
 * Hook to get only labor rubros (MOD category)
 * 
 * @returns Object containing labor rubros array, loading state, and error state
 */
export function useLaborRubros(): UseRubrosCatalogResult {
  const [rubros, setRubros] = useState<RubroMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadRubros = async () => {
      try {
        setLoading(true);
        const data = await fetchLaborRubros();
        if (mounted) {
          setRubros(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load labor rubros'));
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
  }, []);

  return { rubros, loading, error };
}

/**
 * Hook to get only non-labor rubros (all categories except MOD)
 * 
 * @returns Object containing non-labor rubros array, loading state, and error state
 */
export function useNonLaborCatalog(): UseRubrosCatalogResult {
  const [rubros, setRubros] = useState<RubroMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadRubros = async () => {
      try {
        setLoading(true);
        const data = await fetchNonLaborRubros();
        if (mounted) {
          setRubros(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load non-labor rubros'));
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
  }, []);

  return { rubros, loading, error };
}
