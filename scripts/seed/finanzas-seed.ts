import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Types -----------------------------------------------------------------------
type SeedMode = "dev" | "test";

type SeedTables = {
  projects: string;
  allocations: string;
  payroll: string;
};

type ParsedProject = {
  project_id: string;
  projectId?: string;
  presupuesto_total?: string | number;
  mod_total?: string | number;
  currency?: string;
  moneda?: string;
  client?: string;
  cliente?: string;
  name?: string;
  nombre?: string;
  status?: string;
  estado?: string;
  start_date?: string;
  fecha_inicio?: string;
  end_date?: string;
  fecha_fin?: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
};

// Helpers ---------------------------------------------------------------------
function resolveMode(argv: string[]): SeedMode {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  if (modeArg) {
    const value = modeArg.split("=")[1];
    if (value === "dev" || value === "test") return value;
  }
  return "dev";
}

function resolveCsvPath(argv: string[]): string {
  const arg = argv.find((item) => item.startsWith("--csv="));
  if (arg) {
    return arg.slice("--csv=".length);
  }
  return process.env.FINZ_PROJECTS_SEED_CSV || path.join("data", "projects_seed.csv");
}

function parseNumber(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const num = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthSequence(start: Date, months: number): { year: number; month: number }[] {
  const sequence: { year: number; month: number }[] = [];
  for (let i = 0; i < months; i += 1) {
    const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    sequence.push({ year: current.getUTCFullYear(), month: current.getUTCMonth() + 1 });
  }
  return sequence;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function batchWrite(table: string, records: Record<string, unknown>[], client: DynamoDBDocumentClient) {
  for (const slice of chunk(records, 25)) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [table]: slice.map((Item) => ({ PutRequest: { Item } })),
        },
      }),
    );
  }
}

function resolveTables(mode: SeedMode): SeedTables {
  const projects =
    (mode === "test" ? process.env.FINZ_PROJECTS_TABLE_TEST : undefined) || process.env.FINZ_PROJECTS_TABLE;
  const allocations =
    (mode === "test" ? process.env.FINZ_ALLOCATIONS_TABLE_TEST : undefined) || process.env.FINZ_ALLOCATIONS_TABLE;
  const payroll =
    (mode === "test" ? process.env.FINZ_PAYROLL_TABLE_TEST : undefined) || process.env.FINZ_PAYROLL_TABLE;

  if (!projects || !allocations || !payroll) {
    const hint =
      mode === "test"
        ? "Set FINZ_PROJECTS_TABLE_TEST, FINZ_ALLOCATIONS_TABLE_TEST, and FINZ_PAYROLL_TABLE_TEST."
        : "Set FINZ_PROJECTS_TABLE, FINZ_ALLOCATIONS_TABLE, and FINZ_PAYROLL_TABLE.";
    throw new Error(`Missing DynamoDB table environment variables. ${hint}`);
  }

  return { projects, allocations, payroll };
}

function loadProjects(csvPath: string): ParsedProject[] {
  if (!existsSync(csvPath)) {
    const example = path.resolve("data/projects_seed.example.csv");
    throw new Error(
      `Seed CSV not found at ${csvPath}. Provide a CSV with project data or copy the example from ${example}.`,
    );
  }

  const content = readFileSync(csvPath, "utf8");
  const records = parse(content, { columns: true, skip_empty_lines: true }) as ParsedProject[];
  return records.filter((row) => row.project_id || row.projectId);
}

function buildSeedRecords(projects: ParsedProject[], months: number) {
  const nowIso = new Date().toISOString();
  const allocations: Record<string, unknown>[] = [];
  const payrolls: Record<string, unknown>[] = [];
  const projectItems: Record<string, unknown>[] = [];

  for (const row of projects) {
    const projectId = row.project_id || row.projectId;
    if (!projectId) continue;

    const pk = `PROJECT#${projectId}`;
    const sk = "METADATA";
    const totalBudget = parseNumber(row.presupuesto_total ?? row.mod_total);
    const currency = row.currency || row.moneda || "USD";
    const client = row.client || row.cliente || "N/A";
    const name = row.name || row.nombre || projectId;
    const status = row.status || row.estado || "active";
    const start = parseDate(row.start_date || row.fecha_inicio) || new Date("2025-01-01T00:00:00Z");
    const end = parseDate(row.end_date || row.fecha_fin) || new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
    const monthly = totalBudget > 0 ? Math.round((totalBudget / months) * 100) / 100 : 0;

    projectItems.push({
      pk,
      sk,
      project_id: projectId,
      client,
      name,
      currency,
      presupuesto_total: totalBudget,
      status,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      description: row.description || "Generated from seed script",
      created_at: row.created_at || nowIso,
      updated_at: row.updated_at || nowIso,
    });

    const calendar = monthSequence(start, months);
    for (const { year, month } of calendar) {
      const lineItemId = "R-BASELINE";
      const padded = String(month).padStart(2, "0");

      allocations.push({
        pk,
        sk: `ALLOCATION#${year}-${padded}#${lineItemId}`,
        project_id: projectId,
        line_item_id: lineItemId,
        year,
        month,
        planned: monthly,
        forecast: monthly,
        baseline: monthly,
        currency,
        source: "seed-script",
        created_at: nowIso,
        updated_at: nowIso,
      });

      const actual = Math.round(monthly * 0.9 * 100) / 100;
      payrolls.push({
        pk,
        sk: `PAYROLL#${year}-${padded}#${lineItemId}`,
        project_id: projectId,
        line_item_id: lineItemId,
        year,
        month,
        actual,
        currency,
        source: "seed-script",
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  }

  return { projectItems, allocations, payrolls };
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = resolveMode(argv);
  const monthsArg = argv.find((item) => item.startsWith("--months="));
  const months = monthsArg ? Number(monthsArg.split("=")[1]) : 12;
  const csvPath = resolveCsvPath(argv);

  const region = process.env.AWS_REGION || "us-east-2";
  const endpoint = process.env.DYNAMO_ENDPOINT;
  const tables = resolveTables(mode);

  console.log(`🌱 Seeding Finanzas data in ${mode.toUpperCase()} mode`);
  console.log(`   Region: ${region}`);
  if (endpoint) {
    console.log(`   Endpoint: ${endpoint}`);
  }
  console.log(`   CSV: ${csvPath}`);
  console.log(`   Months: ${months}`);
  console.log("   Tables:", tables);

  const projects = loadProjects(csvPath);
  const { projectItems, allocations, payrolls } = buildSeedRecords(projects, months);

  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region,
      ...(endpoint ? { endpoint } : {}),
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );

  await batchWrite(tables.projects, projectItems, client);
  await batchWrite(tables.allocations, allocations, client);
  await batchWrite(tables.payroll, payrolls, client);

  console.log("✅ Seeding complete.");
  console.log(`   Projects:    ${projectItems.length}`);
  console.log(`   Allocations: ${allocations.length}`);
  console.log(`   Payroll:     ${payrolls.length}`);
}

main().catch((error) => {
  console.error("❌ Seed failed", error);
  process.exit(1);
});
