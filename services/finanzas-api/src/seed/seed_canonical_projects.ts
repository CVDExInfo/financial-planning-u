/**
 * Canonical Projects Seed Script
 * Seeds the 7 canonical demo projects with all related entities for testing and demos
 * 
 * Usage:
 *   npm run seed:canonical-projects
 * 
 * Environment variables:
 *   AWS_REGION (default: us-east-2)
 *   STAGE or ENV - Must be 'dev' or 'test' (script aborts for prod/stg)
 *   TABLE_PROJECTS (default: finz_projects)
 *   TABLE_RUBROS (default: finz_rubros)
 *   TABLE_ALLOC (default: finz_allocations)
 *   TABLE_PAYROLL (default: finz_payroll_actuals)
 *   TABLE_ADJ (default: finz_adjustments)
 */

import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

// Environment & table configuration
const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const STAGE = process.env.STAGE || process.env.ENV || "dev";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_RUBROS = process.env.TABLE_RUBROS || "finz_rubros";
const TABLE_ALLOC = process.env.TABLE_ALLOC || "finz_allocations";
const TABLE_PAYROLL = process.env.TABLE_PAYROLL || "finz_payroll_actuals";
const TABLE_ADJ = process.env.TABLE_ADJ || "finz_adjustments";

const ddb = new DynamoDBClient({ region: AWS_REGION });

// Safety check: Don't run in production
function checkEnvironmentSafety() {
  const stage = STAGE.toLowerCase();
  if (stage === "prod" || stage === "production" || stage === "stg" || stage === "staging") {
    console.error("❌ FATAL: Cannot run seed script in production/staging environment!");
    console.error(`   Detected STAGE/ENV: ${STAGE}`);
    console.error("   This script is for dev/test environments only.");
    process.exit(1);
  }
  console.log(`✓ Environment check passed: ${STAGE}`);
}

// Canonical project definitions
interface CanonicalProject {
  projectId: string;
  name: string;
  client: string;
  serviceType: string;
  duration: number; // months
  startMonth: string; // YYYY-MM
  totalBudget: number;
  contractValue: number;
  indirectCost: number;
  targetMargin: number; // percentage
  baselineId: string;
  resources: {
    role: string;
    tier: string;
    count: number;
    monthlyCost: number;
  }[];
  rubros: string[]; // rubro IDs from catalog
  marginProfile: "favorable" | "on-target" | "challenged";
}

const CANONICAL_PROJECTS: CanonicalProject[] = [
  {
    projectId: "P-NOC-CLARO-BOG",
    name: "NOC Claro Bogotá",
    client: "Claro Colombia",
    serviceType: "NOC 24x7",
    duration: 60,
    startMonth: "2025-01",
    totalBudget: 18500000,
    contractValue: 18000000,
    indirectCost: 500000,
    targetMargin: 12,
    baselineId: "BL-NOC-CLARO-001",
    resources: [
      { role: "NOC Engineer", tier: "Gold", count: 8, monthlyCost: 75000 },
      { role: "NOC Lead", tier: "Premium", count: 2, monthlyCost: 110000 },
      { role: "SDM", tier: "Gold", count: 1, monthlyCost: 95000 },
    ],
    rubros: ["RB0001", "RB0002", "RB0003", "RB0010", "RB0015"],
    marginProfile: "favorable",
  },
  {
    projectId: "P-SOC-BANCOL-MED",
    name: "SOC Bancolombia Medellín",
    client: "Bancolombia",
    serviceType: "SOC/Security",
    duration: 36,
    startMonth: "2025-02",
    totalBudget: 12800000,
    contractValue: 12000000,
    indirectCost: 800000,
    targetMargin: 15,
    baselineId: "BL-SOC-BANCOL-001",
    resources: [
      { role: "Security Analyst", tier: "Premium", count: 6, monthlyCost: 95000 },
      { role: "SOC Lead", tier: "Premium", count: 1, monthlyCost: 115000 },
      { role: "SDM", tier: "Gold", count: 1, monthlyCost: 90000 },
    ],
    rubros: ["RB0001", "RB0002", "RB0003", "RB0020", "RB0025"],
    marginProfile: "on-target",
  },
  {
    projectId: "P-WIFI-ELDORADO",
    name: "WiFi Aeropuerto El Dorado",
    client: "Avianca",
    serviceType: "WiFi Infrastructure",
    duration: 24,
    startMonth: "2025-01",
    totalBudget: 4200000,
    contractValue: 3800000,
    indirectCost: 400000,
    targetMargin: 10,
    baselineId: "BL-WIFI-ELDORADO-001",
    resources: [
      { role: "WiFi Engineer", tier: "Gold", count: 3, monthlyCost: 70000 },
      { role: "Tech Lead", tier: "Premium", count: 1, monthlyCost: 105000 },
      { role: "SDM", tier: "Gold", count: 1, monthlyCost: 85000 },
    ],
    rubros: ["RB0001", "RB0002", "RB0003", "RB0030"],
    marginProfile: "on-target",
  },
  {
    projectId: "P-CLOUD-ECOPETROL",
    name: "Cloud Ops Ecopetrol",
    client: "Ecopetrol",
    serviceType: "Cloud Operations",
    duration: 48,
    startMonth: "2024-12",
    totalBudget: 22500000,
    contractValue: 21000000,
    indirectCost: 1500000,
    targetMargin: 14,
    baselineId: "BL-CLOUD-ECOPETROL-001",
    resources: [
      { role: "Cloud Engineer", tier: "Premium", count: 10, monthlyCost: 100000 },
      { role: "Cloud Architect", tier: "Premium", count: 2, monthlyCost: 125000 },
      { role: "SDM", tier: "Premium", count: 1, monthlyCost: 100000 },
    ],
    rubros: ["RB0001", "RB0002", "RB0003", "RB0040", "RB0045", "RB0050"],
    marginProfile: "challenged",
  },
  {
    projectId: "P-SD-TIGO-CALI",
    name: "Service Delivery Tigo Cali",
    client: "Tigo Colombia",
    serviceType: "Managed Services",
    duration: 36,
    startMonth: "2025-03",
    totalBudget: 9600000,
    contractValue: 9000000,
    indirectCost: 600000,
    targetMargin: 11,
    baselineId: "BL-SD-TIGO-001",
    resources: [
      { role: "Service Engineer", tier: "Gold", count: 5, monthlyCost: 72000 },
      { role: "Service Lead", tier: "Gold", count: 1, monthlyCost: 92000 },
      { role: "SDM", tier: "Gold", count: 1, monthlyCost: 88000 },
    ],
    rubros: ["RB0001", "RB0002", "RB0003", "RB0055"],
    marginProfile: "favorable",
  },
  {
    projectId: "P-CONNECT-AVIANCA",
    name: "Connectivity Avianca",
    client: "Avianca",
    serviceType: "SD-WAN/MPLS",
    duration: 48,
    startMonth: "2024-11",
    totalBudget: 15300000,
    contractValue: 14500000,
    indirectCost: 800000,
    targetMargin: 13,
    baselineId: "BL-CONNECT-AVIANCA-001",
    resources: [
      { role: "Network Engineer", tier: "Gold", count: 6, monthlyCost: 78000 },
      { role: "Network Architect", tier: "Premium", count: 1, monthlyCost: 115000 },
      { role: "SDM", tier: "Gold", count: 1, monthlyCost: 90000 },
    ],
    rubros: ["RB0001", "RB0002", "RB0003", "RB0060", "RB0065"],
    marginProfile: "on-target",
  },
  {
    projectId: "P-DATACENTER-ETB",
    name: "Datacenter ETB",
    client: "ETB",
    serviceType: "Datacenter Ops",
    duration: 60,
    startMonth: "2025-01",
    totalBudget: 25000000,
    contractValue: 23000000,
    indirectCost: 2000000,
    targetMargin: 16,
    baselineId: "BL-DATACENTER-ETB-001",
    resources: [
      { role: "Datacenter Ops Engineer", tier: "Gold", count: 12, monthlyCost: 76000 },
      { role: "Datacenter Lead", tier: "Premium", count: 2, monthlyCost: 108000 },
      { role: "SDM", tier: "Premium", count: 1, monthlyCost: 98000 },
    ],
    rubros: ["RB0001", "RB0002", "RB0003", "RB0070", "RB0075", "RB0080"],
    marginProfile: "favorable",
  },
];

// Catalog rubros (standard Ikusi catalog)
const CATALOG_RUBROS = [
  { rubro_id: "RB0001", nombre: "Costo mensual de ingenieros asignados al servicio según % de asignación", tier: "Gold", categoria: "MOD" },
  { rubro_id: "RB0002", nombre: "Perfil senior técnico con responsabilidad de coordinación técnica", tier: "Premium", categoria: "MOD" },
  { rubro_id: "RB0003", nombre: "Gestión operativa, relación con cliente, reportes, SLAs", tier: "Gold", categoria: "MOD" },
  { rubro_id: "RB0010", nombre: "Herramientas de monitoreo y observabilidad 24x7", tier: "N/A", categoria: "TEC" },
  { rubro_id: "RB0015", nombre: "Circuitos y enlaces de telecomunicaciones", tier: "N/A", categoria: "TEL" },
  { rubro_id: "RB0020", nombre: "Licencias SIEM y herramientas de seguridad", tier: "N/A", categoria: "SEC" },
  { rubro_id: "RB0025", nombre: "Capacitación y certificaciones de seguridad", tier: "N/A", categoria: "QLT" },
  { rubro_id: "RB0030", nombre: "Access Points y controladores WiFi", tier: "N/A", categoria: "TEC" },
  { rubro_id: "RB0040", nombre: "Servicios Cloud AWS/Azure", tier: "N/A", categoria: "INF" },
  { rubro_id: "RB0045", nombre: "Herramientas de observabilidad cloud", tier: "N/A", categoria: "TEC" },
  { rubro_id: "RB0050", nombre: "Compliance y auditoría de seguridad cloud", tier: "N/A", categoria: "SEC" },
  { rubro_id: "RB0055", nombre: "Herramientas ITSM y ticketing", tier: "N/A", categoria: "PLT" },
  { rubro_id: "RB0060", nombre: "Licencias SD-WAN", tier: "N/A", categoria: "LIC" },
  { rubro_id: "RB0065", nombre: "Soporte NOC para circuitos", tier: "N/A", categoria: "NOC" },
  { rubro_id: "RB0070", nombre: "Energía y cooling datacenter", tier: "N/A", categoria: "INF" },
  { rubro_id: "RB0075", nombre: "Racks y espacio de co-location", tier: "N/A", categoria: "INF" },
  { rubro_id: "RB0080", nombre: "Backup y disaster recovery", tier: "N/A", categoria: "INF" },
];

/**
 * Helper to check if an item exists
 */
async function itemExists(tableName: string, pk: string, sk: string): Promise<boolean> {
  try {
    const result = await ddb.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({ pk, sk }),
      })
    );
    return !!result.Item;
  } catch (_error) {
    return false;
  }
}

/**
 * Helper to put item (idempotent)
 */
async function putItem(tableName: string, item: Record<string, any>) {
  const exists = await itemExists(tableName, item.pk, item.sk);

  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  );

  return exists ? "updated" : "created";
}

/**
 * Parse month string to get year and month number
 */
function parseMonth(monthStr: string): { year: number; month: number } {
  const [year, month] = monthStr.split("-").map(Number);
  return { year, month };
}

/**
 * Add months to a date string
 */
function addMonths(startMonth: string, offset: number): string {
  const { year, month } = parseMonth(startMonth);
  const date = new Date(year, month - 1 + offset, 1);
  const resultYear = date.getFullYear();
  const resultMonth = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${resultYear}-${resultMonth}`;
}

/**
 * Seed catalog rubros
 * 
 * IMPORTANT: This function only ensures the canonical rubros exist in the catalog.
 * It does NOT modify existing catalog entries - the putItem helper is idempotent.
 * The rubros catalog (71 items) is the single source of truth and should be seeded
 * separately via the rubros catalog seed scripts if needed.
 * 
 * This subset (17 rubros) covers the MOD, TEC, INF, SEC categories needed for
 * the canonical test projects only.
 */
async function seedCatalogRubros() {
  console.log("\n📚 Seeding catalog rubros (canonical subset)");
  console.log("   Note: Idempotent - only creates if missing, never modifies existing");

  for (const rubro of CATALOG_RUBROS) {
    const item = {
      pk: `RUBRO#${rubro.rubro_id}`,
      sk: `DEF`,
      rubro_id: rubro.rubro_id,
      nombre: rubro.nombre,
      tier: rubro.tier,
      categoria: rubro.categoria,
      tipo_costo: "Recurrente",
      createdAt: new Date().toISOString(),
    };

    const status = await putItem(TABLE_RUBROS, item);
    console.log(`  ✓ Catalog rubro ${status}: ${rubro.rubro_id}`);
  }
}

/**
 * Seed a single project with all related data
 */
async function seedProject(project: CanonicalProject) {
  console.log(`\n📦 Seeding project: ${project.projectId} (${project.name})`);

  const now = new Date().toISOString();
  const monthlyBudget = project.totalBudget / project.duration;

  // 1. Project record
  const projectItem = {
    pk: `PROJECT#${project.projectId}`,
    sk: "METADATA",
    projectId: project.projectId,
    name: project.name,
    client: project.client,
    serviceType: project.serviceType,
    baselineId: project.baselineId,
    duration: project.duration,
    startMonth: project.startMonth,
    currency: "USD",
    totalBudget: project.totalBudget,
    contractValue: project.contractValue,
    indirectCost: project.indirectCost,
    targetMargin: project.targetMargin,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await putItem(TABLE_PROJECTS, projectItem);
  console.log(`  ✓ Project record`);

  // 2. Baseline/Handoff record
  const handoffItem = {
    pk: `PROJECT#${project.projectId}`,
    sk: `HANDOFF`,
    projectId: project.projectId,
    baselineId: project.baselineId,
    mod_total: project.contractValue,
    pct_ingenieros: 85,
    pct_sdm: 15,
    aceptado_por: "pm.lead@ikusi.com",
    fecha_handoff: addMonths(project.startMonth, -1),
    notas: `Proyecto ${project.name} - ${project.serviceType}`,
    createdAt: now,
  };

  await putItem(TABLE_PROJECTS, handoffItem);
  console.log(`  ✓ Handoff record`);

  // 3. Baseline record
  const baselineItem = {
    pk: `BASELINE#${project.baselineId}`,
    sk: "METADATA",
    baselineId: project.baselineId,
    projectId: project.projectId,
    name: `Baseline ${project.name}`,
    version: 1,
    status: "active",
    acceptedBy: "sdm.lead@ikusi.com",
    acceptedAt: project.startMonth + "-01T10:00:00Z",
    createdAt: now,
  };

  await putItem(TABLE_PROJECTS, baselineItem);
  console.log(`  ✓ Baseline record`);

  // 4. Project rubro attachments
  // IMPORTANT: All rubros must reference the baseline to ensure 1:1 match
  // This enforces the baseline-first flow: only rubros from the baseline are attached
  for (const rubroId of project.rubros) {
    const attachmentItem = {
      pk: `PROJECT#${project.projectId}`,
      sk: `RUBRO#${rubroId}`,
      projectId: project.projectId,
      rubroId: rubroId,
      baselineId: project.baselineId,
      attachedAt: now,
      attachedBy: "pm.lead@ikusi.com",
    };

    await putItem(TABLE_PROJECTS, attachmentItem);
  }
  console.log(`  ✓ Rubro attachments (${project.rubros.length}) - all linked to ${project.baselineId}`);

  // 5. Estimator items (one per resource type)
  // Each estimator item represents a baseline line item and maps to a catalog rubro
  for (let i = 0; i < project.resources.length; i++) {
    const resource = project.resources[i];
    const estimatorId = `est_${project.projectId}_${i + 1}`;
    const rubroId = project.rubros[Math.min(i, project.rubros.length - 1)]; // Map to rubros

    const estimatorItem = {
      pk: `PROJECT#${project.projectId}`,
      sk: `ESTIMATOR#${estimatorId}`,
      id: estimatorId,
      projectId: project.projectId,
      baselineId: project.baselineId,
      rubroId: rubroId,
      nombre: `${resource.role} - ${project.duration} meses`,
      tier: resource.tier,
      quantity: resource.count,
      unitCost: resource.monthlyCost,
      totalCost: resource.monthlyCost * resource.count * project.duration,
      period: project.duration,
      startMonth: project.startMonth,
      committed: true,
      createdAt: now,
    };

    await putItem(TABLE_PROJECTS, estimatorItem);
  }
  console.log(`  ✓ Estimator items (${project.resources.length})`);

  // 6. Allocations (first 3 months)
  const allocMonths = 3;
  let allocCount = 0;

  for (let monthOffset = 0; monthOffset < allocMonths; monthOffset++) {
    const month = addMonths(project.startMonth, monthOffset);

    for (let i = 0; i < project.resources.length; i++) {
      const resource = project.resources[i];
      const allocId = `alloc_${project.projectId}_m${monthOffset + 1}_r${i + 1}`;
      const rubroId = project.rubros[Math.min(i, project.rubros.length - 1)];
      const amount = resource.monthlyCost * resource.count;

      const allocItem = {
        pk: `PROJECT#${project.projectId}#MONTH#${month}`,
        sk: `ALLOC#${allocId}`,
        id: allocId,
        projectId: project.projectId,
        rubroId: rubroId,
        month: month,
        amount: amount,
        resourceCount: resource.count,
        source: "estimator",
        status: "committed",
        createdAt: now,
      };

      await putItem(TABLE_ALLOC, allocItem);
      allocCount++;
    }
  }
  console.log(`  ✓ Allocations (${allocCount} records)`);

  // 7. Payroll actuals (first 3 months with variance based on margin profile)
  let payrollCount = 0;
  const varianceFactors: Record<string, number[]> = {
    favorable: [0.95, 0.96, 0.97], // 3-5% under budget
    "on-target": [0.99, 1.0, 1.01], // On target
    challenged: [1.03, 1.05, 1.02], // 2-5% over budget
  };

  const factors = varianceFactors[project.marginProfile];

  for (let monthOffset = 0; monthOffset < allocMonths; monthOffset++) {
    const month = addMonths(project.startMonth, monthOffset);
    const varianceFactor = factors[monthOffset % factors.length];

    for (let i = 0; i < project.resources.length; i++) {
      const resource = project.resources[i];
      const payrollId = `payroll_${project.projectId}_m${monthOffset + 1}_r${i + 1}`;
      const rubroId = project.rubros[Math.min(i, project.rubros.length - 1)];
      const plannedAmount = resource.monthlyCost * resource.count;
      const actualAmount = Math.round(plannedAmount * varianceFactor);

      const payrollItem = {
        pk: `PROJECT#${project.projectId}#MONTH#${month}`,
        sk: `PAYROLL#${payrollId}`,
        id: payrollId,
        projectId: project.projectId,
        rubroId: rubroId,
        month: month,
        amount: actualAmount,
        resourceCount: resource.count,
        source: "SAP_HR",
        uploadedBy: "finance@ikusi.com",
        uploadedAt: now,
      };

      await putItem(TABLE_PAYROLL, payrollItem);
      payrollCount++;
    }
  }
  console.log(`  ✓ Payroll actuals (${payrollCount} records)`);

  // 8. Adjustments (for challenged projects only)
  if (project.marginProfile === "challenged") {
    const adjMonth = addMonths(project.startMonth, 2);
    const adjustment = {
      pk: `PROJECT#${project.projectId}`,
      sk: `ADJ#adj_${project.projectId}_001`,
      id: `adj_${project.projectId}_001`,
      project_id: project.projectId,
      tipo: "exceso",
      monto: monthlyBudget * 0.05, // 5% increase
      fecha_inicio: adjMonth,
      justificacion: `Incremento de costos cloud inesperado - ${project.name}`,
      solicitado_por: "sdm.lead@ikusi.com",
      estado: "approved",
      aprobado_por: "director@ikusi.com",
      aprobado_en: now,
      created_at: now,
    };

    await putItem(TABLE_ADJ, adjustment);
    console.log(`  ✓ Adjustment (1 record)`);
  }

  // Validation: Confirm 1:1 baseline-rubro relationship
  console.log(`  ℹ️  Validation: ${project.rubros.length} rubros, ${project.resources.length} estimator items, all linked to baseline ${project.baselineId}`);
  
  console.log(`  ✅ Project ${project.projectId} seeded successfully`);
}

/**
 * Main execution
 */
async function main() {
  console.log("🌱 Starting Canonical Projects Seed");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Stage: ${STAGE}`);
  console.log(`   Projects to seed: ${CANONICAL_PROJECTS.length}`);
  console.log("═".repeat(80));

  // Safety check
  checkEnvironmentSafety();

  try {
    // Seed catalog rubros first
    await seedCatalogRubros();

    // Seed each canonical project
    for (const project of CANONICAL_PROJECTS) {
      await seedProject(project);
    }

    console.log("\n✅ Canonical projects seed completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Projects: ${CANONICAL_PROJECTS.length}`);
    console.log(`   Catalog rubros: ${CATALOG_RUBROS.length}`);
    console.log(`   Total portfolio value: $${CANONICAL_PROJECTS.reduce((sum, p) => sum + p.totalBudget, 0).toLocaleString()} USD`);
    console.log("\n🔍 Margin profiles:");
    console.log(`   Favorable: ${CANONICAL_PROJECTS.filter((p) => p.marginProfile === "favorable").length} projects`);
    console.log(`   On-target: ${CANONICAL_PROJECTS.filter((p) => p.marginProfile === "on-target").length} projects`);
    console.log(`   Challenged: ${CANONICAL_PROJECTS.filter((p) => p.marginProfile === "challenged").length} projects`);
  } catch (error) {
    console.error("\n❌ Error during seed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main as seedCanonicalProjects, CANONICAL_PROJECTS };
