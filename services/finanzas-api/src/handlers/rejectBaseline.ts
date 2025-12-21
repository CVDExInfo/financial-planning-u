import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDMT, getUserEmail } from "../lib/auth";
import {
  ddb,
  tableName,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from "../lib/dynamo";
import { bad, fromAuthError, notFound, ok, serverError } from "../lib/http";

// Route: PATCH /projects/{projectId}/reject-baseline
async function rejectBaseline(event: APIGatewayProxyEventV2) {
  await ensureSDMT(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return bad("missing project id");
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return bad("Invalid JSON in request body");
  }

  const baselineId = body.baseline_id as string | undefined;
  if (!baselineId) {
    return bad("baseline_id is required");
  }

  const userEmail = await getUserEmail(event);
  const rejectedBy = (body.rejected_by || userEmail) as string;
  const comment = (body.comment || "") as string;
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
    return notFound("project not found");
  }

  // Verify that the baseline matches
  const currentBaselineId = projectResult.Item.baseline_id;
  if (currentBaselineId !== baselineId) {
    return bad(
      `baseline_id mismatch: expected ${currentBaselineId}, got ${baselineId}`,
      400
    );
  }

  // Defensive check: prevent re-rejection of already rejected baselines
  const currentStatus = projectResult.Item.baseline_status;
  if (currentStatus === "rejected") {
    return bad(
      "Baseline is already rejected. Cannot reject again.",
      409
    );
  }

  // Only allow rejection from "handed_off" or "pending" status
  if (currentStatus !== "handed_off" && currentStatus !== "pending") {
    return bad(
      `Cannot reject baseline with status "${currentStatus}". Expected "handed_off" or "pending".`,
      409
    );
  }

  // Update project metadata with rejection information
  const updated = await ddb.send(
    new UpdateCommand({
      TableName: tableName("projects"),
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: "METADATA",
      },
      UpdateExpression:
        "SET #baseline_status = :baseline_status, #rejected_by = :rejected_by, #baseline_rejected_at = :baseline_rejected_at, #rejection_comment = :rejection_comment, #updated_at = :updated_at",
      ExpressionAttributeNames: {
        "#baseline_status": "baseline_status",
        "#rejected_by": "rejected_by",
        "#baseline_rejected_at": "baseline_rejected_at",
        "#rejection_comment": "rejection_comment",
        "#updated_at": "updated_at",
      },
      ExpressionAttributeValues: {
        ":baseline_status": "rejected",
        ":rejected_by": rejectedBy,
        ":baseline_rejected_at": now,
        ":rejection_comment": comment,
        ":updated_at": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  // Write audit log for baseline rejection
  const audit = {
    pk: `ENTITY#PROJECT#${projectId}`,
    sk: `TS#${now}`,
    action: "BASELINE_REJECTED",
    resource_type: "project",
    resource_id: projectId,
    user: userEmail,
    timestamp: now,
    before: {
      baseline_status: projectResult.Item.baseline_status,
      rejected_by: projectResult.Item.rejected_by,
      baseline_rejected_at: projectResult.Item.baseline_rejected_at,
      rejection_comment: projectResult.Item.rejection_comment,
    },
    after: {
      baseline_status: "rejected",
      rejected_by: rejectedBy,
      baseline_rejected_at: now,
      rejection_comment: comment,
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

  // TODO: PM Notification Extension Point
  // When a baseline is rejected, notify the PM via:
  // 1. Email lambda (if configured)
  // 2. Notifications table entry (for in-app notifications)
  // 
  // Example notification entry:
  // await ddb.send(
  //   new PutCommand({
  //     TableName: tableName("project_notifications"),
  //     Item: {
  //       pk: `PROJECT#${projectId}`,
  //       sk: `NOTIFICATION#${now}`,
  //       type: "baseline_rejected",
  //       recipient: projectResult.Item.pm_email,
  //       message: `SDMT has rejected the baseline for project ${projectResult.Item.name}`,
  //       comment: comment,
  //       rejected_by: rejectedBy,
  //       timestamp: now,
  //       read: false,
  //     },
  //   })
  // );

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
    baseline_status: "rejected",
    rejected_by: rejectedBy,
    baseline_rejected_at: now,
    rejection_comment: comment,
    ...normalizeProjectFields(updated.Attributes),
  };

  return ok(result);
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath || event.requestContext.http.path;

    // Route based on method and path
    if (method === "PATCH" && path.includes("/projects/")) {
      return await rejectBaseline(event);
    } else {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }
  } catch (err: unknown) {
    // Handle auth errors
    const authError = fromAuthError(err);
    if (authError) return authError;

    console.error("Reject baseline handler error:", err);
    return serverError();
  }
};
