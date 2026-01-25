#!/usr/bin/env node
/**
 * scripts/fix-noncanonical-rubros.cjs
 *
 * Scans allocations and project_rubros tables for rows with non-canonical rubro_id values,
 * computes the canonical ID, and optionally updates them with legacy tracking.
 *
 * Usage:
 *  node scripts/fix-noncanonical-rubros.cjs --dryrun
 *  ALLOCATIONS_TABLE=allocations PROJECT_RUBROS_TABLE=project_rubros node scripts/fix-noncanonical-rubros.cjs --dryrun
 *  ALLOCATIONS_TABLE=allocations PROJECT_RUBROS_TABLE=project_rubros node scripts/fix-noncanonical-rubros.cjs --apply --batch=50
 *
 * Safety:
 *  - Dry-run mode (--dryrun) lists items that would be updated without making changes
 *  - Apply mode (--apply) performs actual updates
 *  - Always take backups before running --apply
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const path = require("path");
const minimist = require("minimist");

const args = minimist(process.argv.slice(2));
const DRYRUN = !!args.dryrun;
const APPLY = !!args.apply;
const BATCH = parseInt(args.batch || "50", 10);

if (!DRYRUN && !APPLY) {
  console.log("ERROR: Specify either --dryrun or --apply");
  console.log("\nUsage:");
  console.log("  node scripts/fix-noncanonical-rubros.cjs --dryrun");
  console.log("  node scripts/fix-noncanonical-rubros.cjs --apply --batch=50");
  process.exit(1);
}

// Load canonical helper from services
const canonicalPath = path.resolve(__dirname, "../services/finanzas-api/src/lib/canonical-taxonomy.ts");
let getCanonicalRubroId, getAllCanonicalIds;

try {
  // Try to load the TypeScript module using ts-node if available
  require("ts-node/register");
  const canonical = require(canonicalPath);
  getCanonicalRubroId = canonical.getCanonicalRubroId;
  getAllCanonicalIds = canonical.getAllCanonicalIds;
} catch (err) {
  console.error("ERROR: Failed to load canonical-taxonomy module");
  console.error("Make sure ts-node is installed: pnpm install -D ts-node");
  console.error(err);
  process.exit(1);
}

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_ALLOC = process.env.ALLOCATIONS_TABLE || process.env.DDB_TABLE_ALLOCATIONS || "allocations";
const TABLE_PRUB = process.env.PROJECT_RUBROS_TABLE || process.env.DDB_TABLE_PROJECT_RUBROS || "project_rubros";

/**
 * Scan a table for items with non-canonical rubro_id
 */
async function scanNonCanonical(tableName) {
  const canonicalSet = new Set(getAllCanonicalIds().map(id => id.toUpperCase()));
  const out = [];
  let ExclusiveStartKey = undefined;
  let scannedCount = 0;

  console.log(`Scanning ${tableName}...`);

  do {
    const res = await ddb.send(new ScanCommand({
      TableName: tableName,
      ProjectionExpression: "pk, sk, rubro_id, canonical_rubro_id, _legacy_id",
      ExclusiveStartKey,
      Limit: 500,
    }));
    
    scannedCount += res.Count || 0;
    ExclusiveStartKey = res.LastEvaluatedKey;
    
    for (const item of res.Items || []) {
      const rubro = String(item.rubro_id || "");
      if (!rubro) continue;
      
      // Check if rubro_id is non-canonical (case-insensitive check)
      const normalizedRubro = rubro.toUpperCase();
      if (!canonicalSet.has(normalizedRubro)) {
        out.push(item);
      }
    }

    if (scannedCount % 1000 === 0) {
      console.log(`  Scanned ${scannedCount} items...`);
    }
  } while (ExclusiveStartKey);

  console.log(`  Scan complete: ${scannedCount} items scanned, ${out.length} non-canonical found`);
  return out;
}

/**
 * Process a table to find and optionally fix non-canonical rubro_ids
 */
async function processTable(tableName) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Processing table: ${tableName}`);
  console.log(`${"=".repeat(80)}\n`);

  const items = await scanNonCanonical(tableName);
  
  if (items.length === 0) {
    console.log(`✅ No non-canonical rubro_ids found in ${tableName}`);
    return items;
  }

  console.log(`\n📋 Found ${items.length} items with non-canonical rubro_id in ${tableName}`);

  if (DRYRUN) {
    console.log("\n🔍 DRY RUN - Showing sample items (max 200):\n");
    items.slice(0, 200).forEach((it, idx) => {
      const canonical = getCanonicalRubroId(it.rubro_id);
      console.log(`  [${idx + 1}] PK: ${it.pk} | SK: ${it.sk}`);
      console.log(`      Current rubro_id: ${it.rubro_id}`);
      console.log(`      Would map to: ${canonical || "(unknown - would keep as-is)"}`);
      if (canonical && canonical !== it.rubro_id) {
        console.log(`      ✏️  Would update`);
      } else {
        console.log(`      ⏭️  No change needed or no canonical mapping found`);
      }
      console.log();
    });
    return items;
  }

  // APPLY mode - perform updates
  let updated = 0;
  let skipped = 0;

  console.log("\n🔧 APPLY mode - Updating items...\n");

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const old = it.rubro_id;
    const canonical = getCanonicalRubroId(old);
    
    if (!canonical || canonical === old) {
      skipped++;
      if (skipped % 50 === 0) {
        console.log(`  Skipped ${skipped} items (no canonical mapping or already canonical)...`);
      }
      continue;
    }

    const params = {
      TableName: tableName,
      Key: { pk: it.pk, sk: it.sk },
      UpdateExpression: "SET rubro_id = :c, canonical_rubro_id = :c, _legacy_id = :old",
      ExpressionAttributeValues: {
        ":c": canonical,
        ":old": old,
      },
    };

    if (APPLY) {
      try {
        await ddb.send(new UpdateCommand(params));
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`  ✅ Updated ${updated} items...`);
        }
        
        // Batch throttling
        if (updated % BATCH === 0) {
          console.log(`  ⏸️  Batch pause (${BATCH} items) - waiting 1s...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error(`  ❌ Failed to update ${it.pk} / ${it.sk}:`, err.message);
      }
    }
  }

  console.log(`\n✅ Done processing ${tableName}:`);
  console.log(`   Updated: ${updated} items`);
  console.log(`   Skipped: ${skipped} items`);
  
  return items;
}

/**
 * Main execution
 */
(async () => {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("CANONICAL RUBRO ID MIGRATION SCRIPT");
    console.log("=".repeat(80));
    console.log(`Mode: ${DRYRUN ? "DRY RUN (no changes)" : "APPLY (will update database)"}`);
    console.log(`Batch size: ${BATCH}`);
    console.log(`Allocations table: ${TABLE_ALLOC}`);
    console.log(`Project rubros table: ${TABLE_PRUB}`);
    console.log("=".repeat(80) + "\n");

    if (APPLY) {
      console.log("⚠️  WARNING: You are running in APPLY mode. Database will be modified!");
      console.log("⚠️  Make sure you have backups before proceeding.\n");
    }

    await processTable(TABLE_ALLOC);
    await processTable(TABLE_PRUB);

    console.log("\n" + "=".repeat(80));
    console.log("MIGRATION SCRIPT COMPLETE");
    console.log("=".repeat(80));
    console.log(`Mode: ${DRYRUN ? "DRY RUN" : "APPLY"}`);
    console.log("\nNext steps:");
    if (DRYRUN) {
      console.log("  1. Review the output above");
      console.log("  2. Take backups of allocations and project_rubros tables");
      console.log("  3. Run with --apply when ready");
    } else {
      console.log("  1. Verify the updates in DynamoDB");
      console.log("  2. Check application logs for any issues");
      console.log("  3. Run a quick scan to verify no non-canonical IDs remain");
    }
    console.log();
  } catch (err) {
    console.error("\n❌ Migration script failed:", err);
    process.exit(2);
  }
})();
