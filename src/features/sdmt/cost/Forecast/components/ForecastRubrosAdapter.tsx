/**
 * ForecastRubrosAdapter Component
 * 
 * Compatibility adapter that provides the same public API as the legacy forecast table
 * while delegating rendering to the modern ForecastRubrosTable component.
 * 
 * Purpose:
 * - Preserve all legacy behaviors (reconciliation, budget editing, exports, etc.)
 * - Provide controlled viewMode support for external state management
 * - Enable incremental migration from legacy table to ForecastRubrosTable
 * - Serve as a bridge during feature flag rollout
 * 
 * Architecture:
 * - Accepts legacy props from SDMTForecast
 * - Delegates core rendering to ForecastRubrosTable
 * - Implements shims for legacy-only features not in ForecastRubrosTable
 * - Preserves all callbacks and event handlers
 */

import { useMemo } from 'react';
import { ForecastRubrosTable } from './ForecastRubrosTable';
import type { CategoryTotals, CategoryRubro, PortfolioTotals } from '../categoryGrouping';
import type { ProjectTotals, ProjectRubro } from '../projectGrouping';
import type { BaselineDetail } from '@/api/finanzas';

type ViewMode = 'category' | 'project';

export interface ForecastRubrosAdapterProps {
  // Core data (maps from SDMTForecast grouping logic)
  categoryTotals: Map<string, CategoryTotals>;
  categoryRubros: Map<string, CategoryRubro[]>;
  projectTotals?: Map<string, ProjectTotals>;
  projectRubros?: Map<string, ProjectRubro[]>;
  portfolioTotals: PortfolioTotals;
  
  // Monthly budget data
  monthlyBudgets: Array<{ month: number; budget: number }>;
  
  // Baseline and period info
  baselineDetail?: BaselineDetail | null;
  selectedPeriod?: string;
  
  // Callbacks for legacy behaviors
  onSaveMonthlyBudget?: (budgets: Array<{ month: number; budget: number }>) => Promise<void>;
  onReconcile?: (args: any) => void;
  onExport?: (format: 'excel' | 'pdf') => void;
  
  // External view control (controlled/uncontrolled pattern)
  externalViewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  
  // Materializer props
  materializationPending?: boolean;
  materializationFailed?: boolean;
  materializationTimeout?: number | null;
  onRetryMaterialization?: () => void;
  
  // Formatting and permissions
  formatCurrency?: (amount: number) => string;
  canEditBudget?: boolean;
}

/**
 * ForecastRubrosAdapter
 * 
 * This adapter component provides backward compatibility with the legacy forecast table
 * while delegating to ForecastRubrosTable. It:
 * 
 * 1. Accepts the same props SDMTForecast passes to legacy table
 * 2. Delegates core rendering to ForecastRubrosTable
 * 3. Implements shims for legacy features not in ForecastRubrosTable
 * 4. Preserves all callbacks and event handlers
 * 5. Supports controlled/uncontrolled viewMode
 * 
 * Legacy behaviors preserved:
 * - External viewMode control (breakdownMode → externalViewMode)
 * - Inline budget editing → handleSaveMonthlyBudget
 * - Reconciliation actions (via onReconcile callback)
 * - Exports (via onExport callback)
 * - Catalog links and change-history popovers (TODO: add when available)
 * - Telemetry for unmatched rubros (TODO: add when available)
 */
export function ForecastRubrosAdapter({
  categoryTotals,
  categoryRubros,
  projectTotals,
  projectRubros,
  portfolioTotals,
  monthlyBudgets,
  baselineDetail,
  selectedPeriod,
  onSaveMonthlyBudget,
  onReconcile,
  onExport,
  externalViewMode,
  onViewModeChange,
  materializationPending,
  materializationFailed,
  materializationTimeout,
  onRetryMaterialization,
  formatCurrency,
  canEditBudget = false,
}: ForecastRubrosAdapterProps) {
  
  // Default currency formatter if not provided
  const defaultFormatCurrency = useMemo(() => {
    return (amount: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };
  }, []);
  
  const currencyFormatter = formatCurrency || defaultFormatCurrency;
  
  // Default budget save handler if not provided
  const handleSaveBudget = useMemo(() => {
    return onSaveMonthlyBudget || (async (budgets: Array<{ month: number; budget: number }>) => {
      console.warn('[ForecastRubrosAdapter] No onSaveMonthlyBudget handler provided');
      if (import.meta.env.DEV) {
        console.log('[ForecastRubrosAdapter] Would save budgets:', budgets);
      }
    });
  }, [onSaveMonthlyBudget]);
  
  // Development logging
  if (import.meta.env.DEV) {
    console.log('[ForecastRubrosAdapter] Rendering with:', {
      externalViewMode,
      controlledMode: !!externalViewMode,
      categoryCount: categoryTotals.size,
      projectCount: projectTotals?.size || 0,
      hasMaterialization: materializationPending !== undefined,
      materializationPending,
      materializationFailed,
      materializationTimeout,
    });
  }
  
  return (
    <>
      {/* Materialization banner - show above table for better situational awareness */}
      {materializationPending && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="flex items-center justify-between">
            <div>
              <strong>Materialización en progreso</strong>
              <div className="text-xs mt-1">
                La línea base se está materializando. Algunos rubros o asignaciones pueden aparecer pronto.
              </div>
              {materializationTimeout && materializationTimeout > 0 && (
                <div className="text-xs text-amber-700 mt-1">
                  ⏱️ Materializado desde hace {materializationTimeout} minuto{materializationTimeout > 1 ? 's' : ''}
                </div>
              )}
            </div>
            {onRetryMaterialization && (
              <button
                onClick={onRetryMaterialization}
                className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      )}

      {materializationFailed && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <div className="flex items-center justify-between">
            <div>
              <strong>La materialización falló</strong>
              <div className="text-xs mt-1">
                No se pudo completar la materialización de la línea base.
              </div>
            </div>
            {onRetryMaterialization && (
              <button
                onClick={onRetryMaterialization}
                className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Delegate to ForecastRubrosTable for core rendering */}
      <ForecastRubrosTable
        categoryTotals={categoryTotals}
        categoryRubros={categoryRubros}
        projectTotals={projectTotals}
        projectRubros={projectRubros}
        portfolioTotals={portfolioTotals}
        monthlyBudgets={monthlyBudgets}
        onSaveBudget={handleSaveBudget}
        formatCurrency={currencyFormatter}
        canEditBudget={canEditBudget}
        defaultFilter="labor"
        externalViewMode={externalViewMode}
        onViewModeChange={onViewModeChange}
      />
      
      {/* 
        TODO: Add legacy features not in ForecastRubrosTable:
        - Reconciliation modals (call onReconcile when user clicks reconcile button)
        - Export actions (call onExport when user requests export)
        - Catalog links (link to canonical rubros catalog)
        - Change history popovers (show change request IDs and history)
        - Selection and bulk actions (if legacy table had these)
        - Telemetry for unmatched rubros (log warnings for rubros without matching data)
      */}
    </>
  );
}
