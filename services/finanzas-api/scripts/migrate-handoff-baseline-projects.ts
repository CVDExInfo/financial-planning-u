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

import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";

// Configuration
const STAGE = process.env.STAGE || process.argv.find(arg => arg.startsWith("--stage="))?.split("=")[1] || "dev";
const DRY_RUN = process.argv.includes("--dry-run");
const TABLE_NAME = process.env.TABLE_PROJECTS || `finz_projects_${STAGE}`;

console.log("=".repeat(80));
console.log("Handoff Baseline Migration Script");
console.log("=".repeat(80));
console.log(`Stage: ${STAGE}`);
console.log(`Table: ${TABLE_NAME}`);
console.log(`Dry Run: ${DRY_RUN ? "YES (no changes will be made)" : "NO (will modify data)"}`);
console.log("=".repeat(80));
console.log("");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-2" });
const ddb = DynamoDBDocumentClient.from(client);

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
  handoffId: string;
  projectId: string;
  baselineId?: string;
  baseline_id?: string;
  [key: string]: unknown;
}

interface MigrationResult {
  projectsScanned: number;
  projectsWithMultipleBaselines: number;
  handoffsMigrated: number;
  newProjectsCreated: number;
  idempotencyRecordsUpdated: number;
  errors: string[];
}

const result: MigrationResult = {
  projectsScanned: 0,
  projectsWithMultipleBaselines: 0,
  handoffsMigrated: 0,
  newProjectsCreated: 0,
  idempotencyRecordsUpdated: 0,
  errors: [],
};

/**
 * Normalize baseline ID from either snake_case or camelCase
 */
function normalizeBaselineId(obj: Record<string, unknown>): string | null {
  return (obj.baseline_id as string) || (obj.baselineId as string) || null;
}

/**
 * Scan all projects and find those with baseline collisions
 */
async function scanProjectsForCollisions(): Promise<Map<string, { metadata: ProjectMetadata; handoffs: HandoffRecord[] }>> {
  const projectsMap = new Map<string, { metadata: ProjectMetadata; handoffs: HandoffRecord[] }>();
  
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  console.log("Scanning projects table for baseline collisions...");

  do {
    const scanResult = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(pk, :pkPrefix)",
        ExpressionAttributeValues: {
          ":pkPrefix": { S: "PROJECT#" },
        },
        ExclusiveStartKey: lastEvaluatedKey as any,
      })
    );

    const items = scanResult.Items || [];
    
    for (const item of items) {
      const pk = item.pk?.S || "";
      const sk = item.sk?.S || "";

      if (!pk || !sk) continue;

      // Convert DynamoDB item to plain object
      const plainItem: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(item)) {
        if (value.S) plainItem[key] = value.S;
        else if (value.N) plainItem[key] = Number(value.N);
        else if (value.BOOL) plainItem[key] = value.BOOL;
        else if (value.M) plainItem[key] = value.M;
        else plainItem[key] = value;
      }

      if (sk === "METADATA") {
        // This is project metadata
        if (!projectsMap.has(pk)) {
          projectsMap.set(pk, { metadata: plainItem as ProjectMetadata, handoffs: [] });
        } else {
          projectsMap.get(pk)!.metadata = plainItem as ProjectMetadata;
        }
        result.projectsScanned++;
      } else if (sk.startsWith("HANDOFF#")) {
        // This is a handoff record
        if (!projectsMap.has(pk)) {
          projectsMap.set(pk, { metadata: {} as ProjectMetadata, handoffs: [] });
        }
        projectsMap.get(pk)!.handoffs.push(plainItem as HandoffRecord);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
    iterations++;

    if (iterations >= MAX_ITERATIONS) {
      console.warn(`Reached max scan iterations (${MAX_ITERATIONS})`);
      break;
    }

    if (lastEvaluatedKey) {
      console.log(`  Scanned ${items.length} items, continuing...`);
    }
  } while (lastEvaluatedKey);

  console.log(`Scan complete. Found ${result.projectsScanned} projects.\n`);

  // Filter to only projects with baseline collisions
  const collisionProjects = new Map<string, { metadata: ProjectMetadata; handoffs: HandoffRecord[] }>();
  
  for (const [pk, data] of projectsMap.entries()) {
    if (!data.metadata.pk || data.handoffs.length === 0) continue;

    const metadataBaselineId = normalizeBaselineId(data.metadata);
    if (!metadataBaselineId) continue;

    // Check if any handoff has a different baseline
    const mismatchedHandoffs = data.handoffs.filter(handoff => {
      const handoffBaselineId = normalizeBaselineId(handoff);
      return handoffBaselineId && handoffBaselineId !== metadataBaselineId;
    });

    if (mismatchedHandoffs.length > 0) {
      collisionProjects.set(pk, data);
      result.projectsWithMultipleBaselines++;
      
      console.log(`Found collision in ${pk}:`);
      console.log(`  METADATA baseline: ${metadataBaselineId}`);
      console.log(`  Total handoffs: ${data.handoffs.length}`);
      console.log(`  Mismatched handoffs: ${mismatchedHandoffs.length}`);
      mismatchedHandoffs.forEach(h => {
        console.log(`    - ${h.sk}: ${normalizeBaselineId(h)}`);
      });
      console.log("");
    }
  }

  return collisionProjects;
}

/**
 * Migrate a single handoff to a new project
 */
async function migrateHandoff(
  oldProjectPk: string,
  handoff: HandoffRecord,
  metadataTemplate: ProjectMetadata
): Promise<{ newProjectId: string; newProjectPk: string }> {
  const newProjectId = `P-${crypto.randomUUID()}`;
  const newProjectPk = `PROJECT#${newProjectId}`;
  const handoffBaselineId = normalizeBaselineId(handoff);

  console.log(`  Migrating ${handoff.sk} (baseline: ${handoffBaselineId})`);
  console.log(`    Old project: ${oldProjectPk}`);
  console.log(`    New project: ${newProjectPk}`);

  // Create new METADATA for the new project
  const newMetadata: ProjectMetadata = {
    ...metadataTemplate,
    pk: newProjectPk,
    sk: "METADATA",
    id: newProjectId,
    project_id: newProjectId,
    projectId: newProjectId,
    baseline_id: handoffBaselineId!,
    baselineId: handoffBaselineId!,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Create new handoff record under new project
  const newHandoff: HandoffRecord = {
    ...handoff,
    pk: newProjectPk,
    projectId: newProjectId,
  };

  if (!DRY_RUN) {
    // Write new METADATA
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: newMetadata,
      })
    );

    // Write new handoff record
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: newHandoff,
      })
    );

    // Delete old handoff record
    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
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

  result.newProjectsCreated++;
  result.handoffsMigrated++;

  return { newProjectId, newProjectPk };
}

/**
 * Update idempotency records that reference the old project
 */
async function updateIdempotencyRecords(
  oldProjectId: string,
  newProjectId: string,
  baselineId: string
): Promise<number> {
  let updated = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const scanResult = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": { S: "IDEMPOTENCY#HANDOFF" },
        },
        ExclusiveStartKey: lastEvaluatedKey as any,
      })
    );

    const items = scanResult.Items || [];

    for (const item of items) {
      const result = item.result?.M;
      if (!result) continue;

      const resultProjectId = result.projectId?.S;
      const resultBaselineId = result.baselineId?.S;

      if (resultProjectId === oldProjectId && resultBaselineId === baselineId) {
        // This idempotency record needs to be updated
        const sk = item.sk?.S;
        
        if (!DRY_RUN && sk) {
          await ddb.send(
            new UpdateItemCommand({
              TableName: TABLE_NAME,
              Key: {
                pk: { S: "IDEMPOTENCY#HANDOFF" },
                sk: { S: sk },
              },
              UpdateExpression: "SET #result.#projectId = :newProjectId",
              ExpressionAttributeNames: {
                "#result": "result",
                "#projectId": "projectId",
              },
              ExpressionAttributeValues: {
                ":newProjectId": { S: newProjectId },
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

/**
 * Main migration logic
 */
async function migrate() {
  try {
    // Step 1: Scan for collisions
    const collisionProjects = await scanProjectsForCollisions();

    if (collisionProjects.size === 0) {
      console.log("✓ No baseline collisions found. No migration needed.");
      return;
    }

    console.log(`Found ${collisionProjects.size} projects with baseline collisions.\n`);

    // Step 2: Migrate each collision
    for (const [oldProjectPk, data] of collisionProjects.entries()) {
      const oldProjectId = oldProjectPk.replace("PROJECT#", "");
      const metadataBaselineId = normalizeBaselineId(data.metadata);

      console.log(`Migrating project ${oldProjectPk}:`);

      // Find handoffs that don't match the metadata baseline
      const mismatchedHandoffs = data.handoffs.filter(handoff => {
        const handoffBaselineId = normalizeBaselineId(handoff);
        return handoffBaselineId && handoffBaselineId !== metadataBaselineId;
      });

      for (const handoff of mismatchedHandoffs) {
        try {
          const { newProjectId } = await migrateHandoff(
            oldProjectPk,
            handoff,
            data.metadata
          );

          // Update idempotency records
          const handoffBaselineId = normalizeBaselineId(handoff);
          if (handoffBaselineId) {
            const idempUpdated = await updateIdempotencyRecords(
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

    // Step 3: Summary
    console.log("=".repeat(80));
    console.log("Migration Summary");
    console.log("=".repeat(80));
    console.log(`Projects scanned: ${result.projectsScanned}`);
    console.log(`Projects with collisions: ${result.projectsWithMultipleBaselines}`);
    console.log(`New projects created: ${result.newProjectsCreated}`);
    console.log(`Handoffs migrated: ${result.handoffsMigrated}`);
    console.log(`Idempotency records updated: ${result.idempotencyRecordsUpdated}`);
    console.log(`Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (DRY_RUN) {
      console.log("\n⚠️  DRY RUN MODE - No changes were made to the database.");
      console.log("Run without --dry-run to apply changes.");
    } else {
      console.log("\n✓ Migration complete!");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrate().catch(console.error);
