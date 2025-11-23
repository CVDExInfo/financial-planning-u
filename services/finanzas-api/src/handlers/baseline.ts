import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID, createHash } from "node:crypto";
import { ddb, tableName, PutCommand, GetCommand } from "../lib/dynamo";
import { ensureCanWrite, getUserEmail } from "../lib/auth";

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
  [key: string]: unknown;
}

interface FxIndexation {
  enabled?: boolean;
  rate?: number;
  [key: string]: unknown;
}

interface BaselineRequest {
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
}

/**
 * POST /baseline
 * Creates a new baseline budget and project in DynamoDB
 */
export const createBaseline = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Creating baseline from event:", JSON.stringify(event, null, 2));

  try {
    const authContext = adaptAuthContext(event);
    await ensureCanWrite(authContext as never);

    const body: BaselineRequest = JSON.parse(event.body || "{}");

    // Validate required fields
    if (!body.project_name) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Missing required field: project_name",
        }),
      };
    }

    // Generate IDs
    const project_id = `P-${randomUUID().split("-")[0]}`;
    const baseline_id = `BL-${Date.now()}`;

    const laborEstimates = Array.isArray(body.labor_estimates)
      ? body.labor_estimates
      : [];
    const nonLaborEstimates = Array.isArray(body.non_labor_estimates)
      ? body.non_labor_estimates
      : [];
    const fxIndexation = body.fx_indexation || {};

    // Calculate totals
    const laborTotal = laborEstimates.reduce((sum, item) => {
      const baseHours = (item.hours_per_month || 0) * (item.fte_count || 1);
      const baseCost = baseHours * (item.hourly_rate || 0);
      const onCost = baseCost * ((item.on_cost_percentage || 0) / 100);
      const monthlyTotal = baseCost + onCost;
      const duration = (item.end_month || 1) - (item.start_month || 1) + 1;
      return sum + monthlyTotal * duration;
    }, 0);

    const nonLaborTotal = nonLaborEstimates.reduce((sum, item) => {
      return sum + (item.amount || 0);
    }, 0);

    const total_amount = laborTotal + nonLaborTotal;

    // Canonical payload snapshot & signature hash (server-side only)
    const canonicalPayload = {
      project_name: body.project_name,
      project_description: body.project_description || "",
      client_name: body.client_name || "",
      currency: body.currency || "USD",
      start_date: body.start_date || new Date().toISOString(),
      duration_months: body.duration_months || 12,
      contract_value: body.contract_value || total_amount,
      assumptions: body.assumptions || [],
      labor_estimates: laborEstimates,
      non_labor_estimates: nonLaborEstimates,
      fx_indexation: fxIndexation,
    };

    const signature_hash = createHash("sha256")
      .update(
        JSON.stringify({
          project_id,
          baseline_id,
          total_amount,
          payload: canonicalPayload,
        })
      )
      .digest("hex");

    // Create project record with pk/sk structure
    const timestamp = new Date().toISOString();
    const actor = await getUserEmail(authContext as never);

    const projectsTable = tableName("projects");
    const auditTable = tableName("audit_log");

    const projectItem = {
      pk: `PROJECT#${project_id}`,
      sk: "METADATA",
      project_id,
      nombre: body.project_name, // Spanish field name for consistency
      project_name: body.project_name,
      description: body.project_description || "",
      cliente: body.client_name || "", // Spanish field name
      client_name: body.client_name || "",
      baseline_id,
      baseline_accepted_at: timestamp,
      status: "active",
      moneda: body.currency || "USD", // Spanish field name
      currency: body.currency || "USD",
      duration_months: body.duration_months || 12,
      contract_value: body.contract_value || total_amount,
      presupuesto_total: total_amount, // Spanish field name
      labor_total: laborTotal,
      non_labor_total: nonLaborTotal,
      total_amount,
      signature_hash,
      labor_estimates: laborEstimates,
      non_labor_estimates: nonLaborEstimates,
      fx_indexation: fxIndexation,
      assumptions: body.assumptions || [],
      baseline_payload: canonicalPayload,
      created_at: timestamp,
      created_by: actor,
      updated_at: timestamp,
      fecha_inicio: body.start_date || timestamp.split("T")[0],
      fecha_fin: (() => {
        const startDate = new Date(body.start_date || timestamp);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + (body.duration_months || 12));
        return endDate.toISOString().split("T")[0];
      })(),
    };

    // Save to DynamoDB
    await ddb.send(
      new PutCommand({
        TableName: projectsTable,
        Item: projectItem,
      })
    );

    // Secondary entry to allow baseline_id lookups without a GSI
    await ddb.send(
      new PutCommand({
        TableName: projectsTable,
        Item: {
          pk: `BASELINE#${baseline_id}`,
          sk: "METADATA",
          project_id,
          baseline_id,
          signature_hash,
          created_at: timestamp,
          total_amount,
          project_ref: `PROJECT#${project_id}`,
          preview: {
            project_name: body.project_name,
            client_name: body.client_name || "",
          },
        },
      })
    );

    console.log("✅ Baseline created successfully:", {
      project_id,
      baseline_id,
      signature_hash,
    });

    // Log to audit trail with pk/sk structure
    const auditTimestamp = new Date().toISOString();
    const auditDate = auditTimestamp.split("T")[0];
    await ddb.send(
      new PutCommand({
        TableName: auditTable,
        Item: {
          pk: `AUDIT#${auditDate}`,
          sk: `${auditTimestamp}#${project_id}`,
          audit_id: `AUD-${randomUUID()}`,
          project_id,
          action: "baseline_created",
          actor,
          timestamp: auditTimestamp,
          details: {
            baseline_id,
            project_name: body.project_name,
            total_amount,
            signature_hash,
          },
        },
      })
    );

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        baseline_id,
        project_id,
        signature_hash,
        total_amount,
        created_at: projectItem.created_at,
      }),
    };
  } catch (error) {
    console.error("Error creating baseline:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to create baseline",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

/**
 * GET /baseline/{baseline_id}
 * Retrieves a baseline by ID
 */
export const getBaseline = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Getting baseline from event:", JSON.stringify(event, null, 2));

  try {
    const baseline_id = event.pathParameters?.baseline_id;

    if (!baseline_id) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Missing baseline_id" }),
      };
    }

    // Attempt baseline lookup entry first
    const baselineLookup = await ddb.send(
      new GetCommand({
        TableName: tableName("projects"),
        Key: {
          pk: `BASELINE#${baseline_id}`,
          sk: "METADATA",
        },
      })
    );

    if (!baselineLookup.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Baseline not found" }),
      };
    }

    const projectResult = await ddb.send(
      new GetCommand({
        TableName: tableName("projects"),
        Key: {
          pk: `PROJECT#${baselineLookup.Item.project_id}`,
          sk: "METADATA",
        },
      })
    );

    if (!projectResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Baseline not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(projectResult.Item),
    };
  } catch (error) {
    console.error("Error getting baseline:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to get baseline",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
