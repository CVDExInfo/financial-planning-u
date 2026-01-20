/**
 * Canonical Rubros Taxonomy for Backend
 * 
 * Lightweight version of the taxonomy for backend validation and mapping.
 * Synced with frontend canonical taxonomy.
 */

export type TipoCosto = 'OPEX' | 'CAPEX';
export type TipoEjecucion = 'mensual' | 'puntual/hito';

export interface CanonicalRubroTaxonomy {
  id: string;
  categoria_codigo: string;
  categoria: string;
  linea_codigo: string;
  linea_gasto: string;
  descripcion: string;
  tipo_ejecucion: TipoEjecucion;
  tipo_costo: TipoCosto;
  fuente_referencia: string;
  isActive: boolean;
}

// Canonical taxonomy IDs (for quick validation)
export const CANONICAL_IDS = new Set([
  'MOD-ING', 'MOD-LEAD', 'MOD-SDM', 'MOD-PM', 'MOD-OT', 'MOD-CONT', 'MOD-EXT',
  'GSV-REU', 'GSV-RPT', 'GSV-AUD', 'GSV-TRN',
  'REM-MANT-P', 'REM-MANT-C', 'REM-HH-EXT', 'REM-TRNS', 'REM-VIAT', 'REM-CONS',
  'TEC-LIC-MON', 'TEC-ITSM', 'TEC-LAB', 'TEC-HW-RPL', 'TEC-HW-FIELD', 'TEC-SUP-VND',
  'INF-CLOUD', 'INF-DC-EN', 'INF-RACK', 'INF-BCK',
  'TEL-CCTS', 'TEL-UCAAS', 'TEL-SIMS', 'TEL-NUM',
  'SEC-SOC', 'SEC-VA', 'SEC-COMP',
  'LOG-SPARES', 'LOG-RMA', 'LOG-ENV',
  'RIE-PEN', 'RIE-CTR', 'RIE-SEG',
  'ADM-PMO', 'ADM-BILL', 'ADM-FIN', 'ADM-LIC', 'ADM-LEG',
  'QLT-ISO', 'QLT-KAIZ', 'QLT-SAT',
  'PLT-PLANV', 'PLT-SFDC', 'PLT-SAP', 'PLT-DLAKE',
  'DEP-HW', 'DEP-SW',
  'NOC-MON', 'NOC-ALR', 'NOC-PLN',
  'COL-UCC', 'COL-STG', 'COL-EMAIL',
  'VIA-INT', 'VIA-CLI',
  'INV-ALM', 'INV-SGA', 'INV-SEG',
  'LIC-FW', 'LIC-NET', 'LIC-EDR',
  'CTR-SLA', 'CTR-OLA',
  'INN-POC', 'INN-AUT',
]);

/**
 * Legacy ID Mapping - maps old rubro_ids to canonical linea_codigo
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
  'RB0004': 'MOD-OT',
  'RB0005': 'MOD-CONT',
  'RB0006': 'MOD-EXT',
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
};

/**
 * Get canonical rubro_id from any legacy format
 * 
 * @param legacyId - Any rubro ID (canonical or legacy)
 * @returns Canonical linea_codigo, or the input if already canonical
 */
export function getCanonicalRubroId(legacyId: string): string {
  // Check if it's a legacy ID that needs mapping
  const mapped = LEGACY_RUBRO_ID_MAP[legacyId];
  if (mapped) {
    return mapped;
  }
  
  // Check if it's already a canonical ID
  if (CANONICAL_IDS.has(legacyId)) {
    return legacyId;
  }
  
  // Unknown ID - log warning and return as-is
  console.warn(`[canonical-taxonomy] Unknown rubro_id: ${legacyId} - not in canonical taxonomy or legacy map`);
  return legacyId;
}

/**
 * Validate if a rubro_id is valid (canonical or has legacy mapping)
 */
export function isValidRubroId(rubroId: string): boolean {
  // Check canonical
  if (CANONICAL_IDS.has(rubroId)) {
    return true;
  }
  
  // Check legacy mapping
  if (LEGACY_RUBRO_ID_MAP[rubroId]) {
    return true;
  }
  
  return false;
}

/**
 * Check if a rubro_id is legacy and should be migrated
 */
export function isLegacyRubroId(rubroId: string): boolean {
  return !!LEGACY_RUBRO_ID_MAP[rubroId];
}

/**
 * Normalize a rubro_id to canonical format with validation
 * Returns an object with canonical ID and any warnings
 */
export function normalizeRubroId(rubroId: string): {
  canonicalId: string;
  isLegacy: boolean;
  isValid: boolean;
  warning?: string;
} {
  const isLegacy = isLegacyRubroId(rubroId);
  const canonicalId = getCanonicalRubroId(rubroId);
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
