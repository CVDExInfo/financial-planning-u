#!/usr/bin/env node
/**
 * Validation Script: Canonical Line Items Checker
 * 
 * This script validates that all line_item_id values in the allocations table
 * match canonical linea_codigo values from data/rubros.taxonomy.json.
 * 
 * Usage:
 *   # Dry run (default)
 *   TABLE_PREFIX=finz_ AWS_REGION=us-east-2 tsx scripts/migrations/validate-canonical-lineitems.ts
 * 
 *   # Fail on mismatch
 *   TABLE_PREFIX=finz_ AWS_REGION=us-east-2 tsx scripts/migrations/validate-canonical-lineitems.ts --fail-on-mismatch
 * 
 * Environment Variables:
 *   TABLE_PREFIX - Prefix for DynamoDB tables (e.g., 'finz_')
 *   AWS_REGION - AWS region (default: us-east-1)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import * as fs from 'fs';
import * as path from 'path';

const TABLE_PREFIX = process.env.TABLE_PREFIX || '';
const REGION = process.env.AWS_REGION || 'us-east-1';
const FAIL_ON_MISMATCH = process.argv.includes('--fail-on-mismatch');

// Path to canonical taxonomy
const TAXONOMY_PATH = path.join(__dirname, '../../data/rubros.taxonomy.json');
const REPORT_PATH = path.join(__dirname, 'validate-canonical-report.json');

interface ValidationResult {
  timestamp: string;
  table: string;
  totalItems: number;
  validItems: number;
  invalidItems: number;
  mismatches: Array<{
    pk: string;
    sk: string;
    line_item_id: string;
    reason: string;
  }>;
}

/**
 * Load canonical IDs from taxonomy file
 */
function loadCanonicalIds(): Set<string> {
  console.log(`[validate] Loading canonical taxonomy from: ${TAXONOMY_PATH}`);
  
  if (!fs.existsSync(TAXONOMY_PATH)) {
    throw new Error(`Taxonomy file not found: ${TAXONOMY_PATH}`);
  }
  
  const taxonomyRaw = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
  const taxonomy = JSON.parse(taxonomyRaw);
  
  if (!taxonomy.items || !Array.isArray(taxonomy.items)) {
    throw new Error('Invalid taxonomy format: missing items array');
  }
  
  const canonicalIds = new Set<string>();
  
  for (const item of taxonomy.items) {
    if (item.linea_codigo) {
      // Store in uppercase for case-insensitive matching
      canonicalIds.add(String(item.linea_codigo).trim().toUpperCase());
    }
  }
  
  console.log(`[validate] Loaded ${canonicalIds.size} canonical IDs from taxonomy`);
  return canonicalIds;
}

/**
 * Scan allocations table and validate line_item_id values
 */
async function validateAllocations(
  client: DynamoDBDocumentClient,
  tableName: string,
  canonicalIds: Set<string>
): Promise<ValidationResult> {
  console.log(`[validate] Scanning table: ${tableName}`);
  
  const result: ValidationResult = {
    timestamp: new Date().toISOString(),
    table: tableName,
    totalItems: 0,
    validItems: 0,
    invalidItems: 0,
    mismatches: [],
  };
  
  let ExclusiveStartKey: any = undefined;
  let batchCount = 0;
  
  do {
    batchCount++;
    
    const response = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      })
    );
    
    const items = response.Items || [];
    console.log(`[validate] Batch ${batchCount}: Processing ${items.length} items`);
    
    for (const item of items) {
      result.totalItems++;
      
      const lineItemId = item.line_item_id || item.rubroId || item.rubro_id;
      
      if (!lineItemId) {
        result.invalidItems++;
        result.mismatches.push({
          pk: item.pk || 'UNKNOWN',
          sk: item.sk || 'UNKNOWN',
          line_item_id: 'NULL',
          reason: 'Missing line_item_id field',
        });
        continue;
      }
      
      // Normalize to uppercase for comparison
      const normalizedId = String(lineItemId).trim().toUpperCase();
      
      // Check if it's a canonical ID
      if (canonicalIds.has(normalizedId)) {
        result.validItems++;
      } else {
        result.invalidItems++;
        result.mismatches.push({
          pk: item.pk || 'UNKNOWN',
          sk: item.sk || 'UNKNOWN',
          line_item_id: lineItemId,
          reason: 'Not a canonical linea_codigo',
        });
      }
    }
    
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  
  console.log(`[validate] Scan complete. Total items: ${result.totalItems}`);
  
  return result;
}

/**
 * Write validation report to JSON file
 */
function writeReport(result: ValidationResult): void {
  console.log(`[validate] Writing report to: ${REPORT_PATH}`);
  
  const reportContent = JSON.stringify(result, null, 2);
  fs.writeFileSync(REPORT_PATH, reportContent, 'utf-8');
  
  console.log(`[validate] Report written successfully`);
}

/**
 * Print validation summary
 */
function printSummary(result: ValidationResult): void {
  console.log('\n===========================================');
  console.log('Canonical Line Items Validation Summary');
  console.log('===========================================\n');
  console.log(`Table:         ${result.table}`);
  console.log(`Timestamp:     ${result.timestamp}`);
  console.log(`Total Items:   ${result.totalItems}`);
  console.log(`Valid Items:   ${result.validItems}`);
  console.log(`Invalid Items: ${result.invalidItems}`);
  
  if (result.invalidItems > 0) {
    console.log('\n⚠️  Non-canonical line_item_id values found:');
    console.log(`   Count: ${result.mismatches.length}`);
    
    // Show first 10 mismatches
    const samplesToShow = Math.min(10, result.mismatches.length);
    console.log(`\n   First ${samplesToShow} mismatches:`);
    
    for (let i = 0; i < samplesToShow; i++) {
      const m = result.mismatches[i];
      console.log(`   ${i + 1}. pk=${m.pk}, sk=${m.sk}`);
      console.log(`      line_item_id: "${m.line_item_id}"`);
      console.log(`      reason: ${m.reason}`);
    }
    
    if (result.mismatches.length > 10) {
      console.log(`   ... and ${result.mismatches.length - 10} more (see report file)`);
    }
  } else {
    console.log('\n✅ All line_item_id values are canonical!');
  }
  
  console.log('\n===========================================\n');
}

/**
 * Main validation function
 */
async function main() {
  try {
    console.log('[validate] Starting canonical line items validation');
    console.log(`[validate] Table prefix: ${TABLE_PREFIX}`);
    console.log(`[validate] AWS Region: ${REGION}`);
    console.log(`[validate] Fail on mismatch: ${FAIL_ON_MISMATCH}\n`);
    
    // Load canonical IDs
    const canonicalIds = loadCanonicalIds();
    
    // Initialize DynamoDB client
    const client = new DynamoDBClient({ region: REGION });
    const ddb = DynamoDBDocumentClient.from(client);
    
    // Table name
    const tableName = `${TABLE_PREFIX}allocations`;
    
    // Validate allocations
    const result = await validateAllocations(ddb, tableName, canonicalIds);
    
    // Write report
    writeReport(result);
    
    // Print summary
    printSummary(result);
    
    // Exit with appropriate code
    if (result.invalidItems > 0 && FAIL_ON_MISMATCH) {
      console.error(`[validate] ❌ Validation failed: ${result.invalidItems} non-canonical values found`);
      console.error(`[validate] See report: ${REPORT_PATH}`);
      process.exit(1);
    }
    
    if (result.invalidItems > 0) {
      console.warn(`[validate] ⚠️  Found ${result.invalidItems} non-canonical values (not failing due to --fail-on-mismatch not set)`);
    }
    
    console.log('[validate] ✅ Validation complete');
    process.exit(0);
  } catch (error: any) {
    // Handle AWS access errors gracefully
    if (error.name === 'ResourceNotFoundException') {
      console.warn(`[validate] ⚠️  Table not found - skipping validation`);
      console.warn(`[validate] This is expected in CI environments without AWS access`);
      process.exit(0);
    }
    
    if (error.name === 'AccessDeniedException' || error.message?.includes('AccessDenied')) {
      console.warn(`[validate] ⚠️  AWS access denied - skipping validation`);
      console.warn(`[validate] This is expected for PRs from forks or environments without AWS credentials`);
      process.exit(0);
    }
    
    console.error('[validate] ❌ Validation error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run validation
main();
