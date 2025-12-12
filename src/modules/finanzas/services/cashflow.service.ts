/**
 * Cashflow Service
 * Provides cashflow data aggregation for single project and all projects modes
 */

import ApiService from "@/lib/api";
import { logger } from "@/utils/logger";

export interface CashflowMonthData {
  month: number;
  ingresos: number;
  egresos: number;
  neto: number;
  margen: number; // percentage
}

export interface CashflowData {
  months: string[]; // Month labels (M1, M2, etc.)
  ingresos: number[];
  egresos: number[];
  neto: number[];
  margen: number[];
}

export interface CashflowResponse {
  inflows: Array<{ month: number; amount: number }>;
  outflows: Array<{ month: number; amount: number }>;
  margin: Array<{ month: number; percentage: number }>;
}

/**
 * Fetch cashflow data for a single project
 */
export async function getCashflowForProject(
  projectId: string,
  months: number
): Promise<CashflowResponse> {
  try {
    const data = await ApiService.getCashFlowData(projectId, months);
    return data;
  } catch (error) {
    logger.error("Failed to fetch cashflow for project:", projectId, error);
    return {
      inflows: [],
      outflows: [],
      margin: [],
    };
  }
}

/**
 * Fetch cashflow data for all projects (aggregated)
 */
export async function getCashflowForAllProjects(
  projectIds: string[],
  months: number
): Promise<CashflowResponse> {
  try {
    // Fetch cashflow for all projects in parallel
    const results = await Promise.allSettled(
      projectIds.map((projectId) =>
        ApiService.getCashFlowData(projectId, months)
      )
    );

    // Aggregate data across all projects
    const aggregated: CashflowResponse = {
      inflows: [],
      outflows: [],
      margin: [],
    };

    // Maps to aggregate by month
    const inflowsByMonth = new Map<number, number>();
    const outflowsByMonth = new Map<number, number>();

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const data = result.value;

        // Aggregate inflows
        data.inflows.forEach((inflow) => {
          const current = inflowsByMonth.get(inflow.month) || 0;
          inflowsByMonth.set(inflow.month, current + inflow.amount);
        });

        // Aggregate outflows
        data.outflows.forEach((outflow) => {
          const current = outflowsByMonth.get(outflow.month) || 0;
          outflowsByMonth.set(outflow.month, current + outflow.amount);
        });
      } else {
        logger.warn(
          "Failed to fetch cashflow for project:",
          projectIds[index],
          result.reason
        );
      }
    });

    // Convert maps to arrays
    for (let month = 1; month <= months; month++) {
      const inflowAmount = inflowsByMonth.get(month) || 0;
      const outflowAmount = outflowsByMonth.get(month) || 0;

      aggregated.inflows.push({ month, amount: inflowAmount });
      aggregated.outflows.push({ month, amount: outflowAmount });

      // Calculate margin
      const marginAmount = inflowAmount - outflowAmount;
      const marginPercentage =
        inflowAmount > 0 ? (marginAmount / inflowAmount) * 100 : 0;
      aggregated.margin.push({ month, percentage: marginPercentage });
    }

    return aggregated;
  } catch (error) {
    logger.error("Failed to fetch cashflow for all projects:", error);
    return {
      inflows: [],
      outflows: [],
      margin: [],
    };
  }
}

/**
 * Transform cashflow response to chart-ready format
 * This is a pure function with strict data validation
 */
export function toCashflowSeries(
  response: CashflowResponse,
  numMonths: number
): CashflowData {
  const months: string[] = [];
  const ingresos: number[] = [];
  const egresos: number[] = [];
  const neto: number[] = [];
  const margen: number[] = [];

  // Create month labels and initialize with zeros
  for (let i = 1; i <= numMonths; i++) {
    months.push(`M${i}`);

    // Find data for this month
    const inflow = response.inflows.find((item) => item.month === i);
    const outflow = response.outflows.find((item) => item.month === i);
    const margin = response.margin.find((item) => item.month === i);

    // Coerce to numbers and guard against NaN
    const ingresosValue = Number(inflow?.amount || 0);
    const egresosValue = Number(outflow?.amount || 0);
    const netoValue = ingresosValue - egresosValue;
    const margenValue = Number(margin?.percentage || 0);

    // Validate numbers
    ingresos.push(Number.isFinite(ingresosValue) ? ingresosValue : 0);
    egresos.push(Number.isFinite(egresosValue) ? egresosValue : 0);
    neto.push(Number.isFinite(netoValue) ? netoValue : 0);
    margen.push(Number.isFinite(margenValue) ? margenValue : 0);
  }

  return {
    months,
    ingresos,
    egresos,
    neto,
    margen,
  };
}

/**
 * Get cashflow data based on mode (single project or all projects)
 */
export async function getCashflow(
  mode: "ALL" | "PROJECT",
  projectId: string | null,
  projectIds: string[],
  months: number
): Promise<CashflowResponse> {
  if (mode === "ALL") {
    return getCashflowForAllProjects(projectIds, months);
  } else if (projectId) {
    return getCashflowForProject(projectId, months);
  } else {
    return {
      inflows: [],
      outflows: [],
      margin: [],
    };
  }
}
