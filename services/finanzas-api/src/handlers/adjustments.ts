import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead, ensureCanWrite, getUserEmail } from "../lib/auth.js";
import { cors } from "../lib/http.js";

type Adjustment = {
  id: string;
  project_id: string;
  tipo: "exceso" | "reduccion" | "reasignacion";
  monto: number;
  estado: "pending_approval" | "approved" | "rejected";
  origen_rubro_id?: string;
  destino_rubro_id?: string;
  fecha_inicio: string;
  metodo_distribucion?: "pro_rata_forward" | "pro_rata_all" | "single_month";
  justificacion?: string;
  solicitado_por: string;
  meses_impactados?: string[];
  distribucion?: { mes: string; monto: number }[];
  created_at: string;
  updated_at: string;
};

const adjustmentStore: Adjustment[] = [
  {
    id: "adj_seed_001",
    project_id: "proj_demo_001",
    tipo: "exceso",
    monto: 25000,
    estado: "approved",
    origen_rubro_id: "rubro_demo_01",
    destino_rubro_id: "rubro_demo_02",
    fecha_inicio: "2025-01",
    metodo_distribucion: "pro_rata_forward",
    justificacion: "Seed adjustment for UI demo",
    solicitado_por: "demo.pm@example.com",
    meses_impactados: ["2025-01", "2025-02", "2025-03"],
    distribucion: [
      { mes: "2025-01", monto: 8333.33 },
      { mes: "2025-02", monto: 8333.33 },
      { mes: "2025-03", monto: 8333.34 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function parseQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key] || event.queryStringParameters?.[key.replace("_", "")] || undefined;
}

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

async function listAdjustments(event: APIGatewayProxyEventV2) {
  await ensureCanRead(event as any);

  const projectId =
    parseQueryParam(event, "project_id") || parseQueryParam(event, "projectId") || undefined;
  const limit = normalizeLimit(parseQueryParam(event, "limit"));

  const filtered = projectId
    ? adjustmentStore.filter((item) => item.project_id === projectId)
    : adjustmentStore;

  return ok({
    data: filtered.slice(0, limit),
    total: filtered.length,
  });
}

async function createAdjustment(event: APIGatewayProxyEventV2) {
  await ensureCanWrite(event as any);

  if (!event.body) {
    return bad("Missing request body", 400);
  }

  let payload: Partial<Adjustment> & { monto?: unknown };
  try {
    payload = typeof event.body === "string" ? JSON.parse(event.body) : (event.body as any);
  } catch (parseErr) {
    return bad({ message: "Invalid JSON body", detail: String(parseErr) }, 400);
  }

  const required = ["project_id", "tipo", "monto", "fecha_inicio", "solicitado_por"] as const;
  const missing = required.filter((field) => !(payload as any)?.[field]);
  if (missing.length) {
    return bad({ message: `Missing fields: ${missing.join(", ")}` }, 400);
  }

  const now = new Date().toISOString();
  const userEmail = (await getUserEmail(event as any)) || payload.solicitado_por || "system";

  const newAdjustment: Adjustment = {
    id: `adj_${Date.now()}`,
    project_id: payload.project_id as string,
    tipo: payload.tipo as Adjustment["tipo"],
    monto: Number(payload.monto),
    estado: "pending_approval",
    origen_rubro_id: payload.origen_rubro_id,
    destino_rubro_id: payload.destino_rubro_id,
    fecha_inicio: payload.fecha_inicio as string,
    metodo_distribucion: payload.metodo_distribucion,
    justificacion: payload.justificacion,
    solicitado_por: payload.solicitado_por || userEmail,
    meses_impactados: payload.meses_impactados || [],
    distribucion: payload.distribucion || [],
    created_at: now,
    updated_at: now,
  };

  adjustmentStore.unshift(newAdjustment);

  return ok(newAdjustment, 201);
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;

    if (method === "OPTIONS") {
      return noContent();
    }

    if (method === "POST") {
      return await createAdjustment(event);
    }

    if (method === "GET") {
      return await listAdjustments(event);
    }

    return bad("Method not allowed", 405);
  } catch (err: unknown) {
    const authResponse = fromAuthError(err);
    if (authResponse) {
      return authResponse;
    }

    console.error("/adjustments unhandled error", err);
    return serverError("internal error");
  }
};
