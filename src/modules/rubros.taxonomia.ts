// AUTO-GENERATED taxonomy for Catálogo de Rubros (classification)
// Source: user-provided table (R1 – Modelo & Gobierno)

export type RubroTaxonomia = {
  categoria_codigo: string;
  categoria: string;
  linea_codigo: string;
  linea_gasto: string;
  descripcion: string;
  tipo_ejecucion: 'mensual' | 'puntual/hito';
  tipo_costo: 'OPEX' | 'CAPEX';
  fuente_referencia: string;
};

/**
 * MOD Role Mapping - Client-approved roles for Service Delivery
 * Maps Rubros line items to specific MOD roles used in baseline handoff and payroll
 */
export const MOD_ROLE_MAPPING = {
  'MOD-ING': ['Ingeniero Soporte N1', 'Ingeniero Soporte N2', 'Ingeniero Soporte N3'],
  'MOD-LEAD': 'Ingeniero Delivery',
  'MOD-SDM': 'Service Delivery Manager',
  'MOD-PM': 'Project Manager',
} as const;

export const MOD_ROLES = [
  'Ingeniero Delivery',
  'Ingeniero Soporte N1',
  'Ingeniero Soporte N2',
  'Ingeniero Soporte N3',
  'Service Delivery Manager',
  'Project Manager',
] as const;

export const CATALOGO_RUBROS: RubroTaxonomia[] = [
  {
    categoria_codigo: `MOD`,
    categoria: `Mano de Obra Directa`,
    linea_codigo: `MOD-ING`,
    linea_gasto: `Ingenieros de soporte (mensual)`,
    descripcion: `Costo mensual de ingenieros asignados al servicio según % de asignación.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Operación pos‑puesta en marcha (cliente)`
  },
  {
    categoria_codigo: `MOD`,
    categoria: `Mano de Obra Directa`,
    linea_codigo: `MOD-LEAD`,
    linea_gasto: `Ingeniero líder / coordinador`,
    descripcion: `Perfil senior técnico con responsabilidad de coordinación técnica.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Buenas prácticas MSP`
  },
  {
    categoria_codigo: `MOD`,
    categoria: `Mano de Obra Directa`,
    linea_codigo: `MOD-SDM`,
    linea_gasto: `Service Delivery Manager (SDM)`,
    descripcion: `Gestión operativa, relación con cliente, reportes, SLAs.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Modelo Service Delivery`
  },
  {
    categoria_codigo: `MOD`,
    categoria: `Mano de Obra Directa`,
    linea_codigo: `MOD-OT`,
    linea_gasto: `Horas extra / guardias`,
    descripcion: `On‑call, fines de semana, festivos.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `MSP`
  },
  {
    categoria_codigo: `MOD`,
    categoria: `Mano de Obra Directa`,
    linea_codigo: `MOD-CONT`,
    linea_gasto: `Contratistas técnicos internos`,
    descripcion: `Soporte temporal bajo nómina interna.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `MSP`
  },
  {
    categoria_codigo: `MOD`,
    categoria: `Mano de Obra Directa`,
    linea_codigo: `MOD-EXT`,
    linea_gasto: `Contratistas externos (labor)`,
    descripcion: `Recursos por demanda no nómina.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `MSP`
  },
  {
    categoria_codigo: `GSV`,
    categoria: `Gestión del Servicio`,
    linea_codigo: `GSV-REU`,
    linea_gasto: `Reuniones de seguimiento`,
    descripcion: `Reuniones periódicas de servicio con cliente (operativas/ejecutivas).`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `ITIL / Service Mgmt`
  },
  {
    categoria_codigo: `GSV`,
    categoria: `Gestión del Servicio`,
    linea_codigo: `GSV-RPT`,
    linea_gasto: `Informes mensuales (SLA/KPI)`,
    descripcion: `Generación y distribución de informes de desempeño.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `ITIL / SLA`
  },
  {
    categoria_codigo: `GSV`,
    categoria: `Gestión del Servicio`,
    linea_codigo: `GSV-AUD`,
    linea_gasto: `Auditoría interna del servicio`,
    descripcion: `Revisión de cumplimiento, controles, evidencias.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Gobernanza`
  },
  {
    categoria_codigo: `GSV`,
    categoria: `Gestión del Servicio`,
    linea_codigo: `GSV-TRN`,
    linea_gasto: `Formación/certificación del equipo`,
    descripcion: `Cursos y certificaciones relevantes para el servicio.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Industria MSP`
  },
  {
    categoria_codigo: `REM`,
    categoria: `Servicios Remotos / Campo`,
    linea_codigo: `REM-MANT-P`,
    linea_gasto: `Mantenimiento preventivo (labor)`,
    descripcion: `Horas de mantenimiento programado.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Operación pos‑puesta en marcha`
  },
  {
    categoria_codigo: `REM`,
    categoria: `Servicios Remotos / Campo`,
    linea_codigo: `REM-MANT-C`,
    linea_gasto: `Mantenimiento correctivo (labor)`,
    descripcion: `Atención a incidentes / fallas.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `MSP/NOC`
  },
  {
    categoria_codigo: `REM`,
    categoria: `Servicios Remotos / Campo`,
    linea_codigo: `REM-HH-EXT`,
    linea_gasto: `Manos remotas (proveedor externo)`,
    descripcion: `Técnicos terceros on‑site por demanda.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Cliente + TEM`
  },
  {
    categoria_codigo: `REM`,
    categoria: `Servicios Remotos / Campo`,
    linea_codigo: `REM-TRNS`,
    linea_gasto: `Transporte/traslados técnicos`,
    descripcion: `Taxis, peajes, combustible según política.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `TEM buenas prácticas`
  },
  {
    categoria_codigo: `REM`,
    categoria: `Servicios Remotos / Campo`,
    linea_codigo: `REM-VIAT`,
    linea_gasto: `Viáticos de campo`,
    descripcion: `Alojamiento y alimentación de técnicos en sitio.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `TEM`
  },
  {
    categoria_codigo: `REM`,
    categoria: `Servicios Remotos / Campo`,
    linea_codigo: `REM-CONS`,
    linea_gasto: `Consumibles de campo`,
    descripcion: `Cables, conectores, bridas, herramientas menores.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Field Service`
  },
  {
    categoria_codigo: `TEC`,
    categoria: `Equipos y Tecnología`,
    linea_codigo: `TEC-LIC-MON`,
    linea_gasto: `Licencias de monitoreo/observabilidad`,
    descripcion: `Herramientas NMS/APM/Logs.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Observabilidad/Ikusi servicios`
  },
  {
    categoria_codigo: `TEC`,
    categoria: `Equipos y Tecnología`,
    linea_codigo: `TEC-ITSM`,
    linea_gasto: `Herramienta ITSM / tickets`,
    descripcion: `Plataforma ITSM (SaaS).`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `ITIL`
  },
  {
    categoria_codigo: `TEC`,
    categoria: `Equipos y Tecnología`,
    linea_codigo: `TEC-LAB`,
    linea_gasto: `Equipamiento de laboratorio/soporte`,
    descripcion: `Equipos de prueba, bancos de ensayo.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `CAPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Operación técnica`
  },
  {
    categoria_codigo: `TEC`,
    categoria: `Equipos y Tecnología`,
    linea_codigo: `TEC-HW-RPL`,
    linea_gasto: `Reemplazo de hardware de ingenieros`,
    descripcion: `Renovación de laptops/workstations (3 años).`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `CAPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Política de renovación`
  },
  {
    categoria_codigo: `TEC`,
    categoria: `Equipos y Tecnología`,
    linea_codigo: `TEC-HW-FIELD`,
    linea_gasto: `Equipos de campo instalados`,
    descripcion: `Routers/switches/APs/antenas instalados en cliente.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `CAPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Infraestructura de red`
  },
  {
    categoria_codigo: `TEC`,
    categoria: `Equipos y Tecnología`,
    linea_codigo: `TEC-SUP-VND`,
    linea_gasto: `Soporte de fabricante (contrato)`,
    descripcion: `Renovación de soporte HW/SW (SmartNet, etc.).`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Vendors`
  },
  {
    categoria_codigo: `INF`,
    categoria: `Infraestructura / Nube / Data Center`,
    linea_codigo: `INF-CLOUD`,
    linea_gasto: `Servicios Cloud / hosting`,
    descripcion: `SaaS/IaaS/PaaS asociados al servicio.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Cloud OPEX`
  },
  {
    categoria_codigo: `INF`,
    categoria: `Infraestructura / Nube / Data Center`,
    linea_codigo: `INF-DC-EN`,
    linea_gasto: `Energía/UPS/Clima (DC)`,
    descripcion: `Costos energéticos y acondicionamiento.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Operación DC`
  },
  {
    categoria_codigo: `INF`,
    categoria: `Infraestructura / Nube / Data Center`,
    linea_codigo: `INF-RACK`,
    linea_gasto: `Racks / colocation`,
    descripcion: `Arrendamiento de espacio en DC/edge.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Infraestructura`
  },
  {
    categoria_codigo: `INF`,
    categoria: `Infraestructura / Nube / Data Center`,
    linea_codigo: `INF-BCK`,
    linea_gasto: `Backup & DR`,
    descripcion: `Copias y recuperación ante desastres.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Buenas prácticas resiliencia`
  },
  {
    categoria_codigo: `TEL`,
    categoria: `Telecomunicaciones`,
    linea_codigo: `TEL-CCTS`,
    linea_gasto: `Circuitos y enlaces`,
    descripcion: `MPLS/Internet/SD‑WAN.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `TEM / Ikusi service providers`
  },
  {
    categoria_codigo: `TEL`,
    categoria: `Telecomunicaciones`,
    linea_codigo: `TEL-UCAAS`,
    linea_gasto: `UCaaS/Colaboración`,
    descripcion: `Plataformas de voz/video/mensajería.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `TEM`
  },
  {
    categoria_codigo: `TEL`,
    categoria: `Telecomunicaciones`,
    linea_codigo: `TEL-SIMS`,
    linea_gasto: `Planes móviles/datos`,
    descripcion: `Líneas celulares del servicio.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `TEM`
  },
  {
    categoria_codigo: `TEL`,
    categoria: `Telecomunicaciones`,
    linea_codigo: `TEL-NUM`,
    linea_gasto: `Numeración/DIDs/Troncales`,
    descripcion: `Servicios de numeración y troncales SIP.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Comms`
  },
  {
    categoria_codigo: `SEC`,
    categoria: `Seguridad y Cumplimiento`,
    linea_codigo: `SEC-SOC`,
    linea_gasto: `Monitoreo SOC / ciberseguridad`,
    descripcion: `Servicios SOC/EDR/SIEM.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Ciberseguridad Ikusi`
  },
  {
    categoria_codigo: `SEC`,
    categoria: `Seguridad y Cumplimiento`,
    linea_codigo: `SEC-VA`,
    linea_gasto: `Vulnerability/Pentest`,
    descripcion: `Evaluaciones periódicas de seguridad.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Seguridad`
  },
  {
    categoria_codigo: `SEC`,
    categoria: `Seguridad y Cumplimiento`,
    linea_codigo: `SEC-COMP`,
    linea_gasto: `Cumplimiento/auditorías`,
    descripcion: `Controles y auditorías normativas.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Compliance`
  },
  {
    categoria_codigo: `LOG`,
    categoria: `Logística y Repuestos`,
    linea_codigo: `LOG-SPARES`,
    linea_gasto: `Pool de repuestos (spares)`,
    descripcion: `Inventario de repuestos críticos.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Field ops / SLA`
  },
  {
    categoria_codigo: `LOG`,
    categoria: `Logística y Repuestos`,
    linea_codigo: `LOG-RMA`,
    linea_gasto: `RMA / garantías`,
    descripcion: `Gestión de devoluciones a fabricante.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Vendor mgmt`
  },
  {
    categoria_codigo: `LOG`,
    categoria: `Logística y Repuestos`,
    linea_codigo: `LOG-ENV`,
    linea_gasto: `Envíos y courier`,
    descripcion: `Paquetería de equipos y partes.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Operación logística`
  },
  {
    categoria_codigo: `RIE`,
    categoria: `Riesgos y Penalizaciones`,
    linea_codigo: `RIE-PEN`,
    linea_gasto: `Penalizaciones por SLA`,
    descripcion: `Penalties por incumplimiento de SLAs.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `SLA contratos`
  },
  {
    categoria_codigo: `RIE`,
    categoria: `Riesgos y Penalizaciones`,
    linea_codigo: `RIE-CTR`,
    linea_gasto: `Contingencias operativas`,
    descripcion: `Fondo de contingencias para eventos mayores.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Riesgo`
  },
  {
    categoria_codigo: `RIE`,
    categoria: `Riesgos y Penalizaciones`,
    linea_codigo: `RIE-SEG`,
    linea_gasto: `Seguros asociados al servicio`,
    descripcion: `Coberturas de equipos/operación.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Seguros`
  },
  {
    categoria_codigo: `ADM`,
    categoria: `Administración / PMO / Prefactura`,
    linea_codigo: `ADM-PMO`,
    linea_gasto: `Costo PMO / gobernanza`,
    descripcion: `Soporte de gobierno y metodología.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `PMO`
  },
  {
    categoria_codigo: `ADM`,
    categoria: `Administración / PMO / Prefactura`,
    linea_codigo: `ADM-BILL`,
    linea_gasto: `Gestión de prefacturas/facturación`,
    descripcion: `Procesamiento y conciliación de facturas.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Proceso Prefactura`
  },
  {
    categoria_codigo: `ADM`,
    categoria: `Administración / PMO / Prefactura`,
    linea_codigo: `ADM-FIN`,
    linea_gasto: `Contabilidad/finanzas del servicio`,
    descripcion: `Asientos, conciliaciones, cierres.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Finanzas`
  },
  {
    categoria_codigo: `ADM`,
    categoria: `Administración / PMO / Prefactura`,
    linea_codigo: `ADM-LIC`,
    linea_gasto: `Licencias administrativas`,
    descripcion: `Herramientas de oficina/gestión.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Operación`
  },
  {
    categoria_codigo: `ADM`,
    categoria: `Administración / PMO / Prefactura`,
    linea_codigo: `ADM-LEG`,
    linea_gasto: `Servicios legales/contratos`,
    descripcion: `Revisión y gestión contractual.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Legal`
  },
  {
    categoria_codigo: `QLT`,
    categoria: `Calidad y Mejora Continua`,
    linea_codigo: `QLT-ISO`,
    linea_gasto: `Certificaciones (ISO/ITIL)`,
    descripcion: `Renovaciones y auditorías externas.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Calidad`
  },
  {
    categoria_codigo: `QLT`,
    categoria: `Calidad y Mejora Continua`,
    linea_codigo: `QLT-KAIZ`,
    linea_gasto: `Programas de mejora (Kaizen/Lean)`,
    descripcion: `Iniciativas de optimización.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Mejora Continua`
  },
  {
    categoria_codigo: `QLT`,
    categoria: `Calidad y Mejora Continua`,
    linea_codigo: `QLT-SAT`,
    linea_gasto: `Encuestas satisfacción cliente`,
    descripcion: `Medición periódica de CSAT/OSAT.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `CX`
  },
  {
    categoria_codigo: `PLT`,
    categoria: `Plataformas de Gestión`,
    linea_codigo: `PLT-PLANV`,
    linea_gasto: `Planview / PPM`,
    descripcion: `Licencias/uso para planificación/PPM.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Planview`
  },
  {
    categoria_codigo: `PLT`,
    categoria: `Plataformas de Gestión`,
    linea_codigo: `PLT-SFDC`,
    linea_gasto: `Salesforce (datos de costos)`,
    descripcion: `Extracción/ingesta de Hoja de Costos.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Salesforce origen`
  },
  {
    categoria_codigo: `PLT`,
    categoria: `Plataformas de Gestión`,
    linea_codigo: `PLT-SAP`,
    linea_gasto: `SAP / ERP`,
    descripcion: `Integraciones contables/facturación.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `ERP`
  },
  {
    categoria_codigo: `PLT`,
    categoria: `Plataformas de Gestión`,
    linea_codigo: `PLT-DLAKE`,
    linea_gasto: `Data Lake`,
    descripcion: `Sincronización maestros (clientes/proveedores).`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Arquitectura IKUSI`
  },
  {
    categoria_codigo: `DEP`,
    categoria: `Depreciación y Amortización`,
    linea_codigo: `DEP-HW`,
    linea_gasto: `Depreciación hardware`,
    descripcion: `Cálculo contable de activos HW.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `CapEx vs OpEx`
  },
  {
    categoria_codigo: `DEP`,
    categoria: `Depreciación y Amortización`,
    linea_codigo: `DEP-SW`,
    linea_gasto: `Amortización software perpetuo`,
    descripcion: `Amortización de licencias perpetuas.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Contabilidad`
  },
  {
    categoria_codigo: `NOC`,
    categoria: `NOC / Operación 24x7`,
    linea_codigo: `NOC-MON`,
    linea_gasto: `Monitoreo 24x7`,
    descripcion: `Servicios de NOC (turnos).`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Ikusi Enterprise Networks`
  },
  {
    categoria_codigo: `NOC`,
    categoria: `NOC / Operación 24x7`,
    linea_codigo: `NOC-ALR`,
    linea_gasto: `Gestión de alertas/eventos`,
    descripcion: `Triaging, escalamiento, reportes.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `NOC best practices`
  },
  {
    categoria_codigo: `NOC`,
    categoria: `NOC / Operación 24x7`,
    linea_codigo: `NOC-PLN`,
    linea_gasto: `Planificación de capacidad`,
    descripcion: `Capacity planning de red/infra.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Red/Infra`
  },
  {
    categoria_codigo: `COL`,
    categoria: `Colaboración / Productividad`,
    linea_codigo: `COL-UCC`,
    linea_gasto: `Licencias de colaboración (UCC)`,
    descripcion: `Teams/Zoom/Meet, grabaciones, PBX cloud.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `UCaaS`
  },
  {
    categoria_codigo: `COL`,
    categoria: `Colaboración / Productividad`,
    linea_codigo: `COL-STG`,
    linea_gasto: `Almacenamiento colaborativo`,
    descripcion: `Drive/SharePoint/OneDrive.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `SaaS`
  },
  {
    categoria_codigo: `COL`,
    categoria: `Colaboración / Productividad`,
    linea_codigo: `COL-EMAIL`,
    linea_gasto: `Correo corporativo`,
    descripcion: `Exchange/Google Workspace.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `SaaS`
  },
  {
    categoria_codigo: `VIA`,
    categoria: `Viajes Corporativos (no campo)`,
    linea_codigo: `VIA-INT`,
    linea_gasto: `Viajes internos gestión`,
    descripcion: `Viajes no asociados a intervención de campo.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Operación`
  },
  {
    categoria_codigo: `VIA`,
    categoria: `Viajes Corporativos (no campo)`,
    linea_codigo: `VIA-CLI`,
    linea_gasto: `Viajes cliente (reuniones)`,
    descripcion: `Reuniones ejecutivas/operativas en cliente.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Cuenta/CSM`
  },
  {
    categoria_codigo: `INV`,
    categoria: `Inventarios / Almacén`,
    linea_codigo: `INV-ALM`,
    linea_gasto: `Almacenamiento de equipos`,
    descripcion: `Bodegas y gestión de inventario.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Logística`
  },
  {
    categoria_codigo: `INV`,
    categoria: `Inventarios / Almacén`,
    linea_codigo: `INV-SGA`,
    linea_gasto: `Software WMS/SGA`,
    descripcion: `Herramienta de gestión de almacén.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Logística tech`
  },
  {
    categoria_codigo: `INV`,
    categoria: `Inventarios / Almacén`,
    linea_codigo: `INV-SEG`,
    linea_gasto: `Seguros de inventario`,
    descripcion: `Coberturas de pérdida/daño.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Seguros`
  },
  {
    categoria_codigo: `LIC`,
    categoria: `Licencias de Red y Seguridad`,
    linea_codigo: `LIC-FW`,
    linea_gasto: `Suscripciones firewall/IPS`,
    descripcion: `Soporte/firmware/feeds de seguridad.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Seguridad`
  },
  {
    categoria_codigo: `LIC`,
    categoria: `Licencias de Red y Seguridad`,
    linea_codigo: `LIC-NET`,
    linea_gasto: `Suscripciones de red (DNA/Prime)`,
    descripcion: `Controladores/licencias por dispositivo.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Enterprise Networks`
  },
  {
    categoria_codigo: `LIC`,
    categoria: `Licencias de Red y Seguridad`,
    linea_codigo: `LIC-EDR`,
    linea_gasto: `EDR/antimalware endpoint`,
    descripcion: `Protección endpoints del servicio.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `SOC`
  },
  {
    categoria_codigo: `CTR`,
    categoria: `Cumplimiento Contractual`,
    linea_codigo: `CTR-SLA`,
    linea_gasto: `Gestión y medición de SLA`,
    descripcion: `Métricas y evidencias contractuales.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `SLA mgmt`
  },
  {
    categoria_codigo: `CTR`,
    categoria: `Cumplimiento Contractual`,
    linea_codigo: `CTR-OLA`,
    linea_gasto: `Acuerdos internos (OLA)`,
    descripcion: `Compromisos entre áreas internas.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `ITSM`
  },
  {
    categoria_codigo: `INN`,
    categoria: `Innovación y Roadmap`,
    linea_codigo: `INN-POC`,
    linea_gasto: `Pilotos/PoC de mejora`,
    descripcion: `Pruebas de nuevas herramientas o procesos.`,
    tipo_ejecucion: `puntual/hito` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `Innovación`
  },
  {
    categoria_codigo: `INN`,
    categoria: `Innovación y Roadmap`,
    linea_codigo: `INN-AUT`,
    linea_gasto: `Automatización/IA ligera`,
    descripcion: `Bots, scripts, detección de anomalías.`,
    tipo_ejecucion: `mensual` as 'mensual' | 'puntual/hito',
    tipo_costo: `OPEX` as 'OPEX' | 'CAPEX',
    fuente_referencia: `TEM/Observabilidad`
  },
];

// Convenience indices
export const byLineaCodigo = new Map(CATALOGO_RUBROS.map(r => [r.linea_codigo, r]));
export const byCategoriaCodigo = new Map<string, RubroTaxonomia[]>(CATALOGO_RUBROS.reduce((acc, r) => {
  const list = acc.get(r.categoria_codigo) || [];
  list.push(r);
  acc.set(r.categoria_codigo, list);
  return acc;
}, new Map()));