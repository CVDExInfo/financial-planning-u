// services/finanzas-api/src/handlers/changes.ts

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { randomUUID } from "node:crypto";

import { ensureCanRead, ensureCanWrite, getUserEmail } from "../lib/auth.js";
import { fromAuthError, ok, bad, serverError } from "../lib/http.js";
import { ddb, PutCommand, QueryCommand, tableName } from "../lib/dynamo.js";

// Normalize "array-ish" inputs (string, string[], comma/newline-separated) into a string[]
const normalizeArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  if (typeof value === "string" && value.trim().length) {
    return value
      .split(/[,\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
};

// Convert a raw Dynamo item into the public ChangeRequest shape
const normalizeChange = (item: Record<string, unknown>) => {
  const sk = (item.sk as string) || "";
  const idFromKey = sk.startsWith("CHANGE#") ? sk.replace("CHANGE#", "") : sk;

  const projectKey = (item.pk as string) || "";

  const primaryAffected = normalizeArray(item.affected_line_items);
  const affectedLineItems =
    primaryAffected.length > 0
      ? primaryAffected
      : normalizeArray(item.affectedLineItems);

  return {
    id: (item.id as string) || (item.changeId as string) || idFromKey,
    project_id:
      (item.project_id as string) ||
      (item.projectId as string) ||
      (projectKey.startsWith("PROJECT#")
        ? projectKey.replace("PROJECT#", "")
        : projectKey),
    baseline_id:
      (item.baseline_id as string) || (item.baselineId as string) || "",
    title: (item.title as string) || "",
    description: (item.description as string) || "",
    impact_amount: Number(item.impact_amount ?? item.impactAmount ?? 0),
    currency: (item.currency as string) || "USD",
    affected_line_items: affectedLineItems,
    justification:
      (item.justification as string) ||
      (item.businessJustification as string) ||
      "",
    requested_by:
      (item.requested_by as string) ||
      (item.requestedBy as string) ||
      (item.created_by as string) ||
      "",
    requested_at:
      (item.requested_at as string) ||
      (item.requestedAt as string) ||
      (item.created_at as string) ||
      new Date().toISOString(),
    status: (item.status as string) || "pending",
    approvals: Array.isArray(item.approvals)
      ? (item.approvals as unknown[])
      : [],
  };
};

async function listChanges(projectId: string) {
  const changesTable = tableName("changes");
  console.info("Changes table resolved", { table: changesTable });

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: changesTable,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `PROJECT#${projectId}` },
      }),
    );

    const items = (result.Items as Record<string, unknown>[]) || [];
    const data = items.map(normalizeChange);

    return ok({ data, projectId, total: data.length });
  } catch (error) {
    if (error && (error as { name?: string }).name === "ResourceNotFoundException") {
      console.error("Changes table not found", { table: changesTable, error });
      return bad("Changes table not found for this environment", 500);
    }
    throw error;
  }
}

async function createChange(
  projectId: string,
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  let payload: Record<string, unknown>;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return bad("Invalid JSON body", 400);
  }

  const title =
    typeof payload.title === "string" ? payload.title.trim() : "";
  const description =
    typeof payload.description === "string"
      ? payload.description.trim()
      : "";
  const impactValue = Number(payload.impact_amount ?? payload.impactAmount);
  const currency =
    typeof payload.currency === "string" ? payload.currency : "USD";

  if (!title || !description || Number.isNaN(impactValue)) {
    return bad("title, description, and impact_amount are required", 422);
  }

  const baselineId =
    typeof payload.baseline_id === "string"
      ? payload.baseline_id
      : typeof payload.baselineId === "string"
        ? payload.baselineId
        : "";

  const justification =
    typeof payload.justification === "string"
      ? payload.justification
      : typeof payload.businessJustification === "string"
        ? payload.businessJustification
        : "";

  const affectedLineItems = normalizeArray(
    (payload.affected_line_items as unknown) ?? payload.affectedLineItems,
  );

  const requestedBy = await getUserEmail(event as never);
  const now = new Date().toISOString();
  const changeId =
    (payload.id as string) || `CHG-${Date.now()}-${randomUUID()}`;

  const item = {
    pk: `PROJECT#${projectId}`,
    sk: `CHANGE#${changeId}`,
    id: changeId,
    project_id: projectId,
    baseline_id: baselineId,
    title,
    description,
    impact_amount: impactValue,
    currency,
    affected_line_items: affectedLineItems,
    justification,
    requested_by: requestedBy,
    requested_at: now,
    status: "pending",
    created_at: now,
    updated_at: now,
  };

  const changesTable = tableName("changes");
  console.info("Changes table resolved", { table: changesTable });

  try {
    await ddb.send(
      new PutCommand({
        TableName: changesTable,
        Item: item,
        ConditionExpression:
          "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      }),
    );
  } catch (error) {
    if (error && (error as { name?: string }).name === "ConditionalCheckFailedException") {
      return bad("Change request already exists for this project/id", 409);
    }

    if (error && (error as { name?: string }).name === "ResourceNotFoundException") {
      console.error("Changes table not found", { table: changesTable, error });
      return bad("Changes table not found for this environment", 500);
    }

    throw error;
  }

  return ok(normalizeChange(item), 201);
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext?.http?.method ?? "";
    const projectId = event.pathParameters?.projectId;

    if (!projectId) {
      return bad("Missing projectId", 400);
    }

    if (method === "GET") {
      await ensureCanRead(event as never);
      return listChanges(projectId);
    }

    if (method === "POST") {
      await ensureCanWrite(event as never);
      return createChange(projectId, event);
    }

    return bad("Route not handled", 404);
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) return authError;

    const message =
      error instanceof Error ? error.message : "Unexpected error";
    console.error("Changes handler error", error);
    return serverError(message);
  }
}
