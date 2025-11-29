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

type ProjectRubroAttachment = {
  projectId?: string;
  rubroId?: string;
  tier?: string;
  category?: string;
  metadata?: unknown;
  createdAt?: string;
  createdBy?: string;
  sk?: string;
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

// Route: GET /projects/{projectId}/rubros
async function listProjectRubros(event: APIGatewayProxyEventV2) {
  await ensureCanRead(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return bad("missing project id");
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

  const attachments = (result.Items || []) as ProjectRubroAttachment[];
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

  let body: { rubroIds?: string[] };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return bad("Invalid JSON in request body");
  }

  if (!body.rubroIds || !Array.isArray(body.rubroIds)) {
    return bad("rubroIds array required");
  }

  const userEmail = await getUserEmail(event);
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

  return ok({
    message: `Attached ${attached.length} rubros to project ${projectId}`,
    attached,
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

    console.error("Rubros handler error:", err);
    return serverError("Internal server error");
  }
};
