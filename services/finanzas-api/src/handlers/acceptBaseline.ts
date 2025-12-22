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
  
  // Determine which baseline_id to use with explicit logic
  let baselineId: string;
  if (requestBaselineId) {
    // Request provides baseline_id - validate it matches project if project has one
    if (projectBaselineId && requestBaselineId !== projectBaselineId) {
      return bad(
        event,
        `baseline_id mismatch: expected ${projectBaselineId}, got ${requestBaselineId}`,
        400
      );
    }
    baselineId = requestBaselineId;
  } else if (projectBaselineId) {
    // Fall back to project's baseline_id
    baselineId = projectBaselineId;
  } else {
    // Neither request nor project has baseline_id
    return bad(event, "baseline_id is required (provide in request body or ensure project has baseline_id)");
  }

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
