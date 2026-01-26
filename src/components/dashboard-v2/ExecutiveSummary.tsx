/**
 * ExecutiveSummary Component - SKELETON/STUB
 * 
 * Position #1: KPI strip showing portfolio-level summary metrics
 * 
 * TODO: Full implementation with KPI cards required
 */

export interface ExecutiveSummaryProps {
  summary: {
    totalPlanned: number;
    totalActual: number;
    totalForecast: number;
    variance: number;
    variancePercent: number;
    runwayMonths?: number;
    budgetUtilization?: number;
  };
  metadata: {
    generatedAt: string;
    year: number;
    months: number;
    currency: string;
  };
}

export function ExecutiveSummary(props: ExecutiveSummaryProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-semibold mb-2">Executive Summary (STUB)</div>
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-500">Planned</div>
          <div className="font-semibold">${(props.summary.totalPlanned / 100).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-500">Forecast</div>
          <div className="font-semibold">${(props.summary.totalForecast / 100).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-500">Actual</div>
          <div className="font-semibold">${(props.summary.totalActual / 100).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-500">Variance</div>
          <div className={`font-semibold ${props.summary.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${(props.summary.variance / 100).toFixed(2)} ({props.summary.variancePercent.toFixed(1)}%)
          </div>
        </div>
      </div>
    </div>
  );
}
