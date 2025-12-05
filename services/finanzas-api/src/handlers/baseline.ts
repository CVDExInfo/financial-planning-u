import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID, createHash } from "node:crypto";
import { ddb, tableName, PutCommand, GetCommand } from "../lib/dynamo";
import { ensureCanWrite, getUserEmail } from "../lib/auth";
import { bad, ok, serverError } from "../lib/http";
import { logError } from "../utils/logging";

const adaptAuthContext = (event: APIGatewayProxyEvent) => ({
  requestContext: {
    authorizer: {
      jwt: {
        claims: event.requestContext?.authorizer?.claims ?? {},
      },
    },
  },
});

interface LaborEstimate {
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

    const body: BaselineRequest = JSON.parse(event.body || "{}");

    if (!body.project_name) {
      return bad("Missing required field: project_name");
    }

    const laborEstimates = Array.isArray(body.labor_estimates)
      ? body.labor_estimates
      : [];
    const nonLaborEstimates = Array.isArray(body.non_labor_estimates)
      ? body.non_labor_estimates
      : [];

    const project_id =
      body.project_id?.trim() ||
      `PRJ-${body.project_name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
    const baseline_id = `base_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

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

    const canonicalPayload = {
      project_id,
      project_name: body.project_name,
      project_description: body.project_description || "",
      client_name: body.client_name || "",
      currency: body.currency || "USD",
      start_date: body.start_date || timestamp,
      duration_months: body.duration_months || 12,
      contract_value: body.contract_value || total_amount,
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
      currency: body.currency || "USD",
      start_date: body.start_date || timestamp,
      duration_months: body.duration_months || 12,
      contract_value: body.contract_value || total_amount,
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
          "Prefactura baselines store is unavailable. Please try again later."
        );
      }

      logError("Unexpected DynamoDB error creating prefactura baseline", error);
      return serverError("Unable to create baseline at this time.");
    }

    return ok(
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
    logError("Error creating baseline:", error);
    return serverError(
      error instanceof Error ? error.message : "Failed to create baseline"
    );
  }
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
      return bad("Missing baseline_id");
    }

    const prefacturasTable = tableName("prefacturas");
    const lookup = await ddb.send(
      new GetCommand({
        TableName: prefacturasTable,
        Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      })
    );

    if (!lookup.Item) {
      return bad("Baseline not found", 404);
    }

    return ok(lookup.Item);
  } catch (error) {
    logError("Error getting baseline:", error);
    return serverError(
      error instanceof Error ? error.message : "Failed to get baseline"
    );
  }
};
