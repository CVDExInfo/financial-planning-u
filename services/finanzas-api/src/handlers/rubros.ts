import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanWrite, ensureCanRead, getUserEmail } from "../lib/auth";
import {
  ddb,
  tableName,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  GetCommand,
} from "../lib/dynamo";

// Route: GET /projects/{projectId}/rubros
async function listProjectRubros(event: APIGatewayProxyEventV2) {
  ensureCanRead(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "missing project id" }),
    };
  }

  // Query all rubros attached to this project
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName("rubros"),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
        ":sk": "RUBRO#",
      },
    })
  );

  const rubros = (result.Items || []).map((item) => ({
    projectId: item.projectId,
    rubroId: item.rubroId,
    tier: item.tier,
    category: item.category,
    metadata: item.metadata,
    createdAt: item.createdAt,
    createdBy: item.createdBy,
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: rubros, total: rubros.length }),
  };
}

// Route: POST /projects/{projectId}/rubros
async function attachRubros(event: APIGatewayProxyEventV2) {
  ensureCanWrite(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "missing project id" }),
    };
  }

  let body: { rubroIds?: string[] };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  if (!body.rubroIds || !Array.isArray(body.rubroIds)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "rubroIds array required" }),
    };
  }

  const userEmail = getUserEmail(event);
  const now = new Date().toISOString();
  const attached: string[] = [];

  // Attach each rubro to the project
  for (const rubroId of body.rubroIds) {
    // Check if rubro exists in catalog (optional validation)
    // For MVP, we'll just attach it

    const attachment = {
      pk: `PROJECT#${projectId}`,
      sk: `RUBRO#${rubroId}`,
      projectId,
      rubroId,
      createdAt: now,
      createdBy: userEmail,
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName("rubros"),
        Item: attachment,
      })
    );

    attached.push(rubroId);

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

    await ddb.send(
      new PutCommand({
        TableName: tableName("audit_log"),
        Item: audit,
      })
    );
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Attached ${attached.length} rubros to project ${projectId}`,
      attached,
    }),
  };
}

// Route: DELETE /projects/{projectId}/rubros/{rubroId}
async function detachRubro(event: APIGatewayProxyEventV2) {
  ensureCanWrite(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  const rubroId = event.pathParameters?.rubroId;

  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "missing project id" }),
    };
  }

  if (!rubroId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "missing rubro id" }),
    };
  }

  const userEmail = getUserEmail(event);
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
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "rubro attachment not found" }),
    };
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

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Detached rubro ${rubroId} from project ${projectId}`,
    }),
  };
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
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }
  } catch (err: unknown) {
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

    console.error("Rubros handler error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
