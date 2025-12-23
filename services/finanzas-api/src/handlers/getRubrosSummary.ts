import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ddb, tableName, QueryCommand } from "../lib/dynamo";
import { ok, bad, serverError } from "../lib/http";
import { logError } from "../utils/logging";

/**
 * GET /projects/{projectId}/rubros-summary
 * 
 * Aggregate allocations and prefacturas by rubroId to provide a rubros-like summary
 * even when the rubros table is empty (e.g., after baseline materialization).
 * 
 * This solves the "missing rubros" problem where:
 * - Baseline handoff creates allocations/prefacturas
 * - But rubros table entries are not created
 * - UI shows "0 Rubros" even though data exists
 * 
 * Returns:
 * {
 *   rubro_summary: [
 *     {
 *       rubroId: "MOD-LEAD",
 *       description: "Service Delivery Manager",
 *       type: "labor",
 *       monthly: [266000, 266000, ...],
 *       total: 3192000,
 *       recurrent: true
 *     }
 *   ],
 *   totals: {
 *     labor_total: 123456,
 *     non_labor_total: 34567,
 *     rubros_count: 4
 *   }
 * }
 */

interface AllocationRecord {
  pk: string;
  sk: string;
  projectId?: string;
  rubroId?: string;
  rubro_id?: string;
  role?: string;
  description?: string;
  month?: number | string;
  amount?: number;
  type?: string;
  rubro_type?: string;
  recurring?: boolean;
}

interface RubroAggregation {
  rubroId: string | null;
  description: string;
  type: string;
  monthly: number[];
  total: number;
  recurrent: boolean;
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    await ensureCanRead(event);
    
    const projectId = event.pathParameters?.projectId || event.pathParameters?.id;
    if (!projectId) {
      return bad("Missing project ID");
    }

    const baselineId = event.queryStringParameters?.baseline;

    // Query allocations table
    const allocationsResult = await ddb.send(
      new QueryCommand({
        TableName: tableName("allocations"),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${projectId}`,
        },
      })
    );

    const allocations = (allocationsResult.Items || []) as AllocationRecord[];

    // Query prefacturas table
    let prefacturas: AllocationRecord[] = [];
    try {
      const prefacturasResult = await ddb.send(
        new QueryCommand({
          TableName: tableName("prefacturas"),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": `PROJECT#${projectId}`,
          },
        })
      );
      prefacturas = (prefacturasResult.Items || []) as AllocationRecord[];
    } catch (err) {
      // Prefacturas table might not exist in some environments
      console.warn("Could not query prefacturas table:", err);
    }

    // Combine allocations and prefacturas
    const allRecords = [...allocations, ...prefacturas];

    if (allRecords.length === 0) {
      return ok({
        rubro_summary: [],
        totals: {
          labor_total: 0,
          non_labor_total: 0,
          rubros_count: 0,
        },
      });
    }

    // Build aggregation map
    const aggregationMap = new Map<string, RubroAggregation>();

    allRecords.forEach((record) => {
      // Extract rubroId (prefer rubroId over rubro_id)
      const rubroId = record.rubroId || record.rubro_id || null;
      const description = record.description || record.role || "Sin descripción";
      const type = record.type || record.rubro_type || "unknown";
      
      // Generate a stable key
      const key = rubroId || `${description}_${type}`;
      
      let entry = aggregationMap.get(key);
      if (!entry) {
        entry = {
          rubroId,
          description,
          type,
          monthly: Array(12).fill(0),
          total: 0,
          recurrent: record.recurring || false,
        };
        aggregationMap.set(key, entry);
      }

      // Parse month and add amount
      const amount = record.amount || 0;
      let monthIndex = -1;

      if (typeof record.month === "number") {
        monthIndex = record.month - 1; // Convert 1-12 to 0-11
      } else if (typeof record.month === "string") {
        // Handle "M1", "M2" format
        const mMatch = record.month.match(/^M(\d+)$/i);
        if (mMatch) {
          monthIndex = parseInt(mMatch[1], 10) - 1;
        }
        // Handle "2025-01" format
        else if (/^\d{4}-\d{2}$/.test(record.month)) {
          const monthNum = parseInt(record.month.substring(5, 7), 10);
          monthIndex = monthNum - 1;
        }
        // Handle plain number string
        else {
          const parsed = parseInt(record.month, 10);
          if (!isNaN(parsed)) {
            monthIndex = parsed - 1;
          }
        }
      }

      if (monthIndex >= 0 && monthIndex < 12) {
        entry.monthly[monthIndex] += amount;
        entry.total += amount;
      } else {
        // If month parsing failed, add to total only
        entry.total += amount;
      }
    });

    // Convert map to array
    const rubroSummary = Array.from(aggregationMap.values());

    // Calculate totals
    let laborTotal = 0;
    let nonLaborTotal = 0;

    rubroSummary.forEach((rubro) => {
      const normalizedType = (rubro.type || "").toLowerCase();
      if (normalizedType === "labor" || normalizedType === "mod") {
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
  } catch (error) {
    logError("getRubrosSummary handler error", error, event.requestContext.requestId);
    return serverError("Failed to get rubros summary");
  }
};
