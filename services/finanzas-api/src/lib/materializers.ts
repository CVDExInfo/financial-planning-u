import { BatchWriteCommand, BatchWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "./dynamo";
import { logError } from "../utils/logging";

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
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "2-digit",
});

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const normalizeBaseline = (baseline: BaselineLike) => {
  const payload = (baseline.payload as Record<string, unknown> | undefined) || {};
  const payloadLabor = asArray((payload as { labor_estimates?: any[] }).labor_estimates);
  const payloadNonLabor = asArray((payload as { non_labor_estimates?: any[] }).non_labor_estimates);
  const labor = asArray(baseline.labor_estimates);
  const nonLabor = asArray(baseline.non_labor_estimates);

  return {
    baselineId: baseline.baseline_id || baseline.baselineId || (payload as { baseline_id?: string; baselineId?: string }).baseline_id ||
      (payload as { baseline_id?: string; baselineId?: string }).baselineId ||
      "unknown",
    projectId: baseline.project_id || baseline.projectId || (payload as { project_id?: string; projectId?: string }).project_id ||
      (payload as { project_id?: string; projectId?: string }).projectId ||
      "unknown",
    durationMonths:
      baseline.duration_months ||
      baseline.durationMonths ||
      (payload as { duration_months?: number; durationMonths?: number }).duration_months ||
      (payload as { duration_months?: number; durationMonths?: number }).durationMonths ||
      0,
    startDate:
      baseline.start_date ||
      (payload as { start_date?: string }).start_date ||
      new Date().toISOString(),
    currency:
      baseline.currency || (payload as { currency?: string }).currency ||
      "USD",
    laborEstimates: labor.length > 0 ? labor : payloadLabor,
    nonLaborEstimates: nonLabor.length > 0 ? nonLabor : payloadNonLabor,
  };
};

const formatMonth = (date: Date) => {
  return MONTH_FORMAT.format(date).replace("/", "-");
};

const monthSequence = (startDate: string, durationMonths: number): string[] => {
  const start = new Date(startDate || new Date().toISOString());
  const months: string[] = [];
  for (let i = 0; i < durationMonths; i += 1) {
    const next = new Date(start);
    next.setUTCMonth(start.getUTCMonth() + i);
    months.push(formatMonth(next));
  }
  return months;
};

const resolveTotalCost = (item: Record<string, any>, monthsCount: number): number => {
  const qty = Number(item.qty ?? item.quantity ?? 1);
  const unitCost = Number(item.unit_cost ?? item.unitCost ?? item.amount ?? 0);
  const explicitTotal = Number(item.total_cost ?? item.totalCost ?? item.total_amount ?? 0);
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
      return Number((explicit as Record<string, any>)[key] ?? (explicit as Record<string, any>)[fallback] ?? 0);
    });
  }

  const recurring = item.periodic === "recurring" || item.recurring === true;
  const monthlyValue = recurring ? totalCost / months.length : totalCost / months.length;
  return months.map(() => Number.isFinite(monthlyValue) ? monthlyValue : 0);
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
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
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
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
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
  const { baselineId, projectId, durationMonths, startDate, currency, laborEstimates, nonLaborEstimates } =
    normalizeBaseline(baseline);

  const months = monthSequence(startDate, durationMonths || 0);
  const lineItems = [...laborEstimates, ...nonLaborEstimates];
  const now = new Date().toISOString();

  const allocations = lineItems.flatMap((item) => {
    const rubroId = item.rubroId || item.rubro_id || item.linea_codigo || item.id || "unknown";
    const totalCost = resolveTotalCost(item, months.length);
    const monthly = resolveMonthlyAmounts(item, months, totalCost);

    return months.map((month, idx) => {
      const amount = Number(monthly[idx] ?? 0);
      const sk = `ALLOCATION#${baselineId}#${month}#${rubroId}`;
      return {
        pk: `PROJECT#${projectId}`,
        sk,
        id: `${baselineId}#${month}#${rubroId}`,
        projectId,
        baselineId,
        rubroId,
        month,
        amount,
        currency,
        source: "baseline_materializer",
        createdAt: now,
      };
    });
  });

  const uniqueAllocations = dedupeByKey(allocations, (item) => `${item.pk}#${item.sk}`);

  if (options.dryRun) {
    return { allocationsPlanned: uniqueAllocations.length, months: months.length };
  }

  try {
    await batchWriteAll(tableName("allocations"), uniqueAllocations);
    return { allocationsWritten: uniqueAllocations.length, months: months.length };
  } catch (error) {
    logError("[materializers] failed to write allocations", { baselineId, projectId, error });
    throw error;
  }
};

export const materializeRubrosForBaseline = async (
  baseline: BaselineLike,
  options: MaterializerOptions = { dryRun: true }
) => {
  const { baselineId, projectId, currency, laborEstimates, nonLaborEstimates, durationMonths } =
    normalizeBaseline(baseline);

  const months = durationMonths || 1;
  const lineItems = [...laborEstimates, ...nonLaborEstimates];

  const rubros = lineItems.map((item) => {
    const rubroId = item.rubroId || item.rubro_id || item.linea_codigo || item.id || "unknown";
    const totalCost = resolveTotalCost(item, months);
    const unitCost = Number(item.unit_cost ?? item.unitCost ?? item.amount ?? totalCost);
    const quantity = Number(item.qty ?? item.quantity ?? 1);
    const name = item.nombre || item.name || item.role || item.description || item.category || rubroId;
    const description = item.descripcion || item.description || item.role || name;
    const category = item.category || item.tipo_costo || item.type || "Unknown";
    const tier = item.tier || item.level;

    return {
      pk: `PROJECT#${projectId}`,
      sk: `RUBRO#${rubroId}#BASELINE#${baselineId}`,
      rubroId,
      baselineId,
      projectId,
      name,
      description,
      tier,
      category,
      unitCost,
      quantity,
      totalCost,
      currency,
      source: "baseline_materializer",
    };
  });

  const uniqueRubros = dedupeByKey(rubros, (item) => `${item.pk}#${item.sk}`);

  if (options.dryRun) {
    return { rubrosPlanned: uniqueRubros.length };
  }

  try {
    await batchWriteAll(tableName("rubros"), uniqueRubros);
    return { rubrosWritten: uniqueRubros.length };
  } catch (error) {
    logError("[materializers] failed to write rubros", { baselineId, projectId, error });
    throw error;
  }
};
