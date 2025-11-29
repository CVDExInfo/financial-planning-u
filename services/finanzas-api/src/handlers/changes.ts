import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead, ensureCanWrite, getUserEmail } from "../lib/auth.js";

type ChangeRequest = {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  impact: number;
  status: "pending" | "approved" | "implemented";
  requested_by: string;
  requested_date: string;
  approved_by?: string;
  approved_date?: string;
  implemented_date?: string;
};

const changeStore: ChangeRequest[] = [
  {
    id: "chg_seed_001",
    project_id: "proj_demo_001",
    title: "Add security review",
    description: "Extend scope to include security review for Q2",
    impact: 12500,
    status: "approved",
    requested_by: "demo.pm@example.com",
    requested_date: "2025-01-05",
    approved_by: "director@example.com",
    approved_date: "2025-01-06",
  },
  {
    id: "chg_seed_002",
    project_id: "proj_demo_002",
    title: "Scale back infra",
    description: "Reduce cloud footprint after optimization",
    impact: -3200,
    status: "pending",
    requested_by: "fin@example.com",
    requested_date: "2025-02-01",
  },
];

function jsonResponse(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

async function listChanges(event: APIGatewayProxyEventV2) {
  await ensureCanRead(event as any);

  const projectId =
    event.queryStringParameters?.project_id || event.queryStringParameters?.projectId;

  const filtered = projectId
    ? changeStore.filter((item) => item.project_id === projectId)
    : changeStore;

  return jsonResponse(200, { data: filtered, total: filtered.length });
}

async function createChange(event: APIGatewayProxyEventV2) {
  await ensureCanWrite(event as any);

  if (!event.body) {
    return jsonResponse(400, { message: "Missing request body" });
  }

  let payload: Partial<ChangeRequest> & { impact?: unknown };
  try {
    payload = typeof event.body === "string" ? JSON.parse(event.body) : (event.body as any);
  } catch (parseErr) {
    return jsonResponse(400, { message: "Invalid JSON body", detail: String(parseErr) });
  }

  const required = ["project_id", "title", "impact"] as const;
  const missing = required.filter((field) => !(payload as any)?.[field]);
  if (missing.length) {
    return jsonResponse(400, { message: `Missing fields: ${missing.join(", ")}` });
  }

  const now = new Date().toISOString();
  const requestedBy =
    payload.requested_by || (await getUserEmail(event as any)) || "system@example.com";

  const newChange: ChangeRequest = {
    id: `chg_${Date.now()}`,
    project_id: payload.project_id as string,
    title: payload.title as string,
    description: payload.description,
    impact: Number(payload.impact),
    status: "pending",
    requested_by: requestedBy,
    requested_date: now,
    approved_by: payload.approved_by,
    approved_date: payload.approved_date,
    implemented_date: payload.implemented_date,
  };

  changeStore.unshift(newChange);

  return jsonResponse(201, newChange);
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;

    if (method === "GET") {
      return await listChanges(event);
    }

    if (method === "POST") {
      return await createChange(event);
    }

    return jsonResponse(405, { message: "Method not allowed" });
  } catch (err: unknown) {
    console.error("/changes unhandled error", err);
    return jsonResponse(500, { error: "internal error" });
  }
};
