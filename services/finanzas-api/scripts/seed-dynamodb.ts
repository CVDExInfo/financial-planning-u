#!/usr/bin/env node
/**
 * DynamoDB Table Diagnostic and Seeding Script
 *
 * Purpose: Check table status, seed initial data for Finanzas SD API
 * Tables: finz_projects, finz_rubros, finz_rubros_taxonomia, finz_allocations,
 *         finz_payroll_actuals, finz_adjustments, finz_alerts, finz_providers, finz_audit_log
 */

import {
  DynamoDBClient,
  DescribeTableCommand,
  ScanCommand,
  PutItemCommand,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const REGION = "us-east-2";
const TABLE_PREFIX = "finz_";

const client = new DynamoDBClient({ region: REGION });

const TABLES = [
  "projects",
  "rubros",
  "rubros_taxonomia",
  "allocations",
  "payroll_actuals",
  "adjustments",
  "alerts",
  "providers",
  "audit_log",
];

interface TableDiagnostic {
  tableName: string;
  exists: boolean;
  itemCount: number;
  status?: string;
  error?: string;
}

async function describeTable(tableName: string): Promise<TableDiagnostic> {
  try {
    const command = new DescribeTableCommand({ TableName: tableName });
    const response = await client.send(command);

    const scanCommand = new ScanCommand({
      TableName: tableName,
      Select: "COUNT",
    });
    const scanResponse = await client.send(scanCommand);

    return {
      tableName,
      exists: true,
      itemCount: scanResponse.Count || 0,
      status: response.Table?.TableStatus,
    };
  } catch (error: any) {
    return {
      tableName,
      exists: false,
      itemCount: 0,
      error: error.message,
    };
  }
}

async function seedProjects() {
  const now = new Date().toISOString();
  const projects = [
    {
      pk: "PROJECT#P-001",
      sk: "METADATA",
      id: "P-001",
      cliente: "IKUSI",
      nombre: "Proyecto Demo 1",
      fecha_inicio: "2025-01-01",
      fecha_fin: "2025-12-31",
      moneda: "USD",
      presupuesto_total: 500000,
      estado: "active",
      created_at: now,
      created_by: "admin",
    },
    {
      pk: "PROJECT#P-002",
      sk: "METADATA",
      id: "P-002",
      cliente: "VELATIA",
      nombre: "Proyecto Demo 2",
      fecha_inicio: "2025-02-01",
      fecha_fin: "2025-11-30",
      moneda: "USD",
      presupuesto_total: 750000,
      estado: "active",
      created_at: now,
      created_by: "admin",
    },
  ];

  console.log("  Seeding projects table...");
  for (const project of projects) {
    const command = new PutItemCommand({
      TableName: `${TABLE_PREFIX}projects`,
      Item: marshall(project),
    });
    await client.send(command);
  }
  console.log(`  ✅ Seeded ${projects.length} projects`);
}

async function seedRubros() {
  const now = new Date().toISOString();

  // Seed from business matrix categories
  const rubros = [
    {
      pk: "RUBRO#MOD",
      sk: "METADATA",
      codigo: "MOD",
      nombre: "Mano de Obra Directa",
      descripcion: "Costos de personal directo asignado al servicio",
      tipo_costo: "OPEX",
      categoria_padre: null,
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "RUBRO#GSV",
      sk: "METADATA",
      codigo: "GSV",
      nombre: "Gestión del Servicio",
      descripcion: "Actividades de gestión operativa y cliente",
      tipo_costo: "OPEX",
      categoria_padre: null,
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "RUBRO#TEC",
      sk: "METADATA",
      codigo: "TEC",
      nombre: "Equipos y Tecnología",
      descripcion: "Hardware, software, licencias",
      tipo_costo: "MIXED",
      categoria_padre: null,
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "RUBRO#INF",
      sk: "METADATA",
      codigo: "INF",
      nombre: "Infraestructura / Nube / Data Center",
      descripcion: "Cloud, hosting, energía, racks",
      tipo_costo: "OPEX",
      categoria_padre: null,
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "RUBRO#TEL",
      sk: "METADATA",
      codigo: "TEL",
      nombre: "Telecomunicaciones",
      descripcion: "Circuitos, UCaaS, planes móviles",
      tipo_costo: "OPEX",
      categoria_padre: null,
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
  ];

  console.log("  Seeding rubros table...");
  for (const rubro of rubros) {
    const command = new PutItemCommand({
      TableName: `${TABLE_PREFIX}rubros`,
      Item: marshall(rubro),
    });
    await client.send(command);
  }
  console.log(`  ✅ Seeded ${rubros.length} rubros`);
}

async function seedRubrosTaxonomia() {
  const now = new Date().toISOString();

  // Seed line items from business matrix
  const lineItems = [
    {
      pk: "TAXONOMIA#MOD",
      sk: "LINE#MOD-ING",
      categoria_codigo: "MOD",
      linea_codigo: "MOD-ING",
      linea_nombre: "Ingenieros de soporte (mensual)",
      descripcion:
        "Costo mensual de ingenieros asignados al servicio según % de asignación.",
      tipo_ejecucion: "mensual",
      tipo_costo: "OPEX",
      fuente_referencia: "Operación pos-puesta en marcha (cliente)",
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "TAXONOMIA#MOD",
      sk: "LINE#MOD-SDM",
      categoria_codigo: "MOD",
      linea_codigo: "MOD-SDM",
      linea_nombre: "Service Delivery Manager (SDM)",
      descripcion: "Gestión operativa, relación con cliente, reportes, SLAs.",
      tipo_ejecucion: "mensual",
      tipo_costo: "OPEX",
      fuente_referencia: "Modelo Service Delivery",
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "TAXONOMIA#TEC",
      sk: "LINE#TEC-LIC-MON",
      categoria_codigo: "TEC",
      linea_codigo: "TEC-LIC-MON",
      linea_nombre: "Licencias de monitoreo/observabilidad",
      descripcion: "Herramientas NMS/APM/Logs.",
      tipo_ejecucion: "mensual",
      tipo_costo: "OPEX",
      fuente_referencia: "Observabilidad/Ikusi servicios",
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "TAXONOMIA#INF",
      sk: "LINE#INF-CLOUD",
      categoria_codigo: "INF",
      linea_codigo: "INF-CLOUD",
      linea_nombre: "Servicios Cloud / hosting",
      descripcion: "SaaS/IaaS/PaaS asociados al servicio.",
      tipo_ejecucion: "mensual",
      tipo_costo: "OPEX",
      fuente_referencia: "Cloud OPEX",
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "TAXONOMIA#TEL",
      sk: "LINE#TEL-CCTS",
      categoria_codigo: "TEL",
      linea_codigo: "TEL-CCTS",
      linea_nombre: "Circuitos y enlaces",
      descripcion: "MPLS/Internet/SD-WAN.",
      tipo_ejecucion: "mensual",
      tipo_costo: "OPEX",
      fuente_referencia: "TEM / Ikusi service providers",
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
  ];

  console.log("  Seeding rubros_taxonomia table...");
  for (const item of lineItems) {
    const command = new PutItemCommand({
      TableName: `${TABLE_PREFIX}rubros_taxonomia`,
      Item: marshall(item),
    });
    await client.send(command);
  }
  console.log(`  ✅ Seeded ${lineItems.length} line items`);
}

async function seedAllocations() {
  const now = new Date().toISOString();

  const allocations = [
    {
      pk: "PROJECT#P-001",
      sk: "ALLOC#2025-01",
      project_id: "P-001",
      month: "2025-01",
      rubro_codigo: "MOD",
      linea_codigo: "MOD-SDM",
      monto_asignado: 8000,
      moneda: "USD",
      tipo: "mensual",
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "PROJECT#P-001",
      sk: "ALLOC#2025-02",
      project_id: "P-001",
      month: "2025-02",
      rubro_codigo: "TEC",
      linea_codigo: "TEC-LIC-MON",
      monto_asignado: 1500,
      moneda: "USD",
      tipo: "mensual",
      created_at: now,
      created_by: "system:seed",
    },
  ];

  console.log("  Seeding allocations table...");
  for (const alloc of allocations) {
    const command = new PutItemCommand({
      TableName: `${TABLE_PREFIX}allocations`,
      Item: marshall(alloc),
    });
    await client.send(command);
  }
  console.log(`  ✅ Seeded ${allocations.length} allocations`);
}

async function seedProviders() {
  const now = new Date().toISOString();

  const providers = [
    {
      pk: "PROVIDER#PRV-001",
      sk: "METADATA",
      id: "PRV-001",
      nombre: "AWS",
      tipo: "Cloud Provider",
      contacto_email: "support@aws.amazon.com",
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
    {
      pk: "PROVIDER#PRV-002",
      sk: "METADATA",
      id: "PRV-002",
      nombre: "Microsoft",
      tipo: "Software Vendor",
      contacto_email: "support@microsoft.com",
      activo: true,
      created_at: now,
      created_by: "system:seed",
    },
  ];

  console.log("  Seeding providers table...");
  for (const provider of providers) {
    const command = new PutItemCommand({
      TableName: `${TABLE_PREFIX}providers`,
      Item: marshall(provider),
    });
    await client.send(command);
  }
  console.log(`  ✅ Seeded ${providers.length} providers`);
}

async function main() {
  console.log("🔍 DynamoDB Table Diagnostic & Seeding Tool\n");
  console.log("Region:", REGION);
  console.log("Table Prefix:", TABLE_PREFIX);
  console.log("=".repeat(80) + "\n");

  // Step 1: Diagnose all tables
  console.log("📊 Step 1: Diagnosing tables...\n");
  const diagnostics: TableDiagnostic[] = [];

  for (const table of TABLES) {
    const fullName = `${TABLE_PREFIX}${table}`;
    process.stdout.write(`  Checking ${fullName}... `);
    const diag = await describeTable(fullName);
    diagnostics.push(diag);

    if (diag.exists) {
      console.log(`✅ EXISTS (${diag.itemCount} items, ${diag.status})`);
    } else {
      console.log(`❌ NOT FOUND: ${diag.error}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("📋 Summary:\n");

  const existingTables = diagnostics.filter((d) => d.exists);
  const emptyTables = existingTables.filter((d) => d.itemCount === 0);

  console.log(`  Total tables: ${TABLES.length}`);
  console.log(`  Existing: ${existingTables.length}`);
  console.log(`  Empty: ${emptyTables.length}`);
  console.log(`  Missing: ${diagnostics.filter((d) => !d.exists).length}`);

  if (emptyTables.length > 0) {
    console.log("\n⚠️  Empty tables detected:");
    emptyTables.forEach((t) => console.log(`    - ${t.tableName}`));
  }

  // Step 2: Seed data
  console.log("\n" + "=".repeat(80));
  console.log("🌱 Step 2: Seeding data...\n");

  try {
    await seedProjects();
    await seedRubros();
    await seedRubrosTaxonomia();
    await seedAllocations();
    await seedProviders();

    console.log("\n✅ Seeding complete!");
  } catch (error: any) {
    console.error("\n❌ Seeding failed:", error.message);
    process.exit(1);
  }

  // Step 3: Verify seeding
  console.log("\n" + "=".repeat(80));
  console.log("🔍 Step 3: Verifying seeded data...\n");

  const verifyTables = [
    "projects",
    "rubros",
    "rubros_taxonomia",
    "allocations",
    "providers",
  ];
  for (const table of verifyTables) {
    const fullName = `${TABLE_PREFIX}${table}`;
    const scanCommand = new ScanCommand({
      TableName: fullName,
      Select: "COUNT",
    });
    const response = await client.send(scanCommand);
    console.log(`  ${fullName}: ${response.Count} items`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ All operations complete!\n");
  console.log("Next steps:");
  console.log(
    "  1. Test API endpoint: GET https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/projects"
  );
  console.log("  2. Check frontend: https://d7t9x3j66yd8k.cloudfront.net/");
  console.log("  3. Navigate to SDMT → Cost Catalog and verify data loads");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
