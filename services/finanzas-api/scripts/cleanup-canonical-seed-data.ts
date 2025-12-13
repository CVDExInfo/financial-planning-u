#!/usr/bin/env ts-node
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const STAGE = (process.env.STAGE || process.env.ENV || "dev").toLowerCase();
const CONFIRM_CLEANUP = process.env.CONFIRM_CLEANUP;

const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_ALLOCATIONS = process.env.TABLE_ALLOC || "finz_allocations";
const TABLE_PAYROLL = process.env.TABLE_PAYROLL || "finz_payroll_actuals";
const TABLE_ADJUSTMENTS = process.env.TABLE_ADJ || "finz_adjustments";

const PROTECTED_STAGES = new Set(["prod", "production", "stg", "staging", "prd"]);

const CANONICAL_PROJECT_IDS = [
  "P-NOC-CLARO-BOG",
  "P-SOC-BANCOL-MED",
  "P-WIFI-ELDORADO",
  "P-CLOUD-ECOPETROL",
  "P-SD-TIGO-CALI",
  "P-CONNECT-AVIANCA",
  "P-DATACENTER-ETB",
];

const CANONICAL_BASELINE_IDS = [
  "BL-NOC-CLARO-001",
  "BL-SOC-BANCOL-001",
  "BL-WIFI-ELDORADO-001",
  "BL-CLOUD-ECOPETROL-001",
  "BL-SD-TIGO-001",
  "BL-CONNECT-AVIANCA-001",
  "BL-DATACENTER-ETB-001",
];

const ddb = new DynamoDBClient({ region: AWS_REGION });

type Key = { pk: string; sk: string };

function assertSafeEnvironment() {
  if (PROTECTED_STAGES.has(STAGE)) {
    throw new Error(
      `❌ FATAL: Cleanup script cannot run in production/staging environment (STAGE=${STAGE}).`
    );
  }
  if (CONFIRM_CLEANUP !== "YES") {
    throw new Error(
      "❌ REFUSED: Set CONFIRM_CLEANUP=YES to run cleanup. Example: CONFIRM_CLEANUP=YES STAGE=dev AWS_REGION=us-east-2 ts-node scripts/cleanup-canonical-seed-data.ts"
    );
  }
  console.log(`✓ Safety checks passed (stage=${STAGE})`);
}

async function queryAllItems(tableName: string, pk: string): Promise<Key[]> {
  const keys: Key[] = [];
  let startKey: Record<string, any> | undefined;

  do {
    const params: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: marshall({ ":pk": pk }),
      ExclusiveStartKey: startKey,
    };

    const response = await ddb.send(new QueryCommand(params));
    const items = response.Items || [];
    for (const item of items) {
      const { pk: itemPk, sk } = unmarshall(item) as { pk: string; sk: string };
      if (itemPk && sk) keys.push({ pk: itemPk, sk });
    }
    startKey = response.LastEvaluatedKey;
  } while (startKey);

  return keys;
}

async function deleteKeys(tableName: string, keys: Key[]) {
  if (!keys.length) return;

  console.log(`\nDeleting ${keys.length} items from ${tableName}`);
  keys.forEach((key) => console.log(` - ${key.pk} :: ${key.sk}`));

  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: chunk.map((key) => ({ DeleteRequest: { Key: marshall(key) } })),
        },
      })
    );
  }
}

async function cleanupProjects() {
  const allDeletes: { table: string; keys: Key[] }[] = [];

  for (const projectId of CANONICAL_PROJECT_IDS) {
    const partitionKey = `PROJECT#${projectId}`;
    const projectItems = await queryAllItems(TABLE_PROJECTS, partitionKey);
    allDeletes.push({ table: TABLE_PROJECTS, keys: projectItems });

    const allocationItems = await queryAllItems(TABLE_ALLOCATIONS, partitionKey);
    allDeletes.push({ table: TABLE_ALLOCATIONS, keys: allocationItems });

    const payrollItems = await queryAllItems(TABLE_PAYROLL, partitionKey);
    allDeletes.push({ table: TABLE_PAYROLL, keys: payrollItems });

    const adjustmentItems = await queryAllItems(TABLE_ADJUSTMENTS, partitionKey);
    allDeletes.push({ table: TABLE_ADJUSTMENTS, keys: adjustmentItems });
  }

  for (const baselineId of CANONICAL_BASELINE_IDS) {
    const baselineKey = `BASELINE#${baselineId}`;
    const baselineItems = await queryAllItems(TABLE_PROJECTS, baselineKey);
    allDeletes.push({ table: TABLE_PROJECTS, keys: baselineItems });
  }

  for (const entry of allDeletes) {
    await deleteKeys(entry.table, entry.keys);
  }
}

async function main() {
  assertSafeEnvironment();
  console.log("Starting canonical seed cleanup...");
  await cleanupProjects();
  console.log("\n✅ Cleanup completed successfully");
}

main().catch((error) => {
  console.error("Cleanup failed", error);
  process.exit(1);
});
