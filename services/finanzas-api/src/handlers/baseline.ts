import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID, createHash } from "node:crypto";
import {
  ddb,
  tableName,
  PutCommand,
  GetCommand,
  ScanCommand,
} from "../lib/dynamo";
import { ensureCanWrite, ensureCanRead, getUserEmail } from "../lib/auth";
import { bad, ok, serverError, withCors } from "../lib/http";
import { logError } from "../utils/logging";

const adaptAuthContext = (event: APIGatewayProxyEvent) => ({
  headers: event.headers,
  requestContext: {
    authorizer: {
      jwt: {
        claims:
          event.requestContext?.authorizer?.jwt?.claims ||
          event.requestContext?.authorizer?.claims ||
          {},
      },
    },
  },
});

interface LaborEstimate {
  rubroId?: string;  // Canonical rubro ID from taxonomy (e.g., "MOD-ING", "MOD-LEAD")
  role?: string;
  country?: string;
  level?: string;
  hours?: number;
  rate?: number;
  resource_name?: string;
  hours_per_month?: number;
  fte_count?: number;
  hourly_rate?: number;
  on_cost_percentage?: number;
  start_month?: number;
  end_month?: number;
  [key: string]: unknown;
}

interface NonLaborEstimate {
  rubroId?: string;  // Canonical rubro ID from taxonomy (e.g., "GSV-REU", "SOI-AWS")
  category?: string;
  description?: string;
  amount?: number;
  vendor?: string;
  one_time?: boolean;
  start_month?: number;
  end_month?: number;
  capex_flag?: boolean;
  [key: string]: unknown;
}

interface FxIndexation {
  enabled?: boolean;
  rate?: number;
  [key: string]: unknown;
}

interface SupportingDocumentMeta {
  documentId?: string;
  documentKey?: string;
  originalName?: string;
  uploadedAt?: string;
  contentType?: string;
}

interface BaselineRequest {
  project_id?: string;
  project_name: string;
  project_description?: string;
  client_name?: string;
  currency?: string;
  start_date?: string;
  duration_months?: number;
  contract_value?: number;
  sdm_manager_name?: string;
  labor_estimates: LaborEstimate[];
  non_labor_estimates: NonLaborEstimate[];
  fx_indexation?: FxIndexation;
  assumptions?: string[];
  supporting_documents?: SupportingDocumentMeta[];
  signed_by?: string;
  signed_role?: string;
  signed_at?: string;
}

/**
 * POST /baseline
 * Creates a new prefactura baseline entry without mutating Finanzas R1 projects
 */
export const createBaseline = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authContext = adaptAuthContext(event);
    await ensureCanWrite(authContext as never);

    let body: BaselineRequest;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseError) {
      logError("Invalid JSON payload for baseline creation", parseError);
      return bad(event, "El cuerpo de la solicitud no es un JSON válido.");
    }

    if (!body.project_name) {
      return bad(event, "Falta el nombre del proyecto.");
    }

    const laborEstimates = Array.isArray(body.labor_estimates)
      ? body.labor_estimates
      : [];
    const nonLaborEstimates = Array.isArray(body.non_labor_estimates)
      ? body.non_labor_estimates
      : [];

    if (!laborEstimates.length && !nonLaborEstimates.length) {
      return bad(event, 
        "Debe haber al menos un costo de mano de obra o no laboral para crear la línea base."
      );
    }

    const project_id =
      body.project_id?.trim() ||
      `PRJ-${body.project_name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
    const baseline_id = `base_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const currency = body.currency?.trim() || "USD";
    const durationMonths = body.duration_months ?? 12;

    if (!durationMonths || durationMonths <= 0) {
      return bad(event, "La duración del proyecto debe ser mayor a cero.");
    }

    const laborTotal = laborEstimates.reduce((sum, item) => {
      const baseHours = (item.hours_per_month || 0) * (item.fte_count || 0);
      const baseCost = baseHours * (item.hourly_rate || item.rate || 0);
      const onCost = baseCost * ((item.on_cost_percentage || 0) / 100);
      const duration = (item.end_month || 1) - (item.start_month || 1) + 1;
      return sum + (baseCost + onCost) * duration;
    }, 0);

    const nonLaborTotal = nonLaborEstimates.reduce((sum, item) => {
      if (item.one_time) {
        return sum + (item.amount || 0);
      }
      const duration = (item.end_month || 1) - (item.start_month || 1) + 1;
      return sum + (item.amount || 0) * duration;
    }, 0);

    const total_amount = laborTotal + nonLaborTotal;
    const timestamp = new Date().toISOString();
    const fxIndexation = body.fx_indexation || {};
    const supportingDocs = Array.isArray(body.supporting_documents)
      ? body.supporting_documents
      : [];

    const sdmManagerEmail =
      typeof body.sdm_manager_email === "string"
        ? body.sdm_manager_email.trim().toLowerCase()
        : undefined;

    const canonicalPayload = {
      project_id,
      project_name: body.project_name,
      project_description: body.project_description || "",
      client_name: body.client_name || "",
      currency,
      start_date: body.start_date || timestamp,
      duration_months: durationMonths,
      contract_value: body.contract_value || total_amount,
      sdm_manager_name: body.sdm_manager_name,
      sdm_manager_email: sdmManagerEmail,
      assumptions: body.assumptions || [],
      labor_estimates: laborEstimates,
      non_labor_estimates: nonLaborEstimates,
      fx_indexation: fxIndexation,
      supporting_documents: supportingDocs,
      signed_by: body.signed_by || (await getUserEmail(authContext as never)),
      signed_role: body.signed_role || "PMO",
      signed_at: body.signed_at || timestamp,
    };

    const signature_hash = createHash("sha256")
      .update(
        JSON.stringify({
          baseline_id,
          project_id,
          total_amount,
          payload: canonicalPayload,
        })
      )
      .digest("hex");

    const prefacturaItem = {
      pk: `PROJECT#${project_id}`,
      sk: `BASELINE#${baseline_id}`,
      project_id,
      project_name: body.project_name,
      client_name: body.client_name || "",
      currency,
      start_date: body.start_date || timestamp,
      duration_months: durationMonths,
      contract_value: body.contract_value || total_amount,
      sdm_manager_name: body.sdm_manager_name,
      sdm_manager_email: sdmManagerEmail,
      assumptions: body.assumptions || [],
      labor_estimates: laborEstimates,
      non_labor_estimates: nonLaborEstimates,
      fx_indexation: fxIndexation,
      supporting_documents: supportingDocs,
      signed_by: canonicalPayload.signed_by,
      signed_role: canonicalPayload.signed_role,
      signed_at: canonicalPayload.signed_at,
      status: "PendingSDMT",
      baseline_id,
      signature_hash,
      total_amount,
      created_at: timestamp,
      created_by: canonicalPayload.signed_by,
    };

    const prefacturasTable = tableName("prefacturas");

    try {
      await ddb.send(
        new PutCommand({
          TableName: prefacturasTable,
          Item: prefacturaItem,
        })
      );

      await ddb.send(
        new PutCommand({
          TableName: prefacturasTable,
          Item: {
            pk: `BASELINE#${baseline_id}`,
            sk: "METADATA",
            project_id,
            baseline_id,
            status: prefacturaItem.status,
            signature_hash,
            total_amount,
            created_at: timestamp,
            sdm_manager_name: body.sdm_manager_name,
            sdm_manager_email: sdmManagerEmail,
            preview: {
              project_name: body.project_name,
              client_name: body.client_name || "",
              currency: body.currency || "USD",
            },
            payload: canonicalPayload,
          },
        })
      );
    } catch (error) {
      const name = (error as { name?: string } | undefined)?.name;
      const code = (error as { Code?: string } | undefined)?.Code;
      if (
        name === "ResourceNotFoundException" ||
        name === "AccessDeniedException" ||
        code === "ResourceNotFoundException" ||
        code === "AccessDeniedException"
      ) {
        logError("Prefactura baseline table unavailable", {
          table: prefacturasTable,
          error,
        });
        return serverError(
          event,
          "El almacén de líneas base de prefacturas no está disponible o está mal configurado."
        );
      }

      logError("Unexpected DynamoDB error creating prefactura baseline", error);
      return serverError(event, "Unable to create baseline at this time.");
    }

    return ok(
      event,
      {
        baselineId: baseline_id,
        projectId: project_id,
        status: prefacturaItem.status,
        signatureHash: signature_hash,
        totalAmount: total_amount,
        createdAt: timestamp,
      },
      201
    );
  } catch (error) {
    const statusCode = (error as { statusCode?: number } | undefined)?.statusCode;
    const body = (error as { body?: unknown } | undefined)?.body;

    if (statusCode) {
      return withCors(
        {
          statusCode,
          body:
            typeof body === "string" ? body : JSON.stringify(body || "Unauthorized"),
          headers: {
            "Content-Type": "application/json",
          },
        },
        event
      );
    }

    logError("Error creating baseline:", error);
    return serverError(
      event,
      error instanceof Error ? error.message : "Failed to create baseline"
    );
  }
};

export const listBaselines = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    await ensureCanRead(event as never);

    const statusFilter =
      event.queryStringParameters?.status?.trim() || "PendingSDMT";

    const prefacturasTable = tableName("prefacturas");

    const scanResult = await ddb.send(
      new ScanCommand({
        TableName: prefacturasTable,
        FilterExpression:
          "begins_with(#pk, :pkPrefix) AND #sk = :skMeta AND (#status = :status OR :status = :noStatus)",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#sk": "sk",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":pkPrefix": "BASELINE#",
          ":skMeta": "METADATA",
          ":status": statusFilter,
          ":noStatus": "",
        },
      })
    );

    const items = (scanResult.Items || [])
      .map((item) => ({
        baseline_id:
          item.baseline_id ||
          (typeof item.pk === "string"
            ? item.pk.replace("BASELINE#", "")
            : undefined),
        project_id: item.project_id,
        project_name:
          item.project_name || item.preview?.project_name || item.payload?.project_name,
        client_name:
          item.client_name || item.preview?.client_name || item.payload?.client_name,
        status: item.status,
        total_amount: item.total_amount || item.payload?.contract_value,
        created_at: item.created_at,
        signed_by: item.signed_by,
        signed_at: item.signed_at,
      }))
      .filter((item) => item.baseline_id)
      .sort((a, b) => {
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });

    return ok(event, { items });
  } catch (error) {
    logError("Error listing baselines:", error);
    return serverError(
      event,
      error instanceof Error ? error.message : "Failed to list baselines"
    );
  }
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method =
    event.httpMethod?.toUpperCase() ||
    (event as { requestContext?: { http?: { method?: string } } }).requestContext
      ?.http?.method?.toUpperCase() ||
    "";

  if (method === "OPTIONS") {
    return noContent(event);
  }

  const routeKey =
    (event as { requestContext?: { routeKey?: string } }).requestContext
      ?.routeKey || "";
  const rawPath =
    (event as { rawPath?: string }).rawPath || event.path || event.resource || "";

  if (routeKey === "POST /baseline" || (method === "POST" && rawPath === "/baseline")) {
    return createBaseline(event);
  }

  if (
    routeKey === "GET /baseline/{baseline_id}" ||
    (method === "GET" && rawPath.startsWith("/baseline/"))
  ) {
    return getBaseline(event);
  }

  if (
    routeKey === "GET /prefacturas/baselines" ||
    (method === "GET" && rawPath.startsWith("/prefacturas/baselines"))
  ) {
    return listBaselines(event);
  }

  return bad(event, "Ruta no encontrada", 404);
};

/**
 * GET /baseline/{baseline_id}
 * Retrieves a baseline by ID from the prefacturas store
 */
export const getBaseline = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const baselineId = event.pathParameters?.baseline_id;
    if (!baselineId) {
      return bad(event, "Missing baseline_id");
    }

    const prefacturasTable = tableName("prefacturas");
    const lookup = await ddb.send(
      new GetCommand({
        TableName: prefacturasTable,
        Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      })
    );

    if (!lookup.Item) {
      return bad(event, "Baseline not found", 404);
    }

    return ok(event, lookup.Item);
  } catch (error) {
    logError("Error getting baseline:", error);
    return serverError(
      event,
      error instanceof Error ? error.message : "Failed to get baseline"
    );
  }
};
