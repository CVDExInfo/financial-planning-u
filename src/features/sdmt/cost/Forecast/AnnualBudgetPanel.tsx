import { useEffect, useState } from 'react';
import { AnnualBudgetWidget } from '@/components/budget/AnnualBudgetWidget';
import { getFinanzasClient } from '@/api/finanzas';
import { toast } from 'sonner';

interface HubSummaryResponse {
  year?: number;
  forecast?: {
    totalPlannedFromPlanview: number;
    totalAdjustedForecastPMO: number;
    forecastVariance: number;
    forecastVariancePercent: number;
    hasPMOAdjustments: boolean;
  };
}

export function AnnualBudgetPanel() {
  const currentYear = new Date().getFullYear();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<HubSummaryResponse | null>(null);

  useEffect(() => {
    loadSummary(currentYear);
  }, []);

  async function loadSummary(year: number) {
    setLoading(true);
    try {
      const client = getFinanzasClient();
      const data = await client.get<HubSummaryResponse>(
        `/finanzas/hub/summary?scope=ALL&year=${year}`
      );
      setSummary(data);
    } catch (error) {
      console.error('Failed to load hub summary for annual budget panel', error);
      toast.error('No se pudo cargar el pronóstico ajustado para el presupuesto anual');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !summary) return null;

  const widgetYear = summary?.year ?? currentYear;
  const totalAdjustedForecast = summary?.forecast?.totalAdjustedForecastPMO ?? 0;

  return (
    <AnnualBudgetWidget
      year={widgetYear}
      totalAdjustedForecast={totalAdjustedForecast}
      onBudgetUpdate={() => {
        // Reload summary when budget is updated to refresh variance calculations
        loadSummary(widgetYear);
      }}
    />
  );
}
