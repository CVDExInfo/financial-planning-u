/**
 * Payroll Service
 * Service for fetching payroll dashboard data from the Finanzas API
 */

import { HAS_API_BASE } from "@/config/env";
import { buildAuthHeader, handleAuthErrorStatus } from "@/config/api";
import httpClient, { HttpError } from "@/lib/http-client";

/**
 * PayrollKind discriminator for plan/forecast/actual
 */
export type PayrollKind = "plan" | "forecast" | "actual";

/**
 * PayrollEntry - raw payroll entry from backend
 */
export interface PayrollEntry {
  id: string;
  projectId: string;
  period: string; // YYYY-MM format
  kind: PayrollKind;
  amount: number;
  currency: string;
  allocationId?: string;
  rubroId?: string;
  resourceCount?: number;
  source?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  notes?: string;
  pk?: string;
  sk?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * MOD Projection by month for dashboard display
 * Matches the MODProjectionByMonth interface from backend
 */
export interface MODProjectionByMonth {
  month: string; // YYYY-MM or YYYY-MM-DD (project start month)
  totalPlanMOD: number; // Sum of all projects' plan MOD
  totalForecastMOD: number; // Sum of all projects' forecast MOD
  totalActualMOD: number; // Sum of all projects' actual MOD
  projectCount: number; // Number of projects starting in this month
}

/**
 * Error class for payroll service errors
 */
export class PayrollServiceError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "PayrollServiceError";
  }
}

/**
 * Get payroll dashboard data for a specific project
 * This function calls the backend /payroll endpoint which reads from
 * the finz_payroll_actuals DynamoDB table
 *
 * @param projectId - The project ID (e.g., "P-CONNECT-AVI-001")
 * @returns Promise<MODProjectionByMonth[]> - Array of MOD projections by month for this project
 * @throws PayrollServiceError if the API call fails
 */
export async function getPayrollDashboardForProject(
  projectId: string,
): Promise<MODProjectionByMonth[]> {
  if (!HAS_API_BASE) {
    throw new PayrollServiceError(
      "Finanzas API base URL is not configured. Cannot fetch payroll data.",
    );
  }

  if (!projectId) {
    throw new PayrollServiceError("Project ID is required");
  }

  try {
    const headers = buildAuthHeader();

    // Call the backend /payroll endpoint with projectId to get payroll entries
    // The endpoint reads from DynamoDB finz_payroll_actuals table
    // Query: pk = PROJECT#${projectId}#MONTH#${period} for all periods
    const response = await httpClient.get<PayrollEntry[]>(
      `/payroll?projectId=${encodeURIComponent(projectId)}`,
      { headers },
    );

    // The backend returns an array of payroll entries (raw PayrollEntry objects)
    const payrollEntries = response.data || [];

    // Aggregate the raw payroll entries by month into MODProjectionByMonth format
    if (Array.isArray(payrollEntries) && payrollEntries.length > 0) {
      return aggregatePayrollByMonth(payrollEntries, projectId);
    }

    // Return empty array if no data
    return [];
  } catch (error) {
    if (error instanceof HttpError) {
      // Handle auth errors
      if (error.status === 401 || error.status === 403) {
        handleAuthErrorStatus(error.status);
      }

      throw new PayrollServiceError(
        `Failed to fetch payroll data: ${error.message}`,
        error.status,
      );
    }

    if (error instanceof Error) {
      throw new PayrollServiceError(
        `Failed to fetch payroll data: ${error.message}`,
      );
    }

    throw new PayrollServiceError("Unknown error fetching payroll data");
  }
}

/**
 * Aggregate raw payroll entries by month and currency into MODProjectionByMonth objects
 * This is a helper function in case the backend doesn't return aggregated data
 */
function aggregatePayrollByMonth(
  entries: PayrollEntry[],
  projectId: string,
): MODProjectionByMonth[] {
  const monthMap = new Map<
    string,
    {
      planMOD: number;
      forecastMOD: number;
      actualMOD: number;
      count: number;
    }
  >();

  for (const entry of entries) {
    const month = entry.period || (entry as any).month;
    const kind = entry.kind || "actual";
    const amount = Number(entry.amount || 0);

    if (!month) continue;

    const existing = monthMap.get(month) || {
      planMOD: 0,
      forecastMOD: 0,
      actualMOD: 0,
      count: 1,
    };

    if (kind === "plan") {
      existing.planMOD += amount;
    } else if (kind === "forecast") {
      existing.forecastMOD += amount;
    } else if (kind === "actual") {
      existing.actualMOD += amount;
    }

    monthMap.set(month, existing);
  }

  // Convert map to array and sort by month
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      totalPlanMOD: data.planMOD,
      totalForecastMOD: data.forecastMOD,
      totalActualMOD: data.actualMOD,
      projectCount: data.count,
    }));
}
