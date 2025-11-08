/**
 * Action Mapping Configuration
 * Maps API routes to Cedar actions for Amazon Verified Permissions (AVP)
 */

export interface RouteActionMapping {
  route: string;
  method: string;
  action: string;
  resourceType: string;
  resourceIdPattern?: string;
  description?: string;
}

export const ACTION_MAPPINGS: RouteActionMapping[] = [
  {
    route: '/health',
    method: 'GET',
    action: 'ViewHealth',
    resourceType: 'Finanzas::Project',
    resourceIdPattern: '*root*',
    description: 'Public health check'
  },
  {
    route: '/catalog/rubros',
    method: 'GET',
    action: 'ViewRubros',
    resourceType: 'Finanzas::Rubro',
    resourceIdPattern: 'Catalog',
    description: 'Read catalog rubros'
  },
  {
    route: '/allocation-rules',
    method: 'GET',
    action: 'ViewRules',
    resourceType: 'Finanzas::Rule',
    resourceIdPattern: '*',
    description: 'View allocation rules'
  },
  {
    route: '/projects',
    method: 'GET',
    action: 'ViewProjects',
    resourceType: 'Finanzas::Project',
    resourceIdPattern: '*',
    description: 'List all projects'
  },
  {
    route: '/projects',
    method: 'POST',
    action: 'CreateProject',
    resourceType: 'Finanzas::Project',
    resourceIdPattern: 'new',
    description: 'Create new project'
  },
  {
    route: '/projects/{id}/allocations:bulk',
    method: 'PUT',
    action: 'BulkAllocate',
    resourceType: 'Finanzas::Allocation',
    resourceIdPattern: 'ALLOC-{id}',
    description: 'Bulk allocations update'
  },
  {
    route: '/projects/{id}/plan',
    method: 'GET',
    action: 'ViewPlan',
    resourceType: 'Finanzas::Project',
    resourceIdPattern: '{id}',
    description: 'View project plan'
  },
  {
    route: '/projects/{id}/rubros',
    method: 'GET',
    action: 'ViewRubros',
    resourceType: 'Finanzas::Rubro',
    resourceIdPattern: 'Catalog',
    description: 'View project rubros'
  },
  {
    route: '/projects/{id}/rubros',
    method: 'POST',
    action: 'CreateAdjustment',
    resourceType: 'Finanzas::Adjustment',
    resourceIdPattern: 'ADJ-{id}',
    description: 'Create adjustment via rubros'
  },
  {
    route: '/adjustments',
    method: 'GET',
    action: 'ViewAdjustments',
    resourceType: 'Finanzas::Adjustment',
    resourceIdPattern: '*',
    description: 'List adjustments'
  },
  {
    route: '/adjustments',
    method: 'POST',
    action: 'CreateAdjustment',
    resourceType: 'Finanzas::Adjustment',
    resourceIdPattern: 'new',
    description: 'Create adjustment'
  },
  {
    route: '/providers',
    method: 'GET',
    action: 'ViewProviders',
    resourceType: 'Finanzas::Provider',
    resourceIdPattern: '*',
    description: 'List providers'
  },
  {
    route: '/providers',
    method: 'POST',
    action: 'UpsertProvider',
    resourceType: 'Finanzas::Provider',
    resourceIdPattern: 'new',
    description: 'Create/update provider'
  },
  {
    route: '/payroll/ingest',
    method: 'POST',
    action: 'IngestPayroll',
    resourceType: 'Finanzas::PayrollFile',
    resourceIdPattern: 'new',
    description: 'Ingest payroll data'
  },
  {
    route: '/close-month',
    method: 'POST',
    action: 'CloseMonth',
    resourceType: 'Finanzas::Project',
    resourceIdPattern: '{project_id}',
    description: 'Close monthly period'
  },
  {
    route: '/prefacturas/webhook',
    method: 'POST',
    action: 'SendPrefactura',
    resourceType: 'Finanzas::Prefactura',
    resourceIdPattern: 'new',
    description: 'Send prefactura'
  },
  {
    route: '/prefacturas/webhook',
    method: 'GET',
    action: 'ViewPrefactura',
    resourceType: 'Finanzas::Prefactura',
    resourceIdPattern: '*',
    description: 'View prefacturas'
  }
];

/**
 * Find action mapping for a given route and method
 */
export function findActionMapping(route: string, method: string): RouteActionMapping | undefined {
  return ACTION_MAPPINGS.find(m => {
    const routePattern = m.route.replace(/{[^}]+}/g, '[^/]+');
    const regex = new RegExp(`^${routePattern}$`);
    return regex.test(route) && m.method === method;
  });
}

/**
 * Build resource ID from pattern and path parameters
 */
export function buildResourceId(pattern: string, pathParams: Record<string, string> = {}): string {
  let resourceId = pattern;
  for (const [key, value] of Object.entries(pathParams)) {
    resourceId = resourceId.replace(`{${key}}`, value);
  }
  return resourceId;
}
