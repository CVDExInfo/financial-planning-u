import { toMonthKey } from "./modSeries";

export type NormalizedModRow = {
  projectId?: string;
  month?: string;
  monthKey?: string;
  startMonth?: string;
  months?: number;
  monthlyAmount?: number;
  amount?: number;
  totalActualMOD?: number;
  totalPlanMOD?: number;
  totalForecastMOD?: number;
  paymentDate?: string;
  paidAt?: string;
  kind?: string;
  __orig: any;
  [key: string]: any;
};

const coerceNumber = (value: any): number | undefined => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const extractProjectId = (row: any): string | undefined => {
  const pkProject =
    typeof row?.pk === "string" && row.pk.startsWith("PROJECT#")
      ? row.pk.replace(/^PROJECT#/, "")
      : undefined;

  return (
    row?.projectId ||
    row?.project_id ||
    row?.projectCode ||
    row?.project_code ||
    pkProject ||
    undefined
  );
};

const extractMonthFromSk = (row: any): string | undefined => {
  const sk = row?.sk;
  if (typeof sk !== "string") return undefined;

  const match = sk.match(/#(\d{4}-\d{2})/);
  return match ? match[1] : undefined;
};

const extractMonth = (row: any): string | undefined => {
  const monthKey =
    toMonthKey(
      row?.month ||
        row?.period ||
        row?.fecha ||
        row?.monthKey ||
        row?.paymentDate ||
        row?.paidAt ||
        row?.date,
    ) || extractMonthFromSk(row);

  return monthKey || undefined;
};

const extractStartMonth = (row: any): string | undefined =>
  toMonthKey(
    row?.startMonth ||
      row?.start_month ||
      row?.startDate ||
      row?.start_date ||
      row?.fecha_inicio,
  ) || extractMonthFromSk(row) || undefined;

export function normalizeApiRowForMod(row: any): NormalizedModRow {
  const projectId = extractProjectId(row);
  const month = extractMonth(row);
  const startMonth = extractStartMonth(row);
  const months =
    coerceNumber(row?.months ?? row?.duration_months ?? row?.meses) ||
    undefined;
  const monthlyAmount =
    coerceNumber(
      row?.monthlyAmount ??
        row?.monto_mensual ??
        row?.monthly_amount ??
        (row?.unit_cost && row?.qty
          ? coerceNumber(row.unit_cost) * coerceNumber(row.qty)
          : undefined),
    ) || undefined;

  const amount =
    coerceNumber(row?.amount ?? row?.monto ?? row?.value ?? row?.total) ||
    undefined;

  const totalActualMOD =
    coerceNumber(
      row?.totalActualMOD ?? row?.totalActual ?? row?.actual ?? row?.modReal,
    ) || amount;
  const totalPlanMOD =
    coerceNumber(
      row?.totalPlanMOD ??
        row?.totalPlan ??
        row?.plan ??
        row?.modPlan ??
        row?.total,
    ) || monthlyAmount;
  const totalForecastMOD =
    coerceNumber(
      row?.totalForecastMOD ??
        row?.totalAdjusted ??
        row?.adjusted ??
        row?.projection ??
        row?.total_forecast,
    ) || undefined;

  const paymentDate = row?.paymentDate || row?.paidAt || row?.fecha || row?.date;

  const rawDistribution = row?.distribucion || row?.distribution;
  const normalizedDistribution = Array.isArray(rawDistribution)
    ? rawDistribution
        .map((entry: any) => {
          const entryMonth = toMonthKey(
            entry?.mes || entry?.month || entry?.fecha || entry?.period,
          );
          const entryAmount =
            coerceNumber(entry?.monto ?? entry?.amount ?? entry?.valor ?? entry?.value) ??
            undefined;

          return {
            ...entry,
            mes: entryMonth || entry?.mes,
            month: entryMonth || entry?.month,
            monto: typeof entryAmount !== "undefined" ? entryAmount : entry?.monto,
            amount: typeof entryAmount !== "undefined" ? entryAmount : entry?.amount,
          };
        })
        .filter(Boolean)
    : undefined;

  return {
    projectId,
    month: month || undefined,
    monthKey: month || undefined,
    startMonth,
    months,
    monthlyAmount,
    amount,
    totalActualMOD,
    totalPlanMOD,
    totalForecastMOD,
    paymentDate,
    paidAt: paymentDate,
    kind: row?.kind || row?.tipo || row?.type,
    ...(normalizedDistribution
      ? { distribucion: normalizedDistribution, distribution: normalizedDistribution }
      : {}),
    __orig: row,
  };
}
