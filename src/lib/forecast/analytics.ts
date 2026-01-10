export type ForecastTotalsInput = {
  month: number;
  planned?: number | null;
  forecast?: number | null;
  actual?: number | null;
};

export type MonthlyTotals = {
  planned: number;
  forecast: number;
  actual: number;
  varianceForecast: number;
  varianceActual: number;
  varianceForecastPercent: number;
  varianceActualPercent: number;
};

export type OverallTotals = {
  planned: number;
  forecast: number;
  actual: number;
  varianceForecast: number;
  varianceActual: number;
  varianceForecastPercent: number;
  varianceActualPercent: number;
};

export type TotalsResult = {
  months: number[];
  byMonth: Record<number, MonthlyTotals>;
  overall: OverallTotals;
};

const toNumber = (value?: number | null) => Number(value || 0);

const buildMonthTotals = (): MonthlyTotals => ({
  planned: 0,
  forecast: 0,
  actual: 0,
  varianceForecast: 0,
  varianceActual: 0,
  varianceForecastPercent: 0,
  varianceActualPercent: 0,
});

export function computeTotals(
  rows: ForecastTotalsInput[],
  months: number[]
): TotalsResult {
  const monthsList = months.length
    ? [...months]
    : Array.from(
        new Set(rows.map((row) => row.month).filter((month) => month > 0))
      ).sort((a, b) => a - b);

  const byMonth: Record<number, MonthlyTotals> = {};
  monthsList.forEach((month) => {
    byMonth[month] = buildMonthTotals();
  });

  rows.forEach((row) => {
    const month = row.month;
    if (!byMonth[month]) {
      byMonth[month] = buildMonthTotals();
    }

    const planned = toNumber(row.planned);
    const forecast = toNumber(row.forecast);
    const actual = toNumber(row.actual);

    byMonth[month].planned += planned;
    byMonth[month].forecast += forecast;
    byMonth[month].actual += actual;
  });

  Object.values(byMonth).forEach((totals) => {
    totals.varianceForecast = totals.forecast - totals.planned;
    totals.varianceActual = totals.actual - totals.planned;
    totals.varianceForecastPercent = totals.planned > 0 ? (totals.varianceForecast / totals.planned) * 100 : 0;
    totals.varianceActualPercent = totals.planned > 0 ? (totals.varianceActual / totals.planned) * 100 : 0;
  });

  const overall = Object.values(byMonth).reduce(
    (acc, monthTotals) => {
      acc.planned += monthTotals.planned;
      acc.forecast += monthTotals.forecast;
      acc.actual += monthTotals.actual;
      return acc;
    },
    {
      planned: 0,
      forecast: 0,
      actual: 0,
      varianceForecast: 0,
      varianceActual: 0,
      varianceForecastPercent: 0,
      varianceActualPercent: 0,
    } as OverallTotals
  );

  overall.varianceForecast = overall.forecast - overall.planned;
  overall.varianceActual = overall.actual - overall.planned;
  overall.varianceForecastPercent =
    overall.planned > 0 ? (overall.varianceForecast / overall.planned) * 100 : 0;
  overall.varianceActualPercent =
    overall.planned > 0 ? (overall.varianceActual / overall.planned) * 100 : 0;

  return {
    months: monthsList,
    byMonth,
    overall,
  };
}

export type VarianceSeriesPoint = {
  month: number;
  plan: number;
  forecast: number;
  actual: number;
  budget?: number;
  forecastVariancePlan: number;
  actualVariancePlan: number;
  forecastVarianceBudget?: number;
  actualVarianceBudget?: number;
};

export function computeVariance({
  plan,
  forecast,
  actual,
  budget,
}: {
  plan: number[];
  forecast: number[];
  actual: number[];
  budget?: number[];
}): VarianceSeriesPoint[] {
  const length = Math.max(
    plan.length,
    forecast.length,
    actual.length,
    budget?.length ?? 0
  );

  return Array.from({ length }, (_, index) => {
    const month = index + 1;
    const planValue = plan[index] ?? 0;
    const forecastValue = forecast[index] ?? 0;
    const actualValue = actual[index] ?? 0;
    const budgetValue = budget?.[index];

    return {
      month,
      plan: planValue,
      forecast: forecastValue,
      actual: actualValue,
      budget: budgetValue,
      forecastVariancePlan: forecastValue - planValue,
      actualVariancePlan: actualValue - planValue,
      forecastVarianceBudget:
        typeof budgetValue === "number" ? forecastValue - budgetValue : undefined,
      actualVarianceBudget:
        typeof budgetValue === "number" ? actualValue - budgetValue : undefined,
    };
  });
}
