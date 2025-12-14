import { APIGatewayProxyEventV2 } from "aws-lambda";
import { z } from "zod";
import { ensureCanRead, ensureCanWrite, getUserContext } from "../lib/auth";
import { ok, bad, serverError, fromAuthError } from "../lib/http";
import {
  ddb,
  tableName,
  PutCommand,
  ScanCommand,
  GetCommand,
  QueryCommand,
} from "../lib/dynamo";
import { logError } from "../utils/logging";
import crypto from "node:crypto";
import { mapToProjectDTO, type ProjectRecord, type ProjectDTO } from "../models/project";

/**
 * RBAC Filter Patterns for Project Visibility
 * 
 * - ADMIN/PMO/SDMT/EXEC_RO: See all tenant projects
 * - SDM: See projects where ANY of these match their email:
 *   1. sdm_manager_email (explicit assignment)
 *   2. accepted_by / aceptado_por (baseline acceptor)
 *   3. created_by (creator fallback for orphaned projects)
 * 
 * This prevents "orphaned" projects where SDM users created them but
 * no sdm_manager_email was set, which was the root cause of the regression.
 */

/**
 * Generate a unique handoff ID
 * Format: handoff_<10-char-uuid>
 */
function generateHandoffId(): string {
  return `handoff_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

/**
 * Generate a short, human-friendly project code from projectId and baselineId
 * If projectId is a long UUID (P-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), 
 * convert it to P-<8chars> using baselineId or projectId hash
 * Otherwise, keep the projectId as-is
 */
function generateShortProjectCode(projectId: string, baselineId?: string): string {
  const MAX_CLEAN_CODE_LENGTH = 20;
  const CODE_SUFFIX_LENGTH = 8;
  
  // Check if projectId is a long UUID format
  const isLongUuid = /^P-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  
  if (projectId.length > MAX_CLEAN_CODE_LENGTH || isLongUuid) {
    // Try to extract short code from baselineId
    if (baselineId) {
      const baselineIdShort = baselineId
        .replace(/^base_/, '')
        .substring(0, CODE_SUFFIX_LENGTH);
      return `P-${baselineIdShort}`;
    }
    
    // Fallback: use first 8 chars of projectId UUID (after P-)
    const uuidPart = projectId.replace(/^P-/, '').replace(/-/g, '');
    return `P-${uuidPart.substring(0, CODE_SUFFIX_LENGTH)}`;
  }
  
  // Short projectId - keep as-is
  return projectId;
}

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

// Default rubro codes for fallback scenarios
const DEFAULT_LABOR_RUBRO = "MOD-ING";
const DEFAULT_NON_LABOR_RUBRO = "GSV-OTHER";

type BaselineLaborEstimate = {
  rubroId?: string;  // Canonical rubro ID from taxonomy (e.g., "MOD-ING", "MOD-LEAD")
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
  rubroId?: string;  // Canonical rubro ID from taxonomy (e.g., "GSV-REU", "SOI-AWS")
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

/**
 * Payload sent by the UI (Crear Proyecto modal)
 * {
 *   name: string;       // e.g. "Mobile Banking App MVP"
 *   code: string;       // PROJ-YYYY-NNN
 *   client: string;     // customer name
 *   start_date: string; // yyyy-mm-dd
 *   end_date: string;   // yyyy-mm-dd
 *   currency: "USD" | "EUR" | "MXN"
 *   mod_total: number;  // numeric MOD budget
 *   description?: string;
 * }
 */

const dateString = z
  .string()
  .min(8, "Date is required")
  .refine((val) => !Number.isNaN(Date.parse(val)), "Invalid date format");

const projectPayloadSchema = z.object({
  name: z.string().min(3).max(200),
  code: z.string().regex(/^PROJ-\d{4}-\d{3}$/),
  client: z.string().min(2).max(200),
  start_date: dateString,
  end_date: dateString,
  currency: z.enum(["USD", "EUR", "MXN"]),
  mod_total: z
    .coerce
    .number({ invalid_type_error: "mod_total must be a number" })
    .min(0, "mod_total must be zero or greater"),
  description: z.string().max(1000).optional(),
});

const normalizeIncomingProject = (raw: Record<string, unknown>) => ({
  name: raw.name ?? raw.nombre,
  code: raw.code ?? raw.codigo,
  client: raw.client ?? raw.cliente,
  start_date: raw.start_date ?? raw.startDate ?? raw.fecha_inicio,
  end_date: raw.end_date ?? raw.endDate ?? raw.fecha_fin,
  currency: raw.currency ?? raw.moneda,
  mod_total: raw.mod_total ?? raw.modTotal ?? raw.presupuesto_total,
  description: raw.description ?? raw.descripcion ?? raw.project_description,
});

export const normalizeProjectItem = (
  item: Record<string, unknown>
): Record<string, unknown> => {
  let derivedId =
    (typeof item.pk === "string" && item.pk.startsWith("PROJECT#")
      ? item.pk.replace("PROJECT#", "")
      : undefined) ||
    (item as Record<string, unknown>).project_id ||
    (item as Record<string, unknown>).projectId ||
    (item as Record<string, unknown>).id;

  if (!derivedId) {
    derivedId = String(
      (item as Record<string, unknown>).pk ??
        (item as Record<string, unknown>).sk ??
        "UNKNOWN-PROJECT"
    );
  }

  const fecha_fin =
    (item as Record<string, unknown>).fecha_fin ||
    (item as Record<string, unknown>).fechaFin ||
    (item as Record<string, unknown>).end_date ||
    (item as Record<string, unknown>).endDate ||
    null;

  const start_date =
    (item as Record<string, unknown>).fecha_inicio ||
    (item as Record<string, unknown>).fechaInicio ||
    (item as Record<string, unknown>).start_date ||
    (item as Record<string, unknown>).startDate ||
    null;

  // Extract existing code or generate short code
  const existingCode = 
    (item as Record<string, unknown>).code ??
    (item as Record<string, unknown>).codigo;
  
  const baselineId = 
    (item as Record<string, unknown>).baseline_id ||
    (item as Record<string, unknown>).baselineId;
  
  const shortCode = existingCode 
    ? String(existingCode)
    : generateShortProjectCode(String(derivedId), baselineId ? String(baselineId) : undefined);

  return {
    id: derivedId,
    identifier: derivedId,
    project_id: derivedId,
    projectId: derivedId,
    cliente: (item as Record<string, unknown>).cliente ?? null,
    client: (item as Record<string, unknown>).client ??
      (item as Record<string, unknown>).cliente ?? null,
    sdm_manager_name:
      (item as Record<string, unknown>).sdm_manager_name ??
      (item as Record<string, unknown>).sd_manager_name ??
      null,
    nombre: (item as Record<string, unknown>).nombre ?? null,
    name:
      (item as Record<string, unknown>).name ??
      (item as Record<string, unknown>).nombre ??
      null,
    code: shortCode,
    codigo: shortCode,
    fecha_inicio: start_date,
    start_date,
    fecha_fin,
    end_date: fecha_fin,
    moneda: (item as Record<string, unknown>).moneda ?? null,
    currency:
      (item as Record<string, unknown>).currency ??
      (item as Record<string, unknown>).moneda ??
      null,
    presupuesto_total: Number(
      (item as Record<string, unknown>).presupuesto_total ||
        (item as Record<string, unknown>).presupuestoTotal ||
        (item as Record<string, unknown>).mod_total ||
        (item as Record<string, unknown>).modTotal ||
        0
    ),
    mod_total: Number(
      (item as Record<string, unknown>).mod_total ||
        (item as Record<string, unknown>).presupuesto_total ||
        (item as Record<string, unknown>).presupuestoTotal ||
        0
    ),
    estado: (item as Record<string, unknown>).estado ?? null,
    status:
      (item as Record<string, unknown>).status ??
      (item as Record<string, unknown>).estado ??
      null,
    description:
      (item as Record<string, unknown>).description ??
      (item as Record<string, unknown>).descripcion ??
      null,
    descripcion:
      (item as Record<string, unknown>).descripcion ??
      (item as Record<string, unknown>).description ??
      null,
    created_at:
      (item as Record<string, unknown>).created_at ||
      (item as Record<string, unknown>).createdAt ||
      null,
    created_by:
      (item as Record<string, unknown>).created_by ||
      (item as Record<string, unknown>).createdBy ||
      null,
    baseline_id:
      (item as Record<string, unknown>).baseline_id ||
      (item as Record<string, unknown>).baselineId ||
      null,
    baselineId:
      (item as Record<string, unknown>).baselineId ||
      (item as Record<string, unknown>).baseline_id ||
      null,
    baseline_status:
      (item as Record<string, unknown>).baseline_status ||
      (item as Record<string, unknown>).baselineStatus ||
      null,
    accepted_by:
      (item as Record<string, unknown>).accepted_by ||
      (item as Record<string, unknown>).aceptado_por ||
      null,
    baseline_accepted_at:
      (item as Record<string, unknown>).baseline_accepted_at ||
      (item as Record<string, unknown>).baselineAcceptedAt ||
      null,
  };
};

const toDateOnlyString = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const normalizeBaseline = (
  baseline: Record<string, unknown> | undefined
): BaselinePayload => {
  const payload = (baseline?.payload as BaselinePayload | undefined) || {};
  const dealInputs = (payload?.deal_inputs as BaselineDealInputs | undefined) || {};

  const labor_estimates =
    (baseline?.labor_estimates as BaselineLaborEstimate[] | undefined) ||
    payload.labor_estimates ||
    [];
  const non_labor_estimates =
    (baseline?.non_labor_estimates as BaselineNonLaborEstimate[] | undefined) ||
    payload.non_labor_estimates ||
    [];

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

const deriveEndDate = (
  startDate?: string,
  durationMonths?: number,
  providedEndDate?: string
): string | undefined => {
  const explicit = toDateOnlyString(providedEndDate);
  if (explicit) return explicit;

  const normalizedStart = toDateOnlyString(startDate);
  if (!normalizedStart || !durationMonths || durationMonths <= 0) return undefined;

  const end = new Date(normalizedStart);
  end.setMonth(end.getMonth() + durationMonths - 1);
  return end.toISOString();
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

    // Use canonical rubroId from taxonomy if provided, otherwise fall back to default
    // IMPORTANT: The frontend now sends rubroId (e.g., "MOD-ING", "MOD-LEAD") from the
    // canonical rubros taxonomy. This ensures proper data lineage into SDMT.
    const canonicalRubroId = estimate.rubroId || DEFAULT_LABOR_RUBRO;
    
    // Create unique rubro SK by combining canonical ID with baseline and index
    // Format: RUBRO#MOD-ING#base_xxx#1
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
        linea_codigo: canonicalRubroId,  // Store canonical taxonomy code
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

    // Use canonical rubroId from taxonomy if provided, otherwise fall back to default
    // IMPORTANT: The frontend now sends rubroId (e.g., "GSV-REU", "SOI-AWS") from the
    // canonical rubros taxonomy. This ensures proper data lineage into SDMT.
    const canonicalRubroId = estimate.rubroId || DEFAULT_NON_LABOR_RUBRO;
    
    // Create unique rubro SK by combining canonical ID with baseline and index
    // Format: RUBRO#GSV-REU#base_xxx#1
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
        linea_codigo: canonicalRubroId,  // Store canonical taxonomy code
      },
    });
  });

  return items;
};

const seedLineItemsFromBaseline = async (
  projectId: string,
  baseline: BaselinePayload,
  baselineId?: string
) => {
  try {
    // SDMT ALIGNMENT FIX: Allow multiple baselines to be seeded
    // Check if THIS baseline has already been seeded by looking for
    // rubros with matching baseline_id in metadata.
    // Query pattern: begins_with(sk, "RUBRO#${baselineId}") will match
    // any rubroId that starts with the baselineId (e.g., "RUBRO#base_123-labor-1")
    if (baselineId) {
      const existing = await ddb.send(
        new QueryCommand({
          TableName: tableName("rubros"),
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
            ":sk": `RUBRO#${baselineId}`,
          },
          Limit: 1,
        })
      );

      if ((existing.Items?.length || 0) > 0) {
        console.info("[seedLineItems] Baseline already seeded, skipping", {
          projectId,
          baselineId,
        });
        return { seeded: 0, skipped: true };
      }
    }

    const seedItems = buildSeedLineItems(baseline, projectId, baselineId);

    if (!seedItems.length) {
      return { seeded: 0, skipped: true };
    }

    for (const item of seedItems) {
      await ddb.send(
        new PutCommand({
          TableName: tableName("rubros"),
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
    }

    return { seeded: seedItems.length, skipped: false };
  } catch (error) {
    logError("Failed to seed baseline line items", { projectId, baselineId, error });
    return { seeded: 0, skipped: true, error };
  }
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath || event.requestContext.http.path || "";
    const routeKey = event.requestContext.routeKey;

    const isHandoffRoute =
      method === "POST" &&
      (routeKey?.includes("/handoff") || rawPath.includes("/handoff"));

    if (isHandoffRoute) {
      await ensureCanWrite(event);

      const projectIdFromPath =
        event.pathParameters?.projectId || event.pathParameters?.id || "";
      if (!projectIdFromPath) {
        return bad("Missing projectId in path", 400);
      }

      const idempotencyKey =
        event.headers["x-idempotency-key"] ||
        event.headers["X-Idempotency-Key"] ||
        event.headers["X-IDEMPOTENCY-KEY"];

      if (!idempotencyKey) {
        return bad("X-Idempotency-Key header required", 400);
      }

      let handoffBody: Record<string, unknown>;
      try {
        handoffBody = JSON.parse(event.body ?? "{}");
      } catch {
        return bad("Invalid JSON in request body");
      }

        const handoffFields =
          handoffBody && typeof handoffBody.fields === "object"
            ? (handoffBody.fields as Record<string, unknown>)
            : undefined;

        let baselineId =
          (handoffBody.baseline_id as string) ||
          (handoffBody.baselineId as string) ||
          (handoffFields?.baseline_id as string) ||
          (handoffFields?.baselineId as string);

      try {
        let resolvedProjectId = projectIdFromPath;

        const existingProject = await ddb.send(
          new GetCommand({
            TableName: tableName("projects"),
            Key: {
              pk: `PROJECT#${resolvedProjectId}`,
              sk: "METADATA",
            },
          })
        );

        const idempotencyCheck = await ddb.send(
          new GetCommand({
            TableName: tableName("projects"),
            Key: {
              pk: "IDEMPOTENCY#HANDOFF",
              sk: idempotencyKey,
            },
          })
        );

        if (idempotencyCheck.Item) {
          const existingPayload = JSON.stringify(idempotencyCheck.Item.payload);
          const currentPayload = JSON.stringify({
            projectId: projectIdFromPath,
            body: handoffBody,
          });

          if (existingPayload !== currentPayload) {
            return bad(
              "Conflict: idempotency key used with different payload",
              409
            );
          }

          return ok(idempotencyCheck.Item.result || idempotencyCheck.Item);
        }

        const baselineFromProject = (existingProject.Item as
          | Record<string, unknown>
          | undefined)?.baseline_id as string | undefined;

        if (!baselineId && baselineFromProject) {
          baselineId = baselineFromProject;
        }

        const baselineLookup = baselineId
          ? await ddb.send(
              new GetCommand({
                TableName: tableName("prefacturas"),
                Key: {
                  pk: `PROJECT#${resolvedProjectId}`,
                  sk: `BASELINE#${baselineId}`,
                },
              })
            )
          : { Item: undefined };

        let baseline = baselineLookup.Item as Record<string, unknown> | undefined;

        if (!baseline && baselineId) {
          const baselineById = await ddb.send(
            new GetCommand({
              TableName: tableName("prefacturas"),
              Key: {
                pk: `BASELINE#${baselineId}`,
                sk: "METADATA",
              },
            })
          );

          const fallbackBaseline = baselineById.Item as
            | Record<string, unknown>
            | undefined;

          if (fallbackBaseline) {
            baseline = fallbackBaseline;
            const baselineProjectId =
              (fallbackBaseline.project_id as string) ||
              (fallbackBaseline.projectId as string);

            if (baselineProjectId) {
              resolvedProjectId = baselineProjectId;
            }
          }
        }

        if (!baseline && !baselineId) {
          const baselineQuery = await ddb.send(
            new QueryCommand({
              TableName: tableName("prefacturas"),
              KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
              ExpressionAttributeNames: {
                "#pk": "pk",
                "#sk": "sk",
              },
              ExpressionAttributeValues: {
                ":pk": `PROJECT#${resolvedProjectId}`,
                ":sk": "BASELINE#",
              },
              ScanIndexForward: false,
              Limit: 1,
            })
          );

          if (baselineQuery.Items && baselineQuery.Items.length > 0) {
            baseline = baselineQuery.Items[0] as Record<string, unknown>;
            const skValue = baseline.sk as string | undefined;
            if (skValue?.startsWith("BASELINE#")) {
              baselineId = skValue.replace("BASELINE#", "");
            }
          }
        }

        if (
          existingProject.Item &&
          ((existingProject.Item as Record<string, unknown>).baseline_id ===
            baselineId ||
            (existingProject.Item as Record<string, unknown>).baselineId ===
              baselineId)
        ) {
          // Project already handed off with this baseline - return existing handoff
          // Query for the most recent handoff record to get handoffId
          const existingHandoffQuery = await ddb.send(
            new QueryCommand({
              TableName: tableName("projects"),
              KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
              ExpressionAttributeValues: {
                ":pk": `PROJECT#${resolvedProjectId}`,
                ":sk": "HANDOFF#",
              },
              ScanIndexForward: false, // Get most recent first
              Limit: 1,
            })
          );

          const existingHandoffId = existingHandoffQuery.Items?.[0]?.handoffId || 
            generateHandoffId();

          return ok({
            handoffId: existingHandoffId,
            projectId: resolvedProjectId,
            baselineId,
            status: "HandoffComplete",
          }, 201);
        }

        if (!baseline) {
          baseline = {};
        }

        const baselineProjectId =
          (baseline.project_id as string) || (baseline.projectId as string);

        if (baselineProjectId && baselineProjectId !== resolvedProjectId) {
          resolvedProjectId = baselineProjectId;
        }
        const now = new Date().toISOString();
        const createdBy =
          event.requestContext.authorizer?.jwt?.claims?.email || "system";

        const normalizedBaseline = normalizeBaseline(
          baseline as Record<string, unknown> | undefined
        );

        const modTotalFromPayload = Number(
          handoffBody.mod_total ??
            handoffFields?.mod_total ??
            handoffFields?.total_amount ??
            0
        );
        const resolvedBudget =
          !Number.isNaN(modTotalFromPayload) && modTotalFromPayload > 0
            ? modTotalFromPayload
            : Number(
                normalizedBaseline.contract_value ||
                  baseline.total_amount ||
                  baseline.mod_total ||
                  0
              );

        const durationMonths =
          normalizedBaseline.duration_months &&
          normalizedBaseline.duration_months > 0
            ? normalizedBaseline.duration_months
            : undefined;
        const startDate =
          normalizedBaseline.start_date ||
          normalizedBaseline.deal_inputs?.start_date ||
          (baseline.start_date as string | undefined);
        const endDate = deriveEndDate(
          startDate,
          durationMonths,
          normalizedBaseline.end_date || normalizedBaseline.deal_inputs?.end_date
        );
        const resolvedCurrency =
          normalizedBaseline.currency ||
          (existingProject.Item as Record<string, unknown> | undefined)?.moneda ||
          (existingProject.Item as Record<string, unknown> | undefined)?.currency ||
          "USD";

        // Extract project name and client from normalized baseline (which looks in payload, deal_inputs, etc.)
        const projectName = 
          normalizedBaseline.project_name ||
          (existingProject.Item as Record<string, unknown> | undefined)?.nombre ||
          (existingProject.Item as Record<string, unknown> | undefined)?.name ||
          `Project ${resolvedProjectId}`;
        
        const clientName = 
          normalizedBaseline.client_name ||
          (existingProject.Item as Record<string, unknown> | undefined)?.cliente ||
          (existingProject.Item as Record<string, unknown> | undefined)?.client ||
          "";

        // Generate a clean project code for handoff projects
        // For handoff projects, we want a short, human-readable code like "P-8charHash"
        // NOT the long UUID-based projectId
        const MAX_CLEAN_CODE_LENGTH = 20;
        const CODE_SUFFIX_LENGTH = 8;
        let projectCode = 
          (existingProject.Item as Record<string, unknown> | undefined)?.code ||
          (existingProject.Item as Record<string, unknown> | undefined)?.codigo ||
          resolvedProjectId;
        
        // If projectId is a long UUID, generate a shorter code based on baseline ID
        if (
          baselineId &&
          (resolvedProjectId.length > MAX_CLEAN_CODE_LENGTH || 
           /^P-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedProjectId))
        ) {
          const baselineIdShort = baselineId.replace(/^base_/, '').substring(0, CODE_SUFFIX_LENGTH);
          projectCode = `P-${baselineIdShort}`;
        }

        const projectItem = {
          pk: `PROJECT#${resolvedProjectId}`,
          sk: "METADATA",
          id: resolvedProjectId,
          project_id: resolvedProjectId,
          projectId: resolvedProjectId,
          nombre: projectName,
          name: projectName,
          cliente: clientName,
          client: clientName,
          code: projectCode,
          codigo: projectCode,
          moneda:
            resolvedCurrency,
          currency:
            resolvedCurrency,
          fecha_inicio:
            startDate ||
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.fecha_inicio ||
            null,
          start_date:
            startDate ||
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.start_date ||
            null,
          fecha_fin:
            endDate ||
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.fecha_fin ||
            null,
          end_date:
            endDate ||
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.end_date ||
            null,
          duration_months: durationMonths,
          presupuesto_total: resolvedBudget,
          mod_total: resolvedBudget,
          descripcion:
            (baseline.project_description as string) ||
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.descripcion ||
            "",
          description:
            (baseline.project_description as string) ||
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.description ||
            "",
          sdm_manager_name:
            normalizedBaseline.sdm_manager_name ||
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.sdm_manager_name ||
            undefined,
          baseline_id: baselineId,
          baselineId,
          baseline_status: "accepted",
          baseline_accepted_at: now,
          status:
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.status || "active",
          estado:
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.estado || "active",
          module:
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.module || "SDMT",
          source: "prefactura",
          created_at:
            (existingProject.Item as Record<string, unknown> | undefined)
              ?.created_at || now,
          updated_at: now,
            created_by:
              (existingProject.Item as Record<string, unknown> | undefined)
                ?.created_by || createdBy,
            accepted_by:
              (handoffBody.aceptado_por as string) ||
              (handoffBody.owner as string) ||
              createdBy,
            pct_ingenieros: Number(
              handoffBody.pct_ingenieros ?? handoffFields?.pct_ingenieros ?? 0
            ),
            pct_sdm: Number(handoffBody.pct_sdm ?? handoffFields?.pct_sdm ?? 0),
            last_handoff_key: idempotencyKey,
          };

          const handoffId = generateHandoffId();

          const handoffOwner =
            (handoffBody.owner as string) || createdBy || "unknown@unknown";

          const handoffRecord = {
            pk: `PROJECT#${resolvedProjectId}`,
            sk: `HANDOFF#${handoffId}`,
            handoffId,
            projectId: resolvedProjectId,
            baselineId: baselineId || (projectItem.baseline_id as string),
            owner: handoffOwner,
            fields: handoffFields || handoffBody,
            version: 1,
            createdAt: now,
            updatedAt: now,
            createdBy: createdBy,
            sdm_manager_name: normalizedBaseline.sdm_manager_name,
          };

          await ddb.send(
            new PutCommand({
              TableName: tableName("projects"),
              Item: projectItem,
            })
          );

          await ddb.send(
            new PutCommand({
              TableName: tableName("projects"),
              Item: handoffRecord,
            })
          );

          await seedLineItemsFromBaseline(
            resolvedProjectId,
            normalizedBaseline,
            baselineId
          );

          const auditEntry = {
            pk: `ENTITY#PROJECT#${resolvedProjectId}`,
            sk: `TS#${now}`,
            action: "HANDOFF_UPDATE",
            resource_type: "project_handoff",
            resource_id: handoffId,
            user: createdBy,
            timestamp: now,
            before: existingProject.Item || null,
            after: {
              project: projectItem,
              handoff: handoffRecord,
            },
            source: "API",
            ip_address: event.requestContext.http?.sourceIp,
            user_agent: event.requestContext.http?.userAgent,
          };

          await ddb.send(
            new PutCommand({
              TableName: tableName("audit_log"),
              Item: auditEntry,
            })
          );

          const ttl = Math.floor(Date.now() / 1000) + 86400;

          const idempotencyRecord = {
            pk: "IDEMPOTENCY#HANDOFF",
            sk: idempotencyKey,
            payload: { projectId: projectIdFromPath, body: handoffBody },
            result: {
              handoffId,
              projectId: resolvedProjectId,
              baselineId,
              status: "HandoffComplete",
            },
            ttl,
          };

          await ddb.send(
            new PutCommand({
              TableName: tableName("projects"),
              Item: idempotencyRecord,
            })
          );

          return ok(
            {
              handoffId,
              projectId: resolvedProjectId,
              baselineId,
              status: "HandoffComplete",
            },
            201
          );
      } catch (error) {
        const authError = fromAuthError(error);
        if (authError) return authError;

        logError("Error during handoff", error);
        return serverError();
      }
    }

    if (method === "POST") {
      await ensureCanWrite(event);

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return bad("Invalid JSON in request body");
      }

      const normalizedPayload = normalizeIncomingProject(body);
      const parsed = projectPayloadSchema.safeParse(normalizedPayload);

      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((issue) => issue.message || issue.path.join("."))
          .join("; ");
        return bad(
          detail || "Invalid project payload. Please check required fields.",
          422
        );
      }

      const payload = parsed.data;

      if (new Date(payload.end_date).getTime() < new Date(payload.start_date).getTime()) {
        return bad("end_date must be on or after start_date", 422);
      }

      const id = "P-" + crypto.randomUUID();
      const now = new Date().toISOString();
      const userContext = await getUserContext(event);
      const createdBy = userContext.email ||
        event.requestContext.authorizer?.jwt?.claims?.email || "system";

      // If user is SDM, set them as the project's SDM manager
      // If user is SDMT/PMO/ADMIN, they must explicitly provide an SDM
      const rawSdmManagerEmail =
        (body.sdm_manager_email as string | undefined) ||
        (body.sdmManagerEmail as string | undefined);

      const sdmManagerEmail = userContext.isSDM
        ? userContext.email
        : rawSdmManagerEmail?.trim();

      if (!sdmManagerEmail) {
        return bad(
          "sdm_manager_email is required when creating a project (asignar responsable SDM)",
          400,
        );
      }

      const item = {
        pk: `PROJECT#${id}`,
        sk: "METADATA",
        id,
        project_id: id,
        projectId: id,
        nombre: payload.name,
        name: payload.name,
        codigo: payload.code,
        code: payload.code,
        cliente: payload.client,
        client: payload.client,
        fecha_inicio: payload.start_date,
        start_date: payload.start_date,
        fecha_fin: payload.end_date,
        end_date: payload.end_date,
        moneda: payload.currency,
        currency: payload.currency,
        presupuesto_total: payload.mod_total,
        mod_total: payload.mod_total,
        descripcion: payload.description,
        description: payload.description,
        estado: "active",
        status: "active",
        created_at: now,
        updated_at: now,
        created_by: createdBy,
        // CRITICAL: Always set SDM manager email for ABAC visibility
        sdm_manager_email: sdmManagerEmail,
      };

      try {
        await ddb.send(
          new PutCommand({
            TableName: tableName("projects"),
            Item: item,
          })
        );

        // Write audit log entry
        const auditEntry = {
          pk: `ENTITY#PROJECT#${id}`,
          sk: `TS#${now}`,
          action: "CREATE_PROJECT",
          resource_type: "project",
          resource_id: id,
          user: item.created_by,
          timestamp: now,
          before: null,
          after: {
            id,
            cliente: item.cliente,
            nombre: item.nombre,
            presupuesto_total: item.presupuesto_total,
            code: item.code,
            fecha_inicio: item.fecha_inicio,
            fecha_fin: item.fecha_fin,
          },
          source: "API",
          ip_address: event.requestContext.http?.sourceIp,
          user_agent: event.requestContext.http?.userAgent,
        };

        await ddb.send(
          new PutCommand({
            TableName: tableName("audit_log"),
            Item: auditEntry,
          })
        );
      } catch (ddbError) {
        const errorObj = ddbError as Error;
        logError("ProjectsFn put failed", {
          projectId: id,
          errorName: errorObj?.name,
          message: errorObj?.message,
        });
        throw ddbError;
      }

      // Return canonical DTO
      return ok(mapToProjectDTO(item as ProjectRecord), 201);
    }

    // GET /projects
    await ensureCanRead(event);

    // Get user context for RBAC filtering
    const userContext = await getUserContext(event);

    console.info("[projects] list request", {
      email: userContext.email,
      roles: userContext.roles,
      queryLimit: event.queryStringParameters?.limit,
    });

    // Support query parameter for limit, default to 100, max 100
    const queryParams = event.queryStringParameters || {};
    const requestedLimit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    const pageLimit = Math.min(Math.max(requestedLimit, 1), 100); // Clamp between 1 and 100

    let rawProjects: ProjectRecord[] = [];

    const scanProjects = async (
      input: ConstructorParameters<typeof ScanCommand>[0],
    ): Promise<ProjectRecord[]> => {
      let items: ProjectRecord[] = [];
      let lastEvaluatedKey: Record<string, unknown> | undefined;

      do {
        const result = await ddb.send(
          new ScanCommand({
            ...input,
            Limit: pageLimit,
            ExclusiveStartKey: lastEvaluatedKey,
          }),
        );

        const pageItems = (result.Items ?? []) as ProjectRecord[];
        items = items.concat(pageItems);

        console.info("[projects] scan page", {
          role: userContext.roles,
          pageCount: pageItems.length,
          hasNext: Boolean(result.LastEvaluatedKey),
        });

        lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (lastEvaluatedKey);

      return items;
    };

    // RBAC-aware querying:
    // - ADMIN / EXEC_RO / PMO / SDMT: scan all projects
    // - SDM: only query projects where SDM email or acceptance/creator matches user email
    // - Others: return empty list for now (future: implement user-project assignments)

    if (userContext.isAdmin || userContext.isExecRO || userContext.isPMO || userContext.isSDMT) {
      // These roles see all projects
      // BACKWARD COMPATIBILITY SHIM: Accept both METADATA (new standard) and META (legacy)
      rawProjects = await scanProjects({
        TableName: tableName("projects"),
        FilterExpression: "begins_with(#pk, :pkPrefix) AND (#sk = :metadata OR #sk = :meta)",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#sk": "sk",
        },
        ExpressionAttributeValues: {
          ":pkPrefix": "PROJECT#",
          ":metadata": "METADATA",
          ":meta": "META",
        },
      });
      
      // Log warnings for legacy META keys
      rawProjects.forEach((record) => {
        if (record.sk === "META") {
          console.warn("[projects] Serving project from legacy META key", {
            projectId: record.project_id || record.projectId,
            sk: "META",
          });
        }
      });
    } else if (userContext.isSDM) {
      // SDM users only see projects they manage or have accepted
      // For now, use scan with filter until GSI is deployed
      // TODO: Once GSI on sdmManagerEmail is deployed, use Query instead of Scan
      rawProjects = await scanProjects({
        TableName: tableName("projects"),
        FilterExpression:
          "begins_with(#pk, :pkPrefix) AND (#sk = :metadata OR #sk = :meta) AND " +
          "(#sdmEmail = :userEmail OR #acceptedBy = :userEmail OR #aceptadoPor = :userEmail OR #createdBy = :userEmail)",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#sk": "sk",
          "#sdmEmail": "sdm_manager_email",
          "#acceptedBy": "accepted_by",
          "#aceptadoPor": "aceptado_por",
          "#createdBy": "created_by",
        },
        ExpressionAttributeValues: {
          ":pkPrefix": "PROJECT#",
          ":metadata": "METADATA",
          ":meta": "META",
          ":userEmail": userContext.email,
        },
      });

      console.info("[projects] SDM filtered projects", {
        sdmEmail: userContext.email,
        projectCount: rawProjects.length,
      });

      if (rawProjects.length === 0) {
        const unassignedProjects = await scanProjects({
          TableName: tableName("projects"),
          FilterExpression:
            "begins_with(#pk, :pkPrefix) AND (#sk = :metadata OR #sk = :meta) AND " +
            "((attribute_not_exists(#sdmEmail) OR #sdmEmail = :empty) AND " +
            "(attribute_not_exists(#acceptedBy) OR #acceptedBy = :empty) AND " +
            "(attribute_not_exists(#aceptadoPor) OR #aceptadoPor = :empty))",
          ExpressionAttributeNames: {
            "#pk": "pk",
            "#sk": "sk",
            "#sdmEmail": "sdm_manager_email",
            "#acceptedBy": "accepted_by",
            "#aceptadoPor": "aceptado_por",
          },
          ExpressionAttributeValues: {
            ":pkPrefix": "PROJECT#",
            ":metadata": "METADATA",
            ":meta": "META",
            ":empty": "",
          },
        });

        if (unassignedProjects.length > 0) {
          console.warn("[projects] SDM has zero visible projects but unassigned projects exist", {
            sdmEmail: userContext.email,
            unassignedCount: unassignedProjects.length,
            sample: unassignedProjects.slice(0, 5).map((p) => ({
              projectId: p.project_id || p.projectId,
              code: (p as Record<string, unknown>).code,
            })),
          });
        }
      }
    } else {
      // Other users: return empty list
      // Future enhancement: check user-project assignments
      console.info("[projects] User has no project access", {
        email: userContext.email,
        roles: userContext.roles,
      });
      rawProjects = [];
    }

    // Map all raw records to canonical DTOs
    const projects: ProjectDTO[] = rawProjects
      .map((record) => mapToProjectDTO(record))
      .filter((dto) => dto.projectId); // Ensure valid projectId

    console.info("[projects] list response", {
      email: userContext.email,
      roles: userContext.roles,
      total: projects.length,
    });

    return ok({ data: projects, total: projects.length });
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) return authError;

    const isDynamoAccessDenied =
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: string }).name === "AccessDeniedException";

    if (isDynamoAccessDenied) {
      logError("DynamoDB access denied", {
        table: tableName("projects"),
        method: event.requestContext.http?.method,
      });
      return serverError();
    }

    logError("Error in projects handler", error);
    return serverError();
  }
};
