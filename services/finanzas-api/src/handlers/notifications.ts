import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead, getUserEmail } from "../lib/auth";
import {
  ddb,
  tableName,
  QueryCommand,
} from "../lib/dynamo";
import { bad, fromAuthError, ok, serverError, withCors } from "../lib/http";
import { logError } from "../utils/logging";

/**
 * GET /projects/{projectId}/notifications
 * Returns unread notifications for a project (baseline acceptance/rejection)
 */
async function getProjectNotifications(event: APIGatewayProxyEventV2) {
  await ensureCanRead(event);
  const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
  if (!projectId) {
    return bad(event, "missing project id");
  }

  try {
    // Query project_notifications table for this project
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("project_notifications"),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${projectId}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: 50, // Reasonable limit
      })
    );

    const notifications = (result.Items || []).map((item) => ({
      id: item.sk,
      type: item.type,
      recipient: item.recipient,
      message: item.message,
      baseline_id: item.baseline_id,
      actioned_by: item.actioned_by,
      timestamp: item.timestamp,
      read: item.read || false,
      comment: item.comment, // For rejection comments
    }));

    // Filter to unread notifications only (optional query param)
    const unreadOnly = event.queryStringParameters?.unread === "true";
    const filteredNotifications = unreadOnly
      ? notifications.filter((n) => !n.read)
      : notifications;

    return ok(event, {
      projectId,
      notifications: filteredNotifications,
      count: filteredNotifications.length,
    });
  } catch (error) {
    logError("Error getting project notifications:", error);
    return serverError(
      event,
      error instanceof Error ? error.message : "Failed to get notifications"
    );
  }
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath || event.requestContext.http.path;

    // Route based on method and path
    if (method === "GET" && path.includes("/projects/") && path.includes("/notifications")) {
      return await getProjectNotifications(event);
    } else {
      return withCors(
        {
          statusCode: 405,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Method not allowed" }),
        },
        event
      );
    }
  } catch (err: unknown) {
    // Handle auth errors
    const authError = fromAuthError(err, event);
    if (authError) return authError;

    console.error("Notifications handler error:", err);
    return serverError(event);
  }
};
