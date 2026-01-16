/**
 * MonthlySnapshotSummary Component
 *
 * Compact summary view for MonthlySnapshotGrid when collapsed.
 * Shows top-line KPIs and top N variances for quick executive overview.
 */

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";

interface VarianceItem {
  id: string;
  name: string;
  code?: string;
  varianceBudget: number;
  varianceBudgetPercent: number | null;
  projectId?: string;
  rubroId?: string;
}

interface MonthlySnapshotSummaryProps {
  /** Selected month index (1-12) */
  month: number;

  /** Total budget for the month */
  totalBudget: number;

  /** Total forecast for the month */
  totalForecast: number;

  /** Total actual for the month */
  totalActual: number;

  /** Optional breakdown between labor and non-labor totals */
  costBreakdown?: {
    laborTotal: number;
    nonLaborTotal: number;
    laborPct: number;
    nonLaborPct: number;
  };

  /** All variance items (from rows) */
  variances: VarianceItem[];

  /** Currency formatter */
  formatCurrency: (amount: number) => string;

  /** Callback when a variance item is clicked */
  onVarianceClick?: (item: VarianceItem) => void;
}

export function MonthlySnapshotSummary({
  month,
  totalBudget,
  totalForecast,
  totalActual,
  costBreakdown,
  variances,
  formatCurrency,
  onVarianceClick,
}: MonthlySnapshotSummaryProps) {
  // Calculate total variance
  const totalVarianceBudget = totalForecast - totalBudget;
  const totalVarianceBudgetPercent =
    totalBudget > 0 ? (totalVarianceBudget / totalBudget) * 100 : null;

  // Get top 5 positive (overspend) and top 5 negative (savings) variances
  const { topPositive, topNegative } = useMemo(() => {
    const positive = [...variances]
      .filter((v) => v.varianceBudget > 0)
      .sort((a, b) => b.varianceBudget - a.varianceBudget)
      .slice(0, 5);

    const negative = [...variances]
      .filter((v) => v.varianceBudget < 0)
      .sort((a, b) => a.varianceBudget - b.varianceBudget)
      .slice(0, 5);

    return { topPositive: positive, topNegative: negative };
  }, [variances]);

  // Format variance with color
  const formatVariance = (value: number, percent: number | null) => {
    const isPositive = value > 0;
    const color = isPositive
      ? "text-red-600"
      : value < 0
      ? "text-green-600"
      : "text-muted-foreground";
    const sign = isPositive ? "+" : "";

    // For percent, only add '+' for positive values; negative values show '-' automatically via toFixed()
    const percentSign = percent !== null && percent > 0 ? "+" : "";
    const percentText =
      percent !== null ? `${percentSign}${percent.toFixed(1)}%` : "—";

    return {
      text: `${sign}${formatCurrency(value)}`,
      percentText,
      color,
    };
  };

  const totalVariance = formatVariance(
    totalVarianceBudget,
    totalVarianceBudgetPercent
  );

  return (
    <Card className="border-2">
      <CardContent className="p-4 space-y-4">
        {/* Top-line KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Presupuesto</div>
            <div className="text-lg font-semibold">
              {totalBudget > 0 ? formatCurrency(totalBudget) : "—"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Pronóstico</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totalForecast)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Real</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totalActual)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Var vs Presupuesto
            </div>
            <div className={`text-lg font-semibold ${totalVariance.color}`}>
              <div>{totalVariance.text}</div>
              <div className="text-sm">({totalVariance.percentText})</div>
            </div>
          </div>
        </div>

        {/* Labor vs Non-Labor Breakdown */}
        {costBreakdown && (
          <div className="border-t pt-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Distribución por tipo de costo</span>
              <span>
                Labor {costBreakdown.laborPct.toFixed(0)}% · No Labor{" "}
                {costBreakdown.nonLaborPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
              {costBreakdown.laborPct > 0 && (
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${costBreakdown.laborPct}%` }}
                />
              )}
              {costBreakdown.nonLaborPct > 0 && (
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${costBreakdown.nonLaborPct}%` }}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md bg-blue-50 px-2 py-1">
                <div className="text-[11px] text-blue-700">Labor</div>
                <div className="font-semibold">
                  {formatCurrency(costBreakdown.laborTotal)}
                </div>
              </div>
              <div className="rounded-md bg-emerald-50 px-2 py-1 text-right">
                <div className="text-[11px] text-emerald-700">No Labor</div>
                <div className="font-semibold">
                  {formatCurrency(costBreakdown.nonLaborTotal)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Variances Section */}
        {(topPositive.length > 0 || topNegative.length > 0) && (
          <div className="border-t pt-3 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              Principales Variaciones — M{month}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Top Positive Variances (Overspend) */}
              {topPositive.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs font-medium text-red-600">
                    <TrendingUp className="h-3 w-3" />
                    <span>Sobre Presupuesto</span>
                  </div>
                  <div className="space-y-1">
                    {topPositive.map((item) => {
                      const variance = formatVariance(
                        item.varianceBudget,
                        item.varianceBudgetPercent
                      );
                      return (
                        <Button
                          key={item.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-auto py-1.5 px-2 text-left hover:bg-red-50"
                          onClick={() => onVarianceClick?.(item)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate">
                                {item.name}
                              </span>
                              {item.code && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0"
                                >
                                  {item.code}
                                </Badge>
                              )}
                            </div>
                            <div className={`text-xs ${variance.color}`}>
                              {variance.text} ({variance.percentText})
                            </div>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Negative Variances (Savings) */}
              {topNegative.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <TrendingDown className="h-3 w-3" />
                    <span>Ahorro</span>
                  </div>
                  <div className="space-y-1">
                    {topNegative.map((item) => {
                      const variance = formatVariance(
                        item.varianceBudget,
                        item.varianceBudgetPercent
                      );
                      return (
                        <Button
                          key={item.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-auto py-1.5 px-2 text-left hover:bg-green-50"
                          onClick={() => onVarianceClick?.(item)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate">
                                {item.name}
                              </span>
                              {item.code && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0"
                                >
                                  {item.code}
                                </Badge>
                              )}
                            </div>
                            <div className={`text-xs ${variance.color}`}>
                              {variance.text} ({variance.percentText})
                            </div>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {topPositive.length === 0 && topNegative.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No hay variaciones significativas para mostrar
          </div>
        )}
      </CardContent>
    </Card>
  );
}
