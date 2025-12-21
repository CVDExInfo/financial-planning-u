#!/usr/bin/env node
/**
 * Data Repair Script: Revert Auto-Accepted Baselines
 * 
 * Problem: Some baselines were incorrectly marked as "accepted" during handoff
 * instead of "handed_off". This script finds and reverts them.
 * 
 * Detection: A baseline is auto-accepted if:
 * - baseline_status == "accepted"
 * - No audit log entry with action == "BASELINE_ACCEPTED" exists
 * 
 * Repair Action:
 * - Set baseline_status = "handed_off"
 * - Remove accepted_by field
 * - Remove baseline_accepted_at field
 * 
 * Usage:
 *   # Dry run (default - shows what would change)
 *   node repairAutoAcceptedBaselines.ts
 * 
 *   # Execute repairs
 *   node repairAutoAcceptedBaselines.ts --execute
 * 
 *   # Limit to specific project
 *   node repairAutoAcceptedBaselines.ts --projectId P-abc123 --execute
 * 
 *   # Limit number of repairs
 *   node repairAutoAcceptedBaselines.ts --limit 10 --execute
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = !args.includes("--execute");
const projectIdFilter = args.find(arg => arg.startsWith("--projectId="))?.split("=")[1];
const limitArg = args.find(arg => arg.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? parseInt(limitArg, 10) : undefined;

// AWS SDK setup
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const ddb = DynamoDBDocumentClient.from(client);

// Table names from environment or defaults
const PROJECTS_TABLE = process.env.PROJECTS_TABLE_NAME || "finanzas-projects-dev";
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE_NAME || "finanzas-audit-log-dev";

interface ProjectMetadata {
  pk: string;
  sk: string;
  id: string;
  baseline_id?: string;
  baseline_status?: string;
  accepted_by?: string;
  baseline_accepted_at?: string;
  handed_off_at?: string;
  handed_off_by?: string;
}

interface AuditLogEntry {
  pk: string;
  sk: string;
  action: string;
  timestamp: string;
}

/**
 * Check if a project has a BASELINE_ACCEPTED audit log entry
 */
async function hasAcceptanceAuditLog(projectId: string): Promise<boolean> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: AUDIT_LOG_TABLE,
        KeyConditionExpression: "pk = :pk",
        FilterExpression: "#action = :action",
        ExpressionAttributeNames: {
          "#action": "action",
        },
        ExpressionAttributeValues: {
          ":pk": `ENTITY#PROJECT#${projectId}`,
          ":action": "BASELINE_ACCEPTED",
        },
        Limit: 1,
      })
    );

    return (result.Items?.length ?? 0) > 0;
  } catch (error) {
    console.error(`Error checking audit log for project ${projectId}:`, error);
    return false; // Assume no audit log on error (safer to skip repair)
  }
}

/**
 * Revert a project's baseline status from "accepted" to "handed_off"
 */
async function revertBaseline(project: ProjectMetadata): Promise<void> {
  const updateExpression = "SET baseline_status = :status REMOVE accepted_by, baseline_accepted_at";
  
  await ddb.send(
    new UpdateCommand({
      TableName: PROJECTS_TABLE,
      Key: {
        pk: project.pk,
        sk: project.sk,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: {
        ":status": "handed_off",
      },
    })
  );
}

/**
 * Scan for projects with accepted baselines
 */
async function findAutoAcceptedBaselines(): Promise<ProjectMetadata[]> {
  const autoAccepted: ProjectMetadata[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;
  let scanned = 0;

  console.log("Scanning projects table for auto-accepted baselines...\n");

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: PROJECTS_TABLE,
        FilterExpression: "sk = :sk AND baseline_status = :status",
        ExpressionAttributeValues: {
          ":sk": "METADATA",
          ":status": "accepted",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = (result.Items ?? []) as ProjectMetadata[];
    scanned += items.length;

    for (const item of items) {
      // Apply projectId filter if provided
      if (projectIdFilter && item.id !== projectIdFilter) {
        continue;
      }

      // Check if this project has a legitimate acceptance audit log
      const hasAudit = await hasAcceptanceAuditLog(item.id);
      
      if (!hasAudit) {
        autoAccepted.push(item);
        console.log(`Found auto-accepted baseline: ${item.id} (baseline: ${item.baseline_id})`);
        
        // Apply limit if specified
        if (limit && autoAccepted.length >= limit) {
          console.log(`Reached limit of ${limit} items\n`);
          return autoAccepted;
        }
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`\nScanned ${scanned} accepted baselines, found ${autoAccepted.length} auto-accepted\n`);
  
  return autoAccepted;
}

/**
 * Main execution
 */
async function main() {
  console.log("=".repeat(80));
  console.log("Data Repair Script: Revert Auto-Accepted Baselines");
  console.log("=".repeat(80));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "EXECUTE (changes will be applied)"}`);
  console.log(`Projects Table: ${PROJECTS_TABLE}`);
  console.log(`Audit Log Table: ${AUDIT_LOG_TABLE}`);
  if (projectIdFilter) {
    console.log(`Filter: projectId = ${projectIdFilter}`);
  }
  if (limit) {
    console.log(`Limit: ${limit} items`);
  }
  console.log("=".repeat(80));
  console.log();

  try {
    // Find auto-accepted baselines
    const autoAccepted = await findAutoAcceptedBaselines();

    if (autoAccepted.length === 0) {
      console.log("✓ No auto-accepted baselines found. Database is clean!");
      return;
    }

    // Display summary
    console.log("Summary of auto-accepted baselines:");
    console.log("-".repeat(80));
    for (const project of autoAccepted) {
      console.log(`Project ID: ${project.id}`);
      console.log(`  Baseline ID: ${project.baseline_id}`);
      console.log(`  Accepted By: ${project.accepted_by || "N/A"}`);
      console.log(`  Accepted At: ${project.baseline_accepted_at || "N/A"}`);
      console.log(`  Handed Off By: ${project.handed_off_by || "N/A"}`);
      console.log(`  Handed Off At: ${project.handed_off_at || "N/A"}`);
      console.log();
    }
    console.log("-".repeat(80));

    if (dryRun) {
      console.log("\n⚠ DRY RUN MODE - No changes were made");
      console.log(`\nTo execute repairs, run with --execute flag:`);
      console.log(`  node repairAutoAcceptedBaselines.ts --execute`);
      console.log();
      console.log(`Total items that would be repaired: ${autoAccepted.length}`);
    } else {
      console.log("\n🔧 Executing repairs...\n");
      
      let repaired = 0;
      let failed = 0;

      for (const project of autoAccepted) {
        try {
          await revertBaseline(project);
          repaired++;
          console.log(`✓ Repaired: ${project.id}`);
        } catch (error) {
          failed++;
          console.error(`✗ Failed to repair ${project.id}:`, error);
        }
      }

      console.log("\n" + "=".repeat(80));
      console.log("Repair Summary:");
      console.log(`  Total found: ${autoAccepted.length}`);
      console.log(`  Repaired: ${repaired}`);
      console.log(`  Failed: ${failed}`);
      console.log("=".repeat(80));
    }
  } catch (error) {
    console.error("\n❌ Error during execution:", error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
