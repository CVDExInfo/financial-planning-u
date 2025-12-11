#!/usr/bin/env ts-node
/**
 * Quick Fix Script for Dev Environment Data Issues
 * 
 * This script performs minimal fixes to ensure the three key scenarios work:
 * 1. Ensures P-CLOUD-ECOPETROL has rubros with metadata.baseline_id
 * 2. Ensures P-SOC-BANCOL-MED has correct baseline_id field
 * 3. Ensures payroll dashboard has necessary data
 * 
 * Usage:
 *   AWS_REGION=us-east-2 TABLE_PREFIX=finz_ ts-node scripts/quick-fix-dev-data.ts
 */

import { 
  DynamoDBClient, 
  GetItemCommand, 
  UpdateItemCommand,
  QueryCommand,
  PutItemCommand 
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PREFIX = process.env.TABLE_PREFIX || "finz_";

const ddb = new DynamoDBClient({ region: AWS_REGION });

const tableName = (name: string) => `${TABLE_PREFIX}${name}`;

async function fixProjectMetadata(projectId: string, expectedBaselineId: string) {
  console.log(`\n🔧 Fixing project metadata for ${projectId}...`);
  
  try {
    const result = await ddb.send(
      new GetItemCommand({
        TableName: tableName("projects"),
        Key: marshall({
          pk: `PROJECT#${projectId}`,
          sk: "METADATA",
        }),
      })
    );

    if (!result.Item) {
      console.log(`  ⚠️  Project ${projectId} not found - please run seed script first`);
      return false;
    }

    const item = unmarshall(result.Item);
    
    // Check if baseline_id is correct
    if (item.baselineId !== expectedBaselineId) {
      console.log(`  🔄 Updating baseline_id: ${item.baselineId} → ${expectedBaselineId}`);
      
      await ddb.send(
        new UpdateItemCommand({
          TableName: tableName("projects"),
          Key: marshall({
            pk: `PROJECT#${projectId}`,
            sk: "METADATA",
          }),
          UpdateExpression: "SET baselineId = :baseline_id",
          ExpressionAttributeValues: marshall({
            ":baseline_id": expectedBaselineId,
          }),
        })
      );
      
      console.log(`  ✅ Updated baseline_id to ${expectedBaselineId}`);
    } else {
      console.log(`  ✅ baseline_id is correct: ${expectedBaselineId}`);
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error fixing project metadata:`, error);
    return false;
  }
}

async function fixRubrosMetadata(projectId: string, expectedBaselineId: string) {
  console.log(`\n🔧 Fixing rubros metadata for ${projectId}...`);
  
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("projects"),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: marshall({
          ":pk": `PROJECT#${projectId}`,
          ":sk": "RUBRO#",
        }),
      })
    );

    if (!result.Items || result.Items.length === 0) {
      console.log(`  ⚠️  No rubros found for ${projectId} - please run seed script first`);
      return false;
    }

    const rubros = result.Items.map((item) => unmarshall(item));
    console.log(`  📊 Found ${rubros.length} rubros`);

    let fixed = 0;
    let alreadyCorrect = 0;

    for (const rubro of rubros) {
      const hasMetadata = rubro.metadata?.baseline_id === expectedBaselineId;
      const hasTopLevel = rubro.baselineId === expectedBaselineId;

      if (!hasMetadata) {
        // Need to fix metadata
        const metadata = {
          ...rubro.metadata,
          baseline_id: expectedBaselineId,
          project_id: projectId,
          source: rubro.metadata?.source || "fix-script",
        };

        await ddb.send(
          new UpdateItemCommand({
            TableName: tableName("projects"),
            Key: marshall({
              pk: rubro.pk,
              sk: rubro.sk,
            }),
            UpdateExpression: "SET metadata = :metadata, baselineId = :baseline_id",
            ExpressionAttributeValues: marshall({
              ":metadata": metadata,
              ":baseline_id": expectedBaselineId,
            }),
          })
        );

        fixed++;
      } else if (hasMetadata && hasTopLevel) {
        alreadyCorrect++;
      } else if (hasMetadata && !hasTopLevel) {
        // Has metadata but missing top-level, add it
        await ddb.send(
          new UpdateItemCommand({
            TableName: tableName("projects"),
            Key: marshall({
              pk: rubro.pk,
              sk: rubro.sk,
            }),
            UpdateExpression: "SET baselineId = :baseline_id",
            ExpressionAttributeValues: marshall({
              ":baseline_id": expectedBaselineId,
            }),
          })
        );
        fixed++;
      }
    }

    console.log(`  ✅ Fixed ${fixed} rubros, ${alreadyCorrect} already correct`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error fixing rubros metadata:`, error);
    return false;
  }
}

async function main() {
  console.log("🚀 Quick Fix Script for Dev Environment Data");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Table Prefix: ${TABLE_PREFIX}`);
  console.log("═".repeat(80));

  const results: boolean[] = [];

  // Fix P-CLOUD-ECOPETROL
  results.push(await fixProjectMetadata("P-CLOUD-ECOPETROL", "BL-CLOUD-ECOPETROL-001"));
  results.push(await fixRubrosMetadata("P-CLOUD-ECOPETROL", "BL-CLOUD-ECOPETROL-001"));

  // Fix P-SOC-BANCOL-MED
  results.push(await fixProjectMetadata("P-SOC-BANCOL-MED", "BL-SOC-BANCOL-001"));
  results.push(await fixRubrosMetadata("P-SOC-BANCOL-MED", "BL-SOC-BANCOL-001"));

  console.log("\n═".repeat(80));
  
  const allSucceeded = results.every((r) => r);
  
  if (allSucceeded) {
    console.log("✅ All fixes completed successfully!");
    console.log("\nNext steps:");
    console.log("  1. Run verification: npm run verify:dev-environment");
    console.log("  2. Test frontend:");
    console.log("     - Portfolio dashboard: /payroll/dashboard");
    console.log("     - Forecast: /plan/forecast?projectId=P-CLOUD-ECOPETROL&months=12");
    console.log("     - Reject baseline: PATCH /projects/P-SOC-BANCOL-MED/reject-baseline");
  } else {
    console.log("⚠️  Some fixes failed or projects not found");
    console.log("\nTo create projects:");
    console.log("  npm run seed:canonical-projects");
    console.log("\nThen run this script again.");
  }
  
  console.log("═".repeat(80));
  
  process.exit(allSucceeded ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main };
