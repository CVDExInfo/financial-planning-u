/**
 * MonthlySnapshotSummary Component
 *
 * Simplified summary view for MonthlySnapshotGrid when collapsed.
 * Shows only top-line KPIs for quick executive overview, aligned with
 * "Resumen Ejecutivo - Cartera Completa" style.
 *
 * Displays 5 key metrics for the selected month:
 * - Presupuesto (Budget)
 * - Pronóstico (Forecast)
 * - Real (Actual)
 * - % Consumo (Real/Budget) - NEW metric added per requirements
 * - Var vs Presupuesto (Variance)
 */

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MonthlySnapshotSummaryProps {
  /** Selected month index (1-60) */
  month: number;

  /** Total budget for the month */
  totalBudget: number;

  /** Total forecast for the month */
  totalForecast: number;

  /** Total actual for the month */
  totalActual: number;

  /** Currency formatter */
  formatCurrency: (amount: number) => string;
}

export function MonthlySnapshotSummary({
  month,
  totalBudget,
  totalForecast,
  totalActual,
  formatCurrency,
}: MonthlySnapshotSummaryProps) {
  // Calculate variance vs budget (Actual - Budget)
  // Positive = over budget (bad), Negative = under budget (good)
  const totalVarianceBudget = totalActual - totalBudget;
  const totalVarianceBudgetPercent =
    totalBudget > 0 ? (totalVarianceBudget / totalBudget) * 100 : null;

  // Calculate % Consumo (Real/Budget)
  // This is the key metric requested in requirements
  const consumoPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  // Format variance with appropriate color
  const getVarianceColor = (value: number): string => {
    if (value > 0) return "text-red-600"; // Over budget = bad
    if (value < 0) return "text-green-600"; // Under budget = good
    return "text-muted-foreground";
  };

  const varianceColor = getVarianceColor(totalVarianceBudget);
  const varianceSign = totalVarianceBudget >= 0 ? "+" : "";

  return (
    <div className="space-y-3">
      {/* Simplified KPI-only view - aligned with "Resumen Ejecutivo - Cartera Completa" */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* 1. Presupuesto */}
        <div className="rounded-lg border bg-background px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">
            Presupuesto
          </div>
          <div className="text-lg font-semibold">
            {totalBudget > 0 ? formatCurrency(totalBudget) : "—"}
          </div>
        </div>

        {/* 2. Pronóstico */}
        <div className="rounded-lg border bg-background px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">
            Pronóstico
          </div>
          <div className="text-lg font-semibold">
            {formatCurrency(totalForecast)}
          </div>
        </div>

        {/* 3. Real */}
        <div className="rounded-lg border bg-background px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">Real</div>
          <div className="text-lg font-semibold text-blue-700">
            {formatCurrency(totalActual)}
          </div>
        </div>

        {/* 4. % Consumo (Real/Budget) - NEW metric per requirements */}
        <div className="rounded-lg border bg-background px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">% Consumo</div>
          <div className="text-lg font-semibold">
            {totalBudget > 0 ? `${consumoPct.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Real/Budget
          </div>
        </div>

        {/* 5. Varianza vs Presupuesto */}
        <div className="rounded-lg border bg-background px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">Varianza</div>
          <div className={`text-lg font-semibold ${varianceColor}`}>
            {varianceSign}
            {formatCurrency(Math.abs(totalVarianceBudget))}
          </div>
          <div className={`text-[10px] ${varianceColor} mt-0.5`}>
            {totalVarianceBudgetPercent !== null
              ? `${varianceSign}${totalVarianceBudgetPercent.toFixed(1)}%`
              : "—"}
          </div>
        </div>
      </div>

      {/* Informational note */}
      <div className="text-xs text-muted-foreground px-1">
        📊 Vista resumida para M{month} — Expandir arriba para ver desglose completo de proyectos/rubros
      </div>
    </div>
  );
}
