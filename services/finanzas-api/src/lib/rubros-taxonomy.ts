/**
 * Server-side Rubros Taxonomy Helpers
 * 
 * This module provides taxonomy mapping for the backend to ensure
 * proper data lineage from Estimator → Baseline → Rubros → Forecast.
 * 
 * Mirrors functionality from src/api/helpers/rubros.ts and 
 * src/lib/rubros/canonical-taxonomy.ts for use in Lambda handlers.
 */

// MOD Role type definition
export type MODRole =
  | 'Ingeniero Delivery'
  | 'Ingeniero Soporte N1'
  | 'Ingeniero Soporte N2'
  | 'Ingeniero Soporte N3'
  | 'Service Delivery Manager'
  | 'Project Manager';

/**
 * Mapping from MOD roles to their corresponding linea_codigo in taxonomy
 * This ensures consistent mapping from Estimator roles to canonical rubroIds
 */
const MOD_ROLE_TO_LINEA_CODIGO: Record<MODRole, string> = {
  'Ingeniero Delivery': 'MOD-LEAD',
  'Ingeniero Soporte N1': 'MOD-ING',
  'Ingeniero Soporte N2': 'MOD-ING',
  'Ingeniero Soporte N3': 'MOD-ING',
  'Service Delivery Manager': 'MOD-SDM',
  'Project Manager': 'MOD-LEAD', // Changed from MOD-PM to MOD-LEAD per canonical taxonomy
};

/**
 * Default rubro codes for fallback scenarios
 * GSV-REU is used as default for non-labor since it's a common service management category
 */
export const DEFAULT_LABOR_RUBRO = "MOD-ING";
export const DEFAULT_NON_LABOR_RUBRO = "GSV-REU";

/**
 * Common non-labor category mappings
 * Maps category/description strings to canonical rubroIds
 */
const NON_LABOR_CATEGORY_MAP: Record<string, string> = {
  // Gestión del Servicio
  'reunion': 'GSV-REU',
  'reuniones': 'GSV-REU',
  'meetings': 'GSV-REU',
  'reporte': 'GSV-RPT',
  'reportes': 'GSV-RPT',
  'reports': 'GSV-RPT',
  'auditoria': 'GSV-AUD',
  'audit': 'GSV-AUD',
  'capacitacion': 'GSV-TRN',
  'training': 'GSV-TRN',
  'formacion': 'GSV-TRN',
  
  // Cloud & Infrastructure
  'aws': 'INF-CLOUD',
  'azure': 'INF-CLOUD',
  'gcp': 'INF-CLOUD',
  'cloud': 'INF-CLOUD',
  'hosting': 'INF-CLOUD',
  'saas': 'INF-CLOUD',
  'iaas': 'INF-CLOUD',
  'paas': 'INF-CLOUD',
  
  // Telecom
  'circuito': 'TEL-CCTS',
  'circuit': 'TEL-CCTS',
  'enlace': 'TEL-CCTS',
  'link': 'TEL-CCTS',
  'mpls': 'TEL-CCTS',
  'internet': 'TEL-CCTS',
  'telefonia': 'TEL-UCAAS',
  'voip': 'TEL-UCAAS',
  'ucaas': 'TEL-UCAAS',
  
  // Security
  'soc': 'SEC-SOC',
  'seguridad': 'SEC-SOC',
  'security': 'SEC-SOC',
  'pentest': 'SEC-VA',
  'vulnerability': 'SEC-VA',
  
  // Technology
  'licencia': 'TEC-LIC-MON',
  'license': 'TEC-LIC-MON',
  'software': 'TEC-LIC-MON',
  'hardware': 'TEC-HW-FIELD',
  'equipo': 'TEC-HW-FIELD',
  'equipment': 'TEC-HW-FIELD',
  
  // Logistics
  'repuesto': 'LOG-SPARES',
  'spare': 'LOG-SPARES',
  'envio': 'LOG-ENV',
  'shipping': 'LOG-ENV',
  'courier': 'LOG-ENV',
};

/**
 * Map a MOD role name to its canonical linea_codigo
 * 
 * @param role - MOD role name (e.g., "Ingeniero Delivery", "Project Manager")
 * @returns Canonical linea_codigo (e.g., "MOD-LEAD", "MOD-PM") or undefined if not found
 */
export function mapModRoleToRubroId(role: string | undefined): string | undefined {
  if (!role) return undefined;
  
  // Try exact match first
  const exactMatch = MOD_ROLE_TO_LINEA_CODIGO[role as MODRole];
  if (exactMatch) return exactMatch;
  
  // Try case-insensitive match
  const normalizedRole = role.trim();
  for (const [key, value] of Object.entries(MOD_ROLE_TO_LINEA_CODIGO)) {
    if (key.toLowerCase() === normalizedRole.toLowerCase()) {
      return value;
    }
  }
  
  return undefined;
}

/**
 * Map a non-labor category/description to a canonical rubroId
 * 
 * @param category - Category or description string
 * @returns Canonical linea_codigo or undefined if no match
 */
export function mapNonLaborCategoryToRubroId(category: string | undefined): string | undefined {
  if (!category) return undefined;
  
  const normalized = category.toLowerCase().trim();
  
  // Try exact match first
  if (NON_LABOR_CATEGORY_MAP[normalized]) {
    return NON_LABOR_CATEGORY_MAP[normalized];
  }
  
  // Try partial match (contains) - only check if not too short to avoid false positives
  if (normalized.length >= 3) {
    for (const [key, value] of Object.entries(NON_LABOR_CATEGORY_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
  }
  
  return undefined;
}

/**
 * Get canonical rubro ID from a rubroId, with legacy ID support
 * 
 * @param rubroId - Input rubro ID (canonical or legacy format)
 * @returns Canonical linea_codigo
 */
export function getCanonicalRubroId(rubroId: string | undefined): string | undefined {
  if (!rubroId) return undefined;
  
  // If it already looks canonical (e.g., "MOD-ING", "GSV-REU"), return as-is
  if (/^[A-Z]{2,4}-[A-Z0-9-]+$/.test(rubroId)) {
    return rubroId;
  }
  
  // Legacy format mappings could go here if needed
  // For now, return as-is with a warning
  console.warn(`[rubros-taxonomy] Non-canonical rubroId format: ${rubroId}`);
  return rubroId;
}

/**
 * Validate if a rubroId looks canonical
 * 
 * @param rubroId - Rubro ID to validate
 * @returns true if format matches canonical pattern
 */
export function isCanonicalRubroId(rubroId: string | undefined): boolean {
  if (!rubroId) return false;
  return /^[A-Z]{2,4}-[A-Z0-9-]+$/.test(rubroId);
}

/**
 * Normalize a labor estimate from any format to canonical format
 * Handles both camelCase (Estimator) and snake_case (standard) fields
 * 
 * @param estimate - Raw labor estimate from baseline
 * @returns Normalized labor estimate with canonical rubroId
 */
export function normalizeLaborEstimate(estimate: any): {
  rubroId: string;
  role?: string;
  level?: string;
  hours_per_month: number;
  fte_count: number;
  hourly_rate: number;
  rate: number;
  on_cost_percentage: number;
  start_month: number;
  end_month: number;
} {
  // Determine canonical rubroId
  let canonicalRubroId = estimate.rubroId || estimate.rubro_id;
  
  // If no rubroId provided, derive from role using taxonomy
  if (!canonicalRubroId && estimate.role) {
    canonicalRubroId = mapModRoleToRubroId(estimate.role);
  }
  
  // Normalize to canonical format if needed
  if (canonicalRubroId) {
    canonicalRubroId = getCanonicalRubroId(canonicalRubroId) || canonicalRubroId;
  }
  
  // Use default if still no rubroId
  if (!canonicalRubroId) {
    canonicalRubroId = DEFAULT_LABOR_RUBRO;
  }

  return {
    rubroId: canonicalRubroId,
    role: estimate.role,
    level: estimate.level,
    // Handle both camelCase and snake_case
    hours_per_month: estimate.hours_per_month ?? estimate.hoursPerMonth ?? estimate.hours ?? 0,
    fte_count: estimate.fte_count ?? estimate.fteCount ?? 1,
    hourly_rate: estimate.hourly_rate ?? estimate.hourlyRate ?? estimate.rate ?? 0,
    rate: estimate.rate ?? estimate.hourly_rate ?? estimate.hourlyRate ?? 0,
    on_cost_percentage: estimate.on_cost_percentage ?? estimate.onCostPercentage ?? 0,
    start_month: estimate.start_month ?? estimate.startMonth ?? 1,
    end_month: estimate.end_month ?? estimate.endMonth ?? estimate.start_month ?? estimate.startMonth ?? 1,
  };
}

/**
 * Normalize a non-labor estimate from any format to canonical format
 * Handles both camelCase (Estimator) and snake_case (standard) fields
 * 
 * @param estimate - Raw non-labor estimate from baseline
 * @returns Normalized non-labor estimate with canonical rubroId
 */
export function normalizeNonLaborEstimate(estimate: any): {
  rubroId: string;
  category?: string;
  description?: string;
  amount: number;
  vendor?: string;
  one_time: boolean;
  start_month: number;
  end_month: number;
} {
  // Determine canonical rubroId
  let canonicalRubroId = estimate.rubroId || estimate.rubro_id;
  
  // If no rubroId provided, try to derive from category/description
  if (!canonicalRubroId) {
    canonicalRubroId = 
      mapNonLaborCategoryToRubroId(estimate.category) ||
      mapNonLaborCategoryToRubroId(estimate.description);
  }
  
  // Normalize to canonical format if needed
  if (canonicalRubroId) {
    canonicalRubroId = getCanonicalRubroId(canonicalRubroId) || canonicalRubroId;
  }
  
  // Use default if still no rubroId
  if (!canonicalRubroId) {
    canonicalRubroId = DEFAULT_NON_LABOR_RUBRO;
  }

  return {
    rubroId: canonicalRubroId,
    category: estimate.category,
    description: estimate.description ?? estimate.descripcion,
    amount: estimate.amount ?? estimate.cost ?? estimate.total ?? 0,
    vendor: estimate.vendor ?? estimate.proveedor,
    one_time: estimate.one_time ?? estimate.oneTime ?? false,
    start_month: estimate.start_month ?? estimate.startMonth ?? 1,
    end_month: estimate.end_month ?? estimate.endMonth ?? estimate.start_month ?? estimate.startMonth ?? 1,
  };
}
