/**
 * Migration Script: Fix Baseline Collision in Projects
 * 
 * This script identifies and fixes projects where multiple different baselines
 * have been incorrectly assigned to the same projectId, causing METADATA overwriting.
 * 
 * Problem:
 * - In production, multiple handoffs with different baselines ended up under the same
 *   PROJECT#<projectId> with only one METADATA row
 * - This causes only the last baseline to appear in SDMT Portfolio UI
 * 
 * Solution:
 * - Scan for projects with HANDOFF records that have different baselines than METADATA
 * - Create new projects for mismatched handoffs
 * - Move handoff records to correct projects
 * - Update idempotency records to point to new projects
 * 
 * Usage:
 *   DRY_RUN=true ts-node scripts/migrate-handoff-baseline-projects.ts  # Test run
 *   DRY_RUN=false ts-node scripts/migrate-handoff-baseline-projects.ts # Execute migration
 */

import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import crypto from "node:crypto";

// Configuration
const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const PROJECTS_TABLE = process.env.TABLE_PROJECTS || "finz_projects";
const DRY_RUN = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

interface ProjectMetadata {
  pk: string;
  sk: string;
  baseline_id?: string;
  baselineId?: string;
  name?: string;
  client?: string;
  [key: string]: unknown;
}

interface HandoffRecord {
  pk: string;
  sk: string;
  handoffId: string;
  projectId: string;
  baselineId?: string;
  baseline_id?: string;
  [key: string]: unknown;
}

interface IdempotencyRecord {
  pk: string;
  sk: string;
  result?: {
    projectId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function normalizeBaselineId(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;
  return (obj.baseline_id as string) || (obj.baselineId as string) || null;
}

/**
 * Scan all projects to find METADATA records
 */
async function scanProjectMetadata(): Promise<ProjectMetadata[]> {
  console.log("[scan] Scanning for project METADATA records...");
  const projects: ProjectMetadata[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: PROJECTS_TABLE,
        FilterExpression: "begins_with(pk, :prefix) AND sk = :metadata",
        ExpressionAttributeValues: {
          ":prefix": "PROJECT#",
          ":metadata": "METADATA",
        },
        ExclusiveStartKey: lastKey,
      })
    );

    if (result.Items) {
      projects.push(...(result.Items as ProjectMetadata[]));
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`[scan] Found ${projects.length} project METADATA records`);
  return projects;
}

/**
 * Get all handoff records for a specific project
 */
async function getProjectHandoffs(projectId: string): Promise<HandoffRecord[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: PROJECTS_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
        ":sk": "HANDOFF#",
      },
    })
  );

  return (result.Items || []) as HandoffRecord[];
}

/**
 * Find idempotency records that reference a specific projectId
 */
async function findIdempotencyRecordsForProject(
  projectId: string
): Promise<IdempotencyRecord[]> {
  const records: IdempotencyRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: PROJECTS_TABLE,
        FilterExpression: "pk = :pk AND attribute_exists(#result.#projectId)",
        ExpressionAttributeNames: {
          "#result": "result",
          "#projectId": "projectId",
        },
        ExpressionAttributeValues: {
          ":pk": "IDEMPOTENCY#HANDOFF",
        },
        ExclusiveStartKey: lastKey,
      })
    );

    if (result.Items) {
      const filtered = result.Items.filter((item) => {
        const rec = item as IdempotencyRecord;
        return rec.result?.projectId === projectId;
      });
      records.push(...(filtered as IdempotencyRecord[]));
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return records;
}

interface MigrationPlan {
  projectId: string;
  metadataBaselineId: string | null;
  conflictingHandoffs: Array<{
    handoff: HandoffRecord;
    handoffBaselineId: string;
    newProjectId: string;
  }>;
}

/**
 * Analyze projects to find baseline conflicts
 */
async function analyzePollutedProjects(
  projects: ProjectMetadata[]
): Promise<MigrationPlan[]> {
  console.log("\n[analyze] Analyzing projects for baseline conflicts...");
  const plans: MigrationPlan[] = [];

  for (const project of projects) {
    const projectId = project.pk.replace("PROJECT#", "");
    const metadataBaselineId = normalizeBaselineId(project);

    // Get all handoffs for this project
    const handoffs = await getProjectHandoffs(projectId);

    if (handoffs.length === 0) {
      continue; // No handoffs, skip
    }

    // Find handoffs with different baselines
    const conflicting: MigrationPlan["conflictingHandoffs"] = [];

    for (const handoff of handoffs) {
      const handoffBaselineId = normalizeBaselineId(handoff);

      if (!handoffBaselineId) {
        console.warn(`[analyze] Handoff ${handoff.handoffId} has no baseline, skipping`);
        continue;
      }

      // Check if this handoff's baseline differs from project METADATA baseline
      if (metadataBaselineId && handoffBaselineId !== metadataBaselineId) {
        const newProjectId = `P-${crypto.randomUUID()}`;
        conflicting.push({
          handoff,
          handoffBaselineId,
          newProjectId,
        });
      }
    }

    if (conflicting.length > 0) {
      plans.push({
        projectId,
        metadataBaselineId,
        conflictingHandoffs: conflicting,
      });
    }
  }

  console.log(`[analyze] Found ${plans.length} projects with baseline conflicts`);
  return plans;
}

/**
 * Execute migration for a single project
 */
async function migrateProject(plan: MigrationPlan): Promise<void> {
  console.log(
    `\n[migrate] Processing project ${plan.projectId} (METADATA baseline: ${plan.metadataBaselineId})`
  );

  for (const conflict of plan.conflictingHandoffs) {
    const { handoff, handoffBaselineId, newProjectId } = conflict;

    console.log(
      `  [migrate] Moving handoff ${handoff.handoffId} (baseline: ${handoffBaselineId}) to new project ${newProjectId}`
    );

    if (DRY_RUN) {
      console.log("    [DRY RUN] Would create new project METADATA");
      console.log("    [DRY RUN] Would move handoff record");
      console.log("    [DRY RUN] Would update idempotency records");
      continue;
    }

    // 1. Create new project METADATA for this baseline
    const newMetadata = {
      pk: `PROJECT#${newProjectId}`,
      sk: "METADATA",
      id: newProjectId,
      project_id: newProjectId,
      projectId: newProjectId,
      baseline_id: handoffBaselineId,
      baselineId: handoffBaselineId,
      baseline_status: "handed_off",
      status: "active",
      estado: "active",
      module: "SDMT",
      source: "prefactura",
      // Copy relevant fields from handoff
      name: (handoff.fields?.project_name ?? handoff.fields?.projectName ?? `Migrated Project ${newProjectId}`),
      nombre: (handoff.fields?.project_name ?? handoff.fields?.projectName ?? `Migrated Project ${newProjectId}`),
      client: (handoff.fields?.client_name ?? handoff.fields?.clientName ?? handoff.fields?.client ?? ""),
      cliente: (handoff.fields?.client_name ?? handoff.fields?.clientName ?? handoff.fields?.client ?? ""),
      currency: handoff.fields?.currency || "USD",
      moneda: handoff.fields?.currency || "USD",
      created_at: handoff.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: handoff.createdBy || "migration-script",
      handed_off_at: handoff.createdAt || new Date().toISOString(),
      handed_off_by: handoff.owner || "migration-script",
      // Add migration marker
      migrated_from_project: plan.projectId,
      migration_timestamp: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: PROJECTS_TABLE,
        Item: newMetadata,
      })
    );

    console.log(`    ✓ Created new project METADATA for ${newProjectId}`);

    // 2. Create new handoff record under new project
    const newHandoff = {
      ...handoff,
      pk: `PROJECT#${newProjectId}`,
      projectId: newProjectId,
      migrated_from_project: plan.projectId,
      migration_timestamp: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: PROJECTS_TABLE,
        Item: newHandoff,
      })
    );

    console.log(`    ✓ Created handoff record for ${newProjectId}`);

    // 3. Find and update idempotency records that reference the old projectId and this baseline
    const idempotencyRecords = await findIdempotencyRecordsForProject(plan.projectId);

    for (const idempRec of idempotencyRecords) {
      // Check if this idempotency record's result baseline matches our handoff baseline
      const idempBaselineId = (idempRec.result as any)?.baselineId as string | undefined;

      if (idempBaselineId === handoffBaselineId) {
        console.log(`    [migrate] Updating idempotency record ${idempRec.sk}`);

        await ddb.send(
          new UpdateCommand({
            TableName: PROJECTS_TABLE,
            Key: {
              pk: idempRec.pk,
              sk: idempRec.sk,
            },
            UpdateExpression: "SET #result.#projectId = :newProjectId, #migrated = :migrated",
            ExpressionAttributeNames: {
              "#result": "result",
              "#projectId": "projectId",
              "#migrated": "migration_updated",
            },
            ExpressionAttributeValues: {
              ":newProjectId": newProjectId,
              ":migrated": new Date().toISOString(),
            },
          })
        );

        console.log(`      ✓ Updated idempotency record ${idempRec.sk}`);
      }
    }
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log("=".repeat(80));
  console.log("Baseline Collision Migration Script");
  console.log("=".repeat(80));
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE EXECUTION"}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log(`Table: ${PROJECTS_TABLE}`);
  console.log("");

  try {
    // 1. Scan all projects
    const projects = await scanProjectMetadata();

    // 2. Analyze for conflicts
    const plans = await analyzePollutedProjects(projects);

    if (plans.length === 0) {
      console.log("\n✓ No baseline conflicts found. All projects are clean!");
      return;
    }

    // 3. Display migration plan
    console.log("\n" + "=".repeat(80));
    console.log("MIGRATION PLAN");
    console.log("=".repeat(80));

    for (const plan of plans) {
      console.log(`\nProject: ${plan.projectId}`);
      console.log(`  METADATA Baseline: ${plan.metadataBaselineId}`);
      console.log(`  Conflicting Handoffs: ${plan.conflictingHandoffs.length}`);

      for (const conflict of plan.conflictingHandoffs) {
        console.log(`    - ${conflict.handoff.handoffId}`);
        console.log(`      Baseline: ${conflict.handoffBaselineId}`);
        console.log(`      New Project: ${conflict.newProjectId}`);
      }
    }

    // 4. Execute migration
    if (DRY_RUN) {
      console.log("\n" + "=".repeat(80));
      console.log("DRY RUN MODE - No changes will be made");
      console.log("To execute migration, run with DRY_RUN=false");
      console.log("=".repeat(80));
    } else {
      console.log("\n" + "=".repeat(80));
      console.log("EXECUTING MIGRATION");
      console.log("=".repeat(80));

      for (const plan of plans) {
        await migrateProject(plan);
      }

      console.log("\n" + "=".repeat(80));
      console.log("MIGRATION COMPLETE");
      console.log("=".repeat(80));
      console.log(`✓ Migrated ${plans.length} projects`);
      console.log(
        `✓ Created ${plans.reduce((sum, p) => sum + p.conflictingHandoffs.length, 0)} new projects`
      );
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
main().catch(console.error);
