import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ok, bad, serverError } from "../lib/http";
import { queryProjectRubros } from "../lib/baseline-sdmt";
import { logError } from "../utils/logging";

/**
 * GET /projects/:projectId/rubros-summary
 * 
 * Aggregates materialized rubros into a summary response for SDMT catalog/forecast.
 * This is the canonical server-side aggregation for baseline-derived rubros.
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
    await ensureCanRead(event as any);

    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
      return bad(event as any, "projectId is required");
    }

    const baselineId = event.queryStringParameters?.baseline;
    const rubros = await queryProjectRubros(projectId, baselineId);

    const rubroMap = new Map<
      string,
      {
        rubroId: string | null;
        description: string;
        type: string;
        monthly: number[];
        total: number;
      }
    >();

    const isLabor = (rubro: any) => {
      const category = `${rubro.category || ""}`.toLowerCase();
      const lineaCodigo = `${rubro.metadata?.linea_codigo || ""}`.toUpperCase();
      return category.includes("labor") || category.includes("mod") || lineaCodigo.startsWith("MOD");
    };

    rubros.forEach((rubro) => {
      const key = rubro.rubroId || rubro.metadata?.linea_codigo || "unknown";
      const description =
        rubro.descripcion ||
        rubro.nombre ||
        rubro.metadata?.linea_codigo ||
        "Sin rubro";

      if (!rubroMap.has(key)) {
        rubroMap.set(key, {
          rubroId: rubro.rubroId || null,
          description,
          type: isLabor(rubro) ? "labor" : "non_labor",
          monthly: Array(12).fill(0),
          total: 0,
        });
      }

      const entry = rubroMap.get(key)!;
      const startMonth = Math.max(Number(rubro.start_month || 1), 1);
      const endMonth = Math.max(Number(rubro.end_month || startMonth), startMonth);
      const qty = Number(rubro.qty || 1);
      const unitCost = Number(rubro.unit_cost || 0);
      const totalCost =
        Number(rubro.total_cost || 0) ||
        unitCost * qty * Math.max(endMonth - startMonth + 1, 1);
      const isOneTime = Boolean(rubro.one_time);

      if (isOneTime) {
        const monthIndex = Math.min(11, Math.max(0, startMonth - 1));
        entry.monthly[monthIndex] += totalCost;
        entry.total += totalCost;
      } else {
        const monthsCount = Math.max(endMonth - startMonth + 1, 1);
        const monthlyAmount = unitCost * qty;
        for (let month = startMonth; month <= endMonth; month += 1) {
          if (month >= 1 && month <= 12) {
            entry.monthly[month - 1] += monthlyAmount;
          }
        }
        entry.total += totalCost || monthlyAmount * monthsCount;
      }
    });

    const rubroSummary = Array.from(rubroMap.values());
    const totals = rubroSummary.reduce(
      (acc, rubro) => {
        if (rubro.type === "labor") {
          acc.labor_total += rubro.total;
        } else {
          acc.non_labor_total += rubro.total;
        }
        return acc;
      },
      { labor_total: 0, non_labor_total: 0 }
    );

    return ok(event as any, {
      rubro_summary: rubroSummary,
      totals: {
        ...totals,
        rubros_count: rubroSummary.length,
      },
    });
  } catch (error: any) {
    logError("getRubrosSummary failed", error);
    return serverError(event as any, "Failed to generate rubros summary");
  }
}
