import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ok, bad, serverError, noContent } from "../lib/http";
import { ddb, QueryCommand, tableName } from "../lib/dynamo";

/**
 * GET /line-items?project_id=xxx
 *
 * Read-only alias endpoint that returns the project’s rubros / line items.
 * This is primarily for frontend compatibility as an alias to
 *   GET /projects/{projectId}/rubros
 *
 * Storage:
 *   - Table: tableName("rubros")
 *   - Partition key: pk = `PROJECT#${projectId}`
 *   - Sort key:     sk begins with "RUBRO#"
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;

    // Fast path for CORS preflight
    if (method === "OPTIONS") {
      // The validate-api-config script accepts both 200 and 204.
      return noContent();
    }

    if (method !== "GET") {
      return bad(`Method ${method} not allowed`, 405);
    }

    // Enforce read permissions (Cognito groups / roles)
    await ensureCanRead(
      event as unknown as Parameters<typeof ensureCanRead>[0]
    );

    // Official contract is ?project_id, but we tolerate ?projectId as well.
    const rawProjectId =
      event.queryStringParameters?.project_id ??
      event.queryStringParameters?.projectId;

    const projectId = rawProjectId?.trim();

    if (!projectId) {
      return bad("Missing required parameter: project_id", 400);
    }

    // Query rubros filtered by project's active baseline
    // This ensures we only return rubros from the accepted baseline,
    // not from all historical baselines
    const filteredRubros = await queryProjectRubros(projectId);

    // Keep the existing line item shape for downstream callers
    const lineItems = filteredRubros.map((item: any) => ({
      id: item.rubroId,
      projectId: item.projectId,
      rubroId: item.rubroId,
      nombre: item.nombre,
      tier: item.tier,
      category: item.category,
      categoria: item.categoria ?? item.category,
      linea_codigo: item.linea_codigo ?? item.rubroId,
      tipo_costo: item.tipo_costo,
      descripcion: item.descripcion ?? item.description,
      metadata: item.metadata,
      createdAt: item.createdAt,
      createdBy: item.createdBy,
      qty: item.qty,
      unit_cost: item.unit_cost,
      currency: item.currency,
      recurring: item.recurring,
      one_time: item.one_time,
      start_month: item.start_month,
      end_month: item.end_month,
      total_cost: item.total_cost,
      description: item.description,
    }));

    return ok({
      data: lineItems,
      total: lineItems.length,
      project_id: projectId,
    });
  } catch (error) {
    // DynamoDB-specific errors → 503 with clear diagnostics
    const name = (error as { name?: string } | undefined)?.name;

    if (name === "ResourceNotFoundException") {
      console.error("DynamoDB table not found for line-items", {
        error,
        table: tableName("rubros"),
        operation: event.requestContext?.http?.method,
        path: event.rawPath,
        projectId: event.queryStringParameters?.project_id,
      });

      return bad(
        `Required table not found: ${tableName(
          "rubros"
        )}. Check infrastructure deployment.`,
        503
      );
    }

    if (name === "AccessDeniedException") {
      console.error("DynamoDB access denied for line-items", {
        error,
        table: tableName("rubros"),
        operation: event.requestContext?.http?.method,
      });

      return bad(
        "Database access denied for line-items - check IAM permissions",
        503
      );
    }

    console.error("Error in line-items handler:", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      method: event.requestContext?.http?.method,
      path: event.rawPath,
      projectId: event.queryStringParameters?.project_id,
    });

    return serverError(
      error instanceof Error ? error.message : "Internal server error"
    );
  }
};
