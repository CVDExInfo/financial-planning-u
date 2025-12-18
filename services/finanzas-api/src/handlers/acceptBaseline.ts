import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanWrite, getUserEmail } from "../lib/auth";
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

// Route: PATCH /projects/{projectId}/accept-baseline
async function acceptBaseline(event: APIGatewayProxyEventV2) {
  await ensureCanWrite(event);
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

  const userEmail = await getUserEmail(event);
  const acceptedBy = (body.accepted_by || userEmail) as string;
  const now = new Date().toISOString();

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

  // ROBUSTNESS FIX: Allow baseline_id to be omitted in request body
  // If not provided, read from project metadata (makes frontend contract more flexible)
  let baselineId = body.baseline_id as string | undefined;
  const metadataBaselineId = projectResult.Item.baseline_id as string | undefined;

  if (!baselineId && !metadataBaselineId) {
    return bad(
      event,
      "project metadata missing baseline_id: run handoff first",
      400
    );
  }

  // If baselineId not provided, use the one from metadata
  if (!baselineId) {
    baselineId = metadataBaselineId;
    console.info("[acceptBaseline] Using baseline_id from project metadata", {
      projectId,
      baselineId,
    });
  }

  // Verify that the baseline matches (if both are provided)
  if (baselineId && metadataBaselineId && metadataBaselineId !== baselineId) {
    return bad(
      event,
      `baseline_id mismatch: expected ${metadataBaselineId}, got ${baselineId}`,
      400
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

  // PM Notification: Write to project_notifications table for PMO to see
  try {
    const recipient = projectResult.Item.sdm_manager_email || projectResult.Item.pm_email || "unknown";
    await ddb.send(
      new PutCommand({
        TableName: tableName("project_notifications"),
        Item: {
          pk: `PROJECT#${projectId}`,
          sk: `NOTIFICATION#${now}`,
          type: "baseline_accepted",
          recipient,
          message: `SDMT accepted baseline ${baselineId} for ${projectResult.Item.name || projectId}`,
          baseline_id: baselineId,
          actioned_by: acceptedBy,
          timestamp: now,
          read: false,
        },
      })
    );
    console.info("[acceptBaseline] Notification created for PM", {
      projectId,
      baselineId,
      recipient,
    });
  } catch (notificationError) {
    // Log error but don't fail the accept operation
    logError("acceptBaseline: failed to create PM notification", {
      projectId,
      baselineId,
      error: notificationError,
    });
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
