/**
 * Baseline → SDMT Mapping & Filtering Utilities
 *
 * TABLES & KEYS
 * -------------
 * - projects:
 *   - PK: PROJECT#${projectId}
 *   - SK: METADATA
 *   - Contains: baseline_id, baseline_status, etc. (active baseline reference)
 *
 * - rubros:
 *   - PK: PROJECT#${projectId}
 *   - SK: RUBRO#${rubroId}
 *   - Contains: metadata.baseline_id (baseline that materialized this rubro)
 *
 * KEY INSIGHT
 * -----------
 * - baseline_id is stored in rubro metadata but NOT in the Dynamo key.
 * - Queries by PROJECT# will return rubros from all baselines.
 * - We must filter by metadata.baseline_id in code to avoid mixing baselines.
 *
 * HANDOFF FLOW
 * ------------
 * 1. Baseline created (prefacturas / baseline flow).
 * 2. Handoff / acceptBaseline updates project METADATA with baseline_id, baseline_status.
 * 3. seedLineItemsFromBaseline materializes labor/non-labor estimates as rubros.
 * 4. SDMT views (catalog, forecast, reconciliation) must:
 *    - read the active baseline_id from projects.METADATA
 *    - filter rubros by that baseline_id.
 */

import { ddb, tableName } from "./dynamo";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export interface ProjectBaselineInfo {
  baselineId: string | null;
  baselineStatus: string | null;
}

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
 * Get the active baseline ID for a project.
 *
 * NOTE: We:
 * - Read from projects table at SK = "METADATA".
 * - Import GetCommand from @aws-sdk/lib-dynamodb (NOT ./dynamo) so Jest mocks
 *   on ./dynamo do not break the command constructor.
 */
export async function getProjectActiveBaseline(
  projectId: string
): Promise<ProjectBaselineInfo> {
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
      (result.Item.baseline_id as string | undefined) ??
      (result.Item.baselineId as string | undefined) ??
      null;

    const baselineStatus =
      (result.Item.baseline_status as string | undefined) ??
      (result.Item.baselineStatus as string | undefined) ??
      null;

    return { baselineId, baselineStatus };
  } catch (error) {
    console.error("Error fetching project baseline", { projectId, error });
    return { baselineId: null, baselineStatus: null };
  }
}

/**
 * Filter rubros by baseline ID.
 *
 * This is the critical function that ensures SDMT views only show rubros
 * from the specified baseline, preventing mixing of multiple baselines.
 */
export function filterRubrosByBaseline<
  T extends { metadata?: { baseline_id?: string } }
>(rubros: T[], baselineId: string | null): T[] {
  // Backwards compatibility: if we don't know the baseline, return all rubros.
  if (!baselineId) {
    return rubros;
  }

  return rubros.filter((rubro) => {
    const rubroBaselineId = rubro.metadata?.baseline_id;

    // Only include rubros that explicitly match this baseline.
    if (rubroBaselineId === baselineId) {
      return true;
    }

    // Legacy rubros without baseline_id are excluded to avoid mixing.
    return false;
  });
}

/**
 * Query and filter rubros for a project by its active baseline.
 *
 * This is the recommended way for SDMT views (catalog, forecast, reconciliation)
 * to obtain consistent, non-mixed rubro data.
 */
export async function queryProjectRubros(
  projectId: string,
  baselineId?: string | null
): Promise<BaselineRubro[]> {
  // If no baselineId is passed, resolve from project metadata.
  let targetBaselineId = baselineId;
  if (!targetBaselineId) {
    const { baselineId: activeBaseline } = await getProjectActiveBaseline(
      projectId
    );
    targetBaselineId = activeBaseline;
  }

  const allRubros: BaselineRubro[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let safetyCounter = 0;
  const MAX_PAGINATION_ITERATIONS = 50; // Defensive guard

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
    lastEvaluatedKey = result.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;

    safetyCounter += 1;
    if (safetyCounter > MAX_PAGINATION_ITERATIONS) {
      console.warn("Exceeded pagination safety limit while querying rubros", {
        projectId,
        baselineId: targetBaselineId,
      });
      break;
    }
  } while (lastEvaluatedKey);

  return filterRubrosByBaseline(allRubros, targetBaselineId ?? null);
}

/**
 * Aggregate total cost for a set of rubros.
 * Used by catalog summaries and baseline total comparisons.
 */
export function calculateRubrosTotalCost(rubros: BaselineRubro[]): number {
  return rubros.reduce((sum, rubro) => {
    const cost = Number(rubro.total_cost ?? 0);
    return sum + (Number.isFinite(cost) ? cost : 0);
  }, 0);
}

/**
 * Generate a monthly forecast grid from rubros.
 *
 * Output is P/F/A by month and line item and is used by the forecast handler
 * before layering in allocations, payroll, and reconciled actuals.
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
    const monthlyCost = Number(rubro.unit_cost ?? 0);
    const startMonth = Math.max(Number(rubro.start_month ?? 1), 1);
    const endMonth = Math.min(
      Math.max(Number(rubro.end_month ?? startMonth), startMonth),
      months
    );
    const recurring = Boolean(rubro.recurring);

    if (recurring) {
      // Recurring rubros: spread across months
      for (let month = startMonth; month <= endMonth; month++) {
        grid.push({
          line_item_id: rubro.rubroId,
          month,
          planned: monthlyCost,
          forecast: monthlyCost, // default forecast = plan
          actual: 0, // actuals come later from reconciled data
        });
      }
    } else {
      // One-time rubros: entire cost in start month
      const total = Number(rubro.total_cost ?? 0);
      grid.push({
        line_item_id: rubro.rubroId,
        month: startMonth,
        planned: total,
        forecast: total,
        actual: 0,
      });
    }
  }

  return grid;
}

export default {
  getProjectActiveBaseline,
  filterRubrosByBaseline,
  queryProjectRubros,
  calculateRubrosTotalCost,
  generateForecastGrid,
};
