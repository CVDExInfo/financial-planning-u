import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanWrite, ensureCanRead, getUserEmail } from "../lib/auth";
import {
  ddb,
  tableName,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  GetCommand,
  BatchGetCommand,
} from "../lib/dynamo";
import { ok, bad, notFound, serverError, fromAuthError } from "../lib/http";
import { logError } from "../utils/logging";

type ProjectRubroAttachment = {
  projectId?: string;
  rubroId?: string;
  tier?: string;
  category?: string;
  metadata?: unknown;
  createdAt?: string;
  createdBy?: string;
  sk?: string;
  qty?: number;
  unit_cost?: number;
  currency?: string;
  recurring?: boolean;
  one_time?: boolean;
  start_month?: number;
  end_month?: number;
  total_cost?: number;
  description?: string;
};

type RubroResponse = {
  id: string;
  rubro_id: string;
  nombre: string;
  linea_codigo?: string;
  tipo_costo?: string;
  project_id: string;
  tier?: string;
  category?: string;
  metadata?: unknown;
  qty?: number;
  unit_cost?: number;
  currency?: string;
  recurring?: boolean;
  one_time?: boolean;
  start_month?: number;
  end_month?: number;
  total_cost?: number;
  description?: string;
};

type RubroDefinition = {
  rubro_id?: string;
  codigo?: string;
  nombre?: string;
  linea_codigo?: string | null;
  tipo_costo?: string | null;
};

const toRubroId = (item: ProjectRubroAttachment): string => {
  if (item.rubroId) return String(item.rubroId);
  if (item.sk && item.sk.startsWith("RUBRO#")) return item.sk.replace("RUBRO#", "");
  return "";
};

const parseDuration = (value?: string | null) => {
  if (!value || typeof value !== "string") {
    return { start: 1, end: 12 };
  }

  const match = value.match(/m?(\d{1,2})(?:-m?(\d{1,2}))?/i);
  if (!match) {
    return { start: 1, end: 12 };
  }

  const start = Math.min(Math.max(parseInt(match[1], 10) || 1, 1), 12);
  const endRaw = match[2] ? parseInt(match[2], 10) : start;
  const end = Math.min(Math.max(endRaw || start, start), 12);

  return { start, end };
};

// Route: GET /projects/{projectId}/rubros
async function listProjectRubros(event: APIGatewayProxyEventV2) {
  await ensureCanRead(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return bad("missing project id");
  }

  // Query all rubros attached to this project (paginate to avoid silently
  // truncating the list when a project has >1MB of rubros)
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  const attachments: ProjectRubroAttachment[] = [];
  let safetyCounter = 0;

  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("rubros"),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${projectId}`,
          ":sk": "RUBRO#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const pageItems = (result.Items || []) as ProjectRubroAttachment[];
    attachments.push(...pageItems);
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;

    // Defensive break to avoid infinite loops if Dynamo keeps returning a LEK
    safetyCounter += 1;
    if (safetyCounter > 50) {
      console.warn("Exceeded pagination safety limit while listing rubros", {
        projectId,
      });
      break;
    }
  } while (lastEvaluatedKey);
  const rubroIds = Array.from(
    new Set(attachments.map((item) => toRubroId(item)).filter(Boolean)),
  );

  const rubroDefinitions: Record<string, RubroDefinition> = {};

  if (rubroIds.length > 0) {
    const keys = rubroIds.map((id) => ({
      pk: `RUBRO#${id}`,
      sk: "METADATA",
    }));

    // DynamoDB BatchGetItem is limited to 100 keys per call, so chunk the keys
    const chunkSize = 100;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);

      const batch = await ddb.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName("rubros")]: {
              Keys: chunk,
            },
          },
        })
      );

      const responses =
        (batch.Responses?.[tableName("rubros")] as RubroDefinition[]) || [];

      for (const def of responses) {
        const id = def.rubro_id || def.codigo || "";
        if (!id) continue;
        rubroDefinitions[id] = { ...def, rubro_id: def.rubro_id ?? def.codigo };
      }
    }
  }

  const rubros = attachments
    .map<RubroResponse | null>((item) => {
      const rubroId = toRubroId(item);
      if (!rubroId) return null;
      const definition = rubroDefinitions[rubroId] || {};

      const normalizedId =
        definition.rubro_id || definition.codigo || rubroId || item.rubroId;
      return {
        id: normalizedId,
        rubro_id: normalizedId,
        nombre: definition.nombre || item.category || rubroId,
        linea_codigo:
          definition.linea_codigo || definition.codigo || undefined,
        tipo_costo: definition.tipo_costo || undefined,
        project_id: projectId,
        tier: item.tier,
        category: item.category,
        metadata: item.metadata,
        qty: item.qty,
        unit_cost: item.unit_cost,
        currency: item.currency,
        recurring: item.recurring,
        one_time: item.one_time,
        start_month: item.start_month,
        end_month: item.end_month,
        total_cost: item.total_cost,
        description: item.description,
      };
    })
    .filter((rubro): rubro is RubroResponse => Boolean(rubro));

  return ok({ data: rubros, total: rubros.length, project_id: projectId });
}

// Route: POST /projects/{projectId}/rubros
async function attachRubros(event: APIGatewayProxyEventV2) {
  await ensureCanWrite(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return bad("missing project id");
  }

  let body: { rubroIds?: unknown[]; rubroId?: string } & Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch (error) {
    logError("attachRubros: invalid JSON", { projectId, raw: event.body, error });
    return bad("Invalid JSON in request body");
  }

  const { rubroIds: bodyRubroIds, rubroId: singleRubroId, ...sharedFields } = body;

  const rawRubroEntries: Array<Record<string, unknown>> = Array.isArray(bodyRubroIds)
    ? bodyRubroIds
        .map((entry) => {
          if (typeof entry === "string") {
            return { ...sharedFields, rubroId: entry };
          }
          if (entry && typeof entry === "object") {
            return { ...sharedFields, ...(entry as Record<string, unknown>) };
          }
          return null;
        })
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : singleRubroId
      ? [{ ...sharedFields, rubroId: singleRubroId }]
      : [];

  if (rawRubroEntries.length === 0) {
    return bad("rubroIds array required");
  }

  const userEmail = await getUserEmail(event);
  const now = new Date().toISOString();
  const attached: string[] = [];

  const normalizeRubroPayload = (payload: Record<string, unknown>) => {
    const rubroId = (payload.rubroId as string) || (payload.rubro_id as string) || "";
    if (!rubroId) return null;

    const qty = Number(payload.qty ?? payload.quantity ?? 1) || 1;
    const unitCost = Number(payload.unitCost ?? payload.unit_cost ?? 0) || 0;
    const type = typeof payload.type === "string" ? payload.type.toLowerCase() : "";
    const recurring = payload.recurring ?? type === "recurring";
    const oneTime = payload.one_time ?? (type === "one-time" || type === "one_time");
    const duration = parseDuration((payload.duration as string) || undefined);
    const explicitStart = Number(payload.start_month ?? payload.startMonth ?? duration.start) ||
      duration.start;
    const explicitEnd = Number(payload.end_month ?? payload.endMonth ?? duration.end) || duration.end;

    const startMonth = Math.min(Math.max(explicitStart, 1), 12);
    const endMonth = Math.min(Math.max(explicitEnd, startMonth), 12);
    const months = Math.max(endMonth - startMonth + 1, 1);
    const baseCost = qty * unitCost;
    const totalCost = (recurring ? baseCost * months : baseCost) || 0;

    const currency =
      typeof payload.currency === "string" && payload.currency.trim()
        ? payload.currency
        : "USD";

    const description =
      typeof payload.description === "string" && payload.description.trim()
        ? payload.description.trim()
        : undefined;

    return {
      rubroId,
      qty,
      unit_cost: unitCost,
      currency,
      recurring: Boolean(recurring && !oneTime),
      one_time: Boolean(oneTime || (!recurring && !oneTime)),
      start_month: startMonth,
      end_month: endMonth,
      total_cost: totalCost,
      description,
      months,
      baseCost,
    };
  };

  const normalizedEntries = rawRubroEntries
    .map((raw) => normalizeRubroPayload(raw))
    .filter((normalized): normalized is NonNullable<ReturnType<typeof normalizeRubroPayload>> =>
      Boolean(normalized?.rubroId),
    );

  if (normalizedEntries.length === 0) {
    console.warn("attachRubros: no valid rubro entries after normalization", {
      projectId,
      attemptedRubroIds: rawRubroEntries,
    });
    return bad("rubroIds array required");
  }

  const warnings: string[] = [];

  console.info("attachRubros: normalized request", {
    projectId,
    rubroCount: normalizedEntries.length,
    rubroIds: normalizedEntries.map((entry) => entry.rubroId),
  });

  // Attach (or upsert) each rubro to the project. PUT without a condition acts as an
  // idempotent upsert so edits can reuse the same rubroId without a dedicated PATCH route.
  for (const normalized of normalizedEntries) {
    const rubroId = normalized.rubroId;

    // Check if rubro exists in catalog (optional validation)
    // For MVP, we'll just attach it

    const attachment = {
      pk: `PROJECT#${projectId}`,
      sk: `RUBRO#${rubroId}`,
      projectId,
      rubroId,
      createdAt: now,
      createdBy: userEmail,
      qty: normalized?.qty,
      unit_cost: normalized?.unit_cost,
      currency: normalized?.currency,
      recurring: normalized?.recurring,
      one_time: normalized?.one_time,
      start_month: normalized?.start_month,
      end_month: normalized?.end_month,
      total_cost: normalized?.total_cost,
      description: normalized?.description,
    };

    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName("rubros"),
          Item: attachment,
        })
      );
    } catch (error) {
      logError("attachRubros: failed to persist rubro attachment", {
        projectId,
        rubroId,
        attachment,
        error,
      });
      throw error;
    }

    attached.push(rubroId);

    // Mirror into allocations for forecast continuity
    const monthsToMaterialize = normalized?.recurring
      ? normalized.months
      : 1;

    const allocationBaseMonth = normalized?.start_month ?? 1;
    for (let i = 0; i < (monthsToMaterialize || 1); i += 1) {
      const monthValue = allocationBaseMonth + i;
      try {
        await ddb.send(
          new PutCommand({
            TableName: tableName("allocations"),
            Item: {
              pk: `PROJECT#${projectId}`,
              sk: `ALLOC#${rubroId}#M${monthValue}`,
              projectId,
              rubroId,
              month: monthValue,
              planned: normalized?.baseCost ?? 0,
              forecast: normalized?.baseCost ?? 0,
              actual: 0,
              created_at: now,
              created_by: userEmail,
            },
          })
        );
      } catch (error) {
        logError("attachRubros: failed to mirror allocation", {
          projectId,
          rubroId,
          monthValue,
          allocationCost: normalized?.baseCost ?? 0,
          error,
        });
        warnings.push(
          `Allocation mirror failed for rubro ${rubroId} month ${monthValue}: ${(error as Error)?.message ||
            "unknown error"}`,
        );
      }
    }

    // Audit log
    const audit = {
      pk: `ENTITY#PROJECT#${projectId}`,
      sk: `TS#${now}#RUBRO#${rubroId}`,
      action: "RUBRO_ATTACH",
      resource_type: "project_rubro",
      resource_id: rubroId,
      user: userEmail,
      timestamp: now,
      before: null,
      after: attachment,
      source: "API",
      ip_address: event.requestContext.http.sourceIp,
      user_agent: event.requestContext.http.userAgent,
    };

    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName("audit_log"),
          Item: audit,
        })
      );
    } catch (error) {
      logError("attachRubros: failed to write audit log", {
        projectId,
        rubroId,
        audit,
        error,
      });
      warnings.push(
        `Audit log write failed for rubro ${rubroId}: ${(error as Error)?.message ||
          "unknown error"}`,
      );
    }
  }

  return ok({
    message: `Attached ${attached.length} rubros to project ${projectId}`,
    attached,
    warnings: warnings.length ? warnings : undefined,
  });
}

// Route: DELETE /projects/{projectId}/rubros/{rubroId}
async function detachRubro(event: APIGatewayProxyEventV2) {
  await ensureCanWrite(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  const rubroId = event.pathParameters?.rubroId;

  if (!projectId) {
    return bad("missing project id");
  }

  if (!rubroId) {
    return bad("missing rubro id");
  }

  const userEmail = await getUserEmail(event);
  const now = new Date().toISOString();

  // Get existing attachment for audit
  const existing = await ddb.send(
    new GetCommand({
      TableName: tableName("rubros"),
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: `RUBRO#${rubroId}`,
      },
    })
  );

  if (!existing.Item) {
    return notFound("rubro attachment not found");
  }

  // Delete the attachment
  await ddb.send(
    new DeleteCommand({
      TableName: tableName("rubros"),
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: `RUBRO#${rubroId}`,
      },
    })
  );

  // Audit log
  const audit = {
    pk: `ENTITY#PROJECT#${projectId}`,
    sk: `TS#${now}#RUBRO#${rubroId}`,
    action: "RUBRO_DETACH",
    resource_type: "project_rubro",
    resource_id: rubroId,
    user: userEmail,
    timestamp: now,
    before: existing.Item,
    after: null,
    source: "API",
    ip_address: event.requestContext.http.sourceIp,
    user_agent: event.requestContext.http.userAgent,
  };

  await ddb.send(
    new PutCommand({
      TableName: tableName("audit_log"),
      Item: audit,
    })
  );

  return ok({
    message: `Detached rubro ${rubroId} from project ${projectId}`,
  });
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;

    if (method === "GET") {
      return await listProjectRubros(event);
    } else if (method === "POST") {
      return await attachRubros(event);
    } else if (method === "DELETE") {
      return await detachRubro(event);
    } else {
      return bad("Method not allowed", 405);
    }
  } catch (err: unknown) {
    // Handle auth errors
    const authError = fromAuthError(err);
    if (authError) {
      return authError;
    }

    logError("Rubros handler error:", err);
    return serverError("Internal server error");
  }
};
