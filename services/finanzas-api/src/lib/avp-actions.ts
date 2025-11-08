/**
 * Action mapping from API routes to Cedar actions
 * 
 * Maps HTTP routes and methods to Cedar action names and resource types
 * for use with Amazon Verified Permissions
 */

export interface ActionMapping {
  action: string;
  resourceType: string;
  getResourceId?: (event: any) => string;
}

/**
 * Route patterns to Cedar action mappings
 */
export const ROUTE_ACTION_MAP: Record<string, Record<string, ActionMapping>> = {
  "/health": {
    GET: {
      action: "ViewHealth",
      resourceType: "Finanzas::Project",
      getResourceId: () => "*root*",
    },
  },
  "/catalog/rubros": {
    GET: {
      action: "ViewRubros",
      resourceType: "Finanzas::Rubro",
      getResourceId: () => "Catalog",
    },
  },
  "/allocation-rules": {
    GET: {
      action: "ViewRules",
      resourceType: "Finanzas::Rule",
      getResourceId: () => "*",
    },
  },
  "/projects": {
    GET: {
      action: "ViewProjects",
      resourceType: "Finanzas::Project",
      getResourceId: () => "*",
    },
    POST: {
      action: "CreateProject",
      resourceType: "Finanzas::Project",
      getResourceId: () => "new",
    },
  },
  "/projects/{id}/allocations:bulk": {
    PUT: {
      action: "BulkAllocate",
      resourceType: "Finanzas::Allocation",
      getResourceId: (event: any) => `ALLOC-${event.pathParameters?.id || "unknown"}`,
    },
  },
  "/projects/{id}/plan": {
    GET: {
      action: "ViewPlan",
      resourceType: "Finanzas::Project",
      getResourceId: (event: any) => event.pathParameters?.id || "unknown",
    },
  },
  "/projects/{id}/rubros": {
    GET: {
      action: "ViewRubros",
      resourceType: "Finanzas::Rubro",
      getResourceId: () => "Catalog",
    },
    POST: {
      action: "CreateAdjustment",
      resourceType: "Finanzas::Adjustment",
      getResourceId: (event: any) => `ADJ-${event.pathParameters?.id || "unknown"}`,
    },
  },
  "/adjustments": {
    GET: {
      action: "ViewAdjustments",
      resourceType: "Finanzas::Adjustment",
      getResourceId: () => "*",
    },
    POST: {
      action: "CreateAdjustment",
      resourceType: "Finanzas::Adjustment",
      getResourceId: () => "new",
    },
  },
  "/providers": {
    GET: {
      action: "ViewProviders",
      resourceType: "Finanzas::Provider",
      getResourceId: () => "*",
    },
    POST: {
      action: "UpsertProvider",
      resourceType: "Finanzas::Provider",
      getResourceId: () => "new",
    },
  },
  "/payroll/ingest": {
    POST: {
      action: "IngestPayroll",
      resourceType: "Finanzas::PayrollFile",
      getResourceId: () => "new",
    },
  },
  "/close-month": {
    POST: {
      action: "CloseMonth",
      resourceType: "Finanzas::Project",
      getResourceId: (event: any) => event.queryStringParameters?.project_id || "*",
    },
  },
  "/prefacturas/webhook": {
    POST: {
      action: "SendPrefactura",
      resourceType: "Finanzas::Prefactura",
      getResourceId: () => "webhook",
    },
    GET: {
      action: "ViewPrefactura",
      resourceType: "Finanzas::Prefactura",
      getResourceId: () => "*",
    },
  },
};

/**
 * Get action mapping for a route and method
 */
export function getActionMapping(
  route: string,
  method: string
): ActionMapping | null {
  // Normalize route path
  const normalizedRoute = route.replace(/^\/+/, "/").split("?")[0];

  // Try exact match first
  if (ROUTE_ACTION_MAP[normalizedRoute]?.[method]) {
    return ROUTE_ACTION_MAP[normalizedRoute][method];
  }

  // Try pattern matching for parameterized routes
  for (const [pattern, methods] of Object.entries(ROUTE_ACTION_MAP)) {
    if (pattern.includes("{id}")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\{id\}/g, "[^/]+") + "$"
      );
      if (regex.test(normalizedRoute) && methods[method]) {
        return methods[method];
      }
    }
  }

  return null;
}

/**
 * Build context for AVP authorization check
 */
export function buildAvpContext(event: any): Record<string, any> {
  const method = event.requestContext?.http?.method || "GET";
  const route = event.requestContext?.http?.path || event.rawPath || "";
  const projectId = event.pathParameters?.id;

  return {
    jwt_groups: [], // Will be populated from token
    http_method: method,
    route: route,
    project_id: projectId,
    env: process.env.STAGE_NAME || process.env.STAGE || "dev",
  };
}
