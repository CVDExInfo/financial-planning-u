#!/usr/bin/env ts-node
/**
 * Migration Script: Separate Projects by Baseline
 *
 * This script fixes the baseline collision problem where multiple baselines
 * ended up under the same PROJECT# with only one METADATA row.
 *
 * What it does:
 * 1. Scans finz_projects for any PROJECT#... that has:
 *    - One METADATA record with a baseline_id
 *    - Multiple HANDOFF# records with DIFFERENT baseline_ids
 * 2. For each mismatched handoff:
 *    - Creates a NEW project ID
 *    - Creates a NEW METADATA record for that baseline
 *    - Moves the handoff record to the new project
 *    - Updates any IDEMPOTENCY#HANDOFF records
 *
 * Usage:
 *   # Dry run (no changes):
 *   npm run migrate:handoff-baselines -- --dry-run
 *
 *   # Actually migrate:
 *   npm run migrate:handoff-baselines
 *
 *   # Migrate specific stage:
 *   npm run migrate:handoff-baselines -- --stage prod
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";

// Configuration
const STAGE = process.env.STAGE || process.argv.find(arg => arg.startsWith("--stage="))?.split("=")[1] || "dev";
const DRY_RUN = process.argv.includes("--dry-run");
const TABLE_NAME = process.env.TABLE_PROJECTS || `finz_projects_${STAGE}`;
const MAX_SCAN_ITERATIONS = parseInt(process.env.MAX_SCAN_ITERATIONS || "1000", 10);

interface ProjectMetadata {
  pk: string;
  sk: string;
  baseline_id?: string;
  baselineId?: string;
  name?: string;
  nombre?: string;
  client?: string;
  cliente?: string;
  [key: string]: unknown;
}

interface HandoffRecord {
  pk: string;
  sk: string;
  handoffId?: string;
  projectId?: string;
  baselineId?: string;
  baseline_id?: string;
  [key: string]: unknown;
}

export interface MigrationResult {
  projectsScanned: number;
  projectsWithMultipleBaselines: number;
  handoffsMigrated: number;
  newProjectsCreated: number;
  idempotencyRecordsUpdated: number;
  errors: string[];
}

export interface MigrationContext {
  ddb: DynamoDBDocumentClient;
  tableName: string;
  dryRun: boolean;
}

const defaultClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-2" });
const defaultDdb = DynamoDBDocumentClient.from(defaultClient);

const defaultContext: MigrationContext = {
  ddb: defaultDdb,
  tableName: TABLE_NAME,
  dryRun: DRY_RUN,
};

function logBanner() {
  console.log("=".repeat(80));
  console.log("Handoff Baseline Migration Script");
  console.log("=".repeat(80));
  console.log(`Stage: ${STAGE}`);
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Dry Run: ${DRY_RUN ? "YES (no changes will be made)" : "NO (will modify data)"}`);
  console.log("=".repeat(80));
  console.log("");
}

export function normalizeBaselineId(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;
  return (obj.baseline_id as string) || (obj.baselineId as string) || null;
}

export async function scanProjectsForCollisions(
  context: MigrationContext
): Promise<{
  collisionProjects: Map<string, { metadata: ProjectMetadata; handoffs: HandoffRecord[] }>;
  totalProjects: number;
}> {
  const { ddb, tableName } = context;
  const projectsMap = new Map<string, { metadata: ProjectMetadata; handoffs: HandoffRecord[] }>();

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let iterations = 0;

  console.log("Scanning projects table for baseline collisions...");

  do {
    const scanResult = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(pk, :pkPrefix)",
        ExpressionAttributeValues: {
          ":pkPrefix": "PROJECT#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = scanResult.Items || [];

    for (const item of items) {
      const pk = item.pk as string;
      const sk = item.sk as string;

      if (!pk || !sk) continue;

      if (sk === "METADATA") {
        if (!projectsMap.has(pk)) {
          projectsMap.set(pk, { metadata: item as ProjectMetadata, handoffs: [] });
        } else {
          projectsMap.get(pk)!.metadata = item as ProjectMetadata;
        }
      } else if (sk.startsWith("HANDOFF#")) {
        if (!projectsMap.has(pk)) {
          projectsMap.set(pk, { metadata: {} as ProjectMetadata, handoffs: [] });
        }
        projectsMap.get(pk)!.handoffs.push(item as HandoffRecord);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
    iterations++;

    if (iterations >= MAX_SCAN_ITERATIONS) {
      console.warn(`Reached max scan iterations (${MAX_SCAN_ITERATIONS})`);
      break;
    }
  } while (lastEvaluatedKey);

  const collisionProjects = new Map<string, { metadata: ProjectMetadata; handoffs: HandoffRecord[] }>();
  const projectsWithMetadata = Array.from(projectsMap.entries()).filter(([, data]) => data.metadata.pk);

  for (const [pk, data] of projectsMap.entries()) {
    if (!data.metadata.pk || data.handoffs.length === 0) continue;

    const metadataBaselineId = normalizeBaselineId(data.metadata);
    if (!metadataBaselineId) continue;

    const mismatchedHandoffs = data.handoffs.filter(handoff => {
      const handoffBaselineId = normalizeBaselineId(handoff);
      return handoffBaselineId && handoffBaselineId !== metadataBaselineId;
    });

    if (mismatchedHandoffs.length > 0) {
      collisionProjects.set(pk, data);
    }
  }

  return { collisionProjects, totalProjects: projectsWithMetadata.length };
}

async function migrateHandoff(
  context: MigrationContext,
  oldProjectPk: string,
  handoff: HandoffRecord,
  metadataTemplate: ProjectMetadata
): Promise<{ newProjectId: string; newProjectPk: string }> {
  const { ddb, tableName, dryRun } = context;
  const newProjectId = `P-${crypto.randomUUID()}`;
  const newProjectPk = `PROJECT#${newProjectId}`;
  const handoffBaselineId = normalizeBaselineId(handoff);

  console.log(`  Migrating ${handoff.sk} (baseline: ${handoffBaselineId})`);
  console.log(`    Old project: ${oldProjectPk}`);
  console.log(`    New project: ${newProjectPk}`);

  const timestamp = new Date().toISOString();

  const newMetadata: ProjectMetadata = {
    ...metadataTemplate,
    pk: newProjectPk,
    sk: "METADATA",
    id: newProjectId,
    project_id: newProjectId,
    projectId: newProjectId,
    baseline_id: handoffBaselineId!,
    baselineId: handoffBaselineId!,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const newHandoff: HandoffRecord = {
    ...handoff,
    pk: newProjectPk,
    projectId: newProjectId,
  };

  if (!dryRun) {
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: newMetadata,
      })
    );

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: newHandoff,
      })
    );

    await ddb.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          pk: handoff.pk,
          sk: handoff.sk,
        },
      })
    );

    console.log(`    ✓ Created new project METADATA`);
    console.log(`    ✓ Moved handoff record`);
  } else {
    console.log(`    [DRY RUN] Would create new project METADATA`);
    console.log(`    [DRY RUN] Would move handoff record`);
  }

  return { newProjectId, newProjectPk };
}

async function updateIdempotencyRecords(
  context: MigrationContext,
  oldProjectId: string,
  newProjectId: string,
  baselineId: string
): Promise<number> {
  const { ddb, tableName, dryRun } = context;
  let updated = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const scanResult = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": "IDEMPOTENCY#HANDOFF",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = scanResult.Items || [];

    for (const item of items) {
      const result = item.result as Record<string, unknown> | undefined;
      if (!result) continue;

      const resultProjectId = result.projectId as string | undefined;
      const resultBaselineId = (result.baselineId as string | undefined) || undefined;

      if (resultProjectId === oldProjectId && resultBaselineId === baselineId) {
        const sk = item.sk as string | undefined;

        if (!dryRun && sk) {
          await ddb.send(
            new UpdateCommand({
              TableName: tableName,
              Key: {
                pk: "IDEMPOTENCY#HANDOFF",
                sk,
              },
              UpdateExpression: "SET #result.#projectId = :newProjectId",
              ExpressionAttributeNames: {
                "#result": "result",
                "#projectId": "projectId",
              },
              ExpressionAttributeValues: {
                ":newProjectId": newProjectId,
              },
            })
          );

          console.log(`    ✓ Updated idempotency record: ${sk}`);
        } else {
          console.log(`    [DRY RUN] Would update idempotency record: ${sk}`);
        }

        updated++;
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return updated;
}

export async function runMigration(context: MigrationContext = defaultContext): Promise<MigrationResult> {
  const result: MigrationResult = {
    projectsScanned: 0,
    projectsWithMultipleBaselines: 0,
    handoffsMigrated: 0,
    newProjectsCreated: 0,
    idempotencyRecordsUpdated: 0,
    errors: [],
  };

  const { collisionProjects, totalProjects } = await scanProjectsForCollisions(context);
  result.projectsScanned = totalProjects;
  result.projectsWithMultipleBaselines = collisionProjects.size;

  if (collisionProjects.size === 0) {
    console.log("✓ No baseline collisions found. No migration needed.");
    return result;
  }

  for (const [oldProjectPk, data] of collisionProjects.entries()) {
    const oldProjectId = oldProjectPk.replace("PROJECT#", "");
    const metadataBaselineId = normalizeBaselineId(data.metadata);

    console.log(`Migrating project ${oldProjectPk}:`);

    const mismatchedHandoffs = data.handoffs.filter(handoff => {
      const handoffBaselineId = normalizeBaselineId(handoff);
      return handoffBaselineId && handoffBaselineId !== metadataBaselineId;
    });

    for (const handoff of mismatchedHandoffs) {
      try {
        const { newProjectId } = await migrateHandoff(context, oldProjectPk, handoff, data.metadata);

        result.newProjectsCreated++;
        result.handoffsMigrated++;

        const handoffBaselineId = normalizeBaselineId(handoff);
        if (handoffBaselineId) {
          const idempUpdated = await updateIdempotencyRecords(
            context,
            oldProjectId,
            newProjectId,
            handoffBaselineId
          );
          result.idempotencyRecordsUpdated += idempUpdated;
        }
      } catch (error) {
        const errorMsg = `Failed to migrate ${handoff.sk}: ${error}`;
        console.error(`  ✗ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log("");
  }

  console.log("=".repeat(80));
  console.log("Migration Summary");
  console.log("=".repeat(80));
  console.log(`Projects scanned: ${result.projectsScanned}`);
  console.log(`Projects with collisions: ${result.projectsWithMultipleBaselines}`);
  console.log(`New projects created: ${result.newProjectsCreated}`);
  console.log(`Handoffs migrated: ${result.handoffsMigrated}`);
  console.log(`Idempotency records updated: ${result.idempotencyRecordsUpdated}`);
  console.log(`Errors: ${result.errors.length}`);

  if (context.dryRun) {
    console.log("\n⚠️  DRY RUN MODE - No changes were made to the database.");
    console.log("Run without --dry-run to apply changes.");
  } else {
    console.log("\n✓ Migration complete!");
  }

  return result;
}

const isDirectRun = Boolean(process.argv[1]?.includes("migrate-handoff-baseline-projects"));

if (isDirectRun) {
  logBanner();
  runMigration(defaultContext).catch(error => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
}
