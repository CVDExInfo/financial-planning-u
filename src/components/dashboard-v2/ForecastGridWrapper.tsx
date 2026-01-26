/**
 * ForecastGridWrapper Component - SKELETON/STUB
 * 
 * Position #3: Wrapper for virtualized forecast grid
 * Handles data preparation and save state management
 * 
 * TODO: Full implementation with ForecastGrid integration required
 */

import type { PortfolioForecastData } from '@/hooks/useDashboardData';

export interface ForecastGridWrapperProps {
  data: PortfolioForecastData;
  months: number;
  year: number;
  canEdit: boolean;
}

export function ForecastGridWrapper(props: ForecastGridWrapperProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-semibold mb-4">Forecast Grid (STUB)</div>
      <div className="text-sm text-gray-600">
        Virtualized grid will render {props.data.rubros.length} rubros × {props.months} months
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Edit mode: {props.canEdit ? 'Enabled' : 'Disabled'}
      </div>
    </div>
  );
}
