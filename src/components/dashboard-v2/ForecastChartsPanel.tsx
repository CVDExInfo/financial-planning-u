/**
 * ForecastChartsPanel Component - SKELETON/STUB
 * 
 * Position #5: Charts panel with trend and variance visualizations
 * 
 * TODO: Full implementation with LineChart and StackedColumns required
 */

import type { PortfolioForecastData } from '@/hooks/useDashboardData';

export interface ForecastChartsPanelProps {
  data: PortfolioForecastData;
  months: number;
}

export function ForecastChartsPanel(props: ForecastChartsPanelProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-semibold mb-4">Charts (STUB)</div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 bg-gray-50 rounded flex items-center justify-center text-gray-400">
          Trend Chart
        </div>
        <div className="h-64 bg-gray-50 rounded flex items-center justify-center text-gray-400">
          Variance Chart
        </div>
      </div>
    </div>
  );
}
