import { apiClient, type ApiResponse, type ApiRequestBody } from './client';

/**
 * Projects API
 */

/**
 * List all projects with optional filtering
 */
export async function getProjects(params?: {
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled';
  limit?: number;
  offset?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const query = queryParams.toString();
  const path = query ? `/finanzas/projects?${query}` : '/finanzas/projects';

  return apiClient<ApiResponse<'/projects', 'get'>>(path, {
    method: 'GET',
  });
}

/**
 * Create a new project
 */
export async function createProject(
  data: ApiRequestBody<'/projects', 'post'>
) {
  return apiClient<ApiResponse<'/projects', 'post', 201>>(
    '/finanzas/projects',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * Process project handoff
 */
export async function createHandoff(
  projectId: string,
  data: ApiRequestBody<'/projects/{id}/handoff', 'post'>
) {
  return apiClient<ApiResponse<'/projects/{id}/handoff', 'post'>>(
    `/finanzas/projects/${projectId}/handoff`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * Catalog API
 */

/**
 * Get budget rubros catalog
 */
export async function getRubros(params?: {
  tipo_ejecucion?: 'mensual' | 'puntual' | 'por_hito';
}) {
  const queryParams = new URLSearchParams();
  if (params?.tipo_ejecucion) {
    queryParams.append('tipo_ejecucion', params.tipo_ejecucion);
  }

  const query = queryParams.toString();
  const path = query ? `/finanzas/catalog/rubros?${query}` : '/finanzas/catalog/rubros';

  return apiClient<ApiResponse<'/catalog/rubros', 'get'>>(path, {
    method: 'GET',
  });
}

/**
 * Add rubro to project
 */
export async function addProjectRubro(
  projectId: string,
  data: ApiRequestBody<'/projects/{id}/rubros', 'post'>
) {
  return apiClient<ApiResponse<'/projects/{id}/rubros', 'post', 201>>(
    `/finanzas/projects/${projectId}/rubros`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * List project rubros
 */
export async function getProjectRubros(projectId: string) {
  return apiClient<ApiResponse<'/projects/{id}/rubros', 'get'>>(
    `/finanzas/projects/${projectId}/rubros`,
    {
      method: 'GET',
    }
  );
}

/**
 * Allocations API
 */

/**
 * Bulk update allocations
 */
export async function bulkUpdateAllocations(
  projectId: string,
  data: ApiRequestBody<'/projects/{id}/allocations:bulk', 'put'>
) {
  return apiClient<ApiResponse<'/projects/{id}/allocations:bulk', 'put'>>(
    `/finanzas/projects/${projectId}/allocations:bulk`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
}

/**
 * Get project financial plan
 */
export async function getProjectPlan(projectId: string, mes: string) {
  return apiClient<ApiResponse<'/projects/{id}/plan', 'get'>>(
    `/finanzas/projects/${projectId}/plan?mes=${mes}`,
    {
      method: 'GET',
    }
  );
}

/**
 * Payroll API
 */

/**
 * Ingest payroll data
 */
export async function ingestPayroll(
  data: ApiRequestBody<'/payroll/ingest', 'post'>
) {
  return apiClient<ApiResponse<'/payroll/ingest', 'post', 202>>(
    '/finanzas/payroll/ingest',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * Close monthly period
 */
export async function closeMonth(mes: string) {
  return apiClient<ApiResponse<'/close-month', 'post'>>(
    `/finanzas/close-month?mes=${mes}`,
    {
      method: 'POST',
    }
  );
}

/**
 * Get coverage report
 */
export async function getCoverageReport(params?: {
  start_date?: string;
  end_date?: string;
  project_id?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);
  if (params?.project_id) queryParams.append('project_id', params.project_id);

  const query = queryParams.toString();
  const path = query
    ? `/finanzas/report/cobertura?${query}`
    : '/finanzas/report/cobertura';

  return apiClient<ApiResponse<'/report/cobertura', 'get'>>(path, {
    method: 'GET',
  });
}

/**
 * Adjustments API
 */

/**
 * Create budget adjustment
 */
export async function createAdjustment(
  data: ApiRequestBody<'/adjustments', 'post'>
) {
  return apiClient<ApiResponse<'/adjustments', 'post', 201>>(
    '/finanzas/adjustments',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * List adjustments
 */
export async function getAdjustments(params?: {
  project_id?: string;
  estado?: 'pending_approval' | 'approved' | 'rejected';
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id);
  if (params?.estado) queryParams.append('estado', params.estado);
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const query = queryParams.toString();
  const path = query ? `/finanzas/adjustments?${query}` : '/finanzas/adjustments';

  return apiClient<ApiResponse<'/adjustments', 'get'>>(path, {
    method: 'GET',
  });
}

/**
 * Movements API
 */

/**
 * Create financial movement
 */
export async function createMovement(
  data: ApiRequestBody<'/movements', 'post'>
) {
  return apiClient<ApiResponse<'/movements', 'post', 201>>(
    '/finanzas/movements',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * List movements
 */
export async function getMovements(params?: {
  project_id?: string;
  estado?: 'pending' | 'approved' | 'rejected';
  tipo?: 'gasto' | 'ingreso' | 'ajuste';
  start_date?: string;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id);
  if (params?.estado) queryParams.append('estado', params.estado);
  if (params?.tipo) queryParams.append('tipo', params.tipo);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const query = queryParams.toString();
  const path = query ? `/finanzas/movements?${query}` : '/finanzas/movements';

  return apiClient<ApiResponse<'/movements', 'get'>>(path, {
    method: 'GET',
  });
}

/**
 * Approve movement
 */
export async function approveMovement(
  movementId: string,
  data: ApiRequestBody<'/movements/{id}/approve', 'post'>
) {
  return apiClient<ApiResponse<'/movements/{id}/approve', 'post'>>(
    `/finanzas/movements/${movementId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * Reject movement
 */
export async function rejectMovement(
  movementId: string,
  data: ApiRequestBody<'/movements/{id}/reject', 'post'>
) {
  return apiClient<ApiResponse<'/movements/{id}/reject', 'post'>>(
    `/finanzas/movements/${movementId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * Alerts API
 */

/**
 * Get financial alerts
 */
export async function getAlerts(params?: {
  project_id?: string;
  severity?: 'critical' | 'warning' | 'info';
  type?: 'budget_overrun' | 'coverage_low' | 'payment_pending' | 'allocation_missing';
}) {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id);
  if (params?.severity) queryParams.append('severity', params.severity);
  if (params?.type) queryParams.append('type', params.type);

  const query = queryParams.toString();
  const path = query ? `/finanzas/alerts?${query}` : '/finanzas/alerts';

  return apiClient<ApiResponse<'/alerts', 'get'>>(path, {
    method: 'GET',
  });
}

/**
 * Providers API
 */

/**
 * Create provider
 */
export async function createProvider(
  data: ApiRequestBody<'/providers', 'post'>
) {
  return apiClient<ApiResponse<'/providers', 'post', 201>>(
    '/finanzas/providers',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * List providers
 */
export async function getProviders(params?: {
  tipo?: 'servicios' | 'materiales' | 'software' | 'infraestructura';
  estado?: 'active' | 'inactive' | 'suspended';
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.tipo) queryParams.append('tipo', params.tipo);
  if (params?.estado) queryParams.append('estado', params.estado);
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const query = queryParams.toString();
  const path = query ? `/finanzas/providers?${query}` : '/finanzas/providers';

  return apiClient<ApiResponse<'/providers', 'get'>>(path, {
    method: 'GET',
  });
}

/**
 * Webhooks API
 */

/**
 * Prefactura webhook
 */
export async function prefacturaWebhook(
  data: ApiRequestBody<'/prefacturas/webhook', 'post'>
) {
  return apiClient<ApiResponse<'/prefacturas/webhook', 'post', 202>>(
    '/finanzas/prefacturas/webhook',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}
