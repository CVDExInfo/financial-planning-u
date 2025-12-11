/**
 * Hook for accessing canonical rubros taxonomy
 * Provides categories, filtered rubros, and lookup functions
 */

import { useMemo } from 'react';
import {
  CANONICAL_RUBROS_TAXONOMY,
  TAXONOMY_BY_ID,
  getTaxonomyById,
  getActiveRubros,
  type CanonicalRubroTaxonomy,
} from '@/lib/rubros/canonical-taxonomy';

export interface CategoryOption {
  codigo: string;
  nombre: string;
}

export function useRubrosTaxonomy() {
  // Get unique categories
  const categories = useMemo<CategoryOption[]>(() => {
    const uniqueCategories = new Map<string, string>();
    
    CANONICAL_RUBROS_TAXONOMY.forEach(rubro => {
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
      return getActiveRubros().filter(
        rubro => rubro.categoria_codigo === categoryCodigo
      );
    };
  }, []);
  
  // Get taxonomy entry by ID
  const getRubroById = useMemo(() => {
    return (rubroId: string): CanonicalRubroTaxonomy | undefined => {
      return getTaxonomyById(rubroId);
    };
  }, []);
  
  return {
    categories,
    getRubrosByCategory,
    getRubroById,
    allRubros: getActiveRubros(),
  };
}

export default useRubrosTaxonomy;
