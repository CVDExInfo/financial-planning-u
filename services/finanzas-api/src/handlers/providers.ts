import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead, ensureCanWrite, getUserEmail } from "../lib/auth";
import {
  ddb,
  PutCommand,
  ScanCommand,
  tableName,
} from "../lib/dynamo";
import crypto from "node:crypto";
import { logError } from "../utils/logging";
import { cors } from "../lib/http";

type Provider = {
  id: string;
  nombre: string;
  tax_id: string;
  tipo: "servicios" | "materiales" | "software" | "infraestructura";
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_telefono?: string;
  pais?: string;
  estado?: "active" | "inactive" | "suspended";
  notas?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
};

const providersTable = tableName("providers");

function jsonResponse(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...cors },
    body: JSON.stringify(payload),
  };
}

function normalizeLimit(limit?: string | number | null): number {
  const parsed = typeof limit === "string" ? parseInt(limit, 10) : limit ?? 50;
  if (!parsed || Number.isNaN(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 200);
}

function parseQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key] || event.queryStringParameters?.[key.replace("_", "")];
}

function normalizeProviderItem(item: Record<string, unknown>): Provider {
  const derivedId =
    (typeof item.pk === "string" && item.pk.startsWith("PROVIDER#")
      ? item.pk.replace("PROVIDER#", "")
      : undefined) ||
    (item as Record<string, unknown>).id ||
    crypto.randomUUID();

  return {
    id: String(derivedId),
    nombre: (item as Record<string, unknown>).nombre as string,
    tax_id: (item as Record<string, unknown>).tax_id as string,
    tipo: (item as Record<string, unknown>).tipo as Provider["tipo"],
    contacto_nombre: (item as Record<string, unknown>).contacto_nombre as string | undefined,
    contacto_email: (item as Record<string, unknown>).contacto_email as string | undefined,
    contacto_telefono: (item as Record<string, unknown>).contacto_telefono as string | undefined,
    pais: (item as Record<string, unknown>).pais as string | undefined,
    estado: ((item as Record<string, unknown>).estado as Provider["estado"]) || "active",
    notas: (item as Record<string, unknown>).notas as string | undefined,
    created_at: (item as Record<string, unknown>).created_at as string | undefined,
    updated_at: (item as Record<string, unknown>).updated_at as string | undefined,
    created_by: (item as Record<string, unknown>).created_by as string | undefined,
  };
}

async function listProviders(event: APIGatewayProxyEventV2) {
  await ensureCanRead(event as any);

  const tipo = parseQueryParam(event, "tipo");
  const estado = parseQueryParam(event, "estado");
  const limit = normalizeLimit(parseQueryParam(event, "limit"));

  const filters: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, unknown> = {};

  if (tipo) {
    filters.push("#tipo = :tipo");
    expressionNames["#tipo"] = "tipo";
    expressionValues[":tipo"] = tipo;
  }

  if (estado) {
    filters.push("#estado = :estado");
    expressionNames["#estado"] = "estado";
    expressionValues[":estado"] = estado;
  }

  const scanInput: ConstructorParameters<typeof ScanCommand>[0] = {
    TableName: providersTable,
    Limit: limit,
  };

  if (filters.length) {
    scanInput.FilterExpression = filters.join(" AND ");
    scanInput.ExpressionAttributeNames = expressionNames;
    scanInput.ExpressionAttributeValues = expressionValues;
  }

  const result = await ddb.send(new ScanCommand(scanInput));
  const providers = (result.Items || []).map(normalizeProviderItem);

  providers.sort((a, b) => {
    const aDate = a.created_at || "";
    const bDate = b.created_at || "";
    return bDate.localeCompare(aDate);
  });

  return jsonResponse(200, { data: providers.slice(0, limit), total: providers.length });
}

async function createProvider(event: APIGatewayProxyEventV2) {
  await ensureCanWrite(event as any);

  if (!event.body) return jsonResponse(400, { message: "Missing request body" });

  let payload: Partial<Provider>;
  try {
    payload = typeof event.body === "string" ? JSON.parse(event.body) : (event.body as any);
  } catch (parseErr) {
    return jsonResponse(400, { message: "Invalid JSON body", detail: String(parseErr) });
  }

  const required = ["nombre", "tax_id", "tipo"] as const;
  const missing = required.filter((field) => !(payload as any)?.[field]);
  if (missing.length) {
    return jsonResponse(400, { message: `Missing fields: ${missing.join(", ")}` });
  }

  const tipo = payload.tipo as Provider["tipo"];
  const allowedTipos: Provider["tipo"][] = [
    "servicios",
    "materiales",
    "software",
    "infraestructura",
  ];

  if (!allowedTipos.includes(tipo)) {
    return jsonResponse(400, { message: "Invalid tipo value" });
  }

  const timestamp = new Date().toISOString();
  const creator = await getUserEmail(event as any);
  const id = `prov_${crypto.randomUUID()}`;

  const item = {
    pk: `PROVIDER#${id}`,
    sk: "METADATA",
    id,
    nombre: payload.nombre as string,
    tax_id: payload.tax_id as string,
    tipo,
    contacto_nombre: payload.contacto_nombre,
    contacto_email: payload.contacto_email,
    contacto_telefono: payload.contacto_telefono,
    pais: payload.pais,
    estado: "active",
    notas: payload.notas,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: creator,
  } satisfies Record<string, unknown>;

  await ddb.send(
    new PutCommand({
      TableName: providersTable,
      Item: item,
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );

  return jsonResponse(201, normalizeProviderItem(item));
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;

    if (method === "POST") {
      return await createProvider(event);
    }

    if (method === "GET") {
      return await listProviders(event);
    }

    return jsonResponse(405, { message: "Method not allowed" });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "statusCode" in err) {
      const e = err as { statusCode?: number; body?: string };
      return jsonResponse(e.statusCode || 500, { error: e.body || "error" });
    }
    logError("/providers unhandled error", err);
    return jsonResponse(500, { error: "internal error" });
  }
};
