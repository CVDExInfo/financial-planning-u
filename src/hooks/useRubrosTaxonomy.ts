/**
 * Hook for accessing canonical rubros taxonomy
 * Provides categories, filtered rubros, and lookup functions
 */

import { useMemo } from 'react';
import {
  ALL_RUBROS_TAXONOMY,
  TAXONOMY_BY_ID,
  getTaxonomyEntry,
  allRubros,
  type CanonicalRubroTaxonomy,
} from '@/lib/rubros';

export interface CategoryOption {
  codigo: string;
  nombre: string;
}

export function useRubrosTaxonomy() {
  // Get unique categories
  const categories = useMemo<CategoryOption[]>(() => {
    const uniqueCategories = new Map<string, string>();
    
    ALL_RUBROS_TAXONOMY.forEach(rubro => {
      if (rubro.isActive) {
        uniqueCategories.set(rubro.categoria_codigo, rubro.categoria);
      }
    });
    
    return Array.from(uniqueCategories.entries())
      .map(([codigo, nombre]) => ({ codigo, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, []);

  // Get rubros by category
  const getRubrosByCategory = useMemo(() => {
    return (categoryCodigo: string): CanonicalRubroTaxonomy[] => {
      return allRubros().filter(
        rubro => rubro.categoria_codigo === categoryCodigo
      );
    };
  }, []);

  // Get taxonomy entry by ID
  const getRubroById = useMemo(() => {
    return (rubroId: string): CanonicalRubroTaxonomy | undefined => {
      return getTaxonomyEntry(rubroId);
    };
  }, []);

  return {
    categories,
    getRubrosByCategory,
    getRubroById,
    allRubros: allRubros(),
  };
}

export default useRubrosTaxonomy;
