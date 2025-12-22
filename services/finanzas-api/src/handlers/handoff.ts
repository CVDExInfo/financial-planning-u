import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanWrite, ensureCanRead, getUserEmail } from "../lib/auth";
import {
  ddb,
  sendDdb,
  tableName,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  TransactWriteCommand,
} from "../lib/dynamo";
import { v4 as uuidv4 } from "uuid";
import { safeParseHandoff } from "../validation/handoff";
import { ZodError } from "zod";
import { bad, fromAuthError, notFound, ok, serverError } from "../lib/http";
import { resolveProjectForHandoff } from "../lib/projects-handoff";
import { logError } from "../utils/logging";
import {
  normalizeLaborEstimate,
  normalizeNonLaborEstimate,
  DEFAULT_LABOR_RUBRO,
  DEFAULT_NON_LABOR_RUBRO,
} from "../lib/rubros-taxonomy";

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

type RubroSeedDeps = {
  send: typeof sendDdb;
  tableName: typeof tableName;
};

const normalizeBaseline = (
  baseline: Record<string, unknown> | undefined
): BaselinePayload => {
  const payload = (baseline?.payload as BaselinePayload | undefined) || {};
  const dealInputs = (payload?.deal_inputs as BaselineDealInputs | undefined) || {};

  // Extract labor estimates from either payload or top-level
  // Support both snake_case (standard) and camelCase (from Estimator)
  const rawLaborEstimates =
    (baseline?.labor_estimates as any[] | undefined) ||
    (baseline?.laborEstimates as any[] | undefined) ||
    payload.labor_estimates ||
    (payload as any)?.laborEstimates ||
    [];

  // Extract non-labor estimates from either payload or top-level
  const rawNonLaborEstimates =
    (baseline?.non_labor_estimates as any[] | undefined) ||
    (baseline?.nonLaborEstimates as any[] | undefined) ||
    payload.non_labor_estimates ||
    (payload as any)?.nonLaborEstimates ||
    [];

  // Use shared normalization functions from taxonomy module
  const labor_estimates: BaselineLaborEstimate[] = rawLaborEstimates.map(normalizeLaborEstimate);
  const non_labor_estimates: BaselineNonLaborEstimate[] = rawNonLaborEstimates.map(normalizeNonLaborEstimate);

  return {
    project_id:
      (baseline?.project_id as string | undefined) ||
      (payload?.project_id as string | undefined),
    project_name:
      (baseline?.project_name as string | undefined) ||
      (payload?.project_name as string | undefined) ||
      dealInputs.project_name,
    client_name:
      (baseline?.client_name as string | undefined) ||
      (payload?.client_name as string | undefined) ||
      dealInputs.client_name,
    currency:
      (baseline?.currency as string | undefined) ||
      (payload?.currency as string | undefined) ||
      dealInputs.currency,
    sdm_manager_name:
      (baseline as { sdm_manager_name?: string } | undefined)?.sdm_manager_name ||
      (payload as { sdm_manager_name?: string } | undefined)?.sdm_manager_name ||
      (dealInputs as { sdm_manager_name?: string }).sdm_manager_name,
    start_date:
      (baseline?.start_date as string | undefined) ||
      (payload?.start_date as string | undefined) ||
      dealInputs.start_date,
    end_date:
      (baseline as { end_date?: string } | undefined)?.end_date ||
      (payload as { end_date?: string } | undefined)?.end_date ||
      dealInputs.end_date,
    duration_months:
      (baseline?.duration_months as number | undefined) ||
      (payload?.duration_months as number | undefined) ||
      dealInputs.duration_months,
    contract_value:
      (baseline?.contract_value as number | undefined) ||
      (payload?.contract_value as number | undefined) ||
      dealInputs.contract_value,
    labor_estimates,
    non_labor_estimates,
    deal_inputs: dealInputs,
  };
};

const buildSeedLineItems = (
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

    const canonicalRubroId = estimate.rubroId || DEFAULT_LABOR_RUBRO;
    const rubroSK = baselineId
      ? `${canonicalRubroId}#${baselineId}#${index + 1}`
      : `${canonicalRubroId}#baseline#${index + 1}`;

    items.push({
      rubroId: rubroSK,
      nombre: estimate.role || canonicalRubroId,
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
        linea_codigo: canonicalRubroId,
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

    const canonicalRubroId = estimate.rubroId || DEFAULT_NON_LABOR_RUBRO;
    const rubroSK = baselineId
      ? `${canonicalRubroId}#${baselineId}#${index + 1}`
      : `${canonicalRubroId}#baseline#${index + 1}`;

    items.push({
      rubroId: rubroSK,
      nombre: estimate.description || estimate.category || canonicalRubroId,
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
        linea_codigo: canonicalRubroId,
      },
    });
  });

  return items;
};

const seedLineItemsFromBaseline = async (
  projectId: string,
  baseline: BaselinePayload,
  baselineId?: string,
  deps: RubroSeedDeps = { send: sendDdb, tableName }
) => {
  try {
    // VALIDATION: Check if baseline has any estimates
    const { labor_estimates = [], non_labor_estimates = [] } = baseline;
    if (!labor_estimates.length && !non_labor_estimates.length) {
      console.error("[seedLineItems] No estimates found in baseline; cannot seed rubros", {
        projectId,
        baselineId,
      });
      return { seeded: 0, skipped: true, error: "no_estimates" as const };
    }

    // Check if this baseline has already been seeded
    // Query all rubros for this project and filter by baseline_id in code
    if (baselineId) {
      const existing = await deps.send(
        new QueryCommand({
          TableName: deps.tableName("rubros"),
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
            ":sk": "RUBRO#",
          },
        })
      );

      // Filter in code by metadata.baseline_id or baselineId
      const alreadySeededForBaseline = (existing.Items || []).some(
        (item: any) =>
          item.metadata?.baseline_id === baselineId ||
          item.baselineId === baselineId
      );

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
        laborEstimatesCount: labor_estimates.length,
        nonLaborEstimatesCount: non_labor_estimates.length,
      });
      return { seeded: 0, skipped: true };
    }

    console.info("[seedLineItems] Starting rubros creation", {
      projectId,
      baselineId,
      totalItems: seedItems.length,
      laborItems: seedItems.filter(i => i.category === 'Labor').length,
      nonLaborItems: seedItems.filter(i => i.category !== 'Labor').length,
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

// Route: GET /projects/{projectId}/handoff
async function getHandoff(event: APIGatewayProxyEventV2) {
  await ensureCanRead(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "missing project id" }),
    };
  }

  // Query for the handoff record for this project
  const result = await sendDdb(
    new QueryCommand({
      TableName: tableName("projects"),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
        ":sk": "HANDOFF#",
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 1,
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "handoff not found" }),
    };
  }

  const handoff = result.Items[0];
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handoffId: handoff.handoffId,
      projectId: projectId,
      owner: handoff.owner,
      fields: handoff.fields || {},
      version: handoff.version || 1,
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
    }),
  };
}

// Route: POST /projects/{projectId}/handoff (idempotent)
async function createHandoff(event: APIGatewayProxyEventV2) {
  await ensureCanWrite(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "missing project id" }),
    };
  }

  const idempotencyKey = event.headers["x-idempotency-key"];
  if (!idempotencyKey) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "X-Idempotency-Key header required" }),
    };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  const userEmail = await getUserEmail(event);
  const now = new Date().toISOString();

  // Extract baseline_id from payload early - needed for project resolution
  const baselineId = ((body.baseline_id || body.baselineId) as string | undefined)?.trim();
  if (!baselineId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "baselineId required for handoff" }),
    };
  }

  // Resolve which project to use for this handoff
  // This function handles idempotency, baseline collision detection, and project search
  let resolvedProjectId: string;
  let existingProjectMetadata: Record<string, unknown> | undefined;
  let isNewProject: boolean;

  try {
    const resolution = await resolveProjectForHandoff({
      ddb,
      tableName,
      incomingProjectId: projectId,
      baselineId,
      idempotencyKey,
    });

    resolvedProjectId = resolution.resolvedProjectId;
    existingProjectMetadata = resolution.existingProjectMetadata;
    isNewProject = resolution.isNewProject;

    console.info("[handoff] Project resolved", {
      incomingProjectId: projectId,
      resolvedProjectId,
      baselineId,
      isNewProject,
    });
  } catch (error) {
    // Handle idempotency conflicts or other resolution errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("Idempotency key")) {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: errorMessage,
        }),
      };
    }

    console.error("[handoff] Project resolution failed", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to resolve project for handoff",
      }),
    };
  }

  // Defensive read: if metadata already exists with a different baseline, bail out
  const currentMetadata = await ddb.send(
    new GetCommand({
      TableName: tableName("projects"),
      Key: {
        pk: `PROJECT#${resolvedProjectId}`,
        sk: "METADATA",
      },
    })
  );

  const currentBaselineId = (currentMetadata.Item?.baseline_id || currentMetadata.Item?.baselineId) as
    | string
    | undefined;

  if (currentMetadata.Item && currentBaselineId && currentBaselineId !== baselineId) {
    console.error("[handoff] Refusing to overwrite METADATA for different baseline", {
      projectId: resolvedProjectId,
      existingBaselineId: currentBaselineId,
      newBaselineId: baselineId,
      idempotencyKey,
    });

    return {
      statusCode: 409,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "baseline collision detected: metadata already exists for a different baseline",
      }),
    };
  }

  // Check if idempotency key has been used (for returning cached result)
  const idempotencyCheck = await sendDdb(
    new GetCommand({
      TableName: tableName("projects"),
      Key: {
        pk: `IDEMPOTENCY#HANDOFF`,
        sk: idempotencyKey,
      },
    })
  );

  if (idempotencyCheck.Item) {
    // Check if payload matches
    const existingPayload = JSON.stringify(idempotencyCheck.Item.payload);
    const currentPayload = JSON.stringify(body);
    
    if (existingPayload !== currentPayload) {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Conflict: idempotency key used with different payload",
        }),
      };
    }

    // Return the existing result
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(idempotencyCheck.Item.result),
    };
  }

  // ENHANCED BASELINE LOADING WITH COMPREHENSIVE DIAGNOSTICS
  // Fetch baseline data from prefacturas table to get project details and estimates
  // Strategy: Try multiple sources in order until we find estimates
  // 1. BASELINE#{baselineId}/METADATA (has payload with nested estimates)
  // 2. PROJECT#{projectId}/BASELINE#{baselineId} (has estimates at top level)
  
  console.info("[handoff] Starting baseline data fetch", {
    baselineId,
    projectId: resolvedProjectId,
    step: "baseline_fetch_start",
  });

  // Try METADATA record first (has payload)
  const baselineMetadataResult = await sendDdb(
    new GetCommand({
      TableName: tableName("prefacturas"),
      Key: {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
      },
    })
  );

  const metadataBaseline = baselineMetadataResult.Item;
  
  // Log what we found in METADATA
  console.info("[handoff] METADATA baseline query result", {
    baselineId,
    projectId: resolvedProjectId,
    found: !!metadataBaseline,
    hasPayload: !!metadataBaseline?.payload,
    payloadKeys: metadataBaseline?.payload ? Object.keys(metadataBaseline.payload) : [],
    hasPayloadLaborEstimates: Array.isArray((metadataBaseline?.payload as any)?.labor_estimates),
    payloadLaborCount: Array.isArray((metadataBaseline?.payload as any)?.labor_estimates) 
      ? (metadataBaseline.payload as any).labor_estimates.length 
      : 0,
    hasPayloadNonLaborEstimates: Array.isArray((metadataBaseline?.payload as any)?.non_labor_estimates),
    payloadNonLaborCount: Array.isArray((metadataBaseline?.payload as any)?.non_labor_estimates)
      ? (metadataBaseline.payload as any).non_labor_estimates.length
      : 0,
  });

  // Try project-scoped baseline as fallback
  const projectBaselineResult = await sendDdb(
    new GetCommand({
      TableName: tableName("prefacturas"),
      Key: {
        pk: `PROJECT#${resolvedProjectId}`,
        sk: `BASELINE#${baselineId}`,
      },
    })
  );

  const projectBaseline = projectBaselineResult.Item;
  
  // Log what we found in project-scoped baseline
  console.info("[handoff] Project-scoped baseline query result", {
    baselineId,
    projectId: resolvedProjectId,
    found: !!projectBaseline,
    hasTopLevelLaborEstimates: Array.isArray(projectBaseline?.labor_estimates),
    topLevelLaborCount: Array.isArray(projectBaseline?.labor_estimates) 
      ? projectBaseline.labor_estimates.length 
      : 0,
    hasTopLevelNonLaborEstimates: Array.isArray(projectBaseline?.non_labor_estimates),
    topLevelNonLaborCount: Array.isArray(projectBaseline?.non_labor_estimates) 
      ? projectBaseline.non_labor_estimates.length 
      : 0,
  });

  // Determine which baseline to use based on presence of estimates
  let baseline: Record<string, unknown> | undefined;
  let baselineSource: string;
  
  // Check METADATA baseline for estimates
  const metadataHasLaborEstimates = 
    Array.isArray((metadataBaseline?.payload as any)?.labor_estimates) && 
    (metadataBaseline.payload as any).labor_estimates.length > 0;
  const metadataHasNonLaborEstimates = 
    Array.isArray((metadataBaseline?.payload as any)?.non_labor_estimates) && 
    (metadataBaseline.payload as any).non_labor_estimates.length > 0;
  
  // Check project-scoped baseline for estimates
  const projectHasLaborEstimates = 
    Array.isArray(projectBaseline?.labor_estimates) && 
    projectBaseline.labor_estimates.length > 0;
  const projectHasNonLaborEstimates = 
    Array.isArray(projectBaseline?.non_labor_estimates) && 
    projectBaseline.non_labor_estimates.length > 0;

  // Prefer baseline with estimates
  if ((metadataHasLaborEstimates || metadataHasNonLaborEstimates) && metadataBaseline) {
    baseline = metadataBaseline;
    baselineSource = "METADATA";
    console.info("[handoff] Using METADATA baseline (has estimates)", {
      baselineId,
      projectId: resolvedProjectId,
      laborCount: metadataHasLaborEstimates ? (metadataBaseline.payload as any).labor_estimates.length : 0,
      nonLaborCount: metadataHasNonLaborEstimates ? (metadataBaseline.payload as any).non_labor_estimates.length : 0,
    });
  } else if ((projectHasLaborEstimates || projectHasNonLaborEstimates) && projectBaseline) {
    baseline = projectBaseline;
    baselineSource = "PROJECT_SCOPED";
    console.info("[handoff] Using project-scoped baseline (has estimates)", {
      baselineId,
      projectId: resolvedProjectId,
      laborCount: projectHasLaborEstimates ? projectBaseline.labor_estimates.length : 0,
      nonLaborCount: projectHasNonLaborEstimates ? projectBaseline.non_labor_estimates.length : 0,
    });
  } else if (metadataBaseline) {
    // Fallback to METADATA even without estimates (for project metadata)
    baseline = metadataBaseline;
    baselineSource = "METADATA_NO_ESTIMATES";
    console.warn("[handoff] Using METADATA baseline but NO ESTIMATES FOUND", {
      baselineId,
      projectId: resolvedProjectId,
      warning: "Baseline exists but contains no labor_estimates or non_labor_estimates",
    });
  } else if (projectBaseline) {
    // Fallback to project-scoped even without estimates
    baseline = projectBaseline;
    baselineSource = "PROJECT_SCOPED_NO_ESTIMATES";
    console.warn("[handoff] Using project-scoped baseline but NO ESTIMATES FOUND", {
      baselineId,
      projectId: resolvedProjectId,
      warning: "Baseline exists but contains no labor_estimates or non_labor_estimates",
    });
  } else {
    // No baseline found anywhere
    baseline = undefined;
    baselineSource = "NOT_FOUND";
    console.error("[handoff] CRITICAL: No baseline found in any location", {
      baselineId,
      projectId: resolvedProjectId,
      error: "Baseline not found in METADATA or project-scoped records",
      checkedKeys: [
        `pk: BASELINE#${baselineId}, sk: METADATA`,
        `pk: PROJECT#${resolvedProjectId}, sk: BASELINE#${baselineId}`,
      ],
    });
  }

  // Helper function to extract project data from baseline or request body
  // This allows contract tests to work without requiring baseline seed data
  const extractProjectData = (baseline: Record<string, any> | undefined, body: Record<string, any>) => {
    const payload = baseline?.payload || {};
    return {
      projectName: payload.project_name || baseline?.project_name || body.project_name || body.projectName || "Unnamed Project",
      clientName: payload.client_name || baseline?.client_name || body.client_name || body.clientName || body.client || "",
      currency: payload.currency || baseline?.currency || body.currency || "USD",
      startDate: payload.start_date || baseline?.start_date || body.start_date || body.startDate || now,
      durationMonths: payload.duration_months || baseline?.duration_months || body.duration_months || body.durationMonths || 12,
      totalAmount: baseline?.total_amount || body.mod_total || body.modTotal || 0,
    };
  };
  
  const { projectName, clientName, currency, startDate, durationMonths, totalAmount } = extractProjectData(baseline, body);

  // Calculate end_date from start_date + duration_months
  // Using proper date arithmetic to handle month boundaries and leap years correctly
  let endDate = baseline?.payload?.end_date || baseline?.end_date || body.end_date || body.endDate;
  if (!endDate && startDate && durationMonths) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      // Add months by adjusting year and month separately to handle boundaries correctly
      const end = new Date(start);
      const targetMonth = end.getMonth() + durationMonths;
      const yearsToAdd = Math.floor(targetMonth / 12);
      const monthsToAdd = targetMonth % 12;
      
      end.setFullYear(end.getFullYear() + yearsToAdd);
      end.setMonth(monthsToAdd);
      
      // Handle day overflow (e.g., Jan 31 + 1 month should be Feb 28/29, not Mar 3)
      // If the day changed unexpectedly, set to last day of previous month
      const originalDay = start.getDate();
      if (end.getDate() !== originalDay && end.getDate() < originalDay) {
        // Day overflowed, set to last day of target month
        end.setDate(0); // Sets to last day of previous month (which is our target)
      }
      
      endDate = end.toISOString().split('T')[0]; // yyyy-mm-dd format
    }
  }

  // CRITICAL: Handoff MUST set status to "handed_off" (NOT "accepted")
  // Only SDMT can accept baselines via PATCH /projects/{projectId}/accept-baseline
  const baselineStatus = "handed_off";
  const sdmManagerName =
    (body.fields as { sdm_manager_name?: string } | undefined)?.sdm_manager_name ||
    (body as { sdm_manager_name?: string }).sdm_manager_name;
  const sdmManagerEmail = (
    (body.fields as { sdm_manager_email?: string } | undefined)?.sdm_manager_email ||
    (body as { sdm_manager_email?: string }).sdm_manager_email ||
    baseline?.payload?.sdm_manager_email
  )?.toLowerCase();

  // Create new handoff record with resolved project ID
  const handoffId = `handoff_${uuidv4().replace(/-/g, "").substring(0, 10)}`;
  const handoff = {
    pk: `PROJECT#${resolvedProjectId}`,
    sk: `HANDOFF#${handoffId}`,
    handoffId,
    projectId: resolvedProjectId,
    baselineId,
    owner: body.owner || userEmail,
    fields: body.fields || body, // Support both structured and flat formats
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: userEmail,
    sdm_manager_name: sdmManagerName,
  };

  // Generate a clean project code from baseline or resolvedProjectId
  // For handoff projects, we want a short, human-readable code like "P-8charHash"
  // NOT the long UUID-based projectId like "P-e3f6647d-3b01-492d-8e54-28bcedcf8919"
  const MAX_CLEAN_CODE_LENGTH = 20;
  const CODE_SUFFIX_LENGTH = 8;
  let projectCode = resolvedProjectId;
  
  // If resolvedProjectId is a long UUID (contains hyphens and is long), generate a shorter code
  // based on the baseline ID to ensure consistency
  if (resolvedProjectId.length > MAX_CLEAN_CODE_LENGTH || /^P-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedProjectId)) {
    // Generate a short code from baseline ID
    const baselineIdShort = baselineId.replace(/^base_/, '').substring(0, CODE_SUFFIX_LENGTH);
    projectCode = `P-${baselineIdShort}`;
  }

  // Create/update SDMT-ready project in projects table
  // If we have existing metadata, preserve important fields
  const projectMetadata = {
    pk: `PROJECT#${resolvedProjectId}`,
    sk: "METADATA",
    id: resolvedProjectId,
    project_id: resolvedProjectId,
    projectId: resolvedProjectId,
    name: projectName,
    nombre: projectName,
    client: clientName || "",
    cliente: clientName || "",
    code: projectCode,
    codigo: projectCode,
    status: "active",
    estado: "active",
    module: "SDMT",
    source: "prefactura",
    baseline_id: baselineId,
    baseline_status: baselineStatus, // Always "handed_off" for handoff - NEVER "accepted"
    // Handoff signature metadata (NOT acceptance)
    // These track WHO handed off the baseline, not who accepted it
    handed_off_by: body.aceptado_por || body.owner || userEmail,
    handed_off_at: now,
    // Acceptance fields remain undefined until SDMT explicitly accepts via PATCH /accept-baseline
    // accepted_by: undefined,
    // baseline_accepted_at: undefined,
    currency,
    moneda: currency,
    start_date: startDate,
    fecha_inicio: startDate,
    end_date: endDate || null,
    fecha_fin: endDate || null,
    duration_months: durationMonths,
    mod_total: totalAmount,
    presupuesto_total: totalAmount,
    created_at: existingProjectMetadata?.created_at || now,
    updated_at: now,
    created_by: existingProjectMetadata?.created_by || userEmail,
    sdm_manager_name: sdmManagerName,
    sdm_manager_email: sdmManagerEmail,
  };

  // Store handoff record and project metadata atomically
  // Use TransactWriteCommand to ensure both records are written together
  // This prevents partial writes and ensures data consistency
  
  // Add diagnostic logging for the write operation
  console.info("[handoff] Writing baseline-project link", {
    level: "INFO",
    msg: "Writing baseline-project link",
    projectId: resolvedProjectId,
    baselineId,
    pk: `PROJECT#${resolvedProjectId}`,
    sk: "METADATA",
  });

  try {
    // Use a transaction to write both the handoff and metadata records atomically
    // This ensures that if one write fails, both fail, maintaining data consistency
    await sendDdb(
      new TransactWriteCommand({
        TransactItems: [
          // Write handoff record
          {
            Put: {
              TableName: tableName("projects"),
              Item: handoff,
            },
          },
          // Write or update project metadata
          // CRITICAL: Use ConditionExpression to prevent overwriting existing baseline_id
          // This safeguards against data lineage corruption
          {
            Put: {
              TableName: tableName("projects"),
              Item: projectMetadata,
              // Only write if:
              // 1. The record doesn't exist yet (attribute_not_exists), OR
              // 2. The existing baseline_id matches what we're trying to write
              // This prevents accidental overwrite of a different baseline
              ConditionExpression:
                "attribute_not_exists(pk) OR attribute_not_exists(baseline_id) OR baseline_id = :baselineId",
              ExpressionAttributeValues: {
                ":baselineId": baselineId,
              },
            },
          },
        ],
      })
    );
  } catch (error) {
    // Handle conditional check failures
    const errorName = (error as { name?: string })?.name;
    if (errorName === "TransactionCanceledException") {
      // Check if it was due to our condition
      const reasons = (error as { CancellationReasons?: Array<{ Code?: string }> })
        ?.CancellationReasons;
      const conditionFailed = reasons?.some((r) => r.Code === "ConditionalCheckFailed");

      if (conditionFailed) {
        console.error("[handoff] Baseline overwrite prevented", {
          projectId: resolvedProjectId,
          attemptedBaselineId: baselineId,
          existingBaselineId: currentMetadata.Item?.baseline_id,
        });

        return {
          statusCode: 409,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error:
              "Cannot overwrite existing baseline for this project. A different baseline is already linked.",
            projectId: resolvedProjectId,
            existingBaselineId: currentMetadata.Item?.baseline_id,
            attemptedBaselineId: baselineId,
          }),
        };
      }
    }

    // Re-throw other errors
    console.error("[handoff] Failed to write handoff and metadata", error);
    throw error;
  }

  const normalizedBaseline = normalizeBaseline(baseline);
  
  // DIAGNOSTIC: Log normalized baseline to see what estimates we extracted
  const hasLaborEstimates = normalizedBaseline.labor_estimates && normalizedBaseline.labor_estimates.length > 0;
  const hasNonLaborEstimates = normalizedBaseline.non_labor_estimates && normalizedBaseline.non_labor_estimates.length > 0;
  
  console.info("[handoff] Normalized baseline for rubros seeding", {
    projectId: resolvedProjectId,
    baselineId,
    baselineSource,
    hasLaborEstimates,
    laborCount: normalizedBaseline.labor_estimates?.length || 0,
    hasNonLaborEstimates,
    nonLaborCount: normalizedBaseline.non_labor_estimates?.length || 0,
    laborSample: normalizedBaseline.labor_estimates?.slice(0, 2).map(e => ({
      rubroId: e.rubroId,
      role: e.role,
      hourlyRate: e.hourly_rate || e.rate,
      fteCount: e.fte_count,
    })),
    nonLaborSample: normalizedBaseline.non_labor_estimates?.slice(0, 2).map(e => ({
      rubroId: e.rubroId,
      description: e.description,
      amount: e.amount,
    })),
  });

  // VALIDATION: Warn if no estimates found anywhere
  if (!hasLaborEstimates && !hasNonLaborEstimates) {
    console.error("[handoff] CRITICAL: No baseline estimates found for project/baseline", {
      projectId: resolvedProjectId,
      baselineId,
      baselineSource,
      error: "Cannot materialize rubros without labor_estimates or non_labor_estimates",
      handoffBody: {
        hasBodyLaborEstimates: Array.isArray(body.labor_estimates),
        hasBodyNonLaborEstimates: Array.isArray(body.non_labor_estimates),
        bodyKeys: Object.keys(body),
      },
      recommendation: "Check that the baseline was created with estimates in the prefactura API, or ensure the handoff body includes estimates arrays",
    });
  }
  
  const seedResult = await seedLineItemsFromBaseline(
    resolvedProjectId,
    normalizedBaseline,
    baselineId
  );

  console.info("[handoff] Seeded baseline rubros", {
    projectId: resolvedProjectId,
    baselineId,
    baselineSource,
    seeded: seedResult.seeded,
    skipped: seedResult.skipped,
    hasEstimates: hasLaborEstimates || hasNonLaborEstimates,
  });

  // Store idempotency record (with 24h TTL)
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  
  // API Response Contract: handoffId is REQUIRED for Postman contract tests
  // and for linking POST (create) with PUT (update) operations
  // handoffId format: handoff_<10-char-uuid>
  const result = {
    handoffId,              // REQUIRED: API contract for POST /projects/{projectId}/handoff
    projectId: resolvedProjectId,
    baselineId,
    status: "HandoffComplete",
    baseline_status: baselineStatus, // Always "handed_off" - acceptance happens later via SDMT
    // Handoff signature metadata (NOT acceptance)
    handed_off_by: projectMetadata.handed_off_by,
    handed_off_at: projectMetadata.handed_off_at,
    // Acceptance fields are undefined until SDMT accepts
    accepted_by: undefined,
    baseline_accepted_at: undefined,
    owner: handoff.owner,
    fields: handoff.fields,
    version: handoff.version,
    createdAt: handoff.createdAt,
    updatedAt: handoff.updatedAt,
    // Additional fields from PR 515 - data lineage fix
    projectName,
    client: clientName || "",
    code: projectCode,
    startDate,
    endDate: endDate || null,
    durationMonths,
    currency,
    modTotal: totalAmount,
    sdm_manager_name: sdmManagerName,
    seededRubros: seedResult.seeded,
  };

  const idempotencyRecord = {
    pk: `IDEMPOTENCY#HANDOFF`,
    sk: idempotencyKey,
    payload: body,
    result,
    ttl,
  };

  await sendDdb(
    new PutCommand({
      TableName: tableName("projects"),
      Item: idempotencyRecord,
    })
  );

  // Audit log
  const audit = {
    pk: `ENTITY#PROJECT#${resolvedProjectId}`,
    sk: `TS#${now}`,
    action: "HANDOFF_CREATE",
    resource_type: "handoff",
    resource_id: handoffId,
    user: userEmail,
    timestamp: now,
    before: existingProjectMetadata || null,
    after: {
      handoff,
      project: projectMetadata,
    },
    source: "API",
    ip_address: event.requestContext.http.sourceIp,
    user_agent: event.requestContext.http.userAgent,
  };

  await sendDdb(
    new PutCommand({
      TableName: tableName("audit_log"),
      Item: audit,
    })
  );

  // Return 201 Created for successful handoff creation
  // The response MUST include handoffId for API contract compliance (Postman tests)
  // handoffId is derived from: handoff_${uuidv4()} - see line 200
  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  };
}

// Route: PUT /handoff/{handoffId}
async function updateHandoff(event: APIGatewayProxyEventV2) {
  await ensureCanWrite(event);
  const handoffId = event.pathParameters?.handoffId;
  if (!handoffId) {
    return bad("missing handoff id");
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return bad("Invalid JSON in request body");
    }

    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) {
      return bad("projectId required in request body");
    }

    // Lookup the handoff first so nonexistent IDs return 404 instead of validation errors
    const existing = await sendDdb(
      new GetCommand({
        TableName: tableName("projects"),
        Key: {
          pk: `PROJECT#${projectId}`,
          sk: `HANDOFF#${handoffId}`,
        },
      })
    );

    if (!existing.Item) {
      return notFound("handoff not found");
    }

    // Validate handoff data if fields are provided
    const fieldsToValidate = body.fields || body;
    const validationResult = safeParseHandoff(fieldsToValidate);
    if (!validationResult.success) {
      return bad("Validation failed", 400);
    }

    const userEmail = await getUserEmail(event);
    const now = new Date().toISOString();
    const expectedVersion = body.version ? Number(body.version) : undefined;
    const currentVersion = existing.Item.version || 1;

    // Optimistic concurrency check
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      return bad("Precondition failed: version mismatch", 412);
    }

    const newVersion = currentVersion + 1;

    // Update handoff
    const updated = await sendDdb(
      new UpdateCommand({
        TableName: tableName("projects"),
        Key: {
          pk: `PROJECT#${projectId}`,
          sk: `HANDOFF#${handoffId}`,
        },
        UpdateExpression:
          "SET #fields = :fields, #version = :version, #updatedAt = :updatedAt, #updatedBy = :updatedBy, #owner = if_not_exists(#owner, :owner)",
        ExpressionAttributeNames: {
          "#fields": "fields",
          "#version": "version",
          "#updatedAt": "updatedAt",
          "#updatedBy": "updatedBy",
          "#owner": "owner",
        },
        ConditionExpression: "#version = :currentVersion",
        ExpressionAttributeValues: {
          ...{
            ":fields": body.fields || body,
            ":version": newVersion,
            ":updatedAt": now,
            ":updatedBy": userEmail,
            ":owner": body.owner || userEmail,
          },
          ":currentVersion": currentVersion,
        },
        ReturnValues: "ALL_NEW",
      })
    );

    // Audit log
    const audit = {
      pk: `ENTITY#PROJECT#${projectId}`,
      sk: `TS#${now}`,
      action: "HANDOFF_UPDATE",
      resource_type: "handoff",
      resource_id: handoffId,
      user: userEmail,
      timestamp: now,
      before: existing.Item,
      after: updated.Attributes,
      source: "API",
      ip_address: event.requestContext.http.sourceIp,
      user_agent: event.requestContext.http.userAgent,
    };

    await sendDdb(
      new PutCommand({
        TableName: tableName("audit_log"),
        Item: audit,
      })
    );

    return ok({
      handoffId: updated.Attributes?.handoffId,
      projectId: updated.Attributes?.projectId,
      owner: updated.Attributes?.owner,
      fields: updated.Attributes?.fields,
      version: updated.Attributes?.version,
      createdAt: updated.Attributes?.createdAt,
      updatedAt: updated.Attributes?.updatedAt,
    });
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) return authError;
    console.error("Error updating handoff", error);
    return serverError();
  }
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath || event.requestContext.http.path;

    // Route based on method and path
    if (method === "GET" && path.includes("/projects/")) {
      return await getHandoff(event);
    } else if (method === "POST" && path.includes("/projects/")) {
      return await createHandoff(event);
    } else if (method === "PUT" && path.includes("/handoff/")) {
      return await updateHandoff(event);
    } else {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }
  } catch (err: unknown) {
    // Handle Zod validation errors
    if (err instanceof ZodError) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Validation failed",
          details: err.errors,
        }),
      };
    }

    // Handle auth errors
    if (
      typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      "body" in err
    ) {
      return {
        statusCode: (err as { statusCode: number }).statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: (err as { body: string }).body,
        }),
      };
    }

    console.error("Handoff handler error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

export { normalizeBaseline, buildSeedLineItems, seedLineItemsFromBaseline };
