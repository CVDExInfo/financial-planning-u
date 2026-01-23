import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ok, bad, serverError } from "../lib/http";
import { ddb, QueryCommand, tableName } from "../lib/dynamo";
import { logError } from "../utils/logging";
import { getCanonicalRubroId } from "../lib/canonical-taxonomy";

/**
 * GET /invoices?project_id=xxx
 *
 * Read-only alias endpoint that returns the same invoice/prefactura
 * rows used by the Reconciliation module. This is primarily for
 * frontend compatibility and legacy integrations.
 *
 * Storage:
 *   - Table: tableName("prefacturas")
 *   - Partition key: pk = `PROJECT#${projectId}`
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;

    if (method !== "GET") {
      return bad(`Method ${method} not allowed`, 405);
    }

    // Enforce read permissions (Cognito groups / roles)
    await ensureCanRead(
      event as unknown as Parameters<typeof ensureCanRead>[0]
    );

    // Support both ?project_id and ?projectId for flexibility, but
    // prefer project_id to keep the contract explicit.
    const rawProjectId =
      event.queryStringParameters?.project_id ??
      event.queryStringParameters?.projectId;

    const projectId = rawProjectId?.trim();

    if (!projectId) {
      return bad("Missing required parameter: project_id", 400);
    }

    // Query invoices/prefacturas for this project
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("prefacturas"),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${projectId}`,
        },
      })
    );

    const items = result.Items ?? [];
    const count = result.Count ?? items.length ?? 0;

    // Annotate each invoice with canonical rubro for frontend matching
    const annotatedItems = items.map(inv => {
      let canonical = inv.rubro_canonical || null;
      
      // Try to compute canonical from available fields if not already present
      if (!canonical) {
        try {
          const rubroSource = inv.linea_codigo || inv.rubroId || inv.rubro || inv.description || '';
          if (rubroSource) {
            canonical = getCanonicalRubroId(rubroSource);
          }
        } catch (e) {
          console.warn('[invoices] Canonicalization failed', { 
            invId: inv.id || inv.sk, 
            err: e instanceof Error ? e.message : String(e) 
          });
          canonical = null;
        }
      }

      return {
        ...inv,
        rubro_canonical: canonical,
        month: inv.month || (inv.invoiceDate && inv.invoiceDate.slice(0, 7)) || null,
        amount: Number(inv.amount || inv.total || 0)
      };
    });

    return ok({
      data: annotatedItems,
      projectId,
      total: count,
    });
  } catch (error) {
    logError("Error in invoices handler", { error });

    return serverError(
      error instanceof Error ? error.message : "Internal server error"
    );
  }
};
