import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, TrendingUp, BarChart3 } from 'lucide-react';

/**
 * Props for ChartsPanelV2 component
 */
interface ChartsPanelV2Props {
  monthlyTrends: Array<{ month: number; value: number }>;
  varianceSeries: Array<{ month: number; value: number }>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isPortfolioView: boolean;
  monthlyBudgets?: number[];
}

/**
 * ChartsPanelV2 - Collapsible panel with trend and variance charts
 * 
 * @component
 * @param {ChartsPanelV2Props} props - Component props
 * @returns {JSX.Element | null} Charts panel for portfolio view
 */
export function ChartsPanelV2({
  monthlyTrends,
  varianceSeries,
  isOpen,
  onOpenChange,
  isPortfolioView,
  monthlyBudgets,
}: ChartsPanelV2Props) {
  if (!isPortfolioView) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate KPIs from trends and variance data
  const totalTrend = monthlyTrends.reduce((sum, item) => sum + item.value, 0);
  const avgTrend = monthlyTrends.length > 0 ? totalTrend / monthlyTrends.length : 0;
  const totalVariance = varianceSeries.reduce((sum, item) => sum + item.value, 0);
  const avgVariance = varianceSeries.length > 0 ? totalVariance / varianceSeries.length : 0;

  const chartKpis = [
    {
      label: 'Tendencia Promedio',
      value: formatCurrency(avgTrend),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Varianza Total',
      value: formatCurrency(totalVariance),
      icon: BarChart3,
      color: totalVariance >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: totalVariance >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
    {
      label: 'Varianza Promedio',
      value: formatCurrency(avgVariance),
      icon: BarChart3,
      color: avgVariance >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: avgVariance >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Análisis Gráfico - Vista Portafolio</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={isOpen ? 'Colapsar' : 'Expandir'}>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* KPI Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {chartKpis.map((kpi, index) => {
                const Icon = kpi.icon;
                return (
                  <div
                    key={index}
                    className={`${kpi.bgColor} rounded-lg p-4`}
                    role="region"
                    aria-label={`${kpi.label}: ${kpi.value}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">{kpi.label}</span>
                      <Icon className={`h-5 w-5 ${kpi.color}`} aria-hidden="true" />
                    </div>
                    <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Monthly Budget Info */}
            {monthlyBudgets && monthlyBudgets.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Presupuesto Mensual</h4>
                <p className="text-xs text-muted-foreground">
                  Total de {monthlyBudgets.length} meses configurados
                </p>
              </div>
            )}

            {/* Line Chart for Trends - Placeholder */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Tendencia Mensual
              </h4>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 flex items-center justify-center bg-muted/10"
                role="img"
                aria-label="Gráfico de tendencias mensuales - En desarrollo"
              >
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Gráfico de Líneas - Tendencia Mensual</p>
                  <p className="text-xs mt-1">
                    {monthlyTrends.length} puntos de datos
                  </p>
                </div>
              </div>
            </div>

            {/* Stacked Column Chart for Variance - Placeholder */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Análisis de Varianza
              </h4>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 flex items-center justify-center bg-muted/10"
                role="img"
                aria-label="Gráfico de varianza - En desarrollo"
              >
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Gráfico de Columnas Apiladas - Varianza</p>
                  <p className="text-xs mt-1">
                    {varianceSeries.length} puntos de datos
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
