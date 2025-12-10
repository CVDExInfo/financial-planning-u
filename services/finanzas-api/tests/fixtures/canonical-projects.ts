/**
 * Canonical Projects Test Fixtures
 * 
 * These fixtures represent the 7 canonical demo projects used in the Finanzas SD system.
 * Tests should use these project IDs to ensure consistency with seeded data.
 * 
 * IMPORTANT: These project IDs match the canonical projects seeded by:
 *   services/finanzas-api/src/seed/seed_canonical_projects.ts
 */

export const CANONICAL_PROJECT_IDS = {
  NOC_CLARO: "P-NOC-CLARO-BOG",
  SOC_BANCOL: "P-SOC-BANCOL-MED",
  WIFI_ELDORADO: "P-WIFI-ELDORADO",
  CLOUD_ECOPETROL: "P-CLOUD-ECOPETROL",
  SD_TIGO: "P-SD-TIGO-CALI",
  CONNECT_AVIANCA: "P-CONNECT-AVIANCA",
  DATACENTER_ETB: "P-DATACENTER-ETB",
} as const;

export const CANONICAL_BASELINE_IDS = {
  NOC_CLARO: "BL-NOC-CLARO-001",
  SOC_BANCOL: "BL-SOC-BANCOL-001",
  WIFI_ELDORADO: "BL-WIFI-ELDORADO-001",
  CLOUD_ECOPETROL: "BL-CLOUD-ECOPETROL-001",
  SD_TIGO: "BL-SD-TIGO-001",
  CONNECT_AVIANCA: "BL-CONNECT-AVIANCA-001",
  DATACENTER_ETB: "BL-DATACENTER-ETB-001",
} as const;

export const CANONICAL_RUBROS = {
  // MOD rubros
  MOD_ENGINEERS: "RB0001",
  MOD_TECH_LEAD: "RB0002",
  MOD_SDM: "RB0003",
  
  // Technical rubros
  TEC_MONITORING: "RB0010",
  TEC_WIFI_AP: "RB0030",
  TEC_OBSERVABILITY: "RB0045",
  
  // Telecom rubros
  TEL_CIRCUITS: "RB0015",
  
  // Security rubros
  SEC_SIEM: "RB0020",
  SEC_TRAINING: "RB0025",
  SEC_COMPLIANCE: "RB0050",
  
  // Infrastructure rubros
  INF_CLOUD: "RB0040",
  INF_POWER: "RB0070",
  INF_RACKS: "RB0075",
  INF_BACKUP: "RB0080",
  
  // Platform rubros
  PLT_ITSM: "RB0055",
  
  // Licensing rubros
  LIC_SDWAN: "RB0060",
  
  // NOC rubros
  NOC_SUPPORT: "RB0065",
} as const;

/**
 * Test helper: Get a canonical project by margin profile
 */
export function getProjectByMarginProfile(profile: "favorable" | "on-target" | "challenged") {
  switch (profile) {
    case "favorable":
      return CANONICAL_PROJECT_IDS.NOC_CLARO; // Consistently under budget
    case "on-target":
      return CANONICAL_PROJECT_IDS.SOC_BANCOL; // Meeting expectations
    case "challenged":
      return CANONICAL_PROJECT_IDS.CLOUD_ECOPETROL; // Over budget
  }
}

/**
 * Test helper: Get project details for assertions
 */
export const CANONICAL_PROJECT_DETAILS = {
  [CANONICAL_PROJECT_IDS.NOC_CLARO]: {
    name: "NOC Claro Bogotá",
    client: "Claro Colombia",
    serviceType: "NOC 24x7",
    duration: 60,
    startMonth: "2025-01",
    totalBudget: 18500000,
    marginProfile: "favorable",
    rubros: [
      CANONICAL_RUBROS.MOD_ENGINEERS,
      CANONICAL_RUBROS.MOD_TECH_LEAD,
      CANONICAL_RUBROS.MOD_SDM,
      CANONICAL_RUBROS.TEC_MONITORING,
      CANONICAL_RUBROS.TEL_CIRCUITS,
    ],
  },
  [CANONICAL_PROJECT_IDS.SOC_BANCOL]: {
    name: "SOC Bancolombia Medellín",
    client: "Bancolombia",
    serviceType: "SOC/Security",
    duration: 36,
    startMonth: "2025-02",
    totalBudget: 12800000,
    marginProfile: "on-target",
    rubros: [
      CANONICAL_RUBROS.MOD_ENGINEERS,
      CANONICAL_RUBROS.MOD_TECH_LEAD,
      CANONICAL_RUBROS.MOD_SDM,
      CANONICAL_RUBROS.SEC_SIEM,
      CANONICAL_RUBROS.SEC_TRAINING,
    ],
  },
  [CANONICAL_PROJECT_IDS.WIFI_ELDORADO]: {
    name: "WiFi Aeropuerto El Dorado",
    client: "Avianca",
    serviceType: "WiFi Infrastructure",
    duration: 24,
    startMonth: "2025-01",
    totalBudget: 4200000,
    marginProfile: "on-target",
    rubros: [
      CANONICAL_RUBROS.MOD_ENGINEERS,
      CANONICAL_RUBROS.MOD_TECH_LEAD,
      CANONICAL_RUBROS.MOD_SDM,
      CANONICAL_RUBROS.TEC_WIFI_AP,
    ],
  },
  [CANONICAL_PROJECT_IDS.CLOUD_ECOPETROL]: {
    name: "Cloud Ops Ecopetrol",
    client: "Ecopetrol",
    serviceType: "Cloud Operations",
    duration: 48,
    startMonth: "2024-12",
    totalBudget: 22500000,
    marginProfile: "challenged",
    rubros: [
      CANONICAL_RUBROS.MOD_ENGINEERS,
      CANONICAL_RUBROS.MOD_TECH_LEAD,
      CANONICAL_RUBROS.MOD_SDM,
      CANONICAL_RUBROS.INF_CLOUD,
      CANONICAL_RUBROS.TEC_OBSERVABILITY,
      CANONICAL_RUBROS.SEC_COMPLIANCE,
    ],
  },
  [CANONICAL_PROJECT_IDS.SD_TIGO]: {
    name: "Service Delivery Tigo Cali",
    client: "Tigo Colombia",
    serviceType: "Managed Services",
    duration: 36,
    startMonth: "2025-03",
    totalBudget: 9600000,
    marginProfile: "favorable",
    rubros: [
      CANONICAL_RUBROS.MOD_ENGINEERS,
      CANONICAL_RUBROS.MOD_TECH_LEAD,
      CANONICAL_RUBROS.MOD_SDM,
      CANONICAL_RUBROS.PLT_ITSM,
    ],
  },
  [CANONICAL_PROJECT_IDS.CONNECT_AVIANCA]: {
    name: "Connectivity Avianca",
    client: "Avianca",
    serviceType: "SD-WAN/MPLS",
    duration: 48,
    startMonth: "2024-11",
    totalBudget: 15300000,
    marginProfile: "on-target",
    rubros: [
      CANONICAL_RUBROS.MOD_ENGINEERS,
      CANONICAL_RUBROS.MOD_TECH_LEAD,
      CANONICAL_RUBROS.MOD_SDM,
      CANONICAL_RUBROS.LIC_SDWAN,
      CANONICAL_RUBROS.NOC_SUPPORT,
    ],
  },
  [CANONICAL_PROJECT_IDS.DATACENTER_ETB]: {
    name: "Datacenter ETB",
    client: "ETB",
    serviceType: "Datacenter Ops",
    duration: 60,
    startMonth: "2025-01",
    totalBudget: 25000000,
    marginProfile: "favorable",
    rubros: [
      CANONICAL_RUBROS.MOD_ENGINEERS,
      CANONICAL_RUBROS.MOD_TECH_LEAD,
      CANONICAL_RUBROS.MOD_SDM,
      CANONICAL_RUBROS.INF_POWER,
      CANONICAL_RUBROS.INF_RACKS,
      CANONICAL_RUBROS.INF_BACKUP,
    ],
  },
} as const;

/**
 * Test helper: Check if a project ID is canonical
 */
export function isCanonicalProject(projectId: string): boolean {
  return Object.values(CANONICAL_PROJECT_IDS).includes(projectId as any);
}

/**
 * Test helper: Get all canonical project IDs as array
 */
export function getAllCanonicalProjectIds(): string[] {
  return Object.values(CANONICAL_PROJECT_IDS);
}

/**
 * Test helper: Mock DynamoDB project record for a canonical project
 */
export function mockCanonicalProjectRecord(projectId: typeof CANONICAL_PROJECT_IDS[keyof typeof CANONICAL_PROJECT_IDS]) {
  const details = CANONICAL_PROJECT_DETAILS[projectId];
  if (!details) {
    throw new Error(`Unknown canonical project: ${projectId}`);
  }

  return {
    pk: `PROJECT#${projectId}`,
    sk: "META",
    projectId,
    name: details.name,
    client: details.client,
    serviceType: details.serviceType,
    duration: details.duration,
    startMonth: details.startMonth,
    totalBudget: details.totalBudget,
    currency: "USD",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Test helper: Mock DynamoDB baseline record for a canonical project
 */
export function mockCanonicalBaselineRecord(
  projectId: typeof CANONICAL_PROJECT_IDS[keyof typeof CANONICAL_PROJECT_IDS],
  baselineId: string
) {
  const details = CANONICAL_PROJECT_DETAILS[projectId];
  if (!details) {
    throw new Error(`Unknown canonical project: ${projectId}`);
  }

  return {
    pk: `BASELINE#${baselineId}`,
    sk: "META",
    baselineId,
    projectId,
    name: `Baseline ${details.name}`,
    version: 1,
    status: "active",
    acceptedBy: "sdm.lead@ikusi.com",
    acceptedAt: `${details.startMonth}-01T10:00:00Z`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Test helper: Mock DynamoDB handoff record for a canonical project
 */
export function mockCanonicalHandoffRecord(
  projectId: typeof CANONICAL_PROJECT_IDS[keyof typeof CANONICAL_PROJECT_IDS],
  baselineId: string
) {
  const details = CANONICAL_PROJECT_DETAILS[projectId];
  if (!details) {
    throw new Error(`Unknown canonical project: ${projectId}`);
  }

  return {
    pk: `PROJECT#${projectId}`,
    sk: "HANDOFF",
    projectId,
    baselineId,
    mod_total: details.totalBudget * 0.9, // 90% for MOD
    pct_ingenieros: 85,
    pct_sdm: 15,
    aceptado_por: "pm.lead@ikusi.com",
    fecha_handoff: `${details.startMonth}-01`,
    notas: `Proyecto ${details.name} - ${details.serviceType}`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Test helper: Mock DynamoDB rubro attachment for a canonical project
 */
export function mockCanonicalRubroAttachment(
  projectId: typeof CANONICAL_PROJECT_IDS[keyof typeof CANONICAL_PROJECT_IDS],
  rubroId: string,
  baselineId: string
) {
  return {
    pk: `PROJECT#${projectId}`,
    sk: `RUBRO#${rubroId}`,
    projectId,
    rubroId,
    baselineId,
    attachedAt: new Date().toISOString(),
    attachedBy: "pm.lead@ikusi.com",
  };
}
