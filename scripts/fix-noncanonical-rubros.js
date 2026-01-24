#!/usr/bin/env node
/**
 * Migration Script: Fix Non-Canonical Rubro IDs in DynamoDB
 * 
 * PURPOSE:
 * Scans allocations and project_rubros tables for rows where rubro_id is not canonical.
 * Updates rows to use canonical IDs while preserving legacy tokens in legacy_rubro_token field.
 * 
 * USAGE:
 *   # Dry run (no writes, lists candidates):
 *   ALLOCATIONS_TABLE=allocations PROJECT_RUBROS_TABLE=project_rubros node scripts/fix-noncanonical-rubros.js --dryrun
 * 
 *   # Apply changes (with batch size):
 *   ALLOCATIONS_TABLE=allocations PROJECT_RUBROS_TABLE=project_rubros node scripts/fix-noncanonical-rubros.js --apply --batch=100
 * 
 *   # Apply to specific table only:
 *   ALLOCATIONS_TABLE=allocations node scripts/fix-noncanonical-rubros.js --apply --table=allocations
 * 
 * ENVIRONMENT VARIABLES:
 *   ALLOCATIONS_TABLE - Name of allocations table (required)
 *   PROJECT_RUBROS_TABLE - Name of project_rubros table (required unless --table specified)
 *   AWS_REGION - AWS region (default: us-east-1)
 * 
 * SAFETY:
 *   - Always run --dryrun first
 *   - Backup tables before applying
 *   - Processes in safe batches
 *   - Logs all changes
 *   - Does not delete data, only updates rubro_id fields
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const path = require("path");

// Import canonical taxonomy helpers from finanzas-api
const canonicalTaxonomyPath = path.join(__dirname, "../services/finanzas-api/src/lib/canonical-taxonomy.ts");

// Since we're in Node.js and the file is TypeScript, we need to use a workaround
// For production, compile TS first or use ts-node
// For this script, we'll implement a simple canonical mapping based on known patterns

const LEGACY_RUBRO_ID_MAP = {
  "mod-lead-ingeniero-delivery": "MOD-LEAD",
  "mod-sdm-service-delivery-manager": "MOD-SDM",
  "mod-pm": "MOD-LEAD",
  "mod-pmo": "MOD-LEAD",
  "mod-ing": "MOD-ING",
  "mod-sdm": "MOD-SDM",
  "mod-engr": "MOD-ING",
  // Add more mappings as needed
};

function getCanonicalRubroId(raw) {
  if (!raw) return null;
  
  const normalized = String(raw).trim();
  const lower = normalized.toLowerCase();
  
  // Check legacy map
  if (LEGACY_RUBRO_ID_MAP[lower]) {
    return LEGACY_RUBRO_ID_MAP[lower];
  }
  
  // If already uppercase and matches pattern, assume canonical
  if (normalized === normalized.toUpperCase() && /^[A-Z0-9-]+$/.test(normalized)) {
    return normalized;
  }
  
  return null; // Unknown/invalid
}

function isCanonical(rubroId) {
  if (!rubroId) return false;
  const canonical = getCanonicalRubroId(rubroId);
  return canonical && canonical === rubroId;
}

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dryrun") || args.includes("--dry-run");
const isApply = args.includes("--apply");
const batchArg = args.find(arg => arg.startsWith("--batch="));
const batchSize = batchArg ? parseInt(batchArg.split("=")[1]) : 25;
const tableArg = args.find(arg => arg.startsWith("--table="));
const specificTable = tableArg ? tableArg.split("=")[1] : null;

// Validate arguments
if (!isDryRun && !isApply) {
  console.error("ERROR: Must specify either --dryrun or --apply");
  process.exit(1);
}

if (isDryRun && isApply) {
  console.error("ERROR: Cannot specify both --dryrun and --apply");
  process.exit(1);
}

// Environment variables
const ALLOCATIONS_TABLE = process.env.ALLOCATIONS_TABLE || "allocations";
const PROJECT_RUBROS_TABLE = process.env.PROJECT_RUBROS_TABLE || "project_rubros";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

// Statistics
const stats = {
  scanned: 0,
  needsUpdate: 0,
  updated: 0,
  errors: 0,
  skipped: 0,
};

async function scanTableForNonCanonical(tableName) {
  console.log(`\n📋 Scanning table: ${tableName}`);
  
  const items = [];
  let lastEvaluatedKey = undefined;
  
  do {
    const params = {
      TableName: tableName,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    };
    
    try {
      const result = await ddb.send(new ScanCommand(params));
      
      if (result.Items) {
        result.Items.forEach(item => {
          stats.scanned++;
          
          const rubroId = item.rubro_id || item.rubroId;
          if (!rubroId) {
            stats.skipped++;
            return;
          }
          
          const canonical = getCanonicalRubroId(rubroId);
          
          if (canonical && canonical !== rubroId) {
            // Non-canonical ID found
            items.push({
              ...item,
              _tableName: tableName,
              _oldRubroId: rubroId,
              _newRubroId: canonical,
            });
            stats.needsUpdate++;
          }
        });
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
      
      if (stats.scanned % 1000 === 0) {
        console.log(`  ... scanned ${stats.scanned} items, found ${stats.needsUpdate} needing updates`);
      }
    } catch (error) {
      console.error(`ERROR scanning ${tableName}:`, error.message);
      stats.errors++;
      break;
    }
  } while (lastEvaluatedKey);
  
  console.log(`✅ Scan complete: ${stats.scanned} items scanned, ${stats.needsUpdate} need canonicalization`);
  
  return items;
}

async function updateItem(item) {
  const tableName = item._tableName;
  const oldRubroId = item._oldRubroId;
  const newRubroId = item._newRubroId;
  
  // Build update expression
  const updateExpression = "SET rubro_id = :newRubroId, canonical_rubro_id = :canonical, legacy_rubro_token = :legacy";
  const expressionAttributeValues = {
    ":newRubroId": newRubroId,
    ":canonical": newRubroId,
    ":legacy": oldRubroId,
  };
  
  // Determine primary key
  const key = {
    pk: item.pk,
    sk: item.sk,
  };
  
  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    }));
    
    stats.updated++;
    return true;
  } catch (error) {
    console.error(`ERROR updating item in ${tableName}:`, error.message);
    console.error(`  pk: ${key.pk}, sk: ${key.sk}`);
    stats.errors++;
    return false;
  }
}

async function processBatch(items, startIdx, endIdx) {
  const batch = items.slice(startIdx, endIdx);
  
  if (isDryRun) {
    console.log(`\n[DRY RUN] Would update ${batch.length} items:`);
    batch.slice(0, 5).forEach(item => {
      console.log(`  ${item.pk}#${item.sk}: "${item._oldRubroId}" → "${item._newRubroId}"`);
    });
    if (batch.length > 5) {
      console.log(`  ... and ${batch.length - 5} more items`);
    }
    return batch.length;
  }
  
  // Apply updates
  console.log(`\n📝 Updating batch ${Math.floor(startIdx / batchSize) + 1} (${batch.length} items)...`);
  
  for (const item of batch) {
    await updateItem(item);
  }
  
  return batch.length;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   DynamoDB Rubro ID Canonicalization Migration Script     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "APPLY (will update DB)"}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log(`Batch size: ${batchSize}`);
  console.log();
  
  if (!isDryRun) {
    console.warn("⚠️  WARNING: Running in APPLY mode - changes will be written to DynamoDB!");
    console.warn("⚠️  Ensure you have backups before proceeding.");
    console.log();
  }
  
  // Determine which tables to process
  const tablesToProcess = [];
  if (specificTable) {
    tablesToProcess.push(specificTable);
  } else {
    tablesToProcess.push(ALLOCATIONS_TABLE, PROJECT_RUBROS_TABLE);
  }
  
  // Scan all tables for non-canonical items
  let allItems = [];
  for (const table of tablesToProcess) {
    const items = await scanTableForNonCanonical(table);
    allItems = allItems.concat(items);
  }
  
  console.log(`\n📊 Total items needing canonicalization: ${allItems.length}`);
  
  if (allItems.length === 0) {
    console.log("✅ No non-canonical rubro IDs found. Database is clean!");
    return;
  }
  
  // Process in batches
  console.log(`\n🔧 Processing ${isDryRun ? "(dry run)" : "updates"}...`);
  
  for (let i = 0; i < allItems.length; i += batchSize) {
    const endIdx = Math.min(i + batchSize, allItems.length);
    await processBatch(allItems, i, endIdx);
    
    // Small delay between batches to avoid throttling
    if (!isDryRun && endIdx < allItems.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Final statistics
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                    MIGRATION SUMMARY                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Items scanned:        ${stats.scanned}`);
  console.log(`  Items needing update: ${stats.needsUpdate}`);
  console.log(`  Items updated:        ${stats.updated}`);
  console.log(`  Items skipped:        ${stats.skipped}`);
  console.log(`  Errors:               ${stats.errors}`);
  console.log();
  
  if (isDryRun) {
    console.log("✅ DRY RUN complete. No changes were made.");
    console.log("   Run with --apply to perform actual updates.");
  } else {
    console.log("✅ Migration complete!");
    if (stats.errors > 0) {
      console.warn(`⚠️  ${stats.errors} errors occurred. Review logs above.`);
      process.exit(1);
    }
  }
}

// Run the script
main().catch(error => {
  console.error("\n❌ Migration failed:", error);
  process.exit(1);
});
