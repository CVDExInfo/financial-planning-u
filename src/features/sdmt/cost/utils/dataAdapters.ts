import type { ForecastCell, LineItem } from "@/types/domain";

const normalizeRubroId = (id?: string): string => {
  if (!id) return "";
  return id.replace(/^RUBRO#?/i, "").replace(/^LINEITEM#?/i, "").trim();
};

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

/**
 * Labor keyword patterns for category detection (English/Spanish)
 * Matches common labor-related terms in categories, roles, and descriptions
 */
const LABOR_KEYWORDS = [
  /\blabor\b/i,
  /\blabour\b/i,
  /mano\s*de\s*obra/i,
  /\bmod\b/i,
  /\bfte\b/i,
  /ingenier[oía]/i,
  /engineer/i,
  /\bmanager\b/i,
  /project\s*manager/i,
  /service\s*delivery\s*manager/i,
  /\bsdm\b/i,
  /\bpm\b/i,
  /soporte/i,
  /support/i,
  /delivery/i,
  /lead/i,
  /líder/i,
] as const;

/**
 * Canonicalize category to ensure labor roles are properly categorized
 * Returns "Labor" for labor-related items, or the original/fallback category
 */
const canonicalizeCategory = (raw: any): string => {
  // Extract potential category values
  const rawCategory = (raw?.category || raw?.categoria || raw?.linea_codigo || "").toString().trim();
  const role = (raw?.role || raw?.rol || "").toString().trim();
  const description = (raw?.description || raw?.nombre || raw?.descripcion || "").toString().trim();
  const subtype = (raw?.subtype || raw?.tipo_costo || "").toString().trim();
  
  // Check if category already indicates labor
  const categoryIsLabor = LABOR_KEYWORDS.some((rx) => rx.test(rawCategory));
  if (categoryIsLabor) {
    return "Labor";
  }
  
  // Check role, description, and subtype for labor indicators
  const textFields = [role, description, subtype].join(" ");
  const hasLaborIndicators = LABOR_KEYWORDS.some((rx) => rx.test(textFields));
  
  if (hasLaborIndicators) {
    return "Labor";
  }
  
  // Return original category or fallback
  return rawCategory || "Rubro";
};

export const normalizeLineItemFromApi = (raw: any, options?: { debugMode?: boolean }): LineItem => {
  const id = normalizeRubroId(
    raw?.id || raw?.rubro_id || raw?.rubroId || raw?.line_item_id || raw?.lineItemId
  );
  
  // Defensive check: warn if ID is missing
  if (!id && options?.debugMode) {
    console.warn('[normalizeLineItemFromApi] Line item has no valid ID. Raw item:', raw);
  }

  const startMonth = toNumber(raw?.start_month ?? raw?.startMonth, 1) || 1;
  const recurringFlag = Boolean(raw?.recurring);
  const oneTimeFlag = raw?.one_time !== undefined ? Boolean(raw.one_time) : !recurringFlag;

  // Canonicalize category to properly detect labor items
  const category = canonicalizeCategory(raw);

  return {
    id,
    category,
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

export const normalizeForecastCells = (cells: any[], options?: { baselineId?: string; debugMode?: boolean }): ForecastCell[] => {
  if (!Array.isArray(cells)) {
    if (options?.debugMode) {
      console.warn('[normalizeForecastCells] Input is not an array:', cells);
    }
    return [];
  }

  const normalized = cells.map((cell, index) => {
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

    // Defensive check: warn if line_item_id is empty
    if (!lineItemId && options?.debugMode) {
      console.warn(`[normalizeForecastCells] Cell at index ${index} has no valid line_item_id. Raw cell:`, cell);
    }

    // Defensive check: warn if month is invalid
    if (month < 1 || month > 12) {
      if (options?.debugMode) {
        console.warn(`[normalizeForecastCells] Cell at index ${index} has invalid month: ${month}. Raw cell:`, cell);
      }
    }

    const varianceBase = cell?.variance ?? cell?.forecast_variance;
    const variance =
      varianceBase !== undefined && varianceBase !== null
        ? toNumber(varianceBase)
        : forecast - planned;

    const normalizedCell: ForecastCell = {
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
    };

    // Add baseline_id to the cell if provided (for traceability)
    if (options?.baselineId && cell?.baseline_id != null && cell.baseline_id !== options.baselineId && options?.debugMode) {
      console.warn(
        `[normalizeForecastCells] Cell baseline_id mismatch. Expected: ${options.baselineId}, Got: ${cell?.baseline_id}`
      );
    }

    return normalizedCell;
  });

  // Defensive check: log summary of normalization
  if (options?.debugMode) {
    const validCells = normalized.filter(c => c.line_item_id && c.month >= 1 && c.month <= 12);
    const invalidCells = normalized.length - validCells.length;
    
    console.log('[normalizeForecastCells] Summary:', {
      inputCount: cells.length,
      normalizedCount: normalized.length,
      validCells: validCells.length,
      invalidCells,
      baselineId: options?.baselineId,
    });
  }

  return normalized;
};

export { normalizeRubroId };
