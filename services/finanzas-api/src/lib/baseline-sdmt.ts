/**
 * Baseline → SDMT Mapping & Filtering Utilities
 * 
 * DISCOVERY - SDMT DATA CONTRACT:
 * 
 * Tables used:
 * - `prefacturas`: Stores baseline definitions (labor_estimates, non_labor_estimates)
 *   - PK: `BASELINE#${baselineId}`, SK: `METADATA`
 *   - Contains: payload with labor_estimates[], non_labor_estimates[]
 * 
 * - `projects`: Stores project metadata including active baseline reference
 *   - PK: `PROJECT#${projectId}`, SK: `METADATA`
 *   - Contains: baseline_id, baseline_status, etc.
 * 
 * - `rubros`: Stores materialized rubros (line items) from baselines
 *   - PK: `PROJECT#${projectId}`, SK: `RUBRO#${rubroId}`
 *   - Contains: metadata.baseline_id (stored but not in key)
 * 
 * KEY INSIGHT:
 * - baselineId is stored in rubro metadata but NOT in DynamoDB keys
 * - This means queries by PROJECT# return rubros from ALL baselines
 * - Solution: Filter results by metadata.baseline_id after querying
 * 
 * HANDOFF FLOW:
 * 1. Baseline created in prefacturas table (baseline.ts)
 * 2. Handoff creates project metadata with baseline_id (handoff.ts or projects.ts)
 * 3. seedLineItemsFromBaseline converts labor/non-labor estimates to rubros (projects.ts)
 * 4. SDMT views (catalog, forecast, recon) should query filtered by active baseline_id
 */

import { ddb, tableName, GetCommand, QueryCommand } from "./dynamo";

export interface BaselineRubro {
  rubroId: string;
  nombre: string;
  descripcion?: string;
  category: string;
  qty: number;
  unit_cost: number;
  currency: string;
  recurring: boolean;
  one_time: boolean;
  start_month: number;
  end_month: number;
  total_cost: number;
  metadata?: {
    source?: string;
    baseline_id?: string;
    project_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Get the active baseline ID for a project
 */
export async function getProjectActiveBaseline(
  projectId: string
): Promise<{ baselineId: string | null; baselineStatus: string | null }> {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: tableName("projects"),
        Key: {
          pk: `PROJECT#${projectId}`,
          sk: "METADATA",
        },
      })
    );

    if (!result.Item) {
      return { baselineId: null, baselineStatus: null };
    }

    const baselineId =
      (result.Item.baseline_id as string) ||
      (result.Item.baselineId as string) ||
      null;
    const baselineStatus =
      (result.Item.baseline_status as string) ||
      (result.Item.baselineStatus as string) ||
      null;

    return { baselineId, baselineStatus };
  } catch (error) {
    console.error("Error fetching project baseline", { projectId, error });
    return { baselineId: null, baselineStatus: null };
  }
}

/**
 * Filter rubros by baseline ID
 * 
 * This is the critical function that ensures SDMT views only show rubros
 * from the specified baseline, preventing mixing of data from multiple baselines.
 */
export function filterRubrosByBaseline<T extends { metadata?: { baseline_id?: string } }>(
  rubros: T[],
  baselineId: string | null
): T[] {
  // If no baseline specified, return all (backwards compatibility)
  if (!baselineId) {
    return rubros;
  }

  // Filter to only rubros that match the baseline
  return rubros.filter((rubro) => {
    const rubroBaselineId = rubro.metadata?.baseline_id;
    
    // Include if baseline_id matches
    if (rubroBaselineId === baselineId) {
      return true;
    }
    
    // Legacy: if rubro has no baseline_id in metadata, exclude it
    // (it's likely from an old seeding or different baseline)
    return false;
  });
}

/**
 * Query and filter rubros for a project by its active baseline
 * 
 * This is the recommended way to fetch rubros for SDMT views.
 */
export async function queryProjectRubros(
  projectId: string,
  baselineId?: string | null
): Promise<BaselineRubro[]> {
  // If baselineId not provided, fetch from project metadata
  let targetBaselineId = baselineId;
  if (!targetBaselineId) {
    const { baselineId: activeBaseline } = await getProjectActiveBaseline(projectId);
    targetBaselineId = activeBaseline;
  }

  // Query all rubros for the project
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  const allRubros: BaselineRubro[] = [];
  let safetyCounter = 0;
  const MAX_PAGINATION_ITERATIONS = 50; // Prevent infinite loops

  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("rubros"),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${projectId}`,
          ":sk": "RUBRO#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const pageItems = (result.Items || []) as BaselineRubro[];
    allRubros.push(...pageItems);
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;

    safetyCounter += 1;
    if (safetyCounter > MAX_PAGINATION_ITERATIONS) {
      console.warn("Exceeded pagination safety limit while querying rubros", {
        projectId,
        baselineId: targetBaselineId,
      });
      break;
    }
  } while (lastEvaluatedKey);

  // Filter by baseline
  return filterRubrosByBaseline(allRubros, targetBaselineId);
}

/**
 * Calculate total cost from rubros
 * This is the authoritative calculation used by catalog and forecast
 */
export function calculateRubrosTotalCost(rubros: BaselineRubro[]): number {
  return rubros.reduce((sum, rubro) => {
    const cost = Number(rubro.total_cost || 0);
    return sum + (Number.isFinite(cost) ? cost : 0);
  }, 0);
}

/**
 * Generate monthly forecast grid from rubros
 * Returns P/F/A (Plan, Forecast, Actual) by month and line item
 */
export function generateForecastGrid(
  rubros: BaselineRubro[],
  months: number = 12
): Array<{
  line_item_id: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
}> {
  const grid: Array<{
    line_item_id: string;
    month: number;
    planned: number;
    forecast: number;
    actual: number;
  }> = [];

  for (const rubro of rubros) {
    const monthlyCost = Number(rubro.unit_cost || 0);
    const startMonth = Math.max(Number(rubro.start_month || 1), 1);
    const endMonth = Math.min(
      Math.max(Number(rubro.end_month || startMonth), startMonth),
      months
    );
    const recurring = Boolean(rubro.recurring);

    if (recurring) {
      // Recurring: spread across months
      for (let month = startMonth; month <= endMonth; month++) {
        grid.push({
          line_item_id: rubro.rubroId,
          month,
          planned: monthlyCost,
          forecast: monthlyCost, // Default: forecast = plan
          actual: 0, // Actual comes from reconciliation
        });
      }
    } else {
      // One-time: all in start month
      grid.push({
        line_item_id: rubro.rubroId,
        month: startMonth,
        planned: Number(rubro.total_cost || 0),
        forecast: Number(rubro.total_cost || 0),
        actual: 0,
      });
    }
  }

  return grid;
}
