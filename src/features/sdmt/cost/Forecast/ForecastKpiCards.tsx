import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';

interface ForecastKpiCardsProps {
  kpis: {
    plannedTotal: number;
    forecastTotal: number;
    actualTotal: number;
    varianceActual: number;
    varianceForecast: number;
    currency?: string;
  };
  loading?: boolean;
}

/**
 * ForecastKpiCards Component
 * 
 * Displays KPI summary cards with planned, forecast, actual totals and variances.
 * Extracted from SDMTForecast to improve modularity.
 */
export function ForecastKpiCards({ kpis, loading = false }: ForecastKpiCardsProps) {
  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium bg-muted h-4 w-20 rounded"></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted h-8 w-24 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Planned Total */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Planned Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(kpis.plannedTotal, kpis.currency)}
          </div>
        </CardContent>
      </Card>

      {/* Forecast Total */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Forecast Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(kpis.forecastTotal, kpis.currency)}
          </div>
        </CardContent>
      </Card>

      {/* Actual Total */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Actual Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(kpis.actualTotal, kpis.currency)}
          </div>
        </CardContent>
      </Card>

      {/* Variance Actual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
            Variance (Actual)
            {kpis.varianceActual !== 0 && (
              kpis.varianceActual > 0 ? (
                <TrendingUp className="ml-1 h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="ml-1 h-4 w-4 text-green-500" />
              )
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            kpis.varianceActual > 0 ? 'text-red-600' : 
            kpis.varianceActual < 0 ? 'text-green-600' : 
            'text-gray-600'
          }`}>
            {formatCurrency(kpis.varianceActual, kpis.currency)}
          </div>
        </CardContent>
      </Card>

      {/* Variance Forecast */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
            Variance (Forecast)
            {kpis.varianceForecast !== 0 && (
              kpis.varianceForecast > 0 ? (
                <TrendingUp className="ml-1 h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="ml-1 h-4 w-4 text-green-500" />
              )
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            kpis.varianceForecast > 0 ? 'text-red-600' : 
            kpis.varianceForecast < 0 ? 'text-green-600' : 
            'text-gray-600'
          }`}>
            {formatCurrency(kpis.varianceForecast, kpis.currency)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
