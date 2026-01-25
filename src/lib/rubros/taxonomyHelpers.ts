/**
 * Taxonomy Helpers
 * 
 * Utility functions for working with the rubros taxonomy
 * Provides user-friendly labels for domain values
 */

import taxonomyData from '../../../data/rubros.taxonomy.json';

export interface RubroTaxonomyItem {
  pk: string;
  sk: string;
  categoria: string;
  categoria_codigo: string;
  descripcion: string;
  fuente_referencia: string;
  linea_codigo: string;
  linea_gasto: string;
  tipo_costo: string;
  tipo_ejecucion: string;
}

/**
 * Load the full taxonomy
 */
export function getTaxonomy(): RubroTaxonomyItem[] {
  return taxonomyData.items as RubroTaxonomyItem[];
}

/**
 * Map of fuente_referencia codes to user-friendly labels
 */
const FUENTE_REFERENCIA_LABELS: Record<string, string> = {
  // Service Delivery
  'Modelo Service Delivery': 'Modelo Service Delivery',
  'Service Delivery Model': 'Modelo Service Delivery',
  'SD Model': 'Modelo Service Delivery',
  
  // PMO
  'PMO': 'PMO',
  'Project Management Office': 'PMO',
  
  // MSP
  'MSP': 'MSP',
  'Managed Service Provider': 'MSP',
  
  // Contracts & SLA
  'Contrato / SLA': 'Contrato / SLA',
  'Contract / SLA': 'Contrato / SLA',
  
  // Certifications
  'ISO / Certificaciones': 'ISO / Certificaciones',
  'Certifications': 'ISO / Certificaciones',
  
  // ERP / Accounting
  'ERP / Contabilidad (SAP)': 'ERP / Contabilidad (SAP)',
  'ERP / Accounting (SAP)': 'ERP / Contabilidad (SAP)',
  'SAP': 'ERP / Contabilidad (SAP)',
  
  // Field Service
  'Operación de Campo (Field Service)': 'Operación de Campo',
  'Field Service': 'Operación de Campo',
  
  // HR / Payroll
  'RRHH / Nómina': 'RRHH / Nómina',
  'HR / Payroll': 'RRHH / Nómina',
  'Payroll': 'RRHH / Nómina',
  
  // Infrastructure
  'Infraestructura IT': 'Infraestructura IT',
  'IT Infrastructure': 'Infraestructura IT',
  
  // Operations
  'Operaciones': 'Operaciones',
  'Operations': 'Operaciones',
  
  // Default fallback
  'default': 'Sin clasificar',
};

/**
 * Get user-friendly label for fuente_referencia
 */
export function getFuenteReferenciaLabel(fuenteReferencia: string | null | undefined): string {
  if (!fuenteReferencia) {
    return FUENTE_REFERENCIA_LABELS['default'];
  }

  // Try exact match first
  if (fuenteReferencia in FUENTE_REFERENCIA_LABELS) {
    return FUENTE_REFERENCIA_LABELS[fuenteReferencia];
  }

  // Try partial match
  const key = Object.keys(FUENTE_REFERENCIA_LABELS).find(k => 
    fuenteReferencia.toLowerCase().includes(k.toLowerCase())
  );

  return key ? FUENTE_REFERENCIA_LABELS[key] : fuenteReferencia;
}

/**
 * Get all unique fuente_referencia values from taxonomy
 */
export function getAllFuentesReferencia(): string[] {
  const taxonomy = getTaxonomy();
  const fuentes = new Set<string>();
  
  taxonomy.forEach(item => {
    if (item.fuente_referencia) {
      fuentes.add(item.fuente_referencia);
    }
  });
  
  return Array.from(fuentes).sort();
}

/**
 * Get all unique categories from taxonomy
 */
export function getAllCategories(): Array<{ codigo: string; nombre: string }> {
  const taxonomy = getTaxonomy();
  const categoriesMap = new Map<string, string>();
  
  taxonomy.forEach(item => {
    if (item.categoria_codigo && item.categoria) {
      categoriesMap.set(item.categoria_codigo, item.categoria);
    }
  });
  
  return Array.from(categoriesMap.entries())
    .map(([codigo, nombre]) => ({ codigo, nombre }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/**
 * Get taxonomy item by linea_codigo
 */
export function getTaxonomyByLineaId(lineaId: string): RubroTaxonomyItem | undefined {
  const taxonomy = getTaxonomy();
  return taxonomy.find(item => item.linea_codigo === lineaId);
}

/**
 * Get taxonomy items by category
 */
export function getTaxonomyByCategory(categoryCodigo: string): RubroTaxonomyItem[] {
  const taxonomy = getTaxonomy();
  return taxonomy.filter(item => item.categoria_codigo === categoryCodigo);
}

/**
 * Get all tipo_costo values (OPEX, CAPEX, etc.)
 */
export function getAllTiposCosto(): string[] {
  const taxonomy = getTaxonomy();
  const tipos = new Set<string>();
  
  taxonomy.forEach(item => {
    if (item.tipo_costo) {
      tipos.add(item.tipo_costo);
    }
  });
  
  return Array.from(tipos).sort();
}

/**
 * Get all tipo_ejecucion values
 */
export function getAllTiposEjecucion(): string[] {
  const taxonomy = getTaxonomy();
  const tipos = new Set<string>();
  
  taxonomy.forEach(item => {
    if (item.tipo_ejecucion) {
      tipos.add(item.tipo_ejecucion);
    }
  });
  
  return Array.from(tipos).sort();
}

/**
 * Search taxonomy by term (searches across multiple fields)
 */
export function searchTaxonomy(term: string): RubroTaxonomyItem[] {
  if (!term || term.trim() === '') {
    return [];
  }

  const taxonomy = getTaxonomy();
  const searchTerm = term.toLowerCase().trim();
  
  return taxonomy.filter(item => 
    item.linea_gasto?.toLowerCase().includes(searchTerm) ||
    item.descripcion?.toLowerCase().includes(searchTerm) ||
    item.categoria?.toLowerCase().includes(searchTerm) ||
    item.linea_codigo?.toLowerCase().includes(searchTerm) ||
    item.fuente_referencia?.toLowerCase().includes(searchTerm)
  );
}

/**
 * Get a rubro by its canonical ID (linea_codigo)
 * This is used by PMO estimator to look up taxonomy metadata for auto-population
 * 
 * @param id - Canonical linea_codigo or any rubro identifier
 * @returns RubroTaxonomyItem or null if not found
 */
export function getRubroById(id: string): RubroTaxonomyItem | null {
  if (!id) return null;
  
  const taxonomy = getTaxonomy();
  const normalizedId = id.toUpperCase().trim();
  
  // Try exact match on linea_codigo first (canonical ID)
  const byLineaCodigo = taxonomy.find(
    item => item.linea_codigo && item.linea_codigo.toUpperCase() === normalizedId
  );
  if (byLineaCodigo) return byLineaCodigo;
  
  // Fallback: try other fields for flexibility
  return taxonomy.find(
    item => 
      (item.pk && item.pk.toUpperCase().includes(normalizedId)) ||
      (item.sk && item.sk.toUpperCase().includes(normalizedId))
  ) || null;
}

/**
 * Get category color for consistent UI theming
 */
export function getCategoryColor(categoryCodigo: string): string {
  // Map category codes to Tailwind color classes
  const colorMap: Record<string, string> = {
    'QLT': 'emerald',   // Quality
    'RIE': 'red',       // Risk
    'PLT': 'blue',      // Platforms
    'REM': 'amber',     // Remote/Field
    'MOD': 'indigo',    // Model
    'PMO': 'purple',    // PMO
    'MSP': 'cyan',      // MSP
  };

  return colorMap[categoryCodigo] || 'slate';
}
