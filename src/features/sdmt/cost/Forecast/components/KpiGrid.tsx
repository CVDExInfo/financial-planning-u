/**
 * KpiGrid Component
 * Unified KPI grid with 6 cards showing key forecast metrics
 */

import { Card, CardContent } from '@/components/ui/card';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KpiGridProps {
  totalPlanned: number;
  totalForecast: number;
  totalActual: number;
  totalFTE: number;
  totalVariance: number;
  variancePercentage: number;
  actualVariance: number;
  actualVariancePercentage: number;
  formatCurrency: (amount: number) => string;
}

export function KpiGrid({
  totalPlanned,
  totalForecast,
  totalActual,
  totalFTE,
  totalVariance,
  variancePercentage,
  actualVariance,
  actualVariancePercentage,
  formatCurrency,
}: KpiGridProps) {
  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp size={14} className="text-red-600" />;
    if (variance < 0) return <TrendingDown size={14} className="text-green-600" />;
    return null;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      {/* Total Planeado */}
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{formatCurrency(totalPlanned)}</div>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-sm text-muted-foreground">Total Planeado</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Suma de costos planificados importados desde Planview baseline</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground mt-1">De Planview</p>
        </CardContent>
      </Card>

      {/* Pronóstico Total */}
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{formatCurrency(totalForecast)}</div>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-sm text-muted-foreground">Pronóstico Total</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Pronóstico ajustado por SDMT basado en tendencias y factores de riesgo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pronóstico Ajustado</p>
        </CardContent>
      </Card>

      {/* Total Real */}
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalActual)}</div>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-sm text-muted-foreground">Total Real</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Gastos reales registrados en el sistema desde facturas conciliadas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Seguimiento SDMT</p>
        </CardContent>
      </Card>

      {/* Total FTE */}
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{totalFTE.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground mt-1">Total FTE</p>
          <p className="text-xs text-muted-foreground mt-1">Basado en rubros de baseline</p>
        </CardContent>
      </Card>

      {/* Variación de Pronóstico */}
      <Card>
        <CardContent className="p-4">
          <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(Math.abs(totalVariance))}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {getVarianceIcon(totalVariance)}
            <p className="text-sm text-muted-foreground">Variación Pronóstico</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Diferencia entre pronóstico y planificado (Forecast - Planned)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{Math.abs(variancePercentage).toFixed(1)}%</p>
        </CardContent>
      </Card>

      {/* Variación Real */}
      <Card>
        <CardContent className="p-4">
          <div className={`text-2xl font-bold ${actualVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(Math.abs(actualVariance))}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {getVarianceIcon(actualVariance)}
            <p className="text-sm text-muted-foreground">Variación Real</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Diferencia entre gastos reales y planificado (Actual - Planned)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{Math.abs(actualVariancePercentage).toFixed(1)}%</p>
        </CardContent>
      </Card>
    </div>
  );
}
