#!/usr/bin/env node
/**
 * Taxonomy Validation Script
 * 
 * Validates that the taxonomy in DynamoDB is in sync with the source taxonomy file
 * and that all allocations reference valid taxonomy entries.
 * 
 * Usage:
 *   pnpm exec tsx scripts/migrations/validate-taxonomy-sync.ts
 *   pnpm exec tsx scripts/migrations/validate-taxonomy-sync.ts --fail-on-mismatch
 * 
 * Environment variables:
 *   AWS_REGION - AWS region (default: us-east-2)
 *   TABLE_PREFIX - DynamoDB table prefix (default: finz_)
 *   S3_BUCKET - S3 bucket for taxonomy (default: ukusi-ui-finanzas-prod)
 *   S3_KEY - S3 key for taxonomy (default: taxonomy/rubros.taxonomy.latest.json)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PREFIX = process.env.TABLE_PREFIX || "finz_";
const S3_BUCKET = process.env.S3_BUCKET || "ukusi-ui-finanzas-prod";
const S3_KEY = process.env.S3_KEY || "taxonomy/rubros.taxonomy.latest.json";
const failOnMismatch = process.argv.includes("--fail-on-mismatch");

const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region: AWS_REGION });

interface ValidationReport {
  timestamp: string;
  taxonomySource: string;
  taxonomyItemCount: number;
  validationResults: {
    allocationsChecked: number;
    allocationsMissingTaxonomy: Array<{
      pk: string;
      sk: string;
      line_item_id?: string;
      canonical_rubro_id?: string;
    }>;
    taxonomyItemsInDb: number;
    taxonomyItemsMissing: string[];
    taxonomyItemsExtra: string[];
  };
  summary: {
    hasIssues: boolean;
    totalIssues: number;
  };
}

/**
 * Helper to read stream from S3
 */
async function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | Uint8Array | string) => {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(Buffer.from(chunk));
      }
    });
    stream.on('error', (err: Error) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

/**
 * Load taxonomy from local file or S3
 */
async function loadTaxonomy(): Promise<any> {
  // Try loading from local file first
  const localPath = join(process.cwd(), 'data', 'rubros.taxonomy.json');
  if (existsSync(localPath)) {
    console.log(`[validate] Loading taxonomy from local file: ${localPath}`);
    const content = await readFile(localPath, 'utf-8');
    return JSON.parse(content);
  }

  // Load from S3
  console.log(`[validate] Loading taxonomy from S3: ${S3_BUCKET}/${S3_KEY}`);
  const obj = await s3.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: S3_KEY })
  );
  const body = await streamToString(obj.Body);
  return JSON.parse(body);
}

/**
 * Scan a DynamoDB table completely
 */
async function scanTable(tableName: string): Promise<any[]> {
  const items: any[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items) {
      items.push(...result.Items);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * Main validation function
 */
async function validateTaxonomySync(): Promise<ValidationReport> {
  console.log('\n🔍 Starting Taxonomy Validation');
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Table Prefix: ${TABLE_PREFIX}`);

  // Load taxonomy
  let taxonomy: any;
  let taxonomySource: string;
  try {
    taxonomy = await loadTaxonomy();
    taxonomySource = existsSync(join(process.cwd(), 'data', 'rubros.taxonomy.json'))
      ? 'local file'
      : `S3 (${S3_BUCKET}/${S3_KEY})`;
    console.log(`[validate] Loaded ${taxonomy.items?.length || 0} taxonomy items from ${taxonomySource}`);
  } catch (err: any) {
    console.error(`[validate] ❌ Failed to load taxonomy:`, err.message);
    throw err;
  }

  const items = taxonomy.items || [];
  const taxonomySet = new Set<string>();
  
  // Build set of valid linea_codigo values
  for (const item of items) {
    if (item.linea_codigo) {
      taxonomySet.add(item.linea_codigo);
    }
  }
  
  console.log(`[validate] Built taxonomy set with ${taxonomySet.size} unique linea_codigo values`);

  // Check allocations table
  console.log(`\n📋 Scanning allocations table...`);
  const allocationsTable = `${TABLE_PREFIX}allocations`;
  let allocations: any[] = [];
  
  try {
    allocations = await scanTable(allocationsTable);
    console.log(`[validate] Scanned ${allocations.length} allocations`);
  } catch (err: any) {
    console.warn(`[validate] ⚠️  Failed to scan allocations table: ${err.message}`);
    console.warn(`[validate] Continuing with validation...`);
  }

  // Find allocations with missing or invalid taxonomy references
  const allocationsMissingTaxonomy: Array<{
    pk: string;
    sk: string;
    line_item_id?: string;
    canonical_rubro_id?: string;
  }> = [];

  for (const allocation of allocations) {
    const lineItemId = allocation.line_item_id || allocation.lineItemId;
    const canonicalRubroId = allocation.canonical_rubro_id || allocation.canonicalRubroId;
    
    // Check if either field is missing or not in taxonomy
    if (!lineItemId && !canonicalRubroId) {
      allocationsMissingTaxonomy.push({
        pk: allocation.pk,
        sk: allocation.sk,
        line_item_id: lineItemId,
        canonical_rubro_id: canonicalRubroId,
      });
    } else if (lineItemId && !taxonomySet.has(lineItemId)) {
      allocationsMissingTaxonomy.push({
        pk: allocation.pk,
        sk: allocation.sk,
        line_item_id: lineItemId,
        canonical_rubro_id: canonicalRubroId,
      });
    } else if (canonicalRubroId && !taxonomySet.has(canonicalRubroId)) {
      allocationsMissingTaxonomy.push({
        pk: allocation.pk,
        sk: allocation.sk,
        line_item_id: lineItemId,
        canonical_rubro_id: canonicalRubroId,
      });
    }
  }

  if (allocationsMissingTaxonomy.length > 0) {
    console.log(`[validate] ⚠️  Found ${allocationsMissingTaxonomy.length} allocations with missing or invalid taxonomy references`);
  } else {
    console.log(`[validate] ✓ All allocations reference valid taxonomy entries`);
  }

  // Check rubros_taxonomia table
  console.log(`\n📋 Scanning rubros_taxonomia table...`);
  const taxonomiaTable = `${TABLE_PREFIX}rubros_taxonomia`;
  let taxonomiaItems: any[] = [];
  
  try {
    taxonomiaItems = await scanTable(taxonomiaTable);
    console.log(`[validate] Scanned ${taxonomiaItems.length} items from rubros_taxonomia table`);
  } catch (err: any) {
    console.warn(`[validate] ⚠️  Failed to scan rubros_taxonomia table: ${err.message}`);
    console.warn(`[validate] Continuing with validation...`);
  }

  // Build set of linea_codigo from DynamoDB
  const dbTaxonomySet = new Set<string>();
  for (const item of taxonomiaItems) {
    if (item.linea_codigo) {
      dbTaxonomySet.add(item.linea_codigo);
    }
  }

  // Find missing items (in source but not in DB)
  const taxonomyItemsMissing: string[] = [];
  for (const lineaCodigo of taxonomySet) {
    if (!dbTaxonomySet.has(lineaCodigo)) {
      taxonomyItemsMissing.push(lineaCodigo);
    }
  }

  // Find extra items (in DB but not in source)
  const taxonomyItemsExtra: string[] = [];
  for (const lineaCodigo of dbTaxonomySet) {
    if (!taxonomySet.has(lineaCodigo)) {
      taxonomyItemsExtra.push(lineaCodigo);
    }
  }

  if (taxonomyItemsMissing.length > 0) {
    console.log(`[validate] ⚠️  Found ${taxonomyItemsMissing.length} taxonomy items missing from DynamoDB`);
    console.log(`[validate] Missing items: ${taxonomyItemsMissing.slice(0, 10).join(', ')}${taxonomyItemsMissing.length > 10 ? '...' : ''}`);
  } else {
    console.log(`[validate] ✓ All source taxonomy items present in DynamoDB`);
  }

  if (taxonomyItemsExtra.length > 0) {
    console.log(`[validate] ⚠️  Found ${taxonomyItemsExtra.length} extra taxonomy items in DynamoDB not in source`);
    console.log(`[validate] Extra items: ${taxonomyItemsExtra.slice(0, 10).join(', ')}${taxonomyItemsExtra.length > 10 ? '...' : ''}`);
  }

  // Build report
  const totalIssues = 
    allocationsMissingTaxonomy.length +
    taxonomyItemsMissing.length +
    taxonomyItemsExtra.length;

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    taxonomySource,
    taxonomyItemCount: items.length,
    validationResults: {
      allocationsChecked: allocations.length,
      allocationsMissingTaxonomy,
      taxonomyItemsInDb: taxonomiaItems.length,
      taxonomyItemsMissing,
      taxonomyItemsExtra,
    },
    summary: {
      hasIssues: totalIssues > 0,
      totalIssues,
    },
  };

  return report;
}

/**
 * Main execution
 */
async function main() {
  try {
    const report = await validateTaxonomySync();

    // Write report to file
    const outDir = join(process.cwd(), 'scripts', 'migrations');
    await mkdir(outDir, { recursive: true });
    
    const reportPath = join(outDir, 'validate-taxonomy-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    console.log(`\n📝 Validation report written to: ${reportPath}`);

    // Print summary
    console.log('\n📊 Validation Summary:');
    console.log(`   Total Issues: ${report.summary.totalIssues}`);
    console.log(`   Allocations Missing Taxonomy: ${report.validationResults.allocationsMissingTaxonomy.length}`);
    console.log(`   Taxonomy Items Missing from DB: ${report.validationResults.taxonomyItemsMissing.length}`);
    console.log(`   Extra Items in DB: ${report.validationResults.taxonomyItemsExtra.length}`);

    if (report.summary.hasIssues) {
      console.log('\n❌ Validation failed - issues found');
      
      if (failOnMismatch) {
        console.log('   Exiting with non-zero status due to --fail-on-mismatch flag');
        process.exit(1);
      } else {
        console.log('   Use --fail-on-mismatch to exit with non-zero status');
        process.exit(0);
      }
    } else {
      console.log('\n✅ Validation passed - no issues found');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Validation script failed:', error);
    process.exit(1);
  }
}

main();
