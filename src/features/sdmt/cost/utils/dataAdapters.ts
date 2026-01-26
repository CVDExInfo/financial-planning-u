import type { ForecastCell, LineItem } from "@/types/domain";
import { canonicalizeRubroId } from "@/lib/rubros";

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
 * Separated into abbreviations and full keywords for better maintainability
 */
const LABOR_ABBREVIATION_KEYWORDS = [
  /\bmod\b/i,  // MOD in category field (all cases), uppercase-only in role/description
  /\bfte\b/i,  // FTE (Full-time equivalent)
  /\bsdm\b/i,  // Service Delivery Manager
  /\bpm\b/i,   // PM in category field (all cases), uppercase-only in role/description
] as const;

const LABOR_FULL_KEYWORDS = [
  /\blabor\b/i,
  /\blabour\b/i,
  /mano\s*de\s*obra/i,
  /ingenier[oía]/i,
  /engineer/i,
  /\bmanager\b/i,
  /project\s*manager/i,
  /service\s*delivery\s*manager/i,
  /soporte/i,
  /support/i,
  /delivery/i,
  /lead/i,
  /líder/i,
] as const;

// Combined list for category field checking (all patterns)
const ALL_LABOR_KEYWORDS = [...LABOR_ABBREVIATION_KEYWORDS, ...LABOR_FULL_KEYWORDS] as const;

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
  
  // Check if category already indicates labor (all patterns, case-insensitive)
  const categoryIsLabor = ALL_LABOR_KEYWORDS.some((rx) => rx.test(rawCategory));
  if (categoryIsLabor) {
    return "Labor";
  }
  
  // Combine role, description, and subtype for checking
  const textFields = [role, description, subtype].join(" ");
  
  // For abbreviations (MOD, PM, FTE, SDM), only match if uppercase
  // to avoid false matches with "model", "equipment", "pm" (time), etc.
  const uppercaseAbbreviations = /\b(MOD|PM|SDM|FTE)\b/;
  if (uppercaseAbbreviations.test(textFields)) {
    return "Labor";
  }
  
  // Check full keywords (case-insensitive, no abbreviations)
  const hasLaborIndicators = LABOR_FULL_KEYWORDS.some((rx) => rx.test(textFields));
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

  // Deduplication map: key = <canonicalRubroId>||<month>, value = merged cell
  const deduplicationMap: Record<string, ForecastCell> = {};
  const invalidCells: ForecastCell[] = []; // Track invalid cells separately for backward compatibility

  cells.forEach((cell, index) => {
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

    // Defensive check: warn if month is invalid (extended range 1-60 for multi-year forecasts)
    if (month < 1 || month > 60) {
      if (options?.debugMode) {
        console.warn(`[normalizeForecastCells] Cell at index ${index} has invalid month: ${month}. Raw cell:`, cell);
      }
    }

    const varianceBase = cell?.variance ?? cell?.forecast_variance;
    const variance =
      varianceBase !== undefined && varianceBase !== null
        ? toNumber(varianceBase)
        : forecast - planned;

    // Build matching IDs array for robust invoice matching
    const matchingIds: string[] = [];
    if (lineItemId) matchingIds.push(lineItemId);
    
    // Add canonical ID for matching (if different from lineItemId)
    const canonicalId = canonicalizeRubroId(lineItemId);
    if (canonicalId && canonicalId !== lineItemId && !matchingIds.includes(canonicalId)) {
      matchingIds.push(canonicalId);
    }
    
    // Add all potential ID variations for matching
    const rubroId = cell?.rubroId || cell?.rubro_id;
    if (rubroId && !matchingIds.includes(normalizeRubroId(rubroId))) {
      matchingIds.push(normalizeRubroId(rubroId));
    }
    
    // Add canonical version of rubroId
    if (rubroId) {
      const canonicalRubroId = canonicalizeRubroId(normalizeRubroId(rubroId));
      if (canonicalRubroId && !matchingIds.includes(canonicalRubroId)) {
        matchingIds.push(canonicalRubroId);
      }
    }
    
    // Add original IDs before normalization for backend compatibility
    const origLineItemId = cell?.line_item_id || cell?.lineItemId;
    if (origLineItemId && origLineItemId !== lineItemId && !matchingIds.includes(origLineItemId)) {
      matchingIds.push(origLineItemId);
    }
    
    const origRubroId = cell?.rubroId || cell?.rubro_id;
    if (origRubroId && !matchingIds.includes(origRubroId)) {
      matchingIds.push(origRubroId);
    }
    
    // Add linea_codigo for taxonomy alignment
    const lineaCode = cell?.linea_codigo || cell?.lineaCodigo;
    if (lineaCode && !matchingIds.includes(lineaCode)) {
      matchingIds.push(lineaCode);
    }

    // Calculate monthLabel (YYYY-MM format) for calendar alignment
    // Supports both calendar months (1-12) and extended project months (1-60)
    let monthLabel: string | undefined;
    if (cell?.monthLabel || cell?.month_label || cell?.calendar_month) {
      monthLabel = cell.monthLabel || cell.month_label || cell.calendar_month;
    } else if (month >= 1 && month <= 12) {
      // For simple calendar months (1-12), create YYYY-MM format
      const year = new Date().getFullYear();
      monthLabel = `${year}-${String(month).padStart(2, '0')}`;
    }

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
      matchingIds: matchingIds.length > 0 ? matchingIds : undefined,
      monthLabel,
      rubroId: rubroId || lineItemId,
      canonicalRubroId: canonicalId,
    };

    // Add baseline_id to the cell if provided (for traceability)
    if (options?.baselineId && cell?.baseline_id != null && cell.baseline_id !== options.baselineId && options?.debugMode) {
      console.warn(
        `[normalizeForecastCells] Cell baseline_id mismatch. Expected: ${options.baselineId}, Got: ${cell?.baseline_id}`
      );
    }

    // Deduplication logic: merge cells with same canonical rubroId + month
    // Skip cells with invalid line_item_id or month (but preserve them for backward compatibility)
    if (!lineItemId || month < 1 || month > 60) {
      if (options?.debugMode) {
        console.warn('[normalizeForecastCells] Tracking invalid cell separately (not deduplicated):', {
          line_item_id: lineItemId,
          month: month
        });
      }
      invalidCells.push(normalizedCell);
      return; // Skip deduplication for invalid cells
    }

    // Use canonical ID for deduplication to merge legacy and canonical IDs
    // (already computed above for matchingIds)
    const deduplicationKey = `${canonicalId}||${month}`;
    
    if (deduplicationMap[deduplicationKey]) {
      // Merge duplicate: sum numeric values (with defensive null checks)
      const existing = deduplicationMap[deduplicationKey];
      existing.planned = (existing.planned || 0) + (normalizedCell.planned || 0);
      existing.forecast = (existing.forecast || 0) + (normalizedCell.forecast || 0);
      existing.actual = (existing.actual || 0) + (normalizedCell.actual || 0);
      existing.variance = (existing.forecast || 0) - (existing.planned || 0);
      
      // Merge matchingIds arrays (dedupe)
      if (normalizedCell.matchingIds) {
        const existingIds = new Set(existing.matchingIds || []);
        normalizedCell.matchingIds.forEach(id => existingIds.add(id));
        existing.matchingIds = Array.from(existingIds);
      }
      
      // Keep most recent update timestamp (using Date objects for proper comparison)
      if (normalizedCell.last_updated && (!existing.last_updated || new Date(normalizedCell.last_updated) > new Date(existing.last_updated || ''))) {
        existing.last_updated = normalizedCell.last_updated;
        existing.updated_by = normalizedCell.updated_by;
      }
      
      // Merge notes (concatenate if both exist)
      if (normalizedCell.notes && existing.notes !== normalizedCell.notes) {
        existing.notes = existing.notes 
          ? `${existing.notes}; ${normalizedCell.notes}`
          : normalizedCell.notes;
      }
      
      // Merge variance_reason (prefer non-empty, concatenate if both exist)
      if (normalizedCell.variance_reason && existing.variance_reason !== normalizedCell.variance_reason) {
        existing.variance_reason = existing.variance_reason 
          ? `${existing.variance_reason}; ${normalizedCell.variance_reason}`
          : normalizedCell.variance_reason;
      }
      
      if (options?.debugMode) {
        console.debug(`[normalizeForecastCells] Merged duplicate cell: ${deduplicationKey}`, {
          canonicalId,
          lineItemId,
          merged: existing,
          original: normalizedCell,
        });
      }
    } else {
      // First occurrence of this canonical rubro + month combination
      // Use canonical ID as the line_item_id for consistency
      normalizedCell.line_item_id = canonicalId;
      deduplicationMap[deduplicationKey] = normalizedCell;
    }
  });

  // Convert deduplication map to array and add invalid cells
  const normalized = [...Object.values(deduplicationMap), ...invalidCells];

  // Defensive check: log summary of normalization and deduplication
  if (options?.debugMode) {
    const validCells = normalized.filter(c => c.line_item_id && c.month >= 1 && c.month <= 60);
    const invalidCellsCount = normalized.length - validCells.length;
    
    console.log('[normalizeForecastCells] Summary:', {
      inputCount: cells.length,
      normalizedCount: normalized.length,
      validCells: validCells.length,
      invalidCells: invalidCellsCount,
      baselineId: options?.baselineId,
      sampleMatchingIds: normalized.slice(0, 3).map(c => ({ 
        line_item_id: c.line_item_id, 
        matchingIds: c.matchingIds 
      })),
    });
  }

  return normalized;
};

export { normalizeRubroId };
