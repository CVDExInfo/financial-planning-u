/**
 * CANONICAL RUBROS TAXONOMY
 * 
 * This is the single source of truth for all rubros (cost line items) across
 * the PMO Estimator, SDMT, and Finanzas modules.
 * 
 * All rubro_id references in the API, database, and UI MUST use the canonical
 * linea_codigo from this taxonomy.
 * 
 * Source: /data/rubros.taxonomy.json (Client-approved taxonomy from R1 Modelo & Gobierno)
 * This file imports and normalizes the canonical JSON taxonomy.
 */

import { normalizeKey } from './normalize-key';
import taxonomyData from '../../../data/rubros.taxonomy.json';

// Re-export normalizeKey for convenience and backward compatibility
export { normalizeKey };

export type TipoCosto = 'OPEX' | 'CAPEX';
export type TipoEjecucion = 'mensual' | 'puntual/hito';

/**
 * Canonical Rubro Taxonomy Entry
 * This structure is the authoritative definition for all rubros
 */
export interface CanonicalRubroTaxonomy {
  /** Canonical rubro ID - MUST be used as rubro_id everywhere */
  id: string;
  /** Category code (e.g., MOD, GSV, TEC) */
  categoria_codigo: string;
  /** Category name in Spanish */
  categoria: string;
  /** Line code (same as id for canonical taxonomy) */
  linea_codigo: string;
  /** Line item name/description */
  linea_gasto: string;
  /** Detailed description */
  descripcion: string;
  /** Execution type: monthly recurring or one-time/milestone */
  tipo_ejecucion: TipoEjecucion;
  /** Cost type: OPEX or CAPEX */
  tipo_costo: TipoCosto;
  /** Reference source for this line item */
  fuente_referencia: string;
  /** Whether this rubro is currently active */
  isActive: boolean;
}

/**
 * CANONICAL TAXONOMY - The single source of truth
 * 
 * This array is loaded from /data/rubros.taxonomy.json and contains all approved rubros.
 * Any rubro_id used in:
 * - DynamoDB tables (rubros, project_rubros, allocations)
 * - API requests/responses
 * - UI forms and displays
 * - Seed scripts
 * 
 * MUST match a linea_codigo from this list.
 */
export const CANONICAL_RUBROS_TAXONOMY: CanonicalRubroTaxonomy[] = (taxonomyData.items || []).map((item: any) => ({
  id: item.linea_codigo,
  categoria_codigo: item.categoria_codigo,
  categoria: item.categoria,
  linea_codigo: item.linea_codigo,
  linea_gasto: item.linea_gasto,
  descripcion: item.descripcion,
  tipo_ejecucion: item.tipo_ejecucion as TipoEjecucion,
  tipo_costo: item.tipo_costo as TipoCosto,
  fuente_referencia: item.fuente_referencia,
  isActive: true, // All items in the JSON are considered active
}));

/**
 * Legacy ID Mapping
 * 
 * Maps old/legacy rubro IDs to their canonical linea_codigo equivalents.
 * This allows backwards compatibility while migrating to canonical IDs.
 * 
 * Sources:
 * - RB#### format: from rubros.catalog.ts (index-based mapping)
 * - RUBRO-### format: old seed scripts
 * - Human-readable format: allocation data and estimator inputs
 */
export const LEGACY_RUBRO_ID_MAP: Record<string, string> = {
  // Old simple format
  'RUBRO-001': 'MOD-ING',
  'RUBRO-002': 'TEC-HW-FIELD',
  'RUBRO-003': 'TEC-LIC-MON',
  'RUBRO-004': 'GSV-REU',
  'RUBRO-005': 'GSV-TRN',
  
  // Old catalog format (RB####)
  'RB0001': 'MOD-ING',
  'RB0002': 'MOD-LEAD',
  'RB0003': 'MOD-SDM',
  'RB0004': 'MOD-IN3',      // MOD-OT → MOD-IN3 (Ingeniero Soporte N3)
  'RB0005': 'MOD-IN2',      // MOD-CONT → MOD-IN2 (Ingeniero Soporte N2 externo)
  'RB0006': 'MOD-IN2',      // MOD-EXT → MOD-IN2 (Ingeniero Soporte N2 externo)
  'RB0007': 'GSV-REU',
  'RB0008': 'GSV-RPT',
  'RB0009': 'GSV-AUD',
  'RB0010': 'GSV-TRN',
  'RB0011': 'REM-MANT-P',
  'RB0012': 'REM-MANT-C',
  'RB0013': 'REM-HH-EXT',
  'RB0014': 'REM-TRNS',
  'RB0015': 'REM-VIAT',
  'RB0016': 'REM-CONS',
  'RB0017': 'TEC-LIC-MON',
  'RB0018': 'TEC-ITSM',
  'RB0019': 'TEC-LAB',
  'RB0020': 'TEC-HW-RPL',
  'RB0021': 'TEC-HW-FIELD',
  'RB0022': 'TEC-SUP-VND',
  'RB0023': 'INF-CLOUD',
  'RB0024': 'INF-DC-EN',
  'RB0025': 'INF-RACK',
  'RB0026': 'INF-BCK',
  'RB0027': 'TEL-CCTS',
  'RB0028': 'TEL-UCAAS',
  'RB0029': 'TEL-SIMS',
  'RB0030': 'TEL-NUM',
  'RB0031': 'SEC-SOC',
  'RB0032': 'SEC-VA',
  'RB0033': 'SEC-COMP',
  'RB0034': 'LOG-SPARES',
  'RB0035': 'LOG-RMA',
  'RB0036': 'LOG-ENV',
  'RB0037': 'RIE-PEN',
  'RB0038': 'RIE-CTR',
  'RB0039': 'RIE-SEG',
  'RB0040': 'ADM-PMO',
  'RB0041': 'ADM-BILL',
  'RB0042': 'ADM-FIN',
  'RB0043': 'ADM-LIC',
  'RB0044': 'ADM-LEG',
  'RB0045': 'QLT-ISO',
  'RB0046': 'QLT-KAIZ',
  'RB0047': 'QLT-SAT',
  'RB0048': 'PLT-PLANV',
  'RB0049': 'PLT-SFDC',
  'RB0050': 'PLT-SAP',
  'RB0051': 'PLT-DLAKE',
  'RB0052': 'DEP-HW',
  'RB0053': 'DEP-SW',
  'RB0054': 'NOC-MON',
  'RB0055': 'NOC-ALR',
  'RB0056': 'NOC-PLN',
  'RB0057': 'COL-UCC',
  'RB0058': 'COL-STG',
  'RB0059': 'COL-EMAIL',
  'RB0060': 'VIA-INT',
  'RB0061': 'VIA-CLI',
  'RB0062': 'INV-ALM',
  'RB0063': 'INV-SGA',
  'RB0064': 'INV-SEG',
  'RB0065': 'LIC-FW',
  'RB0066': 'LIC-NET',
  'RB0067': 'LIC-EDR',
  'RB0068': 'CTR-SLA',
  'RB0069': 'CTR-OLA',
  'RB0070': 'INN-POC',
  'RB0071': 'INN-AUT',
  
  // Additional legacy IDs used in seed data
  'RB0075': 'INF-RACK',   // Racks y espacio de co-location
  'RB0080': 'INF-BCK',    // Backup y disaster recovery
  
  // Old seed format
  'RUBRO-SENIOR-DEV': 'MOD-LEAD',
  'RUBRO-AWS-INFRA': 'INF-CLOUD',
  'RUBRO-LICENSE': 'TEC-LIC-MON',
  'RUBRO-CONSULTING': 'GSV-REU',
  
  // Allocation tokens and human-readable names (added for frontend-backend alignment)
  // PR #942 and #945 aliases
  // Note: Mixed case entries are intentional - they match allocation data as-is
  // The lookup logic normalizes keys before comparison
  'mod-lead-ingeniero-delivery': 'MOD-LEAD',
  'mod-lead-ingeniero': 'MOD-LEAD',
  'ingeniero-delivery': 'MOD-LEAD',
  'Ingeniero Delivery': 'MOD-LEAD',
  'ingeniero-lider': 'MOD-LEAD',
  'mod-sdm-service-delivery-manager': 'MOD-SDM',
  'mod-sdm-sdm': 'MOD-SDM',
  'service-delivery-manager': 'MOD-SDM',
  'mod-ing-ingeniero-soporte-n1': 'MOD-ING',
  'project-manager': 'MOD-LEAD', // Map to MOD-LEAD as MOD-PM/MOD-PMO doesn't exist in canonical taxonomy
  'Project Manager': 'MOD-LEAD', // Add title case variant
  'mod-pm-project-manager': 'MOD-LEAD',
  'MOD-PM': 'MOD-LEAD', // Legacy server-generated MOD-PM mapping (from old PMO estimator)
  'MOD-PMO': 'MOD-LEAD', // Legacy PMO variant
  
  // Old non-canonical labor IDs that should map to canonical equivalents
  'MOD-OT': 'MOD-IN3',   // Old "Other" → Ingeniero Soporte N3
  'MOD-CONT': 'MOD-IN2', // Old "Contractor" → Ingeniero Soporte N2 externo
  'MOD-EXT': 'MOD-IN2',  // Old "External" → Ingeniero Soporte N2 externo
  
  // Category-suffixed patterns - Generated when allocation materializers or 
  // PMO Estimator append the Spanish categoria name to the rubro_id 
  // (e.g., 'TEC-HW-RPL' + 'Equipos y Tecnología' → 'tec-hw-rpl-equipos-y-tecnologia')
  // These appear in DynamoDB allocation table SKs and cause console warnings.
  // Source: finanzas-api materializers & PMO Estimator baseline generation
  // Added: 2026-01-20 to fix console warnings in SDMT Forecast (issue #948)
  'tec-hw-rpl-equipos-y-tecnolog-a': 'TEC-HW-RPL',
  'tec-hw-rpl-equipos-y-tecnologia': 'TEC-HW-RPL',
  'tec-itsm-equipos-y-tecnolog-a': 'TEC-ITSM',
  'tec-itsm-equipos-y-tecnologia': 'TEC-ITSM',
  'inf-cloud-infraestructura-nube-data-center': 'INF-CLOUD',
  'inf-rack-infraestructura-nube-data-center': 'INF-RACK',
};

// Build indexes for fast lookup
const taxonomyById = new Map<string, CanonicalRubroTaxonomy>();
const taxonomyByLineaCodigo = new Map<string, CanonicalRubroTaxonomy>();
const taxonomyByLineaGasto = new Map<string, CanonicalRubroTaxonomy>();
const taxonomyByDescripcion = new Map<string, CanonicalRubroTaxonomy>();

for (const rubro of CANONICAL_RUBROS_TAXONOMY) {
  const normalizedId = normalizeKey(rubro.id);
  const normalizedLinea = normalizeKey(rubro.linea_codigo);
  const normalizedGasto = normalizeKey(rubro.linea_gasto);
  const normalizedDesc = normalizeKey(rubro.descripcion);
  
  taxonomyById.set(normalizedId, rubro);
  taxonomyByLineaCodigo.set(normalizedLinea, rubro);
  taxonomyByLineaGasto.set(normalizedGasto, rubro);
  taxonomyByDescripcion.set(normalizedDesc, rubro);
}

/**
 * TAXONOMY_BY_ID - Exported Map for O(1) taxonomy lookups
 * Use getTaxonomyById() function for normalized lookups
 */
export const TAXONOMY_BY_ID = taxonomyById;

/**
 * Get canonical rubro ID from a raw input string
 * 
 * Looks up the rubro by normalized ID, linea_codigo, linea_gasto, or descripcion.
 * Returns the canonical linea_codigo if found, or null if not found.
 * 
 * @param raw - Raw rubro identifier (can be ID, legacy ID, linea_gasto, etc.)
 * @returns Canonical linea_codigo or null
 */
export function getCanonicalRubroId(raw?: string): string | null {
  if (!raw) return null;
  
  const normalized = normalizeKey(raw);
  
  // Check legacy mapping first
  const legacyMapped = LEGACY_RUBRO_ID_MAP[raw];
  if (legacyMapped) return legacyMapped;
  
  // Normalize and check legacy mapping again (for case-insensitive)
  const normalizedLegacy = Object.keys(LEGACY_RUBRO_ID_MAP).find(
    key => normalizeKey(key) === normalized
  );
  if (normalizedLegacy) return LEGACY_RUBRO_ID_MAP[normalizedLegacy];
  
  // Check canonical taxonomy by various fields
  const byId = taxonomyById.get(normalized);
  if (byId) return byId.linea_codigo;
  
  const byLinea = taxonomyByLineaCodigo.get(normalized);
  if (byLinea) return byLinea.linea_codigo;
  
  const byGasto = taxonomyByLineaGasto.get(normalized);
  if (byGasto) return byGasto.linea_codigo;
  
  const byDesc = taxonomyByDescripcion.get(normalized);
  if (byDesc) return byDesc.linea_codigo;
  
  return null;
}

/**
 * Get rubro taxonomy entry by ID
 * 
 * @param id - Canonical ID or legacy ID
 * @returns Full taxonomy entry or null
 */
export function getTaxonomyById(id?: string): CanonicalRubroTaxonomy | null {
  if (!id) return null;
  
  const canonicalId = getCanonicalRubroId(id);
  if (!canonicalId) return null;
  
  return taxonomyById.get(normalizeKey(canonicalId)) || null;
}

/**
 * Get all canonical IDs
 * 
 * @returns Array of all canonical linea_codigo values
 */
export function getAllCanonicalIds(): string[] {
  return Array.from(taxonomyById.keys());
}

/**
 * Validate if a rubro ID is valid (canonical or has legacy mapping)
 * 
 * @param rubroId - Rubro ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidRubroId(rubroId?: string): boolean {
  if (!rubroId) return false;
  return getCanonicalRubroId(rubroId) !== null;
}

/**
 * Check if a rubro ID is legacy and should be migrated
 * 
 * @param rubroId - Rubro ID to check
 * @returns true if legacy, false otherwise
 */
export function isLegacyRubroId(rubroId: string): boolean {
  return !!LEGACY_RUBRO_ID_MAP[rubroId] || !!Object.keys(LEGACY_RUBRO_ID_MAP).find(
    key => normalizeKey(key) === normalizeKey(rubroId)
  );
}

/**
 * Normalize a rubro ID to canonical format with validation
 * Returns an object with canonical ID and any warnings
 * 
 * @param rubroId - Rubro ID to normalize
 * @returns Object with canonicalId, isLegacy, isValid, and optional warning
 */
export function normalizeRubroId(rubroId: string): {
  canonicalId: string;
  isLegacy: boolean;
  isValid: boolean;
  warning?: string;
} {
  const isLegacy = isLegacyRubroId(rubroId);
  const canonicalId = getCanonicalRubroId(rubroId) || rubroId;
  const isValid = isValidRubroId(rubroId);
  
  let warning: string | undefined;
  if (isLegacy) {
    warning = `Legacy rubro_id '${rubroId}' mapped to canonical '${canonicalId}'`;
  } else if (!isValid) {
    warning = `Unknown rubro_id '${rubroId}' - not in canonical taxonomy`;
  }
  
  return {
    canonicalId,
    isLegacy,
    isValid,
    warning,
  };
}

/**
 * Get all rubros by category
 * 
 * @param categoryCode - Category code (e.g., 'MOD', 'GSV')
 * @returns Array of rubros in that category
 */
export function getRubrosByCategory(categoryCode: string): CanonicalRubroTaxonomy[] {
  return CANONICAL_RUBROS_TAXONOMY.filter(r => r.categoria_codigo === categoryCode);
}

/**
 * Get all categories
 * 
 * @returns Array of unique category codes with names
 */
export function getAllCategories(): Array<{ code: string; name: string }> {
  const categories = new Map<string, string>();
  for (const rubro of CANONICAL_RUBROS_TAXONOMY) {
    categories.set(rubro.categoria_codigo, rubro.categoria);
  }
  return Array.from(categories.entries()).map(([code, name]) => ({ code, name }));
}

/**
 * Get all active rubros (currently all rubros in taxonomy are active)
 * 
 * @returns Array of all active canonical rubros
 */
export function getActiveRubros(): CanonicalRubroTaxonomy[] {
  return CANONICAL_RUBROS_TAXONOMY.filter(r => r.isActive);
}

/**
 * LABOR_CANONICAL_KEYS - Set of canonical labor (MOD - Mano de Obra) rubro IDs
 * Used for fast labor classification in forecast and allocation logic
 */
export const LABOR_CANONICAL_KEYS_SET = new Set([
  'MOD-ING',
  'MOD-LEAD',
  'MOD-SDM',
  'MOD-IN3',
  'MOD-IN2',
].map(normalizeKey));

/**
 * LABOR_CANONICAL_KEYS - Array version for iteration
 */
export const LABOR_CANONICAL_KEYS = Array.from(LABOR_CANONICAL_KEYS_SET);

/**
 * CANONICAL_ALIASES - Maps human-readable role names and legacy IDs to canonical rubro IDs
 * This provides explicit resolution for common textual forms
 */
export const CANONICAL_ALIASES: Record<string, string> = {
  // Human-readable role names
  'service delivery manager': 'MOD-SDM',
  'delivery manager': 'MOD-SDM',
  'sdm': 'MOD-SDM',
  'project manager': 'MOD-LEAD',
  'pm': 'MOD-LEAD',
  'lead engineer': 'MOD-LEAD',
  'engineering lead': 'MOD-LEAD',
  'ingeniero delivery': 'MOD-LEAD',
  'ingeniero lider': 'MOD-LEAD',
  'support engineer': 'MOD-ING',
  'engineer': 'MOD-ING',
  'ingeniero': 'MOD-ING',
  'contractor': 'MOD-IN2',
  'external': 'MOD-IN2',
  
  // Legacy MOD-PM mapping (no longer canonical, maps to MOD-LEAD)
  'mod-pm': 'MOD-LEAD',
  'mod-pmo': 'MOD-LEAD',
};
