import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';

interface ForecastKpisProps {
  kpis: {
    plannedTotal: number;
    forecastTotal: number;
    actualTotal: number;
    varianceActual: number;
    varianceForecast: number;
    totalFTE?: number;
    currency?: string;
  };
  loading?: boolean;
}

/**
 * ForecastKpis Component
 * 
 * Displays KPI summary cards with planned, forecast, actual totals and variances.
 * Refactored from SDMTForecast to improve modularity.
 */
export function ForecastKpis({ kpis, loading = false }: ForecastKpisProps) {
  // Defensive return if HIDE_REAL_ANNUAL_KPIS flag is set
  if (import.meta.env.VITE_FINZ_HIDE_REAL_ANNUAL_KPIS === 'true') {
    return null;
  }

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp size={14} className="text-red-600" />;
    if (variance < 0) return <TrendingDown size={14} className="text-green-600" />;
    return null;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="h-full animate-pulse">
            <CardContent className="p-3">
              <div className="bg-muted h-8 w-24 rounded mb-2"></div>
              <div className="bg-muted h-4 w-20 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
      {/* Planned Total */}
      <Card className="h-full">
        <CardContent className="p-3">
          <div className="text-xl font-bold">{formatCurrency(kpis.plannedTotal, kpis.currency)}</div>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-xs text-muted-foreground">Total Planeado</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Sum of planned costs imported from Planview baseline</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Total */}
      <Card className="h-full">
        <CardContent className="p-3">
          <div className="text-xl font-bold">{formatCurrency(kpis.forecastTotal, kpis.currency)}</div>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-xs text-muted-foreground">Pronóstico Total</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Adjusted forecast by SDMT based on trends and risk factors</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Actual Total */}
      <Card className="h-full">
        <CardContent className="p-3">
          <div className="text-xl font-bold text-blue-600">{formatCurrency(kpis.actualTotal, kpis.currency)}</div>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-xs text-muted-foreground">Total Real</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Actual expenses recorded in system from reconciled invoices</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Total FTE */}
      <Card className="h-full">
        <CardContent className="p-3">
          <div className="text-xl font-bold">{kpis.totalFTE?.toLocaleString() || '0'}</div>
          <p className="text-xs text-muted-foreground mt-1">Total FTE</p>
        </CardContent>
      </Card>

      {/* Variance Forecast */}
      <Card className="h-full">
        <CardContent className="p-3">
          <div className={`text-xl font-bold ${kpis.varianceForecast >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(Math.abs(kpis.varianceForecast), kpis.currency)}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {getVarianceIcon(kpis.varianceForecast)}
            <p className="text-xs text-muted-foreground">Variación Pronóstico</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Difference between forecast and planned (Forecast - Planned)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">
            {kpis.plannedTotal > 0 ? Math.abs((kpis.varianceForecast / kpis.plannedTotal) * 100).toFixed(1) : '0'}%
          </p>
        </CardContent>
      </Card>

      {/* Variance Actual */}
      <Card className="h-full">
        <CardContent className="p-3">
          <div className={`text-xl font-bold ${kpis.varianceActual >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(Math.abs(kpis.varianceActual), kpis.currency)}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {getVarianceIcon(kpis.varianceActual)}
            <p className="text-xs text-muted-foreground">Variación Real</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">Difference between actual and planned (Actual - Planned)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">
            {kpis.plannedTotal > 0 ? Math.abs((kpis.varianceActual / kpis.plannedTotal) * 100).toFixed(1) : '0'}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
