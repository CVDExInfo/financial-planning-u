// Catálogo base de rubros (mínimo R1)

export interface RubroCatalogItem {
  rubro_id: string;
  nombre: string;
  descripcion?: string;
}

export const RUBROS_CATALOG: RubroCatalogItem[] = [
  { rubro_id: 'RUBRO-001', nombre: 'Desarrollo Backend', descripcion: 'Equipo de desarrollo y mantenimiento backend' },
  { rubro_id: 'RUBRO-002', nombre: 'Infraestructura Cloud', descripcion: 'Costos AWS/Azure mensuales' },
  { rubro_id: 'RUBRO-003', nombre: 'Licencias Software', descripcion: 'Herramientas y plataformas de software' },
  { rubro_id: 'RUBRO-004', nombre: 'Servicios Profesionales', descripcion: 'Consultoría externa especializada' },
  { rubro_id: 'RUBRO-005', nombre: 'Capacitación Equipo', descripcion: 'Cursos y certificaciones clave' },
];

export default RUBROS_CATALOG;
