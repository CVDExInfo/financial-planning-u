/**
 * Migration Script: Migrate Allocations from BASELINE# PK to PROJECT# PK
 * 
 * PURPOSE:
 * Historical allocations may have been written with pk = "BASELINE#..." instead of "PROJECT#...".
 * This causes the UI to not see allocations when querying by projectId.
 * 
 * This script:
 * 1. Scans the finz_allocations table for items with pk starting with "BASELINE#"
 * 2. For each allocation, extracts the projectId and creates a new item with pk = "PROJECT#<projectId>"
 * 3. Writes the new item using PutItem with ConditionExpression to ensure idempotency
 * 4. Does NOT delete original items (keep for audit/rollback)
 * 
 * USAGE:
 * - Run once in staging/ops environment
 * - Idempotent: safe to run multiple times
 * - Use DRY_RUN=true for testing
 * 
 * EXAMPLE:
 *   DRY_RUN=true ts-node scripts/migrate-allocations-to-project-pk.ts
 *   DRY_RUN=false ts-node scripts/migrate-allocations-to-project-pk.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-2";
const dryRun = process.env.DRY_RUN !== "false"; // Default to dry run for safety

const client = new DynamoDBClient({ region });
const ddb = DynamoDBDocumentClient.from(client);

const tableName = process.env.ALLOCATIONS_TABLE || "finz_allocations";

interface AllocationItem {
  pk: string;
  sk: string;
  projectId?: string;
  baselineId?: string;
  [key: string]: any;
}

async function migrateAllocations() {
  console.log("=".repeat(80));
  console.log("MIGRATION: Allocations BASELINE# PK -> PROJECT# PK");
  console.log("=".repeat(80));
  console.log(`Table: ${tableName}`);
  console.log(`Region: ${region}`);
  console.log(`Dry Run: ${dryRun ? "YES (no writes)" : "NO (will write to DynamoDB)"}`);
  console.log("=".repeat(80));

  if (dryRun) {
    console.warn("⚠️  DRY RUN MODE - No changes will be written to DynamoDB");
  }

  let scannedCount = 0;
  let baselinePkCount = 0;
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const errors: Array<{ item: any; error: string }> = [];

  // Scan for allocations with pk starting with "BASELINE#"
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;

  do {
    const scanParams: any = {
      TableName: tableName,
      FilterExpression: "begins_with(pk, :baseline_prefix)",
      ExpressionAttributeValues: {
        ":baseline_prefix": "BASELINE#",
      },
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    try {
      const result = await ddb.send(new ScanCommand(scanParams));
      const items = (result.Items || []) as AllocationItem[];

      scannedCount += items.length;
      baselinePkCount += items.length;

      console.log(`\nScanned ${items.length} items with BASELINE# pk...`);

      for (const item of items) {
        // Extract projectId
        const projectId = item.projectId || item.project_id;

        if (!projectId) {
          console.warn(
            `⚠️  Skipping item without projectId: pk=${item.pk}, sk=${item.sk}`
          );
          skippedCount++;
          continue;
        }

        // Create new item with PROJECT# pk
        const newPk = `PROJECT#${projectId}`;
        const newItem = {
          ...item,
          pk: newPk,
        };

        // Remove any DynamoDB internal fields
        delete (newItem as any).lastEvaluatedKey;

        if (dryRun) {
          console.log(`[DRY RUN] Would migrate:`);
          console.log(`  Old PK: ${item.pk}`);
          console.log(`  New PK: ${newPk}`);
          console.log(`  SK: ${item.sk}`);
          console.log(`  Project: ${projectId}`);
          migratedCount++;
        } else {
          // Write new item with idempotent condition
          try {
            await ddb.send(
              new PutCommand({
                TableName: tableName,
                Item: newItem,
                // Idempotency: only write if this exact pk+sk doesn't exist
                ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
              })
            );
            console.log(`✅ Migrated: ${item.pk} -> ${newPk} (sk: ${item.sk})`);
            migratedCount++;
          } catch (err: any) {
            if (err.name === "ConditionalCheckFailedException") {
              // Item already exists - this is OK (idempotent)
              console.log(`⏭️  Skipped (already exists): ${newPk} (sk: ${item.sk})`);
              skippedCount++;
            } else {
              console.error(`❌ Error migrating item: ${err.message}`);
              errors.push({ item, error: err.message });
              errorCount++;
            }
          }
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;

      if (lastEvaluatedKey) {
        console.log("Continuing scan...");
      }
    } catch (err: any) {
      console.error(`❌ Scan error: ${err.message}`);
      throw err;
    }
  } while (lastEvaluatedKey);

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("MIGRATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total items scanned: ${scannedCount}`);
  console.log(`Items with BASELINE# pk: ${baselinePkCount}`);
  console.log(`Items migrated: ${migratedCount}`);
  console.log(`Items skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  if (errors.length > 0) {
    console.log("\nErrors encountered:");
    errors.forEach((e, idx) => {
      console.log(`  ${idx + 1}. pk=${e.item.pk}, sk=${e.item.sk}: ${e.error}`);
    });
  }

  if (dryRun) {
    console.log("\n⚠️  DRY RUN COMPLETED - No changes were written");
    console.log("To apply changes, run with DRY_RUN=false");
  } else {
    console.log("\n✅ MIGRATION COMPLETED");
    console.log("Original items remain in the table for audit purposes.");
    console.log("Consider verifying the migrated allocations before removing originals.");
  }
}

// Run migration
migrateAllocations()
  .then(() => {
    console.log("\nMigration script finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Migration script failed:", err);
    process.exit(1);
  });
