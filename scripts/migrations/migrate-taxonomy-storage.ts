#!/usr/bin/env node
/**
 * Taxonomy Storage Migration Script
 * 
 * This script performs two operations:
 * 1. Uploads taxonomy from S3 to DynamoDB (rubros_taxonomia table)
 * 2. Migrates existing rubros and allocations to use canonical taxonomy IDs
 * 
 * It can run in two modes:
 * - --dry-run: Reports what would be changed without making any modifications
 * - --apply: Actually performs the migration (with backup)
 * 
 * Usage:
 *   pnpm exec tsx scripts/migrations/migrate-taxonomy-storage.ts --dry-run
 *   pnpm exec tsx scripts/migrations/migrate-taxonomy-storage.ts --apply
 * 
 * Environment variables:
 *   AWS_REGION - AWS region (default: us-east-2)
 *   TABLE_PREFIX - DynamoDB table prefix (default: finz_)
 *   S3_BUCKET - S3 bucket for taxonomy (default: ukusi-ui-finanzas-prod)
 *   S3_KEY - S3 key for taxonomy (default: taxonomy/rubros.taxonomy.latest.json)
 */

import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
// Use backend canonicalizer (node-safe, S3 fallback)
import { getCanonicalRubroId } from "../../services/finanzas-api/src/lib/canonical-taxonomy.ts";
// Write artifacts
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PREFIX = process.env.TABLE_PREFIX || "finz_";
const S3_BUCKET = process.env.S3_BUCKET || "ukusi-ui-finanzas-prod";
const S3_KEY = process.env.S3_KEY || "taxonomy/rubros.taxonomy.latest.json";
const isDryRun = process.argv.includes("--dry-run");
const isApply = process.argv.includes("--apply");

if (!isDryRun && !isApply) {
  console.error("❌ Error: Must specify either --dry-run or --apply");
  console.error("Usage:");
  console.error("  pnpm exec tsx scripts/migrations/migrate-taxonomy-storage.ts --dry-run");
  console.error("  pnpm exec tsx scripts/migrations/migrate-taxonomy-storage.ts --apply");
  process.exit(1);
}

const mode = isDryRun ? "DRY RUN" : "APPLY";

const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region: AWS_REGION });

interface MigrationStats {
  taxonomy: {
    total: number;
    written: number;
    failed: number;
  };
  rubros: {
    total: number;
    needsMigration: number;
    migrated: number;
    failed: number;
  };
  allocations: {
    total: number;
    needsMigration: number;
    migrated: number;
    failed: number;
  };
  prefacturas: {
    total: number;
    needsMigration: number;
    migrated: number;
    failed: number;
  };
}

const stats: MigrationStats = {
  taxonomy: { total: 0, written: 0, failed: 0 },
  rubros: { total: 0, needsMigration: 0, migrated: 0, failed: 0 },
  allocations: { total: 0, needsMigration: 0, migrated: 0, failed: 0 },
  prefacturas: { total: 0, needsMigration: 0, migrated: 0, failed: 0 },
};

/**
 * Normalize a rubro ID to its canonical form
 * Returns null if the ID cannot be canonicalized
 */
function normalizeRubroId(rubroId: string | undefined | null): string | null {
  if (!rubroId) return null;
  try {
    const canonical = getCanonicalRubroId(rubroId);
    return canonical || null;
  } catch (error) {
    console.warn(`⚠️  Failed to canonicalize rubro ID: ${rubroId}`, error);
    return null;
  }
}

/**
 * Check if a rubro ID needs migration
 */
function needsMigration(rubroId: string | undefined | null): boolean {
  if (!rubroId) return false;
  const canonical = normalizeRubroId(rubroId);
  return canonical !== null && canonical !== rubroId;
}

/**
 * Helper to read stream from S3
 */
async function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) => 
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    stream.on('error', (err: Error) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

/**
 * Load taxonomy from S3 or local file
 */
async function loadTaxonomy(): Promise<any> {
  // Try loading from local file first (for local development)
  const localPath = join(process.cwd(), 'data', 'rubros.taxonomy.json');
  if (existsSync(localPath)) {
    console.log(`[migration] Loading taxonomy from local file: ${localPath}`);
    const content = await readFile(localPath, 'utf-8');
    return JSON.parse(content);
  }

  // Load from S3
  console.log(`[migration] Loading taxonomy from S3: ${S3_BUCKET}/${S3_KEY}`);
  const obj = await s3.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: S3_KEY })
  );
  const body = await streamToString(obj.Body);
  return JSON.parse(body);
}

/**
 * Write item to DynamoDB with retries
 */
async function writeItemWithRetries(
  tableName: string,
  item: Record<string, any>,
  attempts = 3
): Promise<boolean> {
  let lastErr: any;
  for (let i = 1; i <= attempts; i++) {
    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
        })
      );
      return true;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[migration] Attempt ${i} writing ${item.pk || item.linea_codigo} failed:`,
        (err as Error).message || err
      );
      // Exponential backoff
      await new Promise((res) => setTimeout(res, 200 * Math.pow(2, i)));
    }
  }
  console.error(
    `[migration] Failed after ${attempts} attempts for ${item.pk || item.linea_codigo}:`,
    lastErr
  );
  return false;
}

/**
 * Upload taxonomy items to DynamoDB
 */
async function uploadTaxonomyToDynamoDB(): Promise<void> {
  console.log(`\n📋 Uploading taxonomy to DynamoDB...`);

  const taxonomyTableName = process.env.TAXONOMY_TABLE || `${TABLE_PREFIX}rubros_taxonomia`;
  console.log(`[migration] Target taxonomy table: ${taxonomyTableName}`);

  // Pre-flight check: ensure table exists
  try {
    await client.send(
      new DescribeTableCommand({ TableName: taxonomyTableName })
    );
    console.log(`[migration] ✓ Table ${taxonomyTableName} exists and is accessible`);
  } catch (err: any) {
    console.error(
      `[migration] ❌ Table not found or inaccessible: ${taxonomyTableName}`,
      err.message
    );
    console.error(`[migration] Please create the table or check permissions`);
    process.exit(2);
  }

  // Load taxonomy from S3 or local file
  let taxonomy: any;
  try {
    taxonomy = await loadTaxonomy();
    console.log(
      `[migration] Loaded taxonomy with ${taxonomy.items?.length || 0} items`
    );
  } catch (err: any) {
    console.error(`[migration] ❌ Failed to load taxonomy:`, err.message);
    throw err;
  }

  const items = taxonomy.items || [];
  stats.taxonomy.total = items.length;

  if (items.length === 0) {
    console.warn(`[migration] ⚠️  No taxonomy items found to upload`);
    return;
  }

  // Write each item with retries
  const results: Array<{ id: string; ok: boolean }> = [];
  
  for (const item of items) {
    const itemId = item.linea_codigo || item.pk || 'unknown';
    
    console.log(
      `  ${mode === "DRY RUN" ? "Would write" : "Writing"}: ${itemId} (${item.linea_gasto || 'no description'})`
    );

    if (isApply) {
      const ok = await writeItemWithRetries(taxonomyTableName, item, 3);
      results.push({ id: itemId, ok });
      
      if (ok) {
        stats.taxonomy.written++;
      } else {
        stats.taxonomy.failed++;
      }
    }
  }

  console.log(
    `✅ Taxonomy upload: ${stats.taxonomy.total} total, ${stats.taxonomy.written} written, ${stats.taxonomy.failed} failed`
  );

  // Write results to file for CI artifacts
  if (isApply && results.length > 0) {
    try {
      const outDir = join(process.cwd(), 'scripts', 'migrations');
      await mkdir(outDir, { recursive: true });
      
      const resultsPath = join(outDir, 'taxonomy-upload-result.json');
      await writeFile(
        resultsPath,
        JSON.stringify(
          {
            total: stats.taxonomy.total,
            written: stats.taxonomy.written,
            failed: stats.taxonomy.failed,
            results,
          },
          null,
          2
        ),
        'utf8'
      );
      console.log(`[migration] Wrote upload results to: ${resultsPath}`);
    } catch (err) {
      console.warn(`[migration] ⚠️  Failed to write upload results:`, err);
    }
  }
}

/**
 * Create a backup of an item before migration
 */
async function backupItem(
  tableName: string,
  item: Record<string, any>
): Promise<void> {
  if (isDryRun) return;

  const backupTableName = `${tableName}_backup_${Date.now()}`;
  try {
    await ddb.send(
      new PutCommand({
        TableName: backupTableName,
        Item: { ...item, backupTimestamp: new Date().toISOString() },
      })
    );
  } catch (error) {
    console.warn(`⚠️  Failed to backup item to ${backupTableName}:`, error);
    // Continue anyway - backup is best-effort
  }
}

/**
 * Migrate rubros table
 * Updates linea_codigo field to canonical form
 */
async function migrateRubros(): Promise<void> {
  console.log(`\n📋 Scanning rubros table (${TABLE_PREFIX}rubros)...`);

  const tableName = `${TABLE_PREFIX}rubros`;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = result.Items || [];
    stats.rubros.total += items.length;

    for (const item of items) {
      const lineaCodigo = item.linea_codigo || item.lineaCodigo;
      
      if (needsMigration(lineaCodigo)) {
        stats.rubros.needsMigration++;
        const canonical = normalizeRubroId(lineaCodigo);

        console.log(
          `  ${mode === "DRY RUN" ? "Would update" : "Updating"}: ${lineaCodigo} → ${canonical}`
        );

        if (isApply) {
          try {
            await backupItem(tableName, item);
            await ddb.send(
              new UpdateCommand({
                TableName: tableName,
                Key: { pk: item.pk, sk: item.sk },
                UpdateExpression:
                  "SET linea_codigo = :canonical, migration_timestamp = :ts",
                ExpressionAttributeValues: {
                  ":canonical": canonical,
                  ":ts": new Date().toISOString(),
                },
              })
            );
            stats.rubros.migrated++;
          } catch (error) {
            console.error(`  ❌ Failed to migrate rubro: ${lineaCodigo}`, error);
            stats.rubros.failed++;
          }
        }
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`✅ Rubros: ${stats.rubros.total} total, ${stats.rubros.needsMigration} need migration`);
}

/**
 * Migrate allocations table
 * Updates line_item_id field to canonical form
 */
async function migrateAllocations(): Promise<void> {
  console.log(`\n📋 Scanning allocations table (${TABLE_PREFIX}allocations)...`);

  const tableName = `${TABLE_PREFIX}allocations`;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = result.Items || [];
    stats.allocations.total += items.length;

    for (const item of items) {
      const lineItemId = item.line_item_id || item.lineItemId;

      if (needsMigration(lineItemId)) {
        stats.allocations.needsMigration++;
        const canonical = normalizeRubroId(lineItemId);

        console.log(
          `  ${mode === "DRY RUN" ? "Would update" : "Updating"}: ${lineItemId} → ${canonical}`
        );

        if (isApply) {
          try {
            await backupItem(tableName, item);
            await ddb.send(
              new UpdateCommand({
                TableName: tableName,
                Key: { pk: item.pk, sk: item.sk },
                UpdateExpression:
                  "SET line_item_id = :canonical, migration_timestamp = :ts",
                ExpressionAttributeValues: {
                  ":canonical": canonical,
                  ":ts": new Date().toISOString(),
                },
              })
            );
            stats.allocations.migrated++;
          } catch (error) {
            console.error(`  ❌ Failed to migrate allocation: ${lineItemId}`, error);
            stats.allocations.failed++;
          }
        }
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`✅ Allocations: ${stats.allocations.total} total, ${stats.allocations.needsMigration} need migration`);
}

/**
 * Migrate prefacturas/invoices table
 * Updates lineItemId field to canonical form
 */
async function migratePrefacturas(): Promise<void> {
  console.log(`\n📋 Scanning prefacturas table (${TABLE_PREFIX}prefacturas)...`);

  const tableName = `${TABLE_PREFIX}prefacturas`;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = result.Items || [];
    stats.prefacturas.total += items.length;

    for (const item of items) {
      const lineItemId = item.lineItemId || item.line_item_id;

      if (needsMigration(lineItemId)) {
        stats.prefacturas.needsMigration++;
        const canonical = normalizeRubroId(lineItemId);

        console.log(
          `  ${mode === "DRY RUN" ? "Would update" : "Updating"}: ${lineItemId} → ${canonical}`
        );

        if (isApply) {
          try {
            await backupItem(tableName, item);
            await ddb.send(
              new UpdateCommand({
                TableName: tableName,
                Key: { pk: item.pk, sk: item.sk },
                UpdateExpression:
                  "SET lineItemId = :canonical, migration_timestamp = :ts",
                ExpressionAttributeValues: {
                  ":canonical": canonical,
                  ":ts": new Date().toISOString(),
                },
              })
            );
            stats.prefacturas.migrated++;
          } catch (error) {
            console.error(`  ❌ Failed to migrate prefactura: ${lineItemId}`, error);
            stats.prefacturas.failed++;
          }
        }
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`✅ Prefacturas: ${stats.prefacturas.total} total, ${stats.prefacturas.needsMigration} need migration`);
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log(`\n🚀 Starting Taxonomy Migration (Mode: ${mode})`);
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Table Prefix: ${TABLE_PREFIX}`);
  console.log(`   S3 Bucket: ${S3_BUCKET}`);
  console.log(`   S3 Key: ${S3_KEY}`);

  try {
    // Step 1: Upload taxonomy to DynamoDB
    await uploadTaxonomyToDynamoDB();
    
    // Step 2: Migrate existing data to use canonical IDs
    await migrateRubros();
    await migrateAllocations();
    await migratePrefacturas();

    console.log(`\n📊 Migration Summary (${mode}):`);
    console.log(`   Taxonomy: ${stats.taxonomy.written}/${stats.taxonomy.total} written, ${stats.taxonomy.failed} failed`);
    console.log(`   Rubros: ${stats.rubros.migrated}/${stats.rubros.needsMigration} migrated, ${stats.rubros.failed} failed`);
    console.log(`   Allocations: ${stats.allocations.migrated}/${stats.allocations.needsMigration} migrated, ${stats.allocations.failed} failed`);
    console.log(`   Prefacturas: ${stats.prefacturas.migrated}/${stats.prefacturas.needsMigration} migrated, ${stats.prefacturas.failed} failed`);

    const totalMigrated = stats.taxonomy.written + stats.rubros.migrated + stats.allocations.migrated + stats.prefacturas.migrated;
    const totalFailed = stats.taxonomy.failed + stats.rubros.failed + stats.allocations.failed + stats.prefacturas.failed;

    if (isDryRun) {
      console.log(`\n✅ Dry run complete.`);
      console.log(`   Taxonomy: ${stats.taxonomy.total} items would be written`);
      console.log(`   Data migration: ${stats.rubros.needsMigration + stats.allocations.needsMigration + stats.prefacturas.needsMigration} items would be migrated`);
      console.log(`   Run with --apply to perform the migration.`);
    } else {
      console.log(`\n✅ Migration complete. ${totalMigrated} items written/migrated, ${totalFailed} failed.`);
    }
    // Write artifacts (JSON report + textual log) to scripts/migrations/
    try {
      const outDir = join(process.cwd(), "scripts", "migrations");
      await mkdir(outDir, { recursive: true });

      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, "-");
      const envName = (process.env.TABLE_PREFIX || "finz").replace(/[^a-z0-9_-]/gi, "");
      const modeSlug = mode.replace(/\s+/g, "-").toLowerCase();

      const report = {
        generated_at: now.toISOString(),
        mode,
        region: AWS_REGION,
        table_prefix: TABLE_PREFIX,
        stats,
      };
      const reportPath = join(outDir, `migration-report-${envName}-${modeSlug}-${ts}.json`);
      await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

      let log = '';
      log += `Taxonomy Migration Report - ${now.toISOString()}\n`;
      log += `Mode: ${mode}\n`;
      log += `AWS_REGION: ${AWS_REGION}\n`;
      log += `TABLE_PREFIX: ${TABLE_PREFIX}\n`;
      log += `S3_BUCKET: ${S3_BUCKET}\n`;
      log += `S3_KEY: ${S3_KEY}\n\n`;
      log += `Taxonomy: total=${stats.taxonomy.total} written=${stats.taxonomy.written} failed=${stats.taxonomy.failed}\n`;
      log += `Rubros: total=${stats.rubros.total} need=${stats.rubros.needsMigration} migrated=${stats.rubros.migrated} failed=${stats.rubros.failed}\n`;
      log += `Allocations: total=${stats.allocations.total} need=${stats.allocations.needsMigration} migrated=${stats.allocations.migrated} failed=${stats.allocations.failed}\n`;
      log += `Prefacturas: total=${stats.prefacturas.total} need=${stats.prefacturas.needsMigration} migrated=${stats.prefacturas.migrated} failed=${stats.prefacturas.failed}\n\n`;
      log += `Totals: written/migrated=${totalMigrated} failed=${totalFailed}\n`;

      const logPath = join(outDir, `migration-log-${envName}-${modeSlug}-${ts}.log`);
      await writeFile(logPath, log, "utf8");

      console.log(`\n📝 Wrote migration artifacts:`);
      console.log(`  - JSON: ${reportPath}`);
      console.log(`  - LOG:  ${logPath}`);
    } catch (err) {
      console.warn("⚠️  Failed to write migration artifacts:", err);
    }

    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n❌ Migration failed:`, error);
    process.exit(1);
  }
}

main();
