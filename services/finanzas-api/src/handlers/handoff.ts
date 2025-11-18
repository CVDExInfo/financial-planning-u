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

// Route: GET /projects/{projectId}/handoff
async function getHandoff(event: APIGatewayProxyEventV2) {
  ensureCanRead(event);
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
  ensureCanWrite(event);
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

  const userEmail = getUserEmail(event);
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

  // Create new handoff
  const handoffId = `handoff_${uuidv4().replace(/-/g, "").substring(0, 10)}`;
  const handoff = {
    pk: `PROJECT#${projectId}`,
    sk: `HANDOFF#${handoffId}`,
    handoffId,
    projectId,
    owner: body.owner || userEmail,
    fields: body.fields || body, // Support both structured and flat formats
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: userEmail,
  };

  // Store handoff
  await ddb.send(
    new PutCommand({
      TableName: tableName("projects"),
      Item: handoff,
    })
  );

  // Store idempotency record (with 24h TTL)
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const idempotencyRecord = {
    pk: `IDEMPOTENCY#HANDOFF`,
    sk: idempotencyKey,
    payload: body,
    result: {
      handoffId,
      projectId,
      owner: handoff.owner,
      fields: handoff.fields,
      version: handoff.version,
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
    },
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
    after: handoff,
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
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handoffId,
      projectId,
      owner: handoff.owner,
      fields: handoff.fields,
      version: handoff.version,
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
    }),
  };
}

// Route: PUT /handoff/{handoffId}
async function updateHandoff(event: APIGatewayProxyEventV2) {
  ensureCanWrite(event);
  const handoffId = event.pathParameters?.handoffId;
  if (!handoffId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "missing handoff id" }),
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

  // Validate handoff data if fields are provided
  const fieldsToValidate = body.fields || body;
  const validationResult = safeParseHandoff(fieldsToValidate);
  if (!validationResult.success) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Validation failed",
        details: validationResult.error.errors,
      }),
    };
  }

  const userEmail = getUserEmail(event);
  const now = new Date().toISOString();
  const expectedVersion = body.version ? Number(body.version) : undefined;

  // We need to find the handoff by handoffId (which is in sk)
  // Query all projects' handoffs to find it (not ideal but works for MVP)
  // Better approach: use a GSI on handoffId or store projectId in the request
  
  // For now, require projectId in the request body
  const projectId = body.projectId as string;
  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "projectId required in request body" }),
    };
  }

  // Get existing handoff
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
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "handoff not found" }),
    };
  }

  const currentVersion = existing.Item.version || 1;

  // Optimistic concurrency check
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    return {
      statusCode: 412,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Precondition failed: version mismatch",
        expected: expectedVersion,
        current: currentVersion,
      }),
    };
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

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handoffId: updated.Attributes?.handoffId,
      projectId: updated.Attributes?.projectId,
      owner: updated.Attributes?.owner,
      fields: updated.Attributes?.fields,
      version: updated.Attributes?.version,
      createdAt: updated.Attributes?.createdAt,
      updatedAt: updated.Attributes?.updatedAt,
    }),
  };
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
