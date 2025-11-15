import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface BaselineRequest {
  project_name: string;
  project_description?: string;
  client_name?: string;
  currency?: string;
  start_date?: string;
  duration_months?: number;
  contract_value?: number;
  labor_estimates: any[];
  non_labor_estimates: any[];
  fx_indexation?: any;
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
    const project_id = `P-${uuidv4().split("-")[0]}`;
    const baseline_id = `BL-${Date.now()}`;

    // Calculate totals
    const laborTotal =
      body.labor_estimates?.reduce((sum, item) => {
        const baseHours = (item.hours_per_month || 0) * (item.fte_count || 1);
        const baseCost = baseHours * (item.hourly_rate || 0);
        const onCost = baseCost * ((item.on_cost_percentage || 0) / 100);
        const monthlyTotal = baseCost + onCost;
        const duration = (item.end_month || 1) - (item.start_month || 1) + 1;
        return sum + monthlyTotal * duration;
      }, 0) || 0;

    const nonLaborTotal =
      body.non_labor_estimates?.reduce((sum, item) => {
        return sum + (item.amount || 0);
      }, 0) || 0;

    const total_amount = laborTotal + nonLaborTotal;

    // Generate signature hash
    const signatureData = JSON.stringify({
      project_id,
      baseline_id,
      project_name: body.project_name,
      total_amount,
      timestamp: new Date().toISOString(),
    });
    const signature_hash = crypto
      .createHash("sha256")
      .update(signatureData)
      .digest("hex");

    // Create project record with pk/sk structure
    const timestamp = new Date().toISOString();
    const actor = event.requestContext?.authorizer?.claims?.email || "system";
    
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
      labor_estimates: body.labor_estimates || [],
      non_labor_estimates: body.non_labor_estimates || [],
      fx_indexation: body.fx_indexation || {},
      assumptions: body.assumptions || [],
      created_at: timestamp,
      created_by: actor,
      updated_at: timestamp,
      fecha_inicio: body.start_date || timestamp.split('T')[0],
      fecha_fin: (() => {
        const startDate = new Date(body.start_date || timestamp);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + (body.duration_months || 12));
        return endDate.toISOString().split('T')[0];
      })(),
    };

    // Save to DynamoDB
    await ddb.send(
      new PutCommand({
        TableName: "finz_projects",
        Item: projectItem,
      })
    );

    console.log("✅ Baseline created successfully:", {
      project_id,
      baseline_id,
      signature_hash,
    });

    // Log to audit trail with pk/sk structure
    const auditTimestamp = new Date().toISOString();
    const auditDate = auditTimestamp.split('T')[0];
    await ddb.send(
      new PutCommand({
        TableName: "finz_audit_log",
        Item: {
          pk: `AUDIT#${auditDate}`,
          sk: `${auditTimestamp}#${project_id}`,
          audit_id: `AUD-${uuidv4()}`,
          project_id,
          action: "baseline_created",
          actor: event.requestContext?.authorizer?.claims?.email || "system",
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

    // Query projects table for baseline
    const result = await ddb.send(
      new GetCommand({
        TableName: "finz_projects",
        Key: {
          baseline_id,
        },
      })
    );

    if (!result.Item) {
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
      body: JSON.stringify(result.Item),
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
