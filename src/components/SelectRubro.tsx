/**
 * SelectRubro Component
 * 
 * A dropdown select component for choosing canonical rubros from the taxonomy.
 * Prevents free-text input and ensures only valid canonical IDs are selected.
 * 
 * Features:
 * - Loads rubros from canonical taxonomy
 * - Groups rubros by category
 * - Searchable/filterable
 * - Shows both linea_codigo and linea_gasto for clarity
 * - Validates selected value against canonical IDs
 */

import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CANONICAL_RUBROS_TAXONOMY,
  isValidRubroId,
  type CanonicalRubroTaxonomy,
  getAllCategories,
  getRubrosByCategory,
} from '@/lib/rubros/canonical-taxonomy';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectRubroProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Filter rubros by category code (e.g., "MOD", "GSV")
   */
  categoryFilter?: string;
  /**
   * Filter rubros by type (labor vs non-labor)
   */
  typeFilter?: 'labor' | 'non-labor';
  /**
   * Show search/filter input
   */
  searchable?: boolean;
  /**
   * Show category badges in options
   */
  showCategories?: boolean;
  /**
   * Error message to display
   */
  error?: string;
}

export function SelectRubro({
  value,
  onValueChange,
  placeholder = "Select a rubro...",
  label,
  required = false,
  disabled = false,
  className,
  categoryFilter,
  typeFilter,
  searchable = true,
  showCategories = true,
  error,
}: SelectRubroProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Group rubros by category for organized display using canonical helpers
  const groupedRubros = useMemo(() => {
    // Use getAllCategories helper for consistent category listing
    const categories = getAllCategories();
    
    return categories
      .map(categoryCode => {
        // Use getRubrosByCategory helper for consistent grouping
        const categoryRubros = getRubrosByCategory(categoryCode)
          .filter(r => {
            // Apply category filter
            if (categoryFilter && r.categoria_codigo !== categoryFilter) return false;
            
            // Apply type filter
            if (typeFilter) {
              if (typeFilter === 'labor' && r.categoria_codigo !== 'MOD') return false;
              if (typeFilter === 'non-labor' && r.categoria_codigo === 'MOD') return false;
            }
            
            // Apply search filter
            if (searchTerm) {
              const term = searchTerm.toLowerCase();
              return (
                r.linea_codigo.toLowerCase().includes(term) ||
                r.linea_gasto.toLowerCase().includes(term) ||
                r.descripcion.toLowerCase().includes(term) ||
                r.categoria.toLowerCase().includes(term)
              );
            }
            return true;
          })
          .sort((a, b) => a.linea_codigo.localeCompare(b.linea_codigo));
        
        if (categoryRubros.length === 0) return null;
        
        return {
          code: categoryCode,
          name: categoryRubros[0].categoria,
          rubros: categoryRubros,
        };
      })
      .filter((group): group is { code: string; name: string; rubros: CanonicalRubroTaxonomy[] } => group !== null);
  }, [categoryFilter, typeFilter, searchTerm]);

  // Validate current value
  const isValid = value ? isValidRubroId(value) : true;
  const selectedRubro = value ? CANONICAL_RUBROS_TAXONOMY.find(r => r.linea_codigo === value) : null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <Label htmlFor="rubro-select">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search rubros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger 
          id="rubro-select"
          className={cn(
            "w-full",
            error || !isValid ? "border-destructive" : ""
          )}
        >
          <SelectValue placeholder={placeholder}>
            {selectedRubro && (
              <div className="flex items-center gap-2">
                {showCategories && (
                  <Badge variant="outline" className="text-xs">
                    {selectedRubro.categoria_codigo}
                  </Badge>
                )}
                <span className="font-medium">{selectedRubro.linea_codigo}</span>
                <span className="text-muted-foreground">— {selectedRubro.linea_gasto}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>

        <SelectContent className="max-h-[300px]">
          {groupedRubros.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No rubros found
            </div>
          ) : (
            groupedRubros.map(({ code, name, rubros }) => (
              <SelectGroup key={code}>
                <SelectLabel className="text-xs font-semibold">
                  {code} — {name}
                </SelectLabel>
                {rubros.map((rubro) => (
                  <SelectItem key={rubro.linea_codigo} value={rubro.linea_codigo}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rubro.linea_codigo}</span>
                        <span className="text-muted-foreground">— {rubro.linea_gasto}</span>
                      </div>
                      {rubro.descripcion && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {rubro.descripcion}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))
          )}
        </SelectContent>
      </Select>

      {(error || !isValid) && (
        <p className="text-sm text-destructive">
          {error || 'Invalid rubro selected. Please choose a valid canonical rubro.'}
        </p>
      )}

      {value && !error && isValid && selectedRubro && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p><span className="font-medium">Category:</span> {selectedRubro.categoria}</p>
          <p><span className="font-medium">Type:</span> {selectedRubro.tipo_costo} — {selectedRubro.tipo_ejecucion}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example usage:
 * 
 * ```tsx
 * import { SelectRubro } from '@/components/SelectRubro';
 * 
 * function MyForm() {
 *   const [rubroId, setRubroId] = useState('');
 * 
 *   return (
 *     <SelectRubro
 *       label="Cost Line Item"
 *       value={rubroId}
 *       onValueChange={setRubroId}
 *       required
 *       searchable
 *       showCategories
 *     />
 *   );
 * }
 * 
 * // Filter to labor rubros only
 * <SelectRubro
 *   typeFilter="labor"
 *   label="Labor Resource"
 *   value={rubroId}
 *   onValueChange={setRubroId}
 * />
 * 
 * // Filter to specific category
 * <SelectRubro
 *   categoryFilter="GSV"
 *   label="Service Management Rubro"
 *   value={rubroId}
 *   onValueChange={setRubroId}
 * />
 * ```
 */
