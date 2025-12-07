import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanWrite, ensureCanRead, getUserEmail } from "../lib/auth";
import {
  ddb,
  tableName,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "../lib/dynamo";
import { v4 as uuidv4 } from "uuid";
import { safeParseHandoff } from "../validation/handoff";
import { ZodError } from "zod";
import { bad, fromAuthError, notFound, ok, serverError } from "../lib/http";

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
  const result = await ddb.send(
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

  // Check if this idempotency key has been used before
  const idempotencyCheck = await ddb.send(
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

  // Extract baseline_id from payload
  const baselineId = (body.baseline_id || body.baselineId) as string | undefined;
  if (!baselineId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "baseline_id is required" }),
    };
  }

  // Fetch baseline data from prefacturas table to get project details
  const baselineResult = await ddb.send(
    new GetCommand({
      TableName: tableName("prefacturas"),
      Key: {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
      },
    })
  );

  if (!baselineResult.Item) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Baseline not found" }),
    };
  }

  const baseline = baselineResult.Item;
  const projectName = baseline.payload?.project_name || baseline.project_name || "Unnamed Project";
  const clientName = baseline.payload?.client_name || baseline.client_name || "";
  const currency = baseline.payload?.currency || baseline.currency || "USD";
  const startDate = baseline.payload?.start_date || baseline.start_date || now;
  const durationMonths = baseline.payload?.duration_months || baseline.duration_months || 12;
  const totalAmount = baseline.total_amount || body.mod_total || 0;

  // Calculate end_date from start_date + duration_months
  let endDate = baseline.payload?.end_date || baseline.end_date;
  if (!endDate && startDate && durationMonths) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      const end = new Date(start);
      end.setMonth(end.getMonth() + durationMonths);
      endDate = end.toISOString().split('T')[0]; // yyyy-mm-dd format
    }
  }

  // Create new handoff record
  const handoffId = `handoff_${uuidv4().replace(/-/g, "").substring(0, 10)}`;
  const handoff = {
    pk: `PROJECT#${projectId}`,
    sk: `HANDOFF#${handoffId}`,
    handoffId,
    projectId,
    baselineId,
    owner: body.owner || userEmail,
    fields: body.fields || body, // Support both structured and flat formats
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: userEmail,
  };

  // Generate a clean project code from projectId if not already in proper format
  // projectId might be something like "PRJ-PROJECT-P-5AE50ACE" (derived from project name)
  // We want a cleaner code like "P-5ae50ace" or keep projectId if it's already clean
  let projectCode = projectId;
  
  // If projectId looks like it was auto-generated from a name (contains "PROJECT" or is very long),
  // generate a shorter code. Otherwise use projectId as-is.
  if (projectId.includes("PROJECT") || projectId.length > 20) {
    // Generate a short code: extract meaningful part or create new one
    const baselineIdShort = baselineId.replace(/^base_/, '').substring(0, 8);
    projectCode = `P-${baselineIdShort}`;
  }

  // Create/update SDMT-ready project in projects table
  const projectMetadata = {
    pk: `PROJECT#${projectId}`,
    sk: "METADATA",
    id: projectId,
    project_id: projectId,
    projectId,
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
    baseline_accepted_at: now,
    currency,
    moneda: currency,
    start_date: startDate,
    fecha_inicio: startDate,
    end_date: endDate || null,
    fecha_fin: endDate || null,
    duration_months: durationMonths,
    mod_total: totalAmount,
    presupuesto_total: totalAmount,
    created_at: now,
    updated_at: now,
    created_by: userEmail,
    handed_off_at: now,
    handed_off_by: userEmail,
  };

  // Store handoff record
  await ddb.send(
    new PutCommand({
      TableName: tableName("projects"),
      Item: handoff,
    })
  );

  // Store or update project metadata for SDMT
  await ddb.send(
    new PutCommand({
      TableName: tableName("projects"),
      Item: projectMetadata,
    })
  );

  // Store idempotency record (with 24h TTL)
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const result = {
    handoffId,
    projectId,
    baselineId,
    status: "HandoffComplete",
    owner: handoff.owner,
    fields: handoff.fields,
    version: handoff.version,
    createdAt: handoff.createdAt,
    updatedAt: handoff.updatedAt,
  };

  const idempotencyRecord = {
    pk: `IDEMPOTENCY#HANDOFF`,
    sk: idempotencyKey,
    payload: body,
    result,
    ttl,
  };

  await ddb.send(
    new PutCommand({
      TableName: tableName("projects"),
      Item: idempotencyRecord,
    })
  );

  // Audit log
  const audit = {
    pk: `ENTITY#PROJECT#${projectId}`,
    sk: `TS#${now}`,
    action: "HANDOFF_CREATE",
    resource_type: "handoff",
    resource_id: handoffId,
    user: userEmail,
    timestamp: now,
    before: null,
    after: {
      handoff,
      project: projectMetadata,
    },
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

  return {
    statusCode: 200,
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
    const existing = await ddb.send(
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
    const updated = await ddb.send(
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

    await ddb.send(
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
