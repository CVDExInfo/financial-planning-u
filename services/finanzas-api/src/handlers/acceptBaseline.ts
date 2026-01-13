import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDMT, getUserEmail } from "../lib/auth";
import {
  ddb,
  tableName,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from "../lib/dynamo";
import { bad, fromAuthError, notFound, ok, serverError, withCors } from "../lib/http";
import { materializeAllocationsForBaseline, materializeRubrosForBaseline } from "../lib/materializers";
import { logError } from "../utils/logging";
import { enqueueMaterialization } from "../lib/queue";
import { logDataHealth } from "../lib/dataHealth";

export type BaselineIdResolution =
  | { baselineId: string }
  | { error: "baseline_id mismatch" | "baseline_id is required" };

export function resolveBaselineId({
  requestBaselineId,
  projectBaselineId,
}: {
  requestBaselineId?: string;
  projectBaselineId?: string;
}): BaselineIdResolution {
  if (requestBaselineId && projectBaselineId) {
    if (requestBaselineId !== projectBaselineId) {
      return { error: "baseline_id mismatch" };
    }
    return { baselineId: requestBaselineId };
  }

  if (requestBaselineId) {
    return { baselineId: requestBaselineId };
  }

  if (projectBaselineId) {
    return { baselineId: projectBaselineId };
  }

  return { error: "baseline_id is required" };
}

// Route: PATCH /projects/{projectId}/accept-baseline
async function acceptBaseline(event: APIGatewayProxyEventV2) {
  await ensureSDMT(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return bad(event, "missing project id");
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return bad(event, "Invalid JSON in request body");
  }

  // Fetch the current project metadata to ensure it exists and has the baseline
  const projectResult = await ddb.send(
    new GetCommand({
      TableName: tableName("projects"),
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: "METADATA",
      },
    })
  );

  if (!projectResult.Item) {
    return notFound(event, "project not found");
  }

  // Get baseline_id from request body or fall back to project metadata
  const requestBaselineId = body.baseline_id as string | undefined;
  const projectBaselineId = projectResult.Item.baseline_id as string | undefined;

  const baselineResolution = resolveBaselineId({
    requestBaselineId,
    projectBaselineId,
  });

  if ("error" in baselineResolution) {
    return bad(event, baselineResolution.error, 400);
  }

  const baselineId = baselineResolution.baselineId;

  const userEmail = await getUserEmail(event);
  const acceptedBy = (body.accepted_by || userEmail) as string;
  const now = new Date().toISOString();

  // Defensive check: prevent re-acceptance of already accepted baselines
  const currentStatus = projectResult.Item.baseline_status;
  if (currentStatus === "accepted") {
    return bad(
      event,
      "Baseline is already accepted. Cannot accept again.",
      409
    );
  }

  // Only allow acceptance from "handed_off" or "pending" status
  if (currentStatus !== "handed_off" && currentStatus !== "pending") {
    return bad(
      event,
      `Cannot accept baseline with status "${currentStatus}". Expected "handed_off" or "pending".`,
      409
    );
  }

  // Update project metadata with acceptance information
  const updated = await ddb.send(
    new UpdateCommand({
      TableName: tableName("projects"),
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: "METADATA",
      },
      UpdateExpression:
        "SET #baseline_status = :baseline_status, #accepted_by = :accepted_by, #baseline_accepted_at = :baseline_accepted_at, #updated_at = :updated_at",
      ExpressionAttributeNames: {
        "#baseline_status": "baseline_status",
        "#accepted_by": "accepted_by",
        "#baseline_accepted_at": "baseline_accepted_at",
        "#updated_at": "updated_at",
      },
      ExpressionAttributeValues: {
        ":baseline_status": "accepted",
        ":accepted_by": acceptedBy,
        ":baseline_accepted_at": now,
        ":updated_at": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  // Write audit log for baseline acceptance
  const audit = {
    pk: `ENTITY#PROJECT#${projectId}`,
    sk: `TS#${now}`,
    action: "BASELINE_ACCEPTED",
    resource_type: "project",
    resource_id: projectId,
    user: userEmail,
    timestamp: now,
    before: {
      baseline_status: projectResult.Item.baseline_status,
      accepted_by: projectResult.Item.accepted_by,
      baseline_accepted_at: projectResult.Item.baseline_accepted_at,
    },
    after: {
      baseline_status: "accepted",
      accepted_by: acceptedBy,
      baseline_accepted_at: now,
    },
    source: "API",
    ip_address: event.requestContext.http.sourceIp || "unknown",
    user_agent: event.requestContext.http.userAgent || "unknown",
  };

  await ddb.send(
    new PutCommand({
      TableName: tableName("audit_log"),
      Item: audit,
    })
  );

  // Update baseline record with acceptance metadata
  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName("prefacturas"),
      Key: { pk: `BASELINE#${baselineId}`, sk: 'METADATA' },
      UpdateExpression: 'SET #status = :accepted, acceptedBy = :acceptedBy, acceptedAt = :acceptedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { 
        ':accepted': 'accepted',
        ':acceptedBy': acceptedBy,
        ':acceptedAt': now
      }
    }));
  } catch (err: any) {
    console.error("Failed to update baseline with acceptance metadata", err);
    await logDataHealth({
      projectId,
      baselineId,
      type: "baseline_acceptance_update_error",
      message: String(err),
      createdAt: new Date().toISOString()
    });
  }

  // Enqueue materialization job if MATERIALIZE_QUEUE_URL is configured
  if (process.env.MATERIALIZE_QUEUE_URL) {
    try {
      // Attempt to set materializationQueuedAt only if it doesn't exist yet
      // This prevents duplicate enqueuing if the baseline is accepted multiple times
      await ddb.send(new UpdateCommand({
        TableName: tableName("prefacturas"),
        Key: { pk: `BASELINE#${baselineId}`, sk: 'METADATA' },
        UpdateExpression: 'SET materializationQueuedAt = :now',
        ConditionExpression: 'attribute_not_exists(materializationQueuedAt)',
        ExpressionAttributeValues: { ':now': new Date().toISOString() }
      }));
      
      // Only enqueue if we successfully updated (this means not queued before)
      await enqueueMaterialization(baselineId, projectId);
    } catch (err: any) {
      if (err.name === 'ConditionalCheckFailedException') {
        // Already queued — noop, but log
        console.info('Materialization already queued for baseline', baselineId);
      } else {
        console.error("Failed to enqueue materialization", err);
        // Record the failure in data_health for ops
        await logDataHealth({
          projectId,
          baselineId,
          type: "materialize_enqueuer_error",
          message: String(err),
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  // Helper to normalize project fields (handles both English and Spanish field names)
  const normalizeProjectFields = (attrs: any) => ({
    id: attrs?.id || projectId,
    name: attrs?.name || attrs?.nombre,
    code: attrs?.code || attrs?.codigo,
    client: attrs?.client || attrs?.cliente,
    status: attrs?.status || attrs?.estado,
    currency: attrs?.currency || attrs?.moneda,
    mod_total: attrs?.mod_total || attrs?.presupuesto_total,
    start_date: attrs?.start_date || attrs?.fecha_inicio,
    end_date: attrs?.end_date || attrs?.fecha_fin,
  });

  // Return normalized project response
  const result = {
    projectId,
    baselineId,
    baseline_status: "accepted",
    accepted_by: acceptedBy,
    baseline_accepted_at: now,
    ...normalizeProjectFields(updated.Attributes),
  };

  let materialized = false;
  let materializationDetails: Record<string, unknown> | undefined;
  try {
    const baselineLookup = await ddb.send(
      new GetCommand({
        TableName: tableName("prefacturas"),
        Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      })
    );

    const baselineRecord = baselineLookup.Item || { baseline_id: baselineId, project_id: projectId };

    const [allocationsSummary, rubrosSummary] = await Promise.all([
      materializeAllocationsForBaseline(baselineRecord as any, { dryRun: false }),
      materializeRubrosForBaseline(baselineRecord as any, { dryRun: false }),
    ]);

    materializationDetails = { allocationsSummary, rubrosSummary };
    materialized = true;

    console.info("acceptBaseline materialization", {
      baselineId,
      allocationsSummary,
      rubrosSummary,
    });

    // Persist materialization counts to project metadata
    try {
      const allocationsCount = (allocationsSummary as any).allocationsWritten ?? (allocationsSummary as any).allocationsPlanned ?? 0;
      const rubrosCount = (rubrosSummary as any).rubrosWritten ?? 0;
      const materializedAt = new Date().toISOString();

      await ddb.send(
        new UpdateCommand({
          TableName: tableName("projects"),
          Key: {
            pk: `PROJECT#${projectId}`,
            sk: "METADATA",
          },
          UpdateExpression:
            "SET #rubros_count = :rubros_count, #allocations_count = :allocations_count, #materialized_at = :materialized_at, #updated_at = :updated_at",
          ExpressionAttributeNames: {
            "#rubros_count": "rubros_count",
            "#allocations_count": "allocations_count",
            "#materialized_at": "materialized_at",
            "#updated_at": "updated_at",
          },
          ExpressionAttributeValues: {
            ":rubros_count": rubrosCount,
            ":allocations_count": allocationsCount,
            ":materialized_at": materializedAt,
            ":updated_at": materializedAt,
          },
        })
      );
    } catch (persistError) {
      logError("acceptBaseline: failed to persist materialization counts", {
        projectId,
        baselineId,
        error: persistError,
      });
      await logDataHealth({
        projectId,
        baselineId,
        type: "materialize_persist_error",
        message: `Failed to persist materialization counts: ${String(persistError)}`,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (materializeError) {
    logError("acceptBaseline: failed to materialize baseline", {
      projectId,
      baselineId,
      error: materializeError,
    });
  }

  const response = ok(event, { ...result, materialization: materializationDetails });
  response.headers = {
    ...(response.headers || {}),
    "X-Materialized": materialized ? "true" : "false",
  };

  return response;
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath || event.requestContext.http.path;

    // Route based on method and path
    if (method === "PATCH" && path.includes("/projects/")) {
      return await acceptBaseline(event);
    } else {
      return withCors(
        {
          statusCode: 405,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Method not allowed" }),
        },
        event
      );
    }
  } catch (err: unknown) {
    // Handle auth errors
    const authError = fromAuthError(err, event);
    if (authError) return authError;

    console.error("Accept baseline handler error:", err);
    return serverError(event);
  }
};
