/**
 * Golden Project Seed Script
 * Seeds a complete project (P-GOLDEN-1) with all related entities for testing
 * 
 * Usage:
 *   npm run seed:finanzas:golden
 * 
 * Environment variables required:
 *   AWS_REGION=us-east-2
 *   TABLE_PROJECTS (default: finz_projects)
 *   TABLE_RUBROS (default: finz_rubros)
 *   TABLE_ALLOC (default: finz_allocations)
 *   TABLE_PAYROLL (default: finz_payroll_actuals)
 *   TABLE_ADJ (default: finz_adjustments)
 */

import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_RUBROS = process.env.TABLE_RUBROS || "finz_rubros";
const TABLE_ALLOC = process.env.TABLE_ALLOC || "finz_allocations";
const TABLE_PAYROLL = process.env.TABLE_PAYROLL || "finz_payroll_actuals";
const TABLE_ADJ = process.env.TABLE_ADJ || "finz_adjustments";

const ddb = new DynamoDBClient({ region: AWS_REGION });

// Golden project constants
const PROJECT_ID = "P-GOLDEN-1";
const BASELINE_ID = "BL-1763192300497";
const PROJECT_NAME = "IA plataforma";
const PERIOD_MONTHS = 48;
const START_MONTH = "2025-01";

/**
 * Helper to check if an item exists
 */
async function itemExists(tableName: string, pk: string, sk: string): Promise<boolean> {
  try {
    const result = await ddb.send(new GetItemCommand({
      TableName: tableName,
      Key: marshall({ pk, sk }),
    }));
    return !!result.Item;
  } catch (_error) {
    return false;
  }
}

/**
 * Helper to put item (idempotent - only updates if needed)
 */
async function putItem(tableName: string, item: Record<string, any>) {
  const exists = await itemExists(tableName, item.pk, item.sk);
  
  await ddb.send(new PutItemCommand({
    TableName: tableName,
    Item: marshall(item, { removeUndefinedValues: true }),
  }));
  
  return exists ? 'updated' : 'created';
}

/**
 * Seed the golden project
 */
async function seedProject() {
  console.log(`\n📦 Seeding project: ${PROJECT_ID}`);
  
  const projectItem = {
    pk: `PROJECT#${PROJECT_ID}`,
    sk: `META`,
    projectId: PROJECT_ID,
    name: PROJECT_NAME,
    baselineId: BASELINE_ID,
    period: PERIOD_MONTHS,
    startMonth: START_MONTH,
    currency: "USD",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const status = await putItem(TABLE_PROJECTS, projectItem);
  console.log(`  ✓ Project ${status}: ${PROJECT_ID}`);
}

/**
 * Seed handoff data for the project
 */
async function seedHandoff() {
  console.log(`\n📥 Seeding handoff for: ${PROJECT_ID}`);
  
  const handoffItem = {
    pk: `PROJECT#${PROJECT_ID}`,
    sk: `HANDOFF`,
    projectId: PROJECT_ID,
    mod_total: 12240000, // Total for 48 months
    pct_ingenieros: 85,
    pct_sdm: 15,
    aceptado_por: "pm.lead@ikusi.com",
    fecha_handoff: "2024-12-15",
    notas: "Proyecto de plataforma IA - Entregable incluye 3 ingenieros Gold tier por 48 meses",
    createdAt: new Date().toISOString(),
  };
  
  const status = await putItem(TABLE_PROJECTS, handoffItem);
  console.log(`  ✓ Handoff ${status}`);
}

/**
 * Seed catalog rubros (using a curated subset)
 */
async function seedCatalogRubros() {
  console.log(`\n📚 Seeding catalog rubros`);
  
  const rubros = [
    {
      rubro_id: "RB0001",
      nombre: "Costo mensual de ingenieros asignados al servicio según % de asignación",
      tier: "Gold",
    },
    {
      rubro_id: "RB0002",
      nombre: "Perfil senior técnico con responsabilidad de coordinación técnica",
      tier: "Premium",
    },
    {
      rubro_id: "RB0003",
      nombre: "Gestión operativa, relación con cliente, reportes, SLAs",
      tier: "Gold",
    },
  ];
  
  for (const rubro of rubros) {
    const item = {
      pk: `RUBRO#${rubro.rubro_id}`,
      sk: `DEF`,
      rubro_id: rubro.rubro_id,
      nombre: rubro.nombre,
      tier: rubro.tier,
      categoria: "Servicios de Ingeniería",
      tipo_costo: "Recurrente",
    };
    
    const status = await putItem(TABLE_RUBROS, item);
    console.log(`  ✓ Catalog rubro ${status}: ${rubro.rubro_id}`);
  }
}

/**
 * Seed project rubro attachments
 */
async function seedProjectRubros() {
  console.log(`\n🔗 Seeding project rubro attachments`);
  
  const attachments = [
    { rubroId: "RB0001", tier: "Gold" },
    { rubroId: "RB0002", tier: "Premium" },
    { rubroId: "RB0003", tier: "Gold" },
  ];
  
  for (const attachment of attachments) {
    const item = {
      pk: `PROJECT#${PROJECT_ID}`,
      sk: `RUBRO#${attachment.rubroId}`,
      projectId: PROJECT_ID,
      rubroId: attachment.rubroId,
      tier: attachment.tier,
      attachedAt: new Date().toISOString(),
      attachedBy: "pm.lead@ikusi.com",
    };
    
    const status = await putItem(TABLE_PROJECTS, item);
    console.log(`  ✓ Attachment ${status}: ${attachment.rubroId}`);
  }
}

/**
 * Seed estimator items
 */
async function seedEstimatorItems() {
  console.log(`\n💰 Seeding estimator items`);
  
  const items = [
    {
      id: "est_gold001",
      rubroId: "RB0001",
      nombre: "Ingenieros Gold - 48 meses",
      tier: "Gold",
      quantity: 3,
      unitCost: 85000,
      totalCost: 12240000, // 3 * 85000 * 48
    },
    {
      id: "est_prem002",
      rubroId: "RB0002",
      nombre: "Tech Lead Premium - 48 meses",
      tier: "Premium",
      quantity: 1,
      unitCost: 120000,
      totalCost: 5760000, // 1 * 120000 * 48
    },
    {
      id: "est_gold003",
      rubroId: "RB0003",
      nombre: "Service Manager Gold - 48 meses",
      tier: "Gold",
      quantity: 1,
      unitCost: 95000,
      totalCost: 4560000, // 1 * 95000 * 48
    },
  ];
  
  for (const item of items) {
    const estimatorItem = {
      pk: `PROJECT#${PROJECT_ID}`,
      sk: `ESTIMATOR#${item.id}`,
      id: item.id,
      projectId: PROJECT_ID,
      baselineId: BASELINE_ID,
      rubroId: item.rubroId,
      nombre: item.nombre,
      tier: item.tier,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      period: PERIOD_MONTHS,
      startMonth: START_MONTH,
      committed: true,
      createdAt: new Date().toISOString(),
    };
    
    const status = await putItem(TABLE_PROJECTS, estimatorItem);
    console.log(`  ✓ Estimator item ${status}: ${item.id} - ${item.nombre}`);
  }
}

/**
 * Seed allocations for the first 2 months
 */
async function seedAllocations() {
  console.log(`\n📊 Seeding allocations`);
  
  const allocations = [
    // Month 1 (2025-01)
    { id: "alloc_g1m1", estimatorId: "est_gold001", rubroId: "RB0001", month: "2025-01", amount: 255000, resources: 3 },
    { id: "alloc_p2m1", estimatorId: "est_prem002", rubroId: "RB0002", month: "2025-01", amount: 120000, resources: 1 },
    { id: "alloc_g3m1", estimatorId: "est_gold003", rubroId: "RB0003", month: "2025-01", amount: 95000, resources: 1 },
    
    // Month 2 (2025-02)
    { id: "alloc_g1m2", estimatorId: "est_gold001", rubroId: "RB0001", month: "2025-02", amount: 255000, resources: 3 },
    { id: "alloc_p2m2", estimatorId: "est_prem002", rubroId: "RB0002", month: "2025-02", amount: 120000, resources: 1 },
    { id: "alloc_g3m2", estimatorId: "est_gold003", rubroId: "RB0003", month: "2025-02", amount: 95000, resources: 1 },
  ];
  
  for (const alloc of allocations) {
    const item = {
      pk: `PROJECT#${PROJECT_ID}#MONTH#${alloc.month}`,
      sk: `ALLOC#${alloc.id}`,
      id: alloc.id,
      projectId: PROJECT_ID,
      rubroId: alloc.rubroId,
      estimatorItemId: alloc.estimatorId,
      month: alloc.month,
      amount: alloc.amount,
      resourceCount: alloc.resources,
      source: "estimator",
      status: "committed",
      createdAt: new Date().toISOString(),
    };
    
    const status = await putItem(TABLE_ALLOC, item);
    console.log(`  ✓ Allocation ${status}: ${alloc.month} - ${alloc.rubroId} - $${alloc.amount.toLocaleString()}`);
  }
}

/**
 * Seed payroll actuals for the first 2 months
 */
async function seedPayrollActuals() {
  console.log(`\n💵 Seeding payroll actuals`);
  
  const actuals = [
    // Month 1 (2025-01) - slightly under allocated
    { id: "payroll_g1m1", allocId: "alloc_g1m1", rubroId: "RB0001", month: "2025-01", amount: 247500, resources: 3 },
    { id: "payroll_p2m1", allocId: "alloc_p2m1", rubroId: "RB0002", month: "2025-01", amount: 118000, resources: 1 },
    { id: "payroll_g3m1", allocId: "alloc_g3m1", rubroId: "RB0003", month: "2025-01", amount: 93500, resources: 1 },
    
    // Month 2 (2025-02) - on target
    { id: "payroll_g1m2", allocId: "alloc_g1m2", rubroId: "RB0001", month: "2025-02", amount: 255000, resources: 3 },
    { id: "payroll_p2m2", allocId: "alloc_p2m2", rubroId: "RB0002", month: "2025-02", amount: 120000, resources: 1 },
    { id: "payroll_g3m2", allocId: "alloc_g3m2", rubroId: "RB0003", month: "2025-02", amount: 95000, resources: 1 },
  ];
  
  for (const actual of actuals) {
    const item = {
      pk: `PROJECT#${PROJECT_ID}#MONTH#${actual.month}`,
      sk: `PAYROLL#${actual.id}`,
      id: actual.id,
      projectId: PROJECT_ID,
      allocationId: actual.allocId,
      rubroId: actual.rubroId,
      month: actual.month,
      amount: actual.amount,
      resourceCount: actual.resources,
      source: "SAP_HR",
      uploadedBy: "finance@ikusi.com",
      uploadedAt: new Date().toISOString(),
    };
    
    const status = await putItem(TABLE_PAYROLL, item);
    console.log(`  ✓ Payroll actual ${status}: ${actual.month} - ${actual.rubroId} - $${actual.amount.toLocaleString()}`);
  }
}

/**
 * Seed adjustments
 */
async function seedAdjustments() {
  console.log(`\n⚖️  Seeding adjustments`);
  
  const adjustments = [
    {
      id: "adj_pos001",
      tipo: "exceso",
      monto: 15000,
      month: "2025-03",
      justificacion: "Requerimiento adicional de infraestructura cloud no contemplado inicialmente",
    },
    {
      id: "adj_neg002",
      tipo: "reduccion",
      monto: 8000,
      month: "2025-03",
      justificacion: "Optimización de recursos - un ingeniero con mayor productividad de lo estimado",
    },
  ];
  
  for (const adj of adjustments) {
    const item = {
      pk: `PROJECT#${PROJECT_ID}`,
      sk: `ADJ#${adj.id}`,
      id: adj.id,
      project_id: PROJECT_ID,
      tipo: adj.tipo,
      monto: adj.monto,
      fecha_inicio: adj.month,
      justificacion: adj.justificacion,
      solicitado_por: "pm.lead@ikusi.com",
      estado: "approved",
      aprobado_por: "director@ikusi.com",
      aprobado_en: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    
    const status = await putItem(TABLE_ADJ, item);
    console.log(`  ✓ Adjustment ${status}: ${adj.id} - ${adj.tipo} - $${adj.monto.toLocaleString()}`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🌱 Starting Finanzas Golden Project Seed");
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Project: ${PROJECT_ID}`);
  console.log(`   Baseline: ${BASELINE_ID}`);
  console.log(`   Period: ${PERIOD_MONTHS} months`);
  
  try {
    await seedProject();
    await seedHandoff();
    await seedCatalogRubros();
    await seedProjectRubros();
    await seedEstimatorItems();
    await seedAllocations();
    await seedPayrollActuals();
    await seedAdjustments();
    
    console.log("\n✅ Golden project seed completed successfully!");
    console.log("\n📊 Summary:");
    console.log("   - Project: P-GOLDEN-1 (IA plataforma)");
    console.log("   - Baseline: BL-1763192300497");
    console.log("   - Period: 48 months starting 2025-01");
    console.log("   - Rubros: 3 catalog items attached");
    console.log("   - Estimator: 3 items totaling $22.56M");
    console.log("   - Allocations: 6 records (2 months × 3 rubros)");
    console.log("   - Payroll actuals: 6 records (2 months × 3 rubros)");
    console.log("   - Adjustments: 2 records (1 positive, 1 negative)");
    console.log("\n🔍 Recon Summary for 2025-01:");
    console.log("   - Total Allocated: $470,000");
    console.log("   - Total Actual: $459,000");
    console.log("   - Variance: -$11,000 (-2.34%)");
    console.log("   - Status: Under budget (favorable)");
    
  } catch (error) {
    console.error("\n❌ Error during seed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main as seedGoldenProject };
