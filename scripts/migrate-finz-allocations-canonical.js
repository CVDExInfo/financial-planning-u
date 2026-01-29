#!/usr/bin/env node
/**
 * Migration Script: Canonicalize line_item_id in finz_allocations table
 * 
 * This script scans the finz_allocations DynamoDB table and updates all items
 * to use canonical linea_codigo values from data/rubros.taxonomy.json.
 * 
 * IMPORTANT: Run in dry-run mode first to preview changes before applying.
 * 
 * Usage:
 *   # Dry run (preview changes)
 *   FINZ_ALLOCATIONS_TABLE=finz_allocations node scripts/migrate-finz-allocations-canonical.js
 * 
 *   # Apply changes
 *   FINZ_ALLOCATIONS_TABLE=finz_allocations node scripts/migrate-finz-allocations-canonical.js --apply
 * 
 * Environment Variables:
 *   FINZ_ALLOCATIONS_TABLE - Name of the allocations table (required)
 *   AWS_REGION - AWS region (default: us-east-1)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Dynamic import for ESM compatibility
const importCanonicalizeRubroId = async () => {
  try {
    // Try frontend path first
    const module = await import("../src/lib/rubros/index.js");
    return module.canonicalizeRubroId;
  } catch (err) {
    console.warn("Frontend rubros module not available, trying backend...");
    // Fallback to backend path
    const module = await import("../services/finanzas-api/src/lib/canonical-taxonomy.js");
    return module.getCanonicalRubroId;
  }
};

const TABLE = process.env.FINZ_ALLOCATIONS_TABLE;
const REGION = process.env.AWS_REGION || "us-east-1";

if (!TABLE) {
  console.error("ERROR: FINZ_ALLOCATIONS_TABLE environment variable is required");
  console.error("Usage: FINZ_ALLOCATIONS_TABLE=your-table-name node scripts/migrate-finz-allocations-canonical.js [--apply]");
  process.exit(1);
}

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

/**
 * Scan all items from the allocations table
 */
async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  let scanCount = 0;
  
  console.log(`\n[scan] Starting scan of table: ${TABLE}`);
  
  do {
    scanCount++;
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        ExclusiveStartKey,
      })
    );
    
    const batch = res.Items || [];
    items.push(...batch);
    ExclusiveStartKey = res.LastEvaluatedKey;
    
    console.log(`[scan] Batch ${scanCount}: Retrieved ${batch.length} items (total: ${items.length})`);
  } while (ExclusiveStartKey);
  
  console.log(`[scan] Scan complete. Total items: ${items.length}\n`);
  return items;
}

/**
 * Main migration logic
 */
async function run(apply = false) {
  console.log("\n===========================================");
  console.log("DynamoDB Allocations Canonical Migration");
  console.log("===========================================\n");
  console.log(`Table: ${TABLE}`);
  console.log(`Region: ${REGION}`);
  console.log(`Mode: ${apply ? "APPLY (will write changes)" : "DRY RUN (preview only)"}\n`);
  
  if (!apply) {
    console.warn("⚠️  DRY RUN MODE - No changes will be written to the database");
    console.warn("⚠️  Use --apply flag to actually update the table\n");
  } else {
    console.warn("🔥 APPLY MODE - Changes will be written to the database!");
    console.warn("🔥 Make sure you have a backup of the table before proceeding\n");
  }
  
  // Load canonicalization function
  const canonicalizeRubroId = await importCanonicalizeRubroId();
  console.log("[init] Loaded canonicalization function\n");
  
  // Scan all items
  const items = await scanAll();
  
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];
  const changedItems = []; // Track all changes for report
  
  console.log("\n[process] Processing items...\n");
  
  for (const item of items) {
    // Extract the raw rubro identifier from various possible fields
    const raw = 
      item.line_item_id_original || 
      item.line_item_id || 
      item.rubroId || 
      item.rubro_id ||
      item.canonical_rubro_id;
    
    if (!raw) {
      console.warn(`[skip] No rubro identifier found: pk=${item.pk}, sk=${item.sk}`);
      skipped++;
      continue;
    }
    
    // Attempt to canonicalize
    const canonical = canonicalizeRubroId(raw);
    
    if (!canonical) {
      console.warn(`[fail] NO_CANONICAL: "${raw}" (pk=${item.pk}, sk=${item.sk})`);
      failures.push({
        pk: item.pk,
        sk: item.sk,
        raw,
        reason: "no_canonical_mapping",
      });
      failed++;
      continue;
    }
    
    // Check if update is needed (idempotent check)
    if (item.line_item_id === canonical && item.rubro_canonical === canonical) {
      // Already canonical, skip
      skipped++;
      continue;
    }
    
    console.log(`[update] pk=${item.pk}, sk=${item.sk}`);
    console.log(`         "${raw}" → "${canonical}"`);
    
    // Record the change
    const changeRecord = {
      pk: item.pk,
      sk: item.sk,
      before: {
        line_item_id: item.line_item_id,
        rubro_canonical: item.rubro_canonical,
      },
      after: {
        line_item_id: canonical,
        rubro_canonical: canonical,
      },
      raw_identifier: raw,
    };
    
    if (apply) {
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { pk: item.pk, sk: item.sk },
            UpdateExpression:
              "SET line_item_id = :c, rubro_canonical = :c, line_item_id_original = if_not_exists(line_item_id_original, :raw), canonical_rubro_id = :c",
            ExpressionAttributeValues: {
              ":c": canonical,
              ":raw": raw,
            },
          })
        );
        updated++;
        changedItems.push({ ...changeRecord, applied: true });
      } catch (updateErr) {
        console.error(`[error] Failed to update: ${updateErr.message}`);
        failures.push({
          pk: item.pk,
          sk: item.sk,
          raw,
          reason: updateErr.message,
        });
        failed++;
        changedItems.push({ ...changeRecord, applied: false, error: updateErr.message });
      }
    } else {
      // Dry run - just count and record it
      updated++;
      changedItems.push({ ...changeRecord, applied: false, dryRun: true });
    }
  }
  
  // Generate migration report
  const report = {
    timestamp: new Date().toISOString(),
    table: TABLE,
    region: REGION,
    mode: apply ? "apply" : "dry-run",
    summary: {
      totalScanned: items.length,
      toUpdate: updated,
      alreadyCanonical: skipped,
      failed: failed,
    },
    changes: changedItems,
    failures: failures,
  };
  
  // Write report to file
  const fs = await import('fs/promises');
  const reportPath = 'migration-report.json';
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Migration report written to: ${reportPath}`);
  
  // Print summary
  console.log("\n===========================================");
  console.log("Migration Summary");
  console.log("===========================================\n");
  console.log(`Total items scanned:     ${items.length}`);
  console.log(`Items to update:         ${updated}`);
  console.log(`Items already canonical: ${skipped}`);
  console.log(`Items with failures:     ${failed}`);
  
  if (failures.length > 0) {
    console.log("\n⚠️  Failures:");
    failures.slice(0, 50).forEach((f, idx) => {
      console.log(`  ${idx + 1}. pk=${f.pk}, sk=${f.sk}, raw="${f.raw}", reason=${f.reason}`);
    });
    if (failures.length > 50) {
      console.log(`  ... and ${failures.length - 50} more (see migration-report.json)`);
    }
  }
  
  if (!apply && updated > 0) {
    console.log("\n✅ Dry run complete. To apply changes, run with --apply flag.");
  } else if (apply) {
    console.log(`\n✅ Migration complete. ${updated} items updated.`);
  }
  
  console.log("\n");
  
  // Exit with error code if there were failures
  if (failed > 0) {
    process.exit(1);
  }
}

// Parse command line arguments
const APPLY = process.argv.includes("--apply");

// Run migration
run(APPLY).catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
