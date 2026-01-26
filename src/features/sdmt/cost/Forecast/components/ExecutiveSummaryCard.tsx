import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Target, Activity } from 'lucide-react';

/**
 * Props for ExecutiveSummaryCard component
 */
interface ExecutiveSummaryCardProps {
  summaryBarKpis: {
    presupuesto: number;
    pronostico: number;
    real: number;
    consumo: number; // percentage
    varianza: number;
  } | null;
}

/**
 * ExecutiveSummaryCard - Displays KPI tiles for budget, forecast, actual, consumption, and variance
 * 
 * @component
 * @param {ExecutiveSummaryCardProps} props - Component props
 * @returns {JSX.Element} Executive summary card with KPI tiles
 */
export function ExecutiveSummaryCard({ summaryBarKpis }: ExecutiveSummaryCardProps) {
  if (!summaryBarKpis) {
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

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const kpis = [
    {
      title: 'Presupuesto',
      value: formatCurrency(summaryBarKpis.presupuesto),
      icon: DollarSign,
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
    },
    {
      title: 'Pronóstico',
      value: formatCurrency(summaryBarKpis.pronostico),
      icon: Target,
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
    },
    {
      title: 'Real',
      value: formatCurrency(summaryBarKpis.real),
      icon: Activity,
      colorClass: 'text-green-600',
      bgClass: 'bg-green-50',
    },
    {
      title: 'Consumo',
      value: formatPercentage(summaryBarKpis.consumo),
      icon: Activity,
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-50',
    },
    {
      title: 'Varianza',
      value: formatCurrency(summaryBarKpis.varianza),
      icon: summaryBarKpis.varianza >= 0 ? TrendingUp : TrendingDown,
      colorClass: summaryBarKpis.varianza >= 0 ? 'text-green-600' : 'text-red-600',
      bgClass: summaryBarKpis.varianza >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Ejecutivo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {kpis.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <div
                key={index}
                className={`${kpi.bgClass} rounded-lg p-4 transition-all hover:shadow-md`}
                role="region"
                aria-label={`${kpi.title}: ${kpi.value}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">{kpi.title}</span>
                  <Icon className={`h-5 w-5 ${kpi.colorClass}`} aria-hidden="true" />
                </div>
                <p className={`text-xl font-bold ${kpi.colorClass}`}>{kpi.value}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
