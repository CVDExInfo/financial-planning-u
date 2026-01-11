/**
 * ForecastSummaryBar Component
 * 
 * Executive KPI summary bar for TODOS (All Projects) mode in SDMT Forecast.
 * Displays key financial metrics including budget, forecast, actual, consumption, and variance.
 * 
 * Only shown in portfolio view when budget data is available.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';
import { useMemo } from 'react';

interface ForecastSummaryBarProps {
  totalBudget: number;
  totalForecast: number;
  totalActual: number;
  consumedPercent: number;
  varianceBudget: number;
  varianceBudgetPercent: number;
  useMonthlyBudget: boolean;
  lastUpdated: string | null;
  updatedBy: string | null;
  monthlyBudgetSum: number;
  budgetAllIn: number;
}

export function ForecastSummaryBar({
  totalBudget,
  totalForecast,
  totalActual,
  consumedPercent,
  varianceBudget,
  varianceBudgetPercent,
  useMonthlyBudget,
  lastUpdated,
  updatedBy,
  monthlyBudgetSum,
  budgetAllIn,
}: ForecastSummaryBarProps) {
  // Check for budget parity issue: if both monthly and annual budgets exist and differ by > 1%
  const hasBudgetParityIssue = useMemo(() => {
    if (monthlyBudgetSum > 0 && budgetAllIn > 0) {
      const percentDiff = Math.abs((monthlyBudgetSum - budgetAllIn) / budgetAllIn) * 100;
      return percentDiff > 1;
    }
    return false;
  }, [monthlyBudgetSum, budgetAllIn]);

  // Format currency with USD symbol
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format percentage with 1 decimal place
  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Determine color for variance badge
  const getVarianceColor = (variance: number, percent: number): string => {
    if (totalBudget === 0) {
      return 'bg-muted text-muted-foreground';
    }
    
    // Green if under budget (negative variance = forecast < budget)
    if (variance < 0) {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    
    // Red if over budget (positive variance = forecast > budget)
    if (variance > 0) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    
    // Neutral if within 5% tolerance
    if (Math.abs(percent) < 5) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    
    return 'bg-muted text-muted-foreground';
  };

  // Determine color for consumption percentage
  const getConsumptionColor = (percent: number): string => {
    if (totalBudget === 0) {
      return 'text-muted-foreground';
    }
    
    if (percent > 100) {
      return 'text-red-600';
    }
    if (percent > 90) {
      return 'text-yellow-600';
    }
    return 'text-green-600';
  };

  // Get icon for variance
  const getVarianceIcon = (variance: number) => {
    if (variance > 0) {
      return <TrendingUp size={16} className="text-red-600" />;
    }
    if (variance < 0) {
      return <TrendingDown size={16} className="text-green-600" />;
    }
    return null;
  };

  // Format last updated date
  const formatLastUpdated = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Budget Health Status Logic
  // - consumption <= 90% and forecast <= budget => "En Meta" (green)
  // - consumption > 90% and forecast <= budget => "En Riesgo" (yellow)
  // - forecast > budget OR consumption > 100% => "Sobre Presupuesto" (red)
  const getBudgetHealthStatus = (): {
    label: string;
    color: string;
    bgColor: string;
  } => {
    if (totalBudget === 0) {
      return {
        label: 'Sin Presupuesto',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
      };
    }

    const isForecastOverBudget = totalForecast > totalBudget;
    const isConsumptionOver100 = consumedPercent > 100;
    const isConsumptionOver90 = consumedPercent > 90;

    if (isForecastOverBudget || isConsumptionOver100) {
      return {
        label: 'Sobre Presupuesto',
        color: 'text-red-700',
        bgColor: 'bg-red-100 border-red-200',
      };
    }

    if (isConsumptionOver90) {
      return {
        label: 'En Riesgo',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100 border-yellow-200',
      };
    }

    return {
      label: 'En Meta',
      color: 'text-green-700',
      bgColor: 'bg-green-100 border-green-200',
    };
  };

  const budgetHealth = getBudgetHealthStatus();

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Title and Budget Health Pill Row */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              Resumen Ejecutivo - Cartera Completa
            </h3>
            <div className="flex items-center gap-2">
              <Badge
                className={`${budgetHealth.bgColor} ${budgetHealth.color} border px-3 py-1 font-medium`}
              >
                {budgetHealth.label}
              </Badge>
              {hasBudgetParityIssue && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300 px-3 py-1 font-medium cursor-help"
                      >
                        Presupuesto mensual ≠ Presupuesto anual
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs max-w-xs space-y-1">
                        <p className="font-semibold">Diferencia detectada entre presupuestos:</p>
                        <p>• Suma mensual: {formatCurrency(monthlyBudgetSum)}</p>
                        <p>• Presupuesto anual: {formatCurrency(budgetAllIn)}</p>
                        <p className="mt-2 text-amber-200">
                          Se está usando {useMonthlyBudget ? 'presupuesto mensual' : 'presupuesto anual'} para cálculos.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Total Budget */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Presupuesto Total (All-In)
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Presupuesto anual total (suma de presupuestos mensuales o distribución automática)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-xl font-bold text-primary">
                {totalBudget > 0 ? formatCurrency(totalBudget) : 'No definido'}
              </div>
            </div>

            {/* Total Forecast */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Pronóstico Total
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Suma de pronósticos de todos los proyectos
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-xl font-bold text-foreground">
                {formatCurrency(totalForecast)}
              </div>
            </div>

            {/* Total Actual */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Real Total
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Suma de gastos reales de todos los proyectos
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-xl font-bold text-blue-600">
                {formatCurrency(totalActual)}
              </div>
            </div>

            {/* % Consumed */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  % Consumo (Real/Budget)
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Porcentaje del presupuesto consumido por gastos reales (Actual / Budget × 100)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className={`text-xl font-bold ${getConsumptionColor(consumedPercent)}`}>
                {totalBudget > 0 ? formatPercent(consumedPercent) : '—'}
              </div>
              {totalBudget > 0 && consumedPercent > 100 && (
                <Badge variant="destructive" className="text-[10px] w-fit">
                  Sobre presupuesto
                </Badge>
              )}
              {totalBudget > 0 && consumedPercent > 90 && consumedPercent <= 100 && (
                <Badge variant="outline" className="text-[10px] w-fit border-yellow-600 text-yellow-700">
                  Advertencia
                </Badge>
              )}
            </div>

            {/* Variance vs Budget */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Desviación vs Presupuesto
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Diferencia entre pronóstico y presupuesto (Forecast - Budget)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {totalBudget > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    {getVarianceIcon(varianceBudget)}
                    <span className={`text-xl font-bold ${varianceBudget >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {varianceBudget >= 0 ? '+' : ''}{formatCurrency(varianceBudget)}
                    </span>
                  </div>
                  <Badge className={`text-[10px] w-fit ${getVarianceColor(varianceBudget, varianceBudgetPercent)}`}>
                    {varianceBudget >= 0 ? '+' : ''}{formatPercent(varianceBudgetPercent)}
                    {Math.abs(varianceBudgetPercent) < 5 && ' · On Budget'}
                  </Badge>
                </>
              ) : (
                <div className="text-xl font-bold text-muted-foreground">—</div>
              )}
            </div>
          </div>

          {/* Last Updated Info */}
          {lastUpdated && (
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground pt-2 border-t">
              <span>
                Presupuesto actualizado: {formatLastUpdated(lastUpdated)}
                {updatedBy && ` – ${updatedBy}`}
              </span>
            </div>
          )}

          {/* No Budget Message */}
          {totalBudget === 0 && (
            <div className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2 border border-amber-200">
              ℹ️ Presupuesto no configurado. Configure el presupuesto mensual o anual para ver métricas de consumo y desviación.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
