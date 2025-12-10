/**
 * Cost Categories and Line Items Matrix
 * Based on business cost structure for SDMT Service Delivery
 */

export interface CostCategory {
  codigo: string;
  nombre: string;
  lineas: CostLineItem[];
}

export interface CostLineItem {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo_ejecucion: "mensual" | "puntual/hito";
  tipo_costo: "OPEX" | "CAPEX";
  fuente_referencia: string;
}

/**
 * MOD Roles - Client-approved roles for Service Delivery
 * These are the only roles that should appear in MOD role selection
 */
export const MOD_ROLES = [
  'Ingeniero Delivery',
  'Ingeniero Soporte N1',
  'Ingeniero Soporte N2',
  'Ingeniero Soporte N3',
  'Service Delivery Manager',
  'Project Manager',
] as const;

export const COST_CATEGORIES: CostCategory[] = [
  {
    codigo: "MOD",
    nombre: "Mano de Obra Directa",
    lineas: [
      {
        codigo: "MOD-ING",
        nombre: "Ingenieros de soporte (mensual)",
        descripcion:
          "Costo mensual de ingenieros asignados al servicio según % de asignación.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Operación pos‑puesta en marcha (cliente)",
      },
      {
        codigo: "MOD-LEAD",
        nombre: "Ingeniero líder / coordinador",
        descripcion:
          "Perfil senior técnico con responsabilidad de coordinación técnica.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Buenas prácticas MSP",
      },
      {
        codigo: "MOD-SDM",
        nombre: "Service Delivery Manager (SDM)",
        descripcion: "Gestión operativa, relación con cliente, reportes, SLAs.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Modelo Service Delivery",
      },
      {
        codigo: "MOD-OT",
        nombre: "Horas extra / guardias",
        descripcion: "On‑call, fines de semana, festivos.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "MSP",
      },
      {
        codigo: "MOD-CONT",
        nombre: "Contratistas tecnicos internos",
        descripcion: "Soporte temporal bajo nomina interna.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "MSP",
      },
      {
        codigo: "MOD-EXT",
        nombre: "Contratistas externos (labor)",
        descripcion: "Recursos por demanda no nómina.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "MSP",
      },
    ],
  },
  {
    codigo: "GSV",
    nombre: "Gestión del Servicio",
    lineas: [
      {
        codigo: "GSV-REU",
        nombre: "Reuniones de seguimiento",
        descripcion:
          "Reuniones periódicas de servicio con cliente (operativas/ejecutivas).",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "ITIL / Service Mgmt",
      },
      {
        codigo: "GSV-RPT",
        nombre: "Informes mensuales (SLA/KPI)",
        descripcion: "Generación y distribución de informes de desempeño.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "ITIL / SLA",
      },
      {
        codigo: "GSV-AUD",
        nombre: "Auditoría interna del servicio",
        descripcion: "Revisión de cumplimiento, controles, evidencias.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Gobernanza",
      },
      {
        codigo: "GSV-TRN",
        nombre: "Formación/certificación del equipo",
        descripcion: "Cursos y certificaciones relevantes para el servicio.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Industria MSP",
      },
    ],
  },
  {
    codigo: "REM",
    nombre: "Servicios Remotos / Campo",
    lineas: [
      {
        codigo: "REM-MANT-P",
        nombre: "Mantenimiento preventivo (labor)",
        descripcion: "Horas de mantenimiento programado.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Operación pos‑puesta en marcha",
      },
      {
        codigo: "REM-MANT-C",
        nombre: "Mantenimiento correctivo (labor)",
        descripcion: "Atención a incidentes / fallas.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "MSP/NOC",
      },
      {
        codigo: "REM-HH-EXT",
        nombre: "Manos remotas (proveedor externo)",
        descripcion: "Técnicos terceros on‑site por demanda.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Cliente + TEM",
      },
      {
        codigo: "REM-TRNS",
        nombre: "Transporte/traslados técnicos",
        descripcion: "Taxis, peajes, combustible según política.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "TEM buenas prácticas",
      },
      {
        codigo: "REM-VIAT",
        nombre: "Viáticos de campo",
        descripcion: "Alojamiento y alimentación de técnicos en sitio.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "TEM",
      },
      {
        codigo: "REM-CONS",
        nombre: "Consumibles de campo",
        descripcion: "Cables, conectores, bridas, herramientas menores.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Field Service",
      },
    ],
  },
  {
    codigo: "TEC",
    nombre: "Equipos y Tecnología",
    lineas: [
      {
        codigo: "TEC-LIC-MON",
        nombre: "Licencias de monitoreo/observabilidad",
        descripcion: "Herramientas NMS/APM/Logs.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Observabilidad/Ikusi servicios",
      },
      {
        codigo: "TEC-ITSM",
        nombre: "Herramienta ITSM / tickets",
        descripcion: "Plataforma ITSM (SaaS).",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "ITIL",
      },
      {
        codigo: "TEC-LAB",
        nombre: "Equipamiento de laboratorio/soporte",
        descripcion: "Equipos de prueba, bancos de ensayo.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "CAPEX",
        fuente_referencia: "Operación técnica",
      },
      {
        codigo: "TEC-HW-RPL",
        nombre: "Reemplazo de hardware de ingenieros",
        descripcion: "Renovación de laptops/workstations (3 años).",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "CAPEX",
        fuente_referencia: "Política de renovación",
      },
      {
        codigo: "TEC-HW-FIELD",
        nombre: "Equipos de campo instalados",
        descripcion: "Routers/switches/APs/antenas instalados en cliente.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "CAPEX",
        fuente_referencia: "Infraestructura de red",
      },
      {
        codigo: "TEC-SUP-VND",
        nombre: "Soporte de fabricante (contrato)",
        descripcion: "Renovación de soporte HW/SW (SmartNet, etc.).",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Vendors",
      },
    ],
  },
  {
    codigo: "INF",
    nombre: "Infraestructura / Nube / Data Center",
    lineas: [
      {
        codigo: "INF-CLOUD",
        nombre: "Servicios Cloud / hosting",
        descripcion: "SaaS/IaaS/PaaS asociados al servicio.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Cloud OPEX",
      },
      {
        codigo: "INF-DC-EN",
        nombre: "Energía/UPS/Clima (DC)",
        descripcion: "Costos energéticos y acondicionamiento.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Operación DC",
      },
      {
        codigo: "INF-RACK",
        nombre: "Racks / colocation",
        descripcion: "Arrendamiento de espacio en DC/edge.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Infraestructura",
      },
      {
        codigo: "INF-BCK",
        nombre: "Backup & DR",
        descripcion: "Copias y recuperación ante desastres.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Buenas prácticas resiliencia",
      },
    ],
  },
  {
    codigo: "TEL",
    nombre: "Telecomunicaciones",
    lineas: [
      {
        codigo: "TEL-CCTS",
        nombre: "Circuitos y enlaces",
        descripcion: "MPLS/Internet/SD‑WAN.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "TEM / Ikusi service providers",
      },
      {
        codigo: "TEL-UCAAS",
        nombre: "UCaaS/Colaboración",
        descripcion: "Plataformas de voz/video/mensajería.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "TEM",
      },
      {
        codigo: "TEL-SIMS",
        nombre: "Planes móviles/datos",
        descripcion: "Líneas celulares del servicio.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "TEM",
      },
      {
        codigo: "TEL-NUM",
        nombre: "Numeración/DIDs/Troncales",
        descripcion: "Servicios de numeración y troncales SIP.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Comms",
      },
    ],
  },
  {
    codigo: "SEC",
    nombre: "Seguridad y Cumplimiento",
    lineas: [
      {
        codigo: "SEC-SOC",
        nombre: "Monitoreo SOC / ciberseguridad",
        descripcion: "Servicios SOC/EDR/SIEM.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Ciberseguridad Ikusi",
      },
      {
        codigo: "SEC-VA",
        nombre: "Vulnerability/Pentest",
        descripcion: "Evaluaciones periódicas de seguridad.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Seguridad",
      },
      {
        codigo: "SEC-COMP",
        nombre: "Cumplimiento/auditorías",
        descripcion: "Controles y auditorías normativas.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Compliance",
      },
    ],
  },
  {
    codigo: "LOG",
    nombre: "Logística y Repuestos",
    lineas: [
      {
        codigo: "LOG-SPARES",
        nombre: "Pool de repuestos (spares)",
        descripcion: "Inventario de repuestos críticos.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Field ops / SLA",
      },
      {
        codigo: "LOG-RMA",
        nombre: "RMA / garantías",
        descripcion: "Gestión de devoluciones a fabricante.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Vendor mgmt",
      },
      {
        codigo: "LOG-ENV",
        nombre: "Envíos y courier",
        descripcion: "Paquetería de equipos y partes.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Operación logística",
      },
    ],
  },
  {
    codigo: "RIE",
    nombre: "Riesgos y Penalizaciones",
    lineas: [
      {
        codigo: "RIE-PEN",
        nombre: "Penalizaciones por SLA",
        descripcion: "Penalties por incumplimiento de SLAs.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "SLA contratos",
      },
      {
        codigo: "RIE-CTR",
        nombre: "Contingencias operativas",
        descripcion: "Fondo de contingencias para eventos mayores.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Riesgo",
      },
      {
        codigo: "RIE-SEG",
        nombre: "Seguros asociados al servicio",
        descripcion: "Coberturas de equipos/operación.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Seguros",
      },
    ],
  },
  {
    codigo: "ADM",
    nombre: "Administración / PMO / Prefactura",
    lineas: [
      {
        codigo: "ADM-PMO",
        nombre: "Costo PMO / gobernanza",
        descripcion: "Soporte de gobierno y metodología.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "PMO",
      },
      {
        codigo: "ADM-BILL",
        nombre: "Gestión de prefacturas/facturación",
        descripcion: "Procesamiento y conciliación de facturas.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Proceso Prefactura",
      },
      {
        codigo: "ADM-FIN",
        nombre: "Contabilidad/finanzas del servicio",
        descripcion: "Asientos, conciliaciones, cierres.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Finanzas",
      },
      {
        codigo: "ADM-LIC",
        nombre: "Licencias administrativas",
        descripcion: "Herramientas de oficina/gestión.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Operación",
      },
      {
        codigo: "ADM-LEG",
        nombre: "Servicios legales/contratos",
        descripcion: "Revisión y gestión contractual.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Legal",
      },
    ],
  },
  {
    codigo: "QLT",
    nombre: "Calidad y Mejora Continua",
    lineas: [
      {
        codigo: "QLT-ISO",
        nombre: "Certificaciones (ISO/ITIL)",
        descripcion: "Renovaciones y auditorías externas.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Calidad",
      },
      {
        codigo: "QLT-KAIZ",
        nombre: "Programas de mejora (Kaizen/Lean)",
        descripcion: "Iniciativas de optimización.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Mejora Continua",
      },
      {
        codigo: "QLT-SAT",
        nombre: "Encuestas satisfacción cliente",
        descripcion: "Medición periódica de CSAT/OSAT.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "CX",
      },
    ],
  },
  {
    codigo: "PLT",
    nombre: "Plataformas de Gestión",
    lineas: [
      {
        codigo: "PLT-PLANV",
        nombre: "Planview / PPM",
        descripcion: "Licencias/uso para planificación/PPM.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Planview",
      },
      {
        codigo: "PLT-SFDC",
        nombre: "Salesforce (datos de costos)",
        descripcion: "Extracción/ingesta de Hoja de Costos.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Salesforce origen",
      },
      {
        codigo: "PLT-SAP",
        nombre: "SAP / ERP",
        descripcion: "Integraciones contables/facturación.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "ERP",
      },
      {
        codigo: "PLT-DLAKE",
        nombre: "Data Lake",
        descripcion: "Sincronización maestros (clientes/proveedores).",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Arquitectura IKUSI",
      },
    ],
  },
  {
    codigo: "DEP",
    nombre: "Depreciación y Amortización",
    lineas: [
      {
        codigo: "DEP-HW",
        nombre: "Depreciación hardware",
        descripcion: "Cálculo contable de activos HW.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "CapEx vs OpEx",
      },
      {
        codigo: "DEP-SW",
        nombre: "Amortización software perpetuo",
        descripcion: "Amortización de licencias perpetuas.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Contabilidad",
      },
    ],
  },
  {
    codigo: "NOC",
    nombre: "NOC / Operación 24x7",
    lineas: [
      {
        codigo: "NOC-MON",
        nombre: "Monitoreo 24x7",
        descripcion: "Servicios de NOC (turnos).",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Ikusi Enterprise Networks",
      },
      {
        codigo: "NOC-ALR",
        nombre: "Gestión de alertas/eventos",
        descripcion: "Triaging, escalamiento, reportes.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "NOC best practices",
      },
      {
        codigo: "NOC-PLN",
        nombre: "Planificación de capacidad",
        descripcion: "Capacity planning de red/infra.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Red/Infra",
      },
    ],
  },
  {
    codigo: "COL",
    nombre: "Colaboración / Productividad",
    lineas: [
      {
        codigo: "COL-UCC",
        nombre: "Licencias de colaboración (UCC)",
        descripcion: "Teams/Zoom/Meet, grabaciones, PBX cloud.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "UCaaS",
      },
      {
        codigo: "COL-STG",
        nombre: "Almacenamiento colaborativo",
        descripcion: "Drive/SharePoint/OneDrive.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "SaaS",
      },
      {
        codigo: "COL-EMAIL",
        nombre: "Correo corporativo",
        descripcion: "Exchange/Google Workspace.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "SaaS",
      },
    ],
  },
  {
    codigo: "VIA",
    nombre: "Viajes Corporativos (no campo)",
    lineas: [
      {
        codigo: "VIA-INT",
        nombre: "Viajes internos gestión",
        descripcion: "Viajes no asociados a intervención de campo.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Operación",
      },
      {
        codigo: "VIA-CLI",
        nombre: "Viajes cliente (reuniones)",
        descripcion: "Reuniones ejecutivas/operativas en cliente.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Cuenta/CSM",
      },
    ],
  },
  {
    codigo: "INV",
    nombre: "Inventarios / Almacén",
    lineas: [
      {
        codigo: "INV-ALM",
        nombre: "Almacenamiento de equipos",
        descripcion: "Bodegas y gestión de inventario.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Logística",
      },
      {
        codigo: "INV-SGA",
        nombre: "Software WMS/SGA",
        descripcion: "Herramienta de gestión de almacén.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Logística tech",
      },
      {
        codigo: "INV-SEG",
        nombre: "Seguros de inventario",
        descripcion: "Coberturas de pérdida/daño.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Seguros",
      },
    ],
  },
  {
    codigo: "LIC",
    nombre: "Licencias de Red y Seguridad",
    lineas: [
      {
        codigo: "LIC-FW",
        nombre: "Suscripciones firewall/IPS",
        descripcion: "Soporte/firmware/feeds de seguridad.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Seguridad",
      },
      {
        codigo: "LIC-NET",
        nombre: "Suscripciones de red (DNA/Prime)",
        descripcion: "Controladores/licencias por dispositivo.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "Enterprise Networks",
      },
      {
        codigo: "LIC-EDR",
        nombre: "EDR/antimalware endpoint",
        descripcion: "Protección endpoints del servicio.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "SOC",
      },
    ],
  },
  {
    codigo: "CTR",
    nombre: "Cumplimiento Contractual",
    lineas: [
      {
        codigo: "CTR-SLA",
        nombre: "Gestión y medición de SLA",
        descripcion: "Métricas y evidencias contractuales.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "SLA mgmt",
      },
      {
        codigo: "CTR-OLA",
        nombre: "Acuerdos internos (OLA)",
        descripcion: "Compromisos entre áreas internas.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "ITSM",
      },
    ],
  },
  {
    codigo: "INN",
    nombre: "Innovación y Roadmap",
    lineas: [
      {
        codigo: "INN-POC",
        nombre: "Pilotos/PoC de mejora",
        descripcion: "Pruebas de nuevas herramientas o procesos.",
        tipo_ejecucion: "puntual/hito",
        tipo_costo: "OPEX",
        fuente_referencia: "Innovación",
      },
      {
        codigo: "INN-AUT",
        nombre: "Automatización/IA ligera",
        descripcion: "Bots, scripts, detección de anomalías.",
        tipo_ejecucion: "mensual",
        tipo_costo: "OPEX",
        fuente_referencia: "TEM/Observabilidad",
      },
    ],
  },
];

// Helper functions
export function getCategoryByCode(codigo: string): CostCategory | undefined {
  return COST_CATEGORIES.find((cat) => cat.codigo === codigo);
}

export function getLineItemByCode(
  codigo: string
): { category: CostCategory; lineItem: CostLineItem } | undefined {
  for (const category of COST_CATEGORIES) {
    const lineItem = category.lineas.find((l) => l.codigo === codigo);
    if (lineItem) {
      return { category, lineItem };
    }
  }
  return undefined;
}

export function getCategoryNames(): string[] {
  return COST_CATEGORIES.map((cat) => cat.nombre);
}

export function getCategoryCodes(): string[] {
  return COST_CATEGORIES.map((cat) => cat.codigo);
}
