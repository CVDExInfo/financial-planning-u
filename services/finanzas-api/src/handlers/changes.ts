// services/finanzas-api/src/handlers/changes.ts

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { randomUUID } from "node:crypto";

import { ensureCanRead, ensureCanWrite, getUserEmail } from "../lib/auth.js";
import { fromAuthError, ok, bad, serverError } from "../lib/http.js";
import {
  ddb,
  PutCommand,
  QueryCommand,
  GetCommand,
  tableName,
} from "../lib/dynamo.js";
import { logError } from "../utils/logging.js";

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
      logError("Changes table not found", { table: changesTable, error });
      return bad("Changes table not found for this environment", 500);
    }
    throw error;
  }
}

async function findChangeItem(projectId: string, changeId: string) {
  const changesTable = tableName("changes");
  const key = { pk: `PROJECT#${projectId}`, sk: `CHANGE#${changeId}` };

  const result = await ddb.send(
    new GetCommand({
      TableName: changesTable,
      Key: key,
    }),
  );

  return result.Item as Record<string, unknown> | undefined;
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
      logError("Changes table not found", { table: changesTable, error });
      return bad("Changes table not found for this environment", 500);
    }

    throw error;
  }

  return ok(normalizeChange(item), 201);
}

async function approveOrRejectChange(
  projectId: string,
  changeId: string,
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  let payload: Record<string, unknown>;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return bad("Invalid JSON body", 400);
  }

  const action = typeof payload.action === "string" ? payload.action : "";
  const comment =
    typeof payload.comment === "string" ? payload.comment.trim() : "";

  if (action !== "approve" && action !== "reject") {
    return bad("action must be either 'approve' or 'reject'", 400);
  }

  if (action === "reject" && !comment) {
    return bad("comment is required when rejecting a change", 422);
  }

  const changesTable = tableName("changes");

  let existingItem: Record<string, unknown> | undefined;
  try {
    existingItem = await findChangeItem(projectId, changeId);
  } catch (error) {
    if (error && (error as { name?: string }).name === "ResourceNotFoundException") {
      console.error("Changes table not found", { table: changesTable, error });
      return bad("Changes table not found for this environment", 500);
    }
    throw error;
  }

  if (!existingItem) {
    return bad("Change request not found", 404);
  }

  const normalized = normalizeChange(existingItem);
  const decision = action === "approve" ? "approved" : "rejected";
  const approverId = (await getUserEmail(event as never)) || "";
  const now = new Date().toISOString();

  const approvals = Array.isArray(existingItem.approvals)
    ? (existingItem.approvals as unknown[])
    : [];

  const newApproval = {
    id: `APR-${Date.now()}-${randomUUID()}`,
    change_id: normalized.id,
    approver_role: "approver",
    approver_id: approverId,
    decision,
    comment: comment || undefined,
    approved_at: now,
  };

  const updatedItem = {
    ...existingItem,
    approvals: [...approvals, newApproval],
    status: decision,
    updated_at: now,
    ...(decision === "approved"
      ? { approved_at: now }
      : { rejected_at: now }),
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: changesTable,
        Item: updatedItem,
        ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      }),
    );
  } catch (error) {
    if (error && (error as { name?: string }).name === "ConditionalCheckFailedException") {
      return bad("Change request not found", 404);
    }

    if (error && (error as { name?: string }).name === "ResourceNotFoundException") {
      console.error("Changes table not found", { table: changesTable, error });
      return bad("Changes table not found for this environment", 500);
    }

    throw error;
  }

  return ok(normalizeChange(updatedItem));
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext?.http?.method ?? "";
    const projectId = event.pathParameters?.projectId;
    const changeId = event.pathParameters?.changeId;

    if (!projectId) {
      return bad("Missing projectId", 400);
    }

    if (method === "GET") {
      await ensureCanRead(event as never);
      return listChanges(projectId);
    }

    if (method === "POST" && changeId && event.rawPath?.includes("/approval")) {
      await ensureCanWrite(event as never);
      return approveOrRejectChange(projectId, changeId, event);
    }

    if (method === "POST") {
      await ensureCanWrite(event as never);
      return createChange(projectId, event);
    }

    return bad("Route not handled", 404);
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) return authError;

    // Handle DynamoDB-specific errors with appropriate status codes
    if (error && (error as { name?: string }).name === "ResourceNotFoundException") {
      logError("DynamoDB table not found", {
        error,
        table: tableName("changes"),
        operation: event.requestContext?.http?.method,
        path: event.rawPath,
      });
      return bad(`Required table not found: ${tableName("changes")}. Check infrastructure deployment.`, 503);
    }

    if (error && (error as { name?: string }).name === "AccessDeniedException") {
      logError("DynamoDB access denied", {
        error,
        table: tableName("changes"),
        operation: event.requestContext?.http?.method,
      });
      return bad("Database access denied - check IAM permissions", 503);
    }

    const message =
      error instanceof Error ? error.message : "Unexpected error";
    logError("Changes handler error", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      method: event.requestContext?.http?.method,
      path: event.rawPath,
      projectId: event.pathParameters?.projectId,
    });
    return serverError(message);
  }
}
