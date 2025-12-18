/**
 * ForecastAnalytics Component
 * Analytics section with proper header/export alignment and empty states
 */

import { ChartInsightsPanel } from '@/components/ChartInsightsPanel';
import LineChartComponent from '@/components/charts/LineChart';
import { StackedColumnsChart } from '@/components/charts/StackedColumnsChart';

interface MonthlyTrend {
  month: number;
  Planned: number;
  Forecast: number;
  Actual: number;
  Budget?: number;
}

interface Insight {
  title: string;
  value: string;
  type: 'positive' | 'negative' | 'neutral';
}

interface ForecastAnalyticsProps {
  monthlyTrends: MonthlyTrend[];
  insights: Insight[];
  variancePercentage: number;
  isPortfolioView: boolean;
  budgetSimulationEnabled: boolean;
  budgetTotal: number;
  onExport: () => void;
}

export function ForecastAnalytics({
  monthlyTrends,
  insights,
  variancePercentage,
  isPortfolioView,
  budgetSimulationEnabled,
  budgetTotal,
  onExport,
}: ForecastAnalyticsProps) {
  // Check if we have any data to display
  const hasData = monthlyTrends.some(
    (month) => month.Planned > 0 || month.Forecast > 0 || month.Actual > 0
  );

  const hasVarianceData = monthlyTrends.some(
    (month) => Math.abs(month.Forecast - month.Planned) > 0
  );

  // Build line chart lines dynamically
  const lineChartLines = [
    { dataKey: 'Planned', name: 'Planned', color: 'oklch(0.45 0.12 200)', strokeDasharray: '5 5' },
    { dataKey: 'Forecast', name: 'Forecast', color: 'oklch(0.61 0.15 160)', strokeWidth: 3 },
    { dataKey: 'Actual', name: 'Actual', color: 'oklch(0.72 0.15 65)' },
    // Add Budget line when simulation is enabled
    ...(isPortfolioView && budgetSimulationEnabled && budgetTotal > 0
      ? [{ dataKey: 'Budget', name: 'Budget', color: 'oklch(0.5 0.2 350)', strokeDasharray: '8 4', strokeWidth: 2 }]
      : []),
  ];

  // Variance chart data
  const varianceData = monthlyTrends.map((month) => ({
    month: month.month,
    'Over Budget': Math.max(0, month.Forecast - month.Planned),
    'Under Budget': Math.min(0, month.Forecast - month.Planned),
  }));

  if (!hasData) {
    return (
      <div className="border rounded-lg p-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-muted-foreground font-bold text-xl">📊</span>
          </div>
          <h3 className="text-lg font-medium text-muted-foreground">
            Análisis de pronóstico no disponible
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            No hay datos de pronóstico disponibles aún. Los gráficos y análisis aparecerán aquí
            cuando haya datos de planificación, pronóstico o valores reales.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ChartInsightsPanel
      title="Forecast Analytics & Trends"
      charts={[
        <LineChartComponent
          key="forecast-trends"
          data={monthlyTrends}
          lines={lineChartLines}
          title="Monthly Forecast Trends"
        />,
        hasVarianceData ? (
          <StackedColumnsChart
            key="variance-analysis"
            data={varianceData}
            stacks={[
              { dataKey: 'Over Budget', name: 'Over Budget', color: 'oklch(0.65 0.2 30)' },
              { dataKey: 'Under Budget', name: 'Under Budget', color: 'oklch(0.55 0.15 140)' },
            ]}
            title="Variance Analysis"
          />
        ) : (
          <div key="variance-empty" className="flex items-center justify-center h-[320px] border rounded-lg bg-muted/20">
            <div className="text-center space-y-2 p-6">
              <div className="text-4xl mb-3">📉</div>
              <p className="text-sm font-medium text-muted-foreground">
                No variance data available yet
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Add actuals or adjust forecast to see variance analysis
              </p>
            </div>
          </div>
        ),
      ]}
      insights={insights}
      onExport={onExport}
    />
  );
}
