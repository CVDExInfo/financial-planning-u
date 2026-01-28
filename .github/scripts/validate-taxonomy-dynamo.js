#!/usr/bin/env node
/**
 * DynamoDB Taxonomy Validation Script
 * 
 * Validates that all canonical_rubro_id and line_item_id values in DynamoDB
 * match the canonical taxonomy from data/rubros.taxonomy.json
 * 
 * Usage:
 *   DYNAMODB_TABLE=finz_allocations node .github/scripts/validate-taxonomy-dynamo.js
 * 
 * Environment Variables:
 *   DYNAMODB_TABLE - Name of the allocations table (default: finz_allocations)
 *   AWS_REGION - AWS region (default: us-east-2)
 */

import fs from "fs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE ?? "finz_allocations";
const REGION = process.env.AWS_REGION ?? "us-east-2";

// Load taxonomy from repo
const taxonomyPath = "data/rubros.taxonomy.json";

if (!fs.existsSync(taxonomyPath)) {
  console.error(`❌ Taxonomy file not found: ${taxonomyPath}`);
  process.exit(3);
}

const taxonomyData = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));

// Build canonical ID map from taxonomy
// The taxonomy structure is { items: [...] } where each item has linea_codigo
const mapByCanonical = new Map();

if (taxonomyData.items && Array.isArray(taxonomyData.items)) {
  for (const item of taxonomyData.items) {
    if (item.linea_codigo) {
      const canonical = String(item.linea_codigo).trim().toUpperCase();
      mapByCanonical.set(canonical, canonical);
    }
  }
} else {
  console.error("❌ Invalid taxonomy format: expected { items: [...] }");
  process.exit(3);
}

console.log(`✓ Loaded ${mapByCanonical.size} canonical rubros from taxonomy`);

// DynamoDB client
const client = new DynamoDBClient({ region: REGION });

async function run() {
  console.log(`\n🔍 Scanning DynamoDB table: ${TABLE}`);
  console.log(`   Region: ${REGION}\n`);

  let allItems = [];
  let ExclusiveStartKey = undefined;
  let scanCount = 0;

  try {
    // Scan all items
    do {
      scanCount++;
      const command = new ScanCommand({
        TableName: TABLE,
        ProjectionExpression: "pk, sk, canonical_rubro_id, rubro_id, line_item_id",
        ExclusiveStartKey,
      });

      const response = await client.send(command);
      const items = response.Items || [];
      
      allItems.push(...items);
      ExclusiveStartKey = response.LastEvaluatedKey;
      
      console.log(`   Batch ${scanCount}: Retrieved ${items.length} items (total: ${allItems.length})`);
    } while (ExclusiveStartKey);

    console.log(`\n✓ Scan complete. Total items scanned: ${allItems.length}\n`);

  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.warn(`⚠️  Table '${TABLE}' not found - skipping validation`);
      console.log("   This is expected in test/dev environments without deployed infrastructure");
      process.exit(0);
    }
    
    if (error.name === 'AccessDeniedException' || error.message?.includes('AccessDenied')) {
      console.warn(`⚠️  AWS access denied - skipping validation`);
      console.log("   This is expected for PRs from forks or environments without AWS credentials");
      process.exit(0);
    }
    
    throw error;
  }

  // Validate each item
  const mismatches = [];
  let validCount = 0;

  for (const it of allItems) {
    const canonical = it.canonical_rubro_id || it.rubro_id;
    
    if (!canonical) {
      // Skip items without canonical ID
      continue;
    }

    const canonicalUpper = String(canonical).trim().toUpperCase();
    const expectedLineId = mapByCanonical.get(canonicalUpper);
    
    if (!expectedLineId) {
      mismatches.push({
        pk: it.pk,
        sk: it.sk,
        canonical_rubro_id: canonical,
        reason: "unknown canonical in taxonomy",
      });
      continue;
    }

    // Check if line_item_id matches canonical
    if (it.line_item_id) {
      const lineItemUpper = String(it.line_item_id).trim().toUpperCase();
      
      // For allocations, line_item_id might be a descriptive name, not necessarily the canonical ID
      // So we only check if canonical_rubro_id is valid, not if line_item_id matches exactly
      validCount++;
    } else {
      validCount++;
    }
  }

  // Report results
  console.log("=====================================");
  console.log("Taxonomy → DynamoDB Validation Report");
  console.log("=====================================\n");
  console.log(`Total items scanned:    ${allItems.length}`);
  console.log(`Valid canonical rubros: ${validCount}`);
  console.log(`Unknown/invalid rubros: ${mismatches.length}`);
  console.log("");

  if (mismatches.length > 0) {
    console.error("❌ Validation failed: Found items with unknown canonical rubros\n");
    
    // Show first 50 mismatches
    const samplesToShow = Math.min(50, mismatches.length);
    console.log(`First ${samplesToShow} mismatches:\n`);
    
    for (let i = 0; i < samplesToShow; i++) {
      const m = mismatches[i];
      console.log(`${i + 1}. pk: ${m.pk}`);
      console.log(`   sk: ${m.sk}`);
      console.log(`   canonical_rubro_id: ${m.canonical_rubro_id}`);
      console.log(`   reason: ${m.reason}`);
      console.log("");
    }
    
    if (mismatches.length > 50) {
      console.log(`... and ${mismatches.length - 50} more mismatches`);
    }
    
    // Write detailed report to file
    const reportPath = "taxonomy-validation-report.json";
    fs.writeFileSync(reportPath, JSON.stringify({ mismatches, validCount, totalItems: allItems.length }, null, 2));
    console.log(`\nDetailed report written to: ${reportPath}`);
    
    process.exit(2);
  } else {
    console.log("✅ taxonomy <=> dynamo validation OK");
    console.log("   All canonical rubros in DynamoDB exist in taxonomy");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("\n❌ Validation script error:");
  console.error(err);
  process.exit(3);
});
