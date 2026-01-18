import {
  BatchWriteCommand,
  BatchWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { ddb, tableName, GetCommand, ScanCommand } from "./dynamo";
import { logError } from "../utils/logging";
import { batchGetExistingItems } from "./dynamodbHelpers";
import {
  getCanonicalRubroId,
  mapModRoleToRubroId,
  mapNonLaborCategoryToRubroId,
} from "./rubros-taxonomy";

interface BaselineLike {
  baseline_id?: string;
  baselineId?: string;
  project_id?: string;
  projectId?: string;
  start_date?: string;
  duration_months?: number;
  durationMonths?: number;
  currency?: string;
  payload?: Record<string, unknown>;
  labor_estimates?: any[];
  non_labor_estimates?: any[];
}

interface MaterializerOptions {
  dryRun?: boolean;
  forceRewriteZeros?: boolean;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "2-digit",
});

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const UNMAPPED_RUBRO_ID = "UNMAPPED";
const TAXONOMY_CACHE_TTL_MS = 5 * 60 * 1000;

type RubroTaxonomyEntry = {
  linea_codigo?: string;
  categoria?: string;
  descripcion?: string;
  linea_gasto?: string;
  categoria_codigo?: string;
  tipo_costo?: string;
  tipo_ejecucion?: string;
};

type TaxonomyIndex = {
  fetchedAt: number;
  byCategoryDescription: Map<string, RubroTaxonomyEntry>;
  byDescription: Map<string, RubroTaxonomyEntry>;
};

let taxonomyIndexCache: TaxonomyIndex | null = null;

const normalizeKeyPart = (value?: string | null) =>
  (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

const taxonomyKey = (category?: string | null, description?: string | null) =>
  `${normalizeKeyPart(category)}|${normalizeKeyPart(description)}`;

const ensureTaxonomyIndex = async (): Promise<TaxonomyIndex> => {
  const now = Date.now();
  if (
    taxonomyIndexCache &&
    now - taxonomyIndexCache.fetchedAt < TAXONOMY_CACHE_TTL_MS
  ) {
    return taxonomyIndexCache;
  }

  const entries: RubroTaxonomyEntry[] = [];
  try {
    const scan = await ddb.send(
      new ScanCommand({
        TableName: tableName("rubros_taxonomia"),
        ProjectionExpression:
          "linea_codigo, categoria, descripcion, linea_gasto, categoria_codigo, tipo_costo, tipo_ejecucion",
      })
    );
    entries.push(...(((scan as any)?.Items || []) as RubroTaxonomyEntry[]));
  } catch (error) {
    logError("[materializers] failed to scan rubros_taxonomia", { error });
  }

  const byCategoryDescription = new Map<string, RubroTaxonomyEntry>();
  const byDescription = new Map<string, RubroTaxonomyEntry>();

  for (const entry of entries) {
    const description =
      entry.descripcion || entry.linea_gasto || entry.linea_codigo || "";
    if (entry.categoria || description) {
      byCategoryDescription.set(
        taxonomyKey(entry.categoria, description),
        entry
      );
    }
    if (description) {
      byDescription.set(normalizeKeyPart(description), entry);
    }
  }

  taxonomyIndexCache = {
    fetchedAt: now,
    byCategoryDescription,
    byDescription,
  };

  return taxonomyIndexCache;
};

/**
 * Unmarshall DynamoDB-formatted data if it contains type descriptors
 * (e.g., {"L": [...], "M": {...}, "S": "...", "N": "123"})
 */
const unmarshallIfNeeded = (value: unknown): any => {
  if (!value || typeof value !== "object") {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => unmarshallIfNeeded(item));
  }

  // Check if this looks like marshalled DynamoDB data by looking for type descriptors
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  // DynamoDB type descriptors: S, N, B, SS, NS, BS, M, L, NULL, BOOL
  const dynamoTypes = [
    "S",
    "N",
    "B",
    "SS",
    "NS",
    "BS",
    "M",
    "L",
    "NULL",
    "BOOL",
  ];

  // If the object has exactly one key and it's a DynamoDB type descriptor, unmarshall it
  if (keys.length === 1 && dynamoTypes.includes(keys[0])) {
    try {
      return unmarshall({ temp: value as any }).temp;
    } catch (err) {
      logError("[materializers] failed to unmarshall DynamoDB data", {
        value,
        error: err,
      });
      return value;
    }
  }

  // If it's an object with multiple fields that might be marshalled, try each field
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = unmarshallIfNeeded(val);
  }

  return result;
};

const normalizeProjectId = (rawProjectId: string | undefined | null) => {
  const value = (rawProjectId ?? "").toString().trim();
  if (!value) {
    throw new Error(
      "[materializers] Baseline missing projectId; cannot materialize allocations"
    );
  }

  const sanitized = value.startsWith("PROJECT#")
    ? value.slice("PROJECT#".length)
    : value;

  if (sanitized.startsWith("BASELINE#")) {
    console.warn(
      "[materializers] projectId looks like a baseline pk, stripping prefix",
      {
        rawProjectId: value,
      }
    );
    return sanitized.replace(/^BASELINE#+/i, "");
  }

  if (sanitized !== value) {
    console.info(
      "[materializers] normalized projectId by removing PROJECT# prefix",
      {
        rawProjectId: value,
        normalizedProjectId: sanitized,
      }
    );
  }

  return sanitized;
};

const normalizeBaseline = (baseline: BaselineLike) => {
  // ---------- START PATCH for normalizeBaseline ----------
  const rawPayloadCandidate =
    (baseline.payload as Record<string, unknown> | undefined) ?? baseline ?? {};
  // Try to unmarshall the candidate
  const payloadCandidate = unmarshallIfNeeded(rawPayloadCandidate) as Record<
    string,
    unknown
  >;

  // Helper: try to find estimates within 0..2 extra payload nestings
  const tryUnwrapForEstimates = (p: any): Record<string, unknown> => {
    if (!p || typeof p !== "object") return {};
    // Level 0: direct
    if (
      Array.isArray(p.labor_estimates) ||
      Array.isArray(p.non_labor_estimates)
    )
      return p;
    // Level 1: p.payload
    if (p.payload) {
      const p1 = unmarshallIfNeeded(p.payload);
      if (
        Array.isArray((p1 as any).labor_estimates) ||
        Array.isArray((p1 as any).non_labor_estimates)
      )
        return p1 as Record<string, unknown>;
      // Level 2: p.payload.payload
      if ((p1 as any).payload) {
        const p2 = unmarshallIfNeeded((p1 as any).payload);
        if (
          Array.isArray((p2 as any).labor_estimates) ||
          Array.isArray((p2 as any).non_labor_estimates)
        )
          return p2 as Record<string, unknown>;
      }
    }
    // Last resort: return the original unmarshalled candidate
    return p;
  };

  const payload = tryUnwrapForEstimates(payloadCandidate) as Record<
    string,
    unknown
  >;

  // Diagnostic: helpful preview for CloudWatch (so operators can confirm what materializer received)
  try {
    const previewLaborCount = Array.isArray((payload as any).labor_estimates)
      ? (payload as any).labor_estimates.length
      : 0;
    const previewNonLaborCount = Array.isArray(
      (payload as any).non_labor_estimates
    )
      ? (payload as any).non_labor_estimates.length
      : 0;
    console.info("[materializers] normalizeBaseline preview", {
      baselineId: baseline.baseline_id || baseline.baselineId,
      projectId:
        baseline.project_id ||
        baseline.projectId ||
        (payload as any).project_id,
      startDate: baseline.start_date || (payload as any).start_date || null,
      durationMonths:
        baseline.duration_months ||
        baseline.durationMonths ||
        (payload as any).duration_months ||
        (payload as any).durationMonths ||
        0,
      laborCount: previewLaborCount,
      nonLaborCount: previewNonLaborCount,
    });
  } catch (e) {
    // don't fail normalization on logging issues
    console.warn(
      "[materializers] normalizeBaseline preview logging failed",
      String(e)
    );
  }
  // ---------- END PATCH ----------

  const payloadLabor = asArray(
    (payload as { labor_estimates?: any[] }).labor_estimates
  );
  const payloadNonLabor = asArray(
    (payload as { non_labor_estimates?: any[] }).non_labor_estimates
  );
  const labor = asArray(baseline.labor_estimates);
  const nonLabor = asArray(baseline.non_labor_estimates);

  return {
    baselineId:
      baseline.baseline_id ||
      baseline.baselineId ||
      (payload as { baseline_id?: string; baselineId?: string }).baseline_id ||
      (payload as { baseline_id?: string; baselineId?: string }).baselineId ||
      "unknown",
    projectId: normalizeProjectId(
      baseline.project_id ||
        baseline.projectId ||
        (payload as { project_id?: string; projectId?: string }).project_id ||
        (payload as { project_id?: string; projectId?: string }).projectId ||
        ""
    ),
    durationMonths:
      baseline.duration_months ||
      baseline.durationMonths ||
      (payload as { duration_months?: number; durationMonths?: number })
        .duration_months ||
      (payload as { duration_months?: number; durationMonths?: number })
        .durationMonths ||
      0,
    startDate:
      baseline.start_date ||
      (payload as { start_date?: string }).start_date ||
      new Date().toISOString(),
    currency:
      baseline.currency || (payload as { currency?: string }).currency || "USD",
    laborEstimates: labor.length > 0 ? labor : payloadLabor,
    nonLaborEstimates: nonLabor.length > 0 ? nonLabor : payloadNonLabor,
  };
};

type BaselineLaborEstimate = {
  rubroId?: string;
  rubro_id?: string;
  role?: string;
  level?: string;
  country?: string;
  hours_per_month?: number;
  hoursPerMonth?: number;
  hours?: number;
  hrs_mes?: number;
  hrsMes?: number;
  fte_count?: number;
  fteCount?: number;
  fte?: number;
  hourly_rate?: number;
  hourlyRate?: number;
  rate?: number;
  tarifa_hora?: number;
  tarifaHora?: number;
  total_cost?: number;
  totalCost?: number;
  total_cost_raw?: number;
  monthly_cost?: number;
  monthlyCost?: number;
  monthly_rate?: number;
  monthlyRate?: number;
  amount?: number;
  on_cost_percentage?: number;
  onCostPercentage?: number;
  start_month?: number;
  startMonth?: number;
  end_month?: number;
  endMonth?: number;
  id?: string;
  line_item_id?: string;
  [key: string]: any; // Allow additional fields
};

type BaselineNonLaborEstimate = {
  rubroId?: string;
  rubro_id?: string;
  category?: string;
  descripcion?: string;
  description?: string;
  amount?: number;
  cost?: number;
  total?: number;
  vendor?: string;
  proveedor?: string;
  one_time?: boolean;
  oneTime?: boolean;
  start_month?: number;
  startMonth?: number;
  end_month?: number;
  endMonth?: number;
  id?: string;
  line_item_id?: string;
};

/**
 * Parse a value that might be a number, a string representation of a number,
 * or a currency-formatted string (e.g., "$1,250" or "1.250,00").
 * Returns null if the value cannot be parsed.
 */
const parseNumberLike = (value: any): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    // Remove currency symbols, commas, and whitespace
    const stripped = value.replace(/[^0-9.-]+/g, '');
    const parsed = Number(stripped);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Derive the monthly allocation amount for a labor estimate.
 * Tries multiple field naming conventions and computation strategies.
 * Returns the computed amount and optionally a reason if the amount is zero.
 */
const deriveMonthlyAllocationAmount = (
  labor: BaselineLaborEstimate,
  durationMonths: number
): { amount: number; reason?: string } => {
  // Strategy 1: Prefer explicit total_cost divided by duration
  const totalCost = parseNumberLike(
    labor.total_cost ?? labor.totalCost ?? labor.total_cost_raw
  );
  if (totalCost != null && totalCost > 0 && durationMonths > 0) {
    return { amount: Math.round(totalCost / durationMonths) };
  }

  // Strategy 2: Direct monthly cost field
  const monthlyCost = parseNumberLike(
    labor.monthly_cost ?? labor.monthlyCost ?? labor.monthly_rate ?? labor.monthlyRate ?? labor.amount
  );
  if (monthlyCost != null && monthlyCost > 0) {
    return { amount: Math.round(monthlyCost) };
  }

  // Strategy 3: Hourly-based calculation
  // Try multiple naming conventions for each field
  const hourlyRate = parseNumberLike(
    labor.hourly_rate ??
      labor.hourlyRate ??
      labor.rate ??
      labor.tarifa_hora ??
      labor.tarifaHora
  );
  const hoursPerMonth = parseNumberLike(
    labor.hours_per_month ??
      labor.hoursPerMonth ??
      labor.hours ??
      labor.hrs_mes ??
      labor.hrsMes
  );
  const fte = parseNumberLike(
    labor.fte_count ?? labor.fteCount ?? labor.fte
  );

  if (hourlyRate != null && hourlyRate > 0) {
    const hours = hoursPerMonth ?? 160; // Default to 160 hours/month if not specified
    const fteCount = fte ?? 1; // Default to 1 FTE if not specified
    const computed = hourlyRate * hours * fteCount;

    if (Number.isFinite(computed) && computed > 0) {
      return { amount: Math.round(computed) };
    }
  }

  // Strategy 4: If we have FTE and monthly rate but no hourly breakdown
  if (fte != null && fte > 0 && monthlyCost != null) {
    const computed = monthlyCost * fte;
    if (Number.isFinite(computed) && computed > 0) {
      return { amount: Math.round(computed) };
    }
  }

  // If all strategies failed, return 0 with a diagnostic reason
  const missingFields: string[] = [];
  if (totalCost == null) missingFields.push('total_cost');
  if (monthlyCost == null) missingFields.push('monthly_cost');
  if (hourlyRate == null) missingFields.push('hourly_rate');
  
  return {
    amount: 0,
    reason: `no numeric fields found: checked ${missingFields.join(', ')}`,
  };
};

const stableIdFromParts = (
  ...parts: Array<string | number | undefined | null>
) =>
  parts
    .filter(
      (part) => part !== undefined && part !== null && `${part}`.length > 0
    )
    .map((part) =>
      `${part}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    )
    .join("-");

const resolveTaxonomyLinea = async (
  category?: string,
  description?: string
): Promise<string | undefined> => {
  const index = await ensureTaxonomyIndex();
  const key = taxonomyKey(category, description);
  const direct = index.byCategoryDescription.get(key);
  if (direct?.linea_codigo) return direct.linea_codigo;

  const fallback = index.byDescription.get(normalizeKeyPart(description || ""));
  if (fallback?.linea_codigo) return fallback.linea_codigo;

  return undefined;
};

export type BaselineRubrosBuildResult = {
  items: Array<Record<string, any>>;
  warnings: string[];
  laborCount: number;
  nonLaborCount: number;
};

export const buildRubrosFromBaselinePayload = async (
  baselinePayload: Record<string, unknown>,
  projectId: string,
  baselineId: string
): Promise<BaselineRubrosBuildResult> => {
  const laborEstimates = asArray(
    (baselinePayload as { labor_estimates?: BaselineLaborEstimate[] })
      .labor_estimates
  ) as BaselineLaborEstimate[];
  const nonLaborEstimates = asArray(
    (baselinePayload as { non_labor_estimates?: BaselineNonLaborEstimate[] })
      .non_labor_estimates
  ) as BaselineNonLaborEstimate[];
  const currency = (baselinePayload as { currency?: string }).currency || "USD";

  const warnings: string[] = [];
  const items: Array<Record<string, any>> = [];

  laborEstimates.forEach((estimate, index) => {
    const explicitRubroId = estimate.rubroId || estimate.rubro_id;
    const mappedFromRole = explicitRubroId
      ? undefined
      : mapModRoleToRubroId(estimate.role);
    const canonicalRubroId =
      getCanonicalRubroId(explicitRubroId || mappedFromRole || undefined) ||
      (explicitRubroId ? undefined : mappedFromRole);

    const resolvedLineaCodigo = canonicalRubroId || UNMAPPED_RUBRO_ID;
    if (!canonicalRubroId) {
      warnings.push(
        `Labor estimate missing taxonomy mapping for role "${
          estimate.role ?? "unknown"
        }". Using ${UNMAPPED_RUBRO_ID}.`
      );
    }

    const hoursPerMonth =
      estimate.hours_per_month ?? estimate.hoursPerMonth ?? estimate.hours ?? 0;
    const fteCount = estimate.fte_count ?? estimate.fteCount ?? 1;
    const hourlyRate =
      estimate.hourly_rate ?? estimate.hourlyRate ?? estimate.rate ?? 0;
    const onCostPct =
      estimate.on_cost_percentage ?? estimate.onCostPercentage ?? 0;

    const baseCost = hoursPerMonth * fteCount * hourlyRate;
    const onCost = baseCost * (Number(onCostPct) / 100);
    const monthlyCost = baseCost + onCost;

    const startMonth = Math.max(
      Number(estimate.start_month ?? estimate.startMonth ?? 1),
      1
    );
    const endMonth = Math.max(
      Number(estimate.end_month ?? estimate.endMonth ?? startMonth),
      startMonth
    );
    const monthsCount = endMonth - startMonth + 1;
    const totalCost = monthlyCost * monthsCount;

    const stableId =
      estimate.id ||
      estimate.line_item_id ||
      stableIdFromParts(estimate.role, estimate.level, index + 1) ||
      `labor-${index + 1}`;

    const instanceId = `${baselineId}#labor#${stableId}`;

    items.push({
      pk: `PROJECT#${projectId}`,
      sk: `RUBRO#${instanceId}`,
      projectId,
      baselineId,
      rubroId: instanceId,
      linea_codigo: resolvedLineaCodigo,
      nombre: estimate.role || resolvedLineaCodigo,
      descripcion: estimate.level
        ? `${estimate.role ?? "Rol"} (${estimate.level})`
        : estimate.role,
      category: "Labor",
      qty: 1,
      unit_cost: monthlyCost,
      currency,
      recurring: true,
      one_time: false,
      start_month: startMonth,
      end_month: endMonth,
      total_cost: totalCost,
      metadata: {
        source: "baseline_materializer",
        baseline_id: baselineId,
        project_id: projectId,
        role: estimate.role,
        linea_codigo: resolvedLineaCodigo,
      },
    });
  });

  for (let index = 0; index < nonLaborEstimates.length; index += 1) {
    const estimate = nonLaborEstimates[index];
    const explicitRubroId = estimate.rubroId || estimate.rubro_id;
    const category = estimate.category;
    const description = estimate.description ?? estimate.descripcion;

    let resolvedLineaCodigo =
      getCanonicalRubroId(explicitRubroId) ||
      mapNonLaborCategoryToRubroId(category) ||
      mapNonLaborCategoryToRubroId(description);

    if (!resolvedLineaCodigo) {
      resolvedLineaCodigo = await resolveTaxonomyLinea(category, description);
    }

    if (!resolvedLineaCodigo) {
      resolvedLineaCodigo = UNMAPPED_RUBRO_ID;
      warnings.push(
        `Non-labor estimate missing taxonomy mapping for "${category ?? ""} ${
          description ?? ""
        }". Using ${UNMAPPED_RUBRO_ID}.`
      );
    }

    const amount = Number(
      estimate.amount ?? estimate.cost ?? estimate.total ?? 0
    );
    const recurring = !(estimate.one_time ?? estimate.oneTime ?? false);
    const startMonth = Math.max(
      Number(estimate.start_month ?? estimate.startMonth ?? 1),
      1
    );
    const endMonth = recurring
      ? Math.max(
          Number(estimate.end_month ?? estimate.endMonth ?? startMonth),
          startMonth
        )
      : startMonth;
    const monthsCount = recurring ? endMonth - startMonth + 1 : 1;
    const totalCost = recurring ? amount * monthsCount : amount;

    const stableId =
      estimate.id ||
      estimate.line_item_id ||
      stableIdFromParts(description, category, index + 1) ||
      `nonlabor-${index + 1}`;

    const instanceId = `${baselineId}#nonlabor#${stableId}`;

    items.push({
      pk: `PROJECT#${projectId}`,
      sk: `RUBRO#${instanceId}`,
      projectId,
      baselineId,
      rubroId: instanceId,
      linea_codigo: resolvedLineaCodigo,
      nombre: description || category || resolvedLineaCodigo,
      descripcion: description,
      category: category || "Non-labor",
      qty: 1,
      unit_cost: amount,
      currency,
      recurring,
      one_time: !recurring,
      start_month: startMonth,
      end_month: endMonth,
      total_cost: totalCost,
      metadata: {
        source: "baseline_materializer",
        baseline_id: baselineId,
        project_id: projectId,
        vendor: estimate.vendor ?? estimate.proveedor,
        linea_codigo: resolvedLineaCodigo,
      },
    });
  }

  return {
    items,
    warnings,
    laborCount: laborEstimates.length,
    nonLaborCount: nonLaborEstimates.length,
  };
};

const formatMonth = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthSequence = (startDate: string, durationMonths: number): string[] => {
  // Contract month alignment: M1 = baseline start_date month
  let start: Date;
  let startDateWasFallback = false;

  if (startDate) {
    start = new Date(startDate);
    // Validate the date
    if (isNaN(start.getTime())) {
      console.error("[materializers] Invalid start_date, using current month", {
        startDate,
      });
      start = new Date();
      startDateWasFallback = true;
    }
  } else {
    console.error("[materializers] Missing start_date, using current month");
    start = new Date();
    startDateWasFallback = true;
  }

  if (startDateWasFallback) {
    console.warn("[materializers] Contract month alignment may be incorrect", {
      startDateWasFallback: true,
      fallbackMonth: formatMonth(start),
    });
  }

  const months: string[] = [];
  for (let i = 0; i < durationMonths; i += 1) {
    const next = new Date(start);
    next.setUTCMonth(start.getUTCMonth() + i);
    months.push(formatMonth(next));
  }
  return months;
};

const resolveTotalCost = (
  item: Record<string, any>,
  monthsCount: number
): number => {
  // Detect if this is a labor estimate by checking for labor-specific fields
  const isLaborEstimate =
    item.role != null ||
    item.hourly_rate != null ||
    item.hourlyRate != null ||
    item.tarifa_hora != null ||
    item.tarifaHora != null ||
    item.fte_count != null ||
    item.fteCount != null ||
    item.fte != null ||
    item.hours_per_month != null ||
    item.hoursPerMonth != null ||
    item.hrs_mes != null ||
    item.hrsMes != null;

  // For labor estimates, use the specialized derivation logic
  if (isLaborEstimate) {
    const result = deriveMonthlyAllocationAmount(
      item as BaselineLaborEstimate,
      monthsCount
    );
    
    // Log when we compute a zero amount for debugging
    if (result.amount === 0 && result.reason) {
      console.warn('[materializers] labor estimate computed to zero', {
        role: item.role,
        id: item.id,
        reason: result.reason,
        sampleFields: {
          total_cost: item.total_cost,
          hourly_rate: item.hourly_rate,
          monthly_cost: item.monthly_cost,
          hoursPerMonth: item.hoursPerMonth ?? item.hours_per_month,
          fteCount: item.fteCount ?? item.fte_count,
        },
      });
    }
    
    // Return total cost (monthly amount * duration)
    return result.amount * monthsCount;
  }

  // Original logic for non-labor estimates
  const qty = Number(item.qty ?? item.quantity ?? 1);
  const unitCost = Number(item.unit_cost ?? item.unitCost ?? item.amount ?? 0);
  const explicitTotal = Number(
    item.total_cost ?? item.totalCost ?? item.total_amount ?? 0
  );
  if (!Number.isNaN(explicitTotal) && explicitTotal > 0) return explicitTotal;
  const recurring = item.periodic === "recurring" || item.recurring === true;
  if (!Number.isNaN(unitCost) && unitCost > 0) {
    const base = unitCost * qty;
    return recurring ? base * monthsCount : base;
  }
  return 0;
};

const resolveMonthlyAmounts = (
  item: Record<string, any>,
  months: string[],
  totalCost: number
): number[] => {
  const explicit =
    item.monthlyAmounts ||
    item.month_amounts ||
    item.monthly_amounts ||
    item.months ||
    item.amounts ||
    item.monthly;

  if (Array.isArray(explicit) && explicit.length > 0) {
    return months.map((_, idx) => Number(explicit[idx] || 0));
  }

  if (explicit && typeof explicit === "object") {
    return months.map((month, idx) => {
      const key = month as keyof typeof explicit;
      const fallback = idx + 1;
      return Number(
        (explicit as Record<string, any>)[key] ??
          (explicit as Record<string, any>)[fallback] ??
          0
      );
    });
  }

  const recurring = item.periodic === "recurring" || item.recurring === true;
  const monthlyValue = totalCost / months.length;
  return months.map(() => (Number.isFinite(monthlyValue) ? monthlyValue : 0));
};

const dedupeByKey = <T>(items: T[], keyFn: (item: T) => string): T[] => {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
};

const batchWriteAll = async (table: string, items: Record<string, any>[]) => {
  const batches: BatchWriteCommandInput[] = [];
  for (let i = 0; i < items.length; i += 25) {
    const slice = items.slice(i, i + 25);
    batches.push({
      RequestItems: {
        [table]: slice.map((Item) => ({ PutRequest: { Item } })),
      },
    });
  }

  for (const batch of batches) {
    let pending: BatchWriteCommandInput | undefined = batch;
    let retryCount = 0;
    const maxRetries = 3;

    while (pending && retryCount < maxRetries) {
      try {
        const response = await ddb.send(new BatchWriteCommand(pending));
        const unprocessed = response.UnprocessedItems?.[table];
        if (unprocessed && unprocessed.length > 0) {
          pending = { RequestItems: { [table]: unprocessed } };
          retryCount++;
          // Exponential backoff for retries
          if (retryCount < maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, 100 * Math.pow(2, retryCount))
            );
          }
        } else {
          pending = undefined;
        }
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }
        // Exponential backoff for errors
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * Math.pow(2, retryCount))
        );
      }
    }

    if (pending && retryCount >= maxRetries) {
      throw new Error(`Failed to write batch after ${maxRetries} retries`);
    }
  }
};

export const materializeAllocationsForBaseline = async (
  baseline: BaselineLike,
  options: MaterializerOptions = { dryRun: true }
) => {
  const {
    baselineId,
    projectId,
    durationMonths,
    startDate,
    currency,
    laborEstimates,
    nonLaborEstimates,
  } = normalizeBaseline(baseline);

  console.info("[materializers] materializeAllocationsForBaseline start", {
    projectId,
    baselineId,
    start_date: startDate,
    durationMonths,
    laborEstimatesCount: laborEstimates.length,
    nonLaborEstimatesCount: nonLaborEstimates.length,
  });

  const months = monthSequence(startDate, durationMonths || 0);
  const lineItems = [...laborEstimates, ...nonLaborEstimates];
  const now = new Date().toISOString();

  const allocations = lineItems.flatMap((item) => {
    const rubroStableId =
      item.rubroId ||
      item.rubro_id ||
      item.linea_codigo ||
      item.id ||
      "unknown";
    const lineItemId =
      item.id ||
      item.line_item_id ||
      stableIdFromParts(rubroStableId, item.role, item.category);
    const totalCost = resolveTotalCost(item, months.length);
    const monthly = resolveMonthlyAmounts(item, months, totalCost);

    return months.map((month, idx) => {
      const amount = Number(monthly[idx] ?? 0);
      // SK format MUST match allocations handler: ALLOCATION#{baselineId}#{month}#{rubroId}
      // This ensures idempotent writes and allows GET /allocations to find materialized data
      const sk = `ALLOCATION#${baselineId}#${month}#${rubroStableId}`;
      return {
        pk: `PROJECT#${projectId}`,
        sk,
        project_id: projectId,
        projectId,
        baseline_id: baselineId,
        baselineId,
        rubro_id: rubroStableId,
        calendar_month: month,
        month,
        month_index: idx + 1,
        // P/F/A model: Planned (P) = monthly amount from baseline (immutable)
        //             Forecast (F) = initially equals Planned (can change via cost changes)
        //             Actual (A) = 0 initially (updated from invoices/payroll)
        planned: amount,
        forecast: amount,
        actual: 0,
        amount, // Keep for backward compatibility
        allocation_type: "planned",
        source: "baseline_materializer",
        line_item_id: lineItemId,
        createdAt: now,
        updatedAt: now,
      };
    });
  });

  const uniqueAllocations = dedupeByKey(
    allocations,
    (item) => `${item.pk}#${item.sk}`
  );
  const allocationsAttempted = uniqueAllocations.length;

  if (options.dryRun) {
    return {
      allocationsAttempted,
      allocationsPlanned: uniqueAllocations.length,
      months: months.length,
    };
  }

  // Idempotency: Check for existing allocations
  let existingKeys = new Set<string>();
  const existingItemsMap = new Map<string, Record<string, any>>();
  try {
    const keys = uniqueAllocations.map((allocation) => ({
      pk: allocation.pk,
      sk: allocation.sk,
    }));
    console.info("[materializers] checking existing allocations", {
      baselineId,
      projectId,
      sampleSKsToCheck: keys.slice(0, 3).map((k) => k.sk),
    });
    const existingAllocations = await batchGetExistingItems(
      tableName("allocations"),
      keys
    );
    
    // Build a map of existing items for comparison
    for (const item of existingAllocations) {
      const key = `${item.pk}#${item.sk}`;
      existingKeys.add(key);
      existingItemsMap.set(key, item);
    }
    
    console.info("[materializers] existing allocations found", {
      baselineId,
      projectId,
      existingCount: existingKeys.size,
      existingSKsSample: Array.from(existingKeys).slice(0, 3),
    });
  } catch (error) {
    logError("[materializers] failed to batch check existing allocations", {
      baselineId,
      projectId,
      error,
    });
  }

  // Filter allocations to write based on idempotency rules:
  // 1. Write if item doesn't exist
  // 2. Write if forceRewriteZeros is true AND existing.amount === 0 AND new amount > 0
  const allocationsToWrite = uniqueAllocations.filter((item) => {
    const key = `${item.pk}#${item.sk}`;
    const existing = existingItemsMap.get(key);
    
    if (!existing) {
      return true; // Write if doesn't exist
    }
    
    // If forceRewriteZeros is enabled, check if we should overwrite zero amounts
    if (options.forceRewriteZeros) {
      const existingAmount = Number(existing.amount ?? existing.planned ?? 0);
      const newAmount = Number(item.amount ?? item.planned ?? 0);
      
      if (existingAmount === 0 && newAmount > 0) {
        console.info('[materializers] overwriting zero allocation with positive value', {
          baselineId,
          sk: item.sk,
          existingAmount,
          newAmount,
        });
        return true; // Overwrite zero with positive
      }
    }
    
    return false; // Skip (already exists)
  });

  const allocationsSkipped = allocationsAttempted - allocationsToWrite.length;
  const allocationsWritten = allocationsToWrite.length;

  try {
    if (allocationsToWrite.length > 0) {
      await batchWriteAll(tableName("allocations"), allocationsToWrite);
    }

    console.info("[materializers] materializeAllocationsForBaseline result", {
      baselineId,
      projectId,
      allocationsAttempted,
      allocationsWritten,
      allocationsSkipped,
      months: months.length,
      monthRange:
        months.length > 0
          ? `${months[0]} to ${months[months.length - 1]}`
          : "none",
    });

    // WARN if we attempted to create allocations but wrote 0 (all skipped)
    if (allocationsAttempted > 0 && allocationsWritten === 0) {
      console.warn(
        "[materializers] All allocations were skipped (idempotent)",
        {
          baselineId,
          projectId,
          allocationsAttempted,
          note: "This is normal if allocations were already materialized",
        }
      );
    }

    return { allocationsAttempted, allocationsWritten, allocationsSkipped };
  } catch (error) {
    logError("[materializers] failed to write allocations", {
      baselineId,
      projectId,
      error,
    });
    throw error;
  }
};

export const materializeRubrosForBaseline = async (
  baseline: BaselineLike,
  options: MaterializerOptions = { dryRun: true }
) => {
  const normalized = normalizeBaseline(baseline);
  const baselineId = normalized.baselineId;
  const projectId = normalized.projectId;

  const payload =
    (baseline.payload as Record<string, unknown> | undefined) ||
    (baseline as Record<string, unknown>);

  const { items, warnings, laborCount, nonLaborCount } =
    await buildRubrosFromBaselinePayload(payload, projectId, baselineId);

  if (!laborCount && !nonLaborCount) {
    const error = new Error(
      `Baseline ${baselineId} has no labor_estimates or non_labor_estimates to materialize.`
    );
    (error as { statusCode?: number }).statusCode = 500;
    throw error;
  }

  const uniqueRubros = dedupeByKey(items, (item) => `${item.pk}#${item.sk}`);

  if (options.dryRun) {
    return { dryRun: true, rubrosPlanned: uniqueRubros.length, warnings };
  }

  let existingKeys = new Set<string>();
  try {
    const keys = uniqueRubros.map((rubro) => ({ pk: rubro.pk, sk: rubro.sk }));
    const existingRubros = await batchGetExistingItems(
      tableName("rubros"),
      keys
    );
    existingKeys = new Set(
      existingRubros.map((item) => `${item.pk}#${item.sk}`)
    );
  } catch (error) {
    logError("[materializers] failed to batch check existing rubros", {
      baselineId,
      projectId,
      error,
    });
  }

  const now = new Date().toISOString();
  const rubrosToWrite = uniqueRubros.map((rubro) => ({
    ...rubro,
    createdAt: rubro.createdAt || now,
    updatedAt: now,
  }));

  try {
    if (rubrosToWrite.length > 0) {
      await batchWriteAll(tableName("rubros"), rubrosToWrite);
    }
    const rubrosWritten = rubrosToWrite.filter(
      (item) => !existingKeys.has(`${item.pk}#${item.sk}`)
    ).length;
    const rubrosUpdated = rubrosToWrite.length - rubrosWritten;
    return {
      dryRun: false,
      rubrosWritten,
      rubrosUpdated,
      rubrosSkipped: 0,
      warnings,
    };
  } catch (error) {
    logError("[materializers] failed to write rubros", {
      baselineId,
      projectId,
      error,
    });
    throw error;
  }
};

export const materializeRubrosFromBaseline = async ({
  projectId,
  baselineId,
  dryRun = false,
}: {
  projectId?: string;
  baselineId: string;
  dryRun?: boolean;
}) => {
  if (!baselineId) {
    throw new Error("baselineId is required to materialize rubros");
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: tableName("prefacturas"),
      Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      ConsistentRead: true,
    })
  );

  if (!result.Item) {
    const error = new Error(
      `Baseline ${baselineId} not found in prefacturas store.`
    );
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const payload = result.Item;
  const resolvedProjectId =
    projectId ||
    (payload.project_id as string | undefined) ||
    (payload.projectId as string | undefined) ||
    (payload.payload as Record<string, unknown> | undefined)?.project_id ||
    (payload.payload as Record<string, unknown> | undefined)?.projectId;

  if (!resolvedProjectId) {
    const error = new Error(
      `Baseline ${baselineId} does not include project_id; cannot materialize rubros.`
    );
    (error as { statusCode?: number }).statusCode = 500;
    throw error;
  }

  return materializeRubrosForBaseline(
    {
      ...payload,
      project_id: resolvedProjectId,
      baseline_id: baselineId,
    },
    { dryRun }
  );
};
