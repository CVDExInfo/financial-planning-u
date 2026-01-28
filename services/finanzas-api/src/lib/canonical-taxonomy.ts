/**
 * Canonical Rubros Taxonomy for Backend
 *
 * Loads canonical taxonomy from /data/rubros.taxonomy.json if present.
 * If not present, attempts to load from S3 (TAXONOMY_S3_BUCKET / TAXONOMY_S3_KEY).
 * If both fail, falls back to an empty taxonomy (graceful degradation).
 */

import * as fs from 'fs';
import * as path from 'path';

// lazy-import AWS SDK only when needed so tests and local dev remain fast
let S3Client: any = null;
let GetObjectCommand: any = null;

// Helper to read stream from S3
async function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('error', (err: Error) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

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

let taxonomyData: any = { items: [] };
let isLoading = false; // Guard against concurrent S3 loads

// Try synchronous local load (best-effort; do not throw)
try {
  const taxonomyPath = path.join(__dirname, '../../../../data/rubros.taxonomy.json');
  const raw = fs.readFileSync(taxonomyPath, 'utf-8');
  taxonomyData = JSON.parse(raw);
  console.info(`[canonical-taxonomy] loaded taxonomy from local file: ${taxonomyPath}`);
} catch (err: any) {
  // local file absent or not readable — we will attempt S3 on-demand
  console.warn('[canonical-taxonomy] local taxonomy file not found or could not be read; will attempt S3 fallback at runtime if configured.', err?.message || err);
  taxonomyData = { items: [] };
}

/** Build the canonical taxonomy array from whatever we have in memory (safe). 
 * This array is mutable and will be rebuilt by rebuildTaxonomyIndexes() after S3 load.
 */
const TAXONOMY_ITEMS = (taxonomyData && Array.isArray(taxonomyData.items)) ? taxonomyData.items : [];

export const CANONICAL_RUBROS_TAXONOMY: CanonicalRubroTaxonomy[] = (TAXONOMY_ITEMS || []).map((item: any) => ({
  id: item.linea_codigo,
  categoria_codigo: item.categoria_codigo,
  categoria: item.categoria,
  linea_codigo: item.linea_codigo,
  linea_gasto: item.linea_gasto,
  descripcion: item.descripcion,
  tipo_ejecucion: item.tipo_ejecucion,
  tipo_costo: item.tipo_costo,
  fuente_referencia: item.fuente_referencia,
  isActive: true,
}));

export const CANONICAL_IDS = new Set(CANONICAL_RUBROS_TAXONOMY.map(r => r.linea_codigo || r.id));

/**
 * Rebuild the exported taxonomy arrays and sets from current taxonomyData.
 * Called after initial load and after S3 fallback load.
 */
function rebuildTaxonomyIndexes(): void {
  const items = (taxonomyData && Array.isArray(taxonomyData.items)) ? taxonomyData.items : [];
  
  // Rebuild CANONICAL_RUBROS_TAXONOMY
  CANONICAL_RUBROS_TAXONOMY.length = 0;
  CANONICAL_RUBROS_TAXONOMY.push(...items.map((item: any) => ({
    id: item.linea_codigo,
    categoria_codigo: item.categoria_codigo,
    categoria: item.categoria,
    linea_codigo: item.linea_codigo,
    linea_gasto: item.linea_gasto,
    descripcion: item.descripcion,
    tipo_ejecucion: item.tipo_ejecucion,
    tipo_costo: item.tipo_costo,
    fuente_referencia: item.fuente_referencia,
    isActive: true,
  })));
  
  // Rebuild CANONICAL_IDS
  CANONICAL_IDS.clear();
  CANONICAL_RUBROS_TAXONOMY.forEach(r => {
    CANONICAL_IDS.add(r.linea_codigo || r.id);
  });
}

/**
 * Try to ensure taxonomy is loaded in memory.
 * If we loaded locally at startup, this resolves quickly.
 * If not and an S3 bucket is configured, we attempt to fetch the taxonomy asynchronously.
 * After loading from S3, rebuilds all indexes and exports.
 */
export async function ensureTaxonomyLoaded(): Promise<void> {
  if (taxonomyData && Array.isArray(taxonomyData.items) && taxonomyData.items.length > 0) {
    return;
  }

  // Prevent concurrent S3 loads
  if (isLoading) {
    // Wait for the ongoing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  const bucket = process.env.TAXONOMY_S3_BUCKET;
  if (!bucket) {
    console.warn('[canonical-taxonomy] TAXONOMY_S3_BUCKET not set; using empty taxonomy.');
    taxonomyData = { items: [] };
    rebuildTaxonomyIndexes();
    return;
  }

  const key = process.env.TAXONOMY_S3_KEY || 'taxonomy/rubros.taxonomy.json';

  isLoading = true;
  try {
    // lazy import to avoid top-level dependency cost
    const { S3Client: _S3Client, GetObjectCommand: _GetObjectCommand } = require('@aws-sdk/client-s3');
    S3Client = _S3Client;
    GetObjectCommand = _GetObjectCommand;

    const s3 = new S3Client({});
    const resp = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await streamToString(resp.Body);
    taxonomyData = JSON.parse(body);
    
    // CRITICAL: Rebuild indexes after S3 load
    rebuildTaxonomyIndexes();
    
    console.info(`[canonical-taxonomy] loaded taxonomy from S3: ${bucket}/${key} (${taxonomyData.items?.length || 0} items)`);
  } catch (e: any) {
    console.warn('[canonical-taxonomy] failed to load taxonomy from S3; falling back to empty taxonomy.', e?.message || e);
    taxonomyData = { items: [] };
    rebuildTaxonomyIndexes();
  } finally {
    isLoading = false;
  }
}

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
  
  // Legacy service/infrastructure identifiers
  'SOI-AWS': 'INF-CLOUD',  // Services Infrastructure - AWS → Infrastructure - Cloud
  'MOD-ARCH': 'MOD-LEAD',  // Architect → Lead Engineer
  
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
  'MOD-PM': 'MOD-LEAD', // Legacy server-generated MOD-PM mapping (from old PMO estimator)
  'mod-pm': 'MOD-LEAD', // Lowercase variant
  
  // Old non-canonical labor IDs that should map to canonical equivalents
  'MOD-OT': 'MOD-IN3',   // Old "Other" → Ingeniero Soporte N3
  'MOD-CONT': 'MOD-IN2', // Old "Contractor" → Ingeniero Soporte N2 externo
  'MOD-EXT': 'MOD-IN2',  // Old "External" → Ingeniero Soporte N2 externo
  'MOD-ENGINEER': 'MOD-ING', // Legacy "Engineer" variant → Ingeniero Soporte N1
  'MOD-DEV': 'MOD-ING', // Legacy "Developer" variant → Ingeniero Soporte N1
  'MOD-TEST': 'MOD-ING', // Legacy "Test" variant → Ingeniero Soporte N1
  
  // Legacy GSV (Gestión del Servicio) mappings
  'GSV-TOOL': 'GSV-RPT', // Legacy "Tool" → Informes mensuales
  'GSV-CLOUD': 'INF-CLOUD', // Legacy "GSV-CLOUD" → Servicios Cloud / hosting
};

/**
 * Normalize a key for case-insensitive comparison
 */
function normalizeKey(s?: string): string {
  return (s || '').toString().trim().toUpperCase();
}

/**
 * Get canonical rubro_id from any legacy format
 * 
 * @param legacyId - Any rubro ID (canonical or legacy)
 * @returns Canonical linea_codigo, or the input unchanged if unknown
 */
export function getCanonicalRubroId(legacyId?: string): string | null {
  if (!legacyId) return null;
  
  const normalized = normalizeKey(legacyId);
  
  // Check if it's a legacy ID that needs mapping
  const mapped = LEGACY_RUBRO_ID_MAP[legacyId];
  if (mapped) {
    return mapped;
  }
  
  // Check case-insensitive legacy mapping
  const normalizedLegacy = Object.keys(LEGACY_RUBRO_ID_MAP).find(
    key => normalizeKey(key) === normalized
  );
  if (normalizedLegacy) {
    return LEGACY_RUBRO_ID_MAP[normalizedLegacy];
  }
  
  // Check if it's already a canonical ID
  const canonical = Array.from(CANONICAL_IDS).find(id => normalizeKey(id) === normalized);
  if (canonical) {
    return canonical;
  }
  
  // Unknown ID - log warning and return unchanged (for graceful degradation)
  console.warn(`[canonical-taxonomy] Unknown rubro_id: ${legacyId} - not in canonical taxonomy or legacy map`);
  return legacyId;
}

/**
 * Validate if a rubro_id is valid (canonical or has legacy mapping)
 */
export function isValidRubroId(rubroId?: string): boolean {
  if (!rubroId) return false;
  
  const normalized = normalizeKey(rubroId);
  
  // Check if it's in the legacy map
  if (LEGACY_RUBRO_ID_MAP[rubroId]) return true;
  if (Object.keys(LEGACY_RUBRO_ID_MAP).find(key => normalizeKey(key) === normalized)) return true;
  
  // Check if it's a canonical ID
  if (Array.from(CANONICAL_IDS).find(id => normalizeKey(id) === normalized)) return true;
  
  return false;
}

/**
 * Check if a rubro_id is legacy and should be migrated
 */
export function isLegacyRubroId(rubroId: string): boolean {
  return !!LEGACY_RUBRO_ID_MAP[rubroId] || !!Object.keys(LEGACY_RUBRO_ID_MAP).find(
    key => normalizeKey(key) === normalizeKey(rubroId)
  );
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
 * Get all canonical IDs as array
 */
export function getAllCanonicalIds(): string[] {
  return Array.from(CANONICAL_IDS);
}

/**
 * Get taxonomy entry by ID
 */
export function getTaxonomyById(id: string): CanonicalRubroTaxonomy | null {
  const canonicalId = getCanonicalRubroId(id);
  if (!canonicalId) return null;
  return CANONICAL_RUBROS_TAXONOMY.find(r => r.linea_codigo === canonicalId) || null;
}
