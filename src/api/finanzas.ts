/**
 * Finanzas API endpoints - PRODUCTION ONLY
 * Direct calls to Lambda handlers with no mock fallbacks
 */

import { httpGet, httpPost } from "./client";

/**
 * Get forecast data for a project
 * GET /plan/forecast?projectId={id}&months={n}
 */
export function getForecast(projectId: string, months: number) {
  return httpGet<{ data: unknown[] }>(
    `/plan/forecast?projectId=${encodeURIComponent(projectId)}&months=${months}`
  );
}

/**
 * Get invoices (prefacturas) for a project
 * GET /prefacturas?projectId={id}
 */
export function getInvoices(projectId: string) {
  return httpGet<{ data: unknown[] }>(
    `/prefacturas?projectId=${encodeURIComponent(projectId)}`
  );
}

/**
 * Get project rubros (line items)
 * GET /projects/{id}/rubros
 */
export function getProjectRubros(projectId: string) {
  return httpGet<{ data: unknown[]; total?: number }>(
    `/projects/${encodeURIComponent(projectId)}/rubros`
  );
}

/**
 * Add a line item to a project
 * POST /projects/{id}/rubros
 */
export function createProjectRubro(
  projectId: string,
  data: {
    rubroId: string;
    qty: number;
    unitCost: number;
    type: string;
    duration: string;
  }
) {
  return httpPost(`/projects/${encodeURIComponent(projectId)}/rubros`, data);
}
