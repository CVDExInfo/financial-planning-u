import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead, ensureCanWrite, getUserEmail } from "../lib/auth";

type Provider = {
  id: string;
  nombre: string;
  tax_id: string;
  tipo: "servicios" | "materiales" | "software" | "infraestructura";
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_telefono?: string;
  pais?: string;
  estado: "active" | "inactive" | "suspended";
  notas?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
};

const providerStore: Provider[] = [
  {
    id: "prov_seed_001",
    nombre: "Proveedor Semilla S.A.",
    tax_id: "RFC-SEM-001",
    tipo: "servicios",
    contacto_nombre: "Ana Pérez",
    contacto_email: "ana.perez@semilla.com",
    contacto_telefono: "+52-55-0000-0000",
    pais: "MX",
    estado: "active",
    notas: "Proveedor de ejemplo para R1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "system",
  },
];

function jsonResponse(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
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

async function listProviders(event: APIGatewayProxyEventV2) {
  await ensureCanRead(event as any);

  const tipo = parseQueryParam(event, "tipo");
  const estado = parseQueryParam(event, "estado");
  const limit = normalizeLimit(parseQueryParam(event, "limit"));

  const filtered = providerStore.filter((provider) => {
    const matchesTipo = tipo ? provider.tipo === tipo : true;
    const matchesEstado = estado ? provider.estado === estado : true;
    return matchesTipo && matchesEstado;
  });

  return jsonResponse(200, { data: filtered.slice(0, limit), total: filtered.length });
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

  const timestamp = new Date().toISOString();
  const creator = await getUserEmail(event as any);

  const provider: Provider = {
    id: `prov_${Date.now()}`,
    nombre: payload.nombre as string,
    tax_id: payload.tax_id as string,
    tipo: payload.tipo as Provider["tipo"],
    contacto_nombre: payload.contacto_nombre,
    contacto_email: payload.contacto_email,
    contacto_telefono: payload.contacto_telefono,
    pais: payload.pais,
    estado: "active",
    notas: payload.notas,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: creator,
  };

  providerStore.unshift(provider);

  return jsonResponse(201, provider);
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
    console.error("/providers unhandled error", err);
    return jsonResponse(500, { error: "internal error" });
  }
};
