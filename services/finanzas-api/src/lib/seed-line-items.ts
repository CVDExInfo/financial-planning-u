import { PutCommand, QueryCommand } from "../lib/dynamo";
import { DEFAULT_LABOR_RUBRO, DEFAULT_NON_LABOR_RUBRO } from "./rubros-taxonomy";
import { logError } from "../utils/logging";
import { requireCanonicalRubro } from "./requireCanonical";

type BaselineDealInputs = {
  project_name?: string;
  client_name?: string;
  contract_value?: number;
  duration_months?: number;
  start_date?: string;
  end_date?: string;
  currency?: string;
  sdm_manager_name?: string;
};

type BaselineLaborEstimate = {
  rubroId?: string; // Canonical rubro ID from taxonomy (e.g., "MOD-ING", "MOD-LEAD")
  role?: string;
  level?: string;
  hours_per_month?: number;
  fte_count?: number;
  hourly_rate?: number;
  rate?: number;
  on_cost_percentage?: number;
  start_month?: number;
  end_month?: number;
};

type BaselineNonLaborEstimate = {
  rubroId?: string; // Canonical rubro ID from taxonomy (e.g., "GSV-REU", "SOI-AWS")
  category?: string;
  description?: string;
  amount?: number;
  vendor?: string;
  one_time?: boolean;
  start_month?: number;
  end_month?: number;
};

type BaselinePayload = {
  project_id?: string;
  project_name?: string;
  client_name?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  duration_months?: number;
  contract_value?: number;
  sdm_manager_name?: string;
  labor_estimates?: BaselineLaborEstimate[];
  non_labor_estimates?: BaselineNonLaborEstimate[];
  deal_inputs?: BaselineDealInputs;
};

type SeededLineItem = {
  rubroId: string;
  nombre: string;
  descripcion?: string;
  category?: string;
  qty: number;
  unit_cost: number;
  currency: string;
  recurring: boolean;
  one_time: boolean;
  start_month: number;
  end_month: number;
  total_cost: number;
  metadata?: Record<string, unknown>;
};

export type RubroSeedDeps = {
  send: typeof import("../lib/dynamo").sendDdb | any;
  tableName: typeof import("../lib/dynamo").tableName;
};

export const buildSeedLineItems = (
  baseline: BaselinePayload,
  projectId: string,
  baselineId?: string
): SeededLineItem[] => {
  const items: SeededLineItem[] = [];
  const currency = baseline.currency || "USD";

  (baseline.labor_estimates || []).forEach((estimate, index) => {
    const hoursPerMonth = Number(estimate.hours_per_month || 0);
    const fteCount = Number(estimate.fte_count || 0);
    const hourlyRate = Number(estimate.hourly_rate || estimate.rate || 0);
    const onCostPct = Number(estimate.on_cost_percentage || 0);
    const baseCost = hoursPerMonth * fteCount * hourlyRate;
    const onCost = baseCost * (onCostPct / 100);
    const monthlyCost = baseCost + onCost;
    const startMonth = Math.max(Number(estimate.start_month || 1), 1);
    const endMonth = Math.max(Number(estimate.end_month || startMonth), startMonth);
    const months = endMonth - startMonth + 1;
    const totalCost = monthlyCost * months;

    // CRITICAL: Enforce canonical rubro ID from taxonomy - no exceptions
    const rawRubro = estimate.rubroId || DEFAULT_LABOR_RUBRO;
    const canonicalRubro = requireCanonicalRubro(rawRubro);
    
    const rubroSK = baselineId
      ? `${canonicalRubro}#${baselineId}#${index + 1}`
      : `${canonicalRubro}#baseline#${index + 1}`;

    items.push({
      rubroId: rubroSK,
      nombre: estimate.role || canonicalRubro,
      descripcion: estimate.level ? `${estimate.role ?? "Role"} (${estimate.level})` : estimate.role,
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
        source: "baseline",
        baseline_id: baselineId,
        project_id: projectId,
        role: estimate.role,
        linea_codigo: canonicalRubro,
      },
    });
  });

  (baseline.non_labor_estimates || []).forEach((estimate, index) => {
    const amount = Number(estimate.amount || 0);
    const recurring = !estimate.one_time;
    const startMonth = Math.max(Number(estimate.start_month || 1), 1);
    const endMonth = recurring
      ? Math.max(Number(estimate.end_month || startMonth), startMonth)
      : startMonth;
    const months = recurring ? endMonth - startMonth + 1 : 1;
    const totalCost = recurring ? amount * months : amount;

    // CRITICAL: Enforce canonical rubro ID from taxonomy - no exceptions
    const rawRubro = estimate.rubroId || DEFAULT_NON_LABOR_RUBRO;
    const canonicalRubro = requireCanonicalRubro(rawRubro);
    
    const rubroSK = baselineId
      ? `${canonicalRubro}#${baselineId}#${index + 1}`
      : `${canonicalRubro}#baseline#${index + 1}`;

    items.push({
      rubroId: rubroSK,
      nombre: estimate.description || estimate.category || canonicalRubro,
      descripcion: estimate.description,
      category: estimate.category || "Non-labor",
      qty: 1,
      unit_cost: amount,
      currency,
      recurring,
      one_time: !recurring,
      start_month: startMonth,
      end_month: endMonth,
      total_cost: totalCost,
      metadata: {
        source: "baseline",
        baseline_id: baselineId,
        project_id: projectId,
        vendor: estimate.vendor,
        linea_codigo: canonicalRubro,
      },
    });
  });

  return items;
};

export const seedLineItemsFromBaseline = async (
  projectId: string,
  baseline: BaselinePayload,
  baselineId?: string,
  deps: RubroSeedDeps = {
    send: require("../lib/dynamo").sendDdb,
    tableName: require("../lib/dynamo").tableName,
  }
) => {
  try {
    // VALIDATION: Check if baseline has any estimates
    const { labor_estimates = [], non_labor_estimates = [] } = baseline;
    const hasEstimates = labor_estimates.length > 0 || non_labor_estimates.length > 0;
    
    // If no estimates, return early - do NOT seed synthetic rubros
    if (!hasEstimates) {
      console.warn("[seedLineItems] No estimates found in baseline; skipping seed operation", {
        projectId,
        baselineId,
        reason: "no_estimates",
      });
      
      return {
        seeded: 0,
        skipped: true,
        reason: "no_estimates",
      };
    }

    // Check if this baseline has already been seeded
    // Query all rubros for this project and filter by baseline_id in code
    if (baselineId) {
      let lastEvaluatedKey: Record<string, unknown> | undefined;
      let alreadySeededForBaseline = false;

      do {
        const existing = await deps.send(
          new QueryCommand({
            TableName: deps.tableName("rubros"),
            KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
            ExpressionAttributeValues: {
              ":pk": `PROJECT#${projectId}`,
              ":sk": "RUBRO#",
            },
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        // Filter in code by metadata.baseline_id or baselineId
        alreadySeededForBaseline = ((existing as any).Items || []).some(
          (item: any) =>
            item.metadata?.baseline_id === baselineId ||
            item.baselineId === baselineId
        );

        if (alreadySeededForBaseline) {
          break;
        }

        lastEvaluatedKey = (existing as any).LastEvaluatedKey as
          | Record<string, unknown>
          | undefined;
      } while (lastEvaluatedKey);

      if (alreadySeededForBaseline) {
        console.info("[seedLineItems] Baseline already seeded, skipping", {
          projectId,
          baselineId,
        });
        return { seeded: 0, skipped: true };
      }
    }

    const seedItems = buildSeedLineItems(baseline, projectId, baselineId);

    if (!seedItems.length) {
      console.warn("[seedLineItems] No line items generated from baseline", {
        projectId,
        baselineId,
        laborEstimatesCount: (baseline.labor_estimates || []).length,
        nonLaborEstimatesCount: (baseline.non_labor_estimates || []).length,
      });
      return { seeded: 0, skipped: true };
    }

    console.info("[seedLineItems] Starting rubros creation", {
      projectId,
      baselineId,
      totalItems: seedItems.length,
      laborItems: seedItems.filter(i => i.category === "Labor").length,
      nonLaborItems: seedItems.filter(i => i.category !== "Labor").length,
    });

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ item: string; error: string }> = [];

    for (const item of seedItems) {
      try {
        await deps.send(
          new PutCommand({
            TableName: deps.tableName("rubros"),
            Item: {
              pk: `PROJECT#${projectId}`,
              sk: `RUBRO#${item.rubroId}`,
              projectId,
              rubroId: item.rubroId,
              nombre: item.nombre,
              descripcion: item.descripcion,
              category: item.category,
              qty: item.qty,
              unit_cost: item.unit_cost,
              currency: item.currency,
              recurring: item.recurring,
              one_time: item.one_time,
              start_month: item.start_month,
              end_month: item.end_month,
              total_cost: item.total_cost,
              metadata: item.metadata,
              createdAt: new Date().toISOString(),
              createdBy: "prefactura-handoff",
            },
          })
        );
        successCount++;
      } catch (dynamoError) {
        errorCount++;
        const errorMessage = dynamoError instanceof Error ? dynamoError.message : String(dynamoError);
        errors.push({ item: item.rubroId, error: errorMessage });
        console.error("[seedLineItems] DynamoDB error creating rubro", {
          projectId,
          baselineId,
          rubroId: item.rubroId,
          error: errorMessage,
        });
      }
    }

    // Log final summary
    console.info("[seedLineItems] Rubros creation completed", {
      projectId,
      baselineId,
      totalItems: seedItems.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    });

    // Return success even if some items failed (partial success)
    return {
      seeded: successCount,
      skipped: false,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("[seedLineItems] Fatal error seeding baseline line items", {
      projectId,
      baselineId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logError("Failed to seed baseline line items", { projectId, baselineId, error });
    return { seeded: 0, skipped: true, error };
  }
};
