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

  const baselineId = body.baseline_id as string | undefined;
  if (!baselineId) {
    return bad(event, "baseline_id is required");
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

  // Verify that the baseline matches
  const currentBaselineId = projectResult.Item.baseline_id;
  if (currentBaselineId !== baselineId) {
    return bad(
      event,
      `baseline_id mismatch: expected ${currentBaselineId}, got ${baselineId}`,
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

  return ok(event, result);
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
