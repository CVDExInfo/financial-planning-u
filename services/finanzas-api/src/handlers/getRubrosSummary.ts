import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ok, bad, serverError } from "../lib/http";
import { ddb, tableName, QueryCommand } from "../lib/dynamo";
import { logError } from "../utils/logging";

/**
 * GET /projects/:projectId/rubros-summary
 * 
 * Aggregates allocations and prefacturas into a rubros summary when manual rubros don't exist.
 * This is a server-side fallback for efficient aggregation of baseline data.
 * 
 * Query params:
 *  - baseline: Optional baseline ID to filter by
 * 
 * Returns:
 *  {
 *    rubro_summary: [
 *      {
 *        rubroId: string | null,
 *        description: string,
 *        type: string, // 'labor' | 'non_labor' | ...
 *        monthly: number[], // 12 items (M1..M12)
 *        total: number,
 *        recurrent?: boolean
 *      }
 *    ],
 *    totals: {
 *      labor_total: number,
 *      non_labor_total: number,
 *      rubros_count: number
 *    }
 *  }
 */
export async function getRubrosSummary(event: APIGatewayProxyEventV2) {
  try {
    // Auth check
    const authResult = ensureCanRead(event);
    if (!authResult.ok) {
      return authResult;
    }

    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
      return bad("projectId is required");
    }

    const baselineId = event.queryStringParameters?.baseline;
    const table = tableName();

    // Fetch allocations for the project
    const allocationsParams = {
      TableName: table,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
      } as Record<string, any>,
      FilterExpression: baselineId 
        ? "begins_with(sk, :allocPrefix) AND baseline_id = :baseline"
        : "begins_with(sk, :allocPrefix)",
    };

    if (baselineId) {
      allocationsParams.ExpressionAttributeValues[":baseline"] = baselineId;
    }
    allocationsParams.ExpressionAttributeValues[":allocPrefix"] = "ALLOCATION#";

    const allocationsResult = await ddb.send(new QueryCommand(allocationsParams));
    const allocations = (allocationsResult as any).Items || [];

    // Fetch prefacturas for the project
    const prefacturasParams = {
      TableName: table,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
      } as Record<string, any>,
      FilterExpression: baselineId
        ? "begins_with(sk, :prefPrefix) AND baseline_id = :baseline"
        : "begins_with(sk, :prefPrefix)",
    };

    if (baselineId) {
      prefacturasParams.ExpressionAttributeValues[":baseline"] = baselineId;
    }
    prefacturasParams.ExpressionAttributeValues[":prefPrefix"] = "PREFACTURA#";

    const prefacturasResult = await ddb.send(new QueryCommand(prefacturasParams));
    const prefacturas = (prefacturasResult as any).Items || [];

    // Aggregate into rubros summary
    const rubroMap = new Map<string, any>();

    const addToRubro = (item: any) => {
      const key = item.rubroId || item.role || item.description || "unknown";
      let rubro = rubroMap.get(key);
      
      if (!rubro) {
        rubro = {
          rubroId: item.rubroId || null,
          description: item.description || item.role || "Sin rubro",
          type: item.type || "unknown",
          monthly: Array(12).fill(0),
          total: 0,
        };
        rubroMap.set(key, rubro);
      }

      const month = (item.month || 1) - 1; // Convert to 0-indexed
      const amount = item.amount || 0;
      
      if (month >= 0 && month < 12) {
        rubro.monthly[month] += amount;
      }
      rubro.total += amount;
    };

    // Process allocations
    allocations.forEach((alloc: any) => {
      addToRubro(alloc);
    });

    // Process prefacturas (they may have nested items)
    prefacturas.forEach((pref: any) => {
      if (Array.isArray(pref.items)) {
        pref.items.forEach(addToRubro);
      } else {
        addToRubro({
          rubroId: pref.rubroId,
          description: pref.description,
          month: pref.month || 1,
          amount: pref.amount,
          type: pref.type,
        });
      }
    });

    const rubroSummary = Array.from(rubroMap.values());

    // Calculate totals
    let laborTotal = 0;
    let nonLaborTotal = 0;

    rubroSummary.forEach((rubro) => {
      if (rubro.type === "labor" || rubro.type === "MOD") {
        laborTotal += rubro.total;
      } else {
        nonLaborTotal += rubro.total;
      }
    });

    return ok({
      rubro_summary: rubroSummary,
      totals: {
        labor_total: laborTotal,
        non_labor_total: nonLaborTotal,
        rubros_count: rubroSummary.length,
      },
    });
  } catch (error: any) {
    logError("getRubrosSummary failed", error);
    return serverError("Failed to generate rubros summary");
  }
}
