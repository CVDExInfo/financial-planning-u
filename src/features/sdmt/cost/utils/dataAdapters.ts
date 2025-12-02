import type { ForecastCell, LineItem } from "@/types/domain";

const normalizeRubroId = (id?: string): string => {
  if (!id) return "";
  return id.replace(/^RUBRO#?/i, "").replace(/^LINEITEM#?/i, "").trim();
};

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const normalizeLineItemFromApi = (raw: any): LineItem => {
  const id = normalizeRubroId(
    raw?.id || raw?.rubro_id || raw?.rubroId || raw?.line_item_id || raw?.lineItemId
  );
  const startMonth = toNumber(raw?.start_month ?? raw?.startMonth, 1) || 1;
  const recurringFlag = Boolean(raw?.recurring);
  const oneTimeFlag = raw?.one_time !== undefined ? Boolean(raw.one_time) : !recurringFlag;

  return {
    id,
    category: raw?.category || raw?.categoria || raw?.linea_codigo || "Rubro",
    subtype: raw?.subtype || raw?.tipo_costo,
    vendor: raw?.vendor,
    description: raw?.description || raw?.nombre || raw?.descripcion || id || "Rubro",
    one_time: oneTimeFlag,
    recurring: recurringFlag,
    qty: toNumber(raw?.qty ?? raw?.quantity ?? raw?.cantidad, 1) || 1,
    unit_cost: toNumber(raw?.unit_cost ?? raw?.unitCost ?? raw?.amount ?? raw?.monto),
    currency: (raw?.currency || raw?.moneda || "USD") as LineItem["currency"],
    fx_pair: raw?.fx_pair,
    fx_rate_at_booking: raw?.fx_rate_at_booking
      ? toNumber(raw.fx_rate_at_booking)
      : undefined,
    start_month: startMonth,
    end_month: toNumber(raw?.end_month ?? raw?.endMonth, recurringFlag ? 12 : startMonth) ||
      (recurringFlag ? 12 : startMonth),
    amortization: (raw?.amortization as LineItem["amortization"]) || "none",
    capex_flag: Boolean(raw?.capex_flag),
    cost_center: raw?.cost_center,
    gl_code: raw?.gl_code,
    tax_pct: raw?.tax_pct ? toNumber(raw.tax_pct) : undefined,
    indexation_policy: (raw?.indexation_policy as LineItem["indexation_policy"]) || "none",
    attachments: Array.isArray(raw?.attachments) ? raw.attachments : [],
    notes: raw?.notes,
    created_at: raw?.created_at || new Date().toISOString(),
    updated_at: raw?.updated_at || new Date().toISOString(),
    created_by: raw?.created_by || "finanzas-api",
    service_tier: raw?.tier || raw?.service_tier,
    service_type: raw?.service_type,
    sla_uptime: raw?.sla_uptime,
    deliverable: raw?.deliverable,
    max_participants: raw?.max_participants
      ? toNumber(raw.max_participants)
      : undefined,
    duration_days: raw?.duration_days ? toNumber(raw.duration_days) : undefined,
    total_cost: raw?.total_cost !== undefined
      ? toNumber(raw.total_cost)
      : toNumber(raw?.totalCost ?? raw?.total_amount ?? raw?.total),
  } satisfies LineItem;
};

export const normalizeForecastCells = (cells: any[]): ForecastCell[] => {
  return (Array.isArray(cells) ? cells : []).map((cell) => {
    const planned = toNumber(
      cell?.planned ?? cell?.amount_planned ?? cell?.planned_amount ?? cell?.plan
    );
    const forecast = toNumber(
      cell?.forecast ?? cell?.amount_forecast ?? cell?.forecast_amount ?? planned
    );
    const actual = toNumber(cell?.actual ?? cell?.amount_actual ?? cell?.actual_amount);
    const month = toNumber(cell?.month ?? cell?.period ?? cell?.month_number, 0);
    const lineItemId = normalizeRubroId(
      cell?.line_item_id || cell?.lineItemId || cell?.rubro_id || cell?.rubroId
    );

    const varianceBase = cell?.variance ?? cell?.forecast_variance;
    const variance =
      varianceBase !== undefined && varianceBase !== null
        ? toNumber(varianceBase)
        : forecast - planned;

    return {
      line_item_id: lineItemId,
      month,
      planned,
      forecast,
      actual,
      variance,
      variance_reason: cell?.variance_reason,
      notes: cell?.notes,
      last_updated: cell?.last_updated || cell?.updated_at || "",
      updated_by: cell?.updated_by || cell?.user || "",
    } satisfies ForecastCell;
  });
};

export { normalizeRubroId };
