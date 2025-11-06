// Taxonomía base para rubros de costos
// Nota: Estos datos sirven como referencia local y como fuente para seeders.

export type TipoCosto = 'CAPEX' | 'OPEX';

export interface RubroTaxonomia {
  rubro_id: string;
  categoria: string; // p.ej. Ingeniería, Infraestructura, Software, Servicios
  linea_codigo: string; // código contable o centro de costo
  tipo_costo: TipoCosto;
}

export const RUBROS_TAXONOMIA: RubroTaxonomia[] = [
  { rubro_id: 'RUBRO-001', categoria: 'Ingeniería', linea_codigo: 'CC-ING-001', tipo_costo: 'OPEX' },
  { rubro_id: 'RUBRO-002', categoria: 'Infraestructura', linea_codigo: 'CC-INF-010', tipo_costo: 'CAPEX' },
  { rubro_id: 'RUBRO-003', categoria: 'Software', linea_codigo: 'CC-SW-020', tipo_costo: 'OPEX' },
  { rubro_id: 'RUBRO-004', categoria: 'Servicios', linea_codigo: 'CC-SRV-030', tipo_costo: 'OPEX' },
  { rubro_id: 'RUBRO-005', categoria: 'Capacitación', linea_codigo: 'CC-TRN-040', tipo_costo: 'OPEX' },
];

export default RUBROS_TAXONOMIA;
