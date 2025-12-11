/**
 * Verification Script: Allocations vs Projects
 * 
 * Validates that:
 * 1. Every allocation.projectId exists in the projects table
 * 2. Every allocation has the correct pk format: PROJECT#{projectId}
 * 3. Every allocation has month data for filtering
 * 
 * Usage:
 *   ts-node scripts/verify-allocations-vs-projects.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_ALLOC = process.env.TABLE_ALLOC || "finz_allocations";

const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

interface AllocationRecord {
  pk: string;
  sk: string;
  projectId?: string;
  month?: string;
  amount?: number;
  rubroId?: string;
}

interface ProjectRecord {
  pk: string;
  sk: string;
  projectId?: string;
  name?: string;
}

async function main() {
  console.log("🔍 Verifying Allocations vs Projects");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Projects table: ${TABLE_PROJECTS}`);
  console.log(`   Allocations table: ${TABLE_ALLOC}`);
  console.log("═".repeat(80));

  // Scan projects table
  console.log("\n📊 Scanning projects table...");
  const projectsResult = await ddb.send(
    new ScanCommand({
      TableName: TABLE_PROJECTS,
      FilterExpression: "sk = :sk",
      ExpressionAttributeValues: {
        ":sk": "METADATA",
      },
    })
  );

  const projects = (projectsResult.Items || []) as ProjectRecord[];
  const projectIds = new Set(projects.map((p) => p.projectId).filter(Boolean));
  console.log(`   Found ${projects.length} projects`);

  // Scan allocations table
  console.log("\n📊 Scanning allocations table...");
  const allocationsResult = await ddb.send(
    new ScanCommand({
      TableName: TABLE_ALLOC,
    })
  );

  const allocations = (allocationsResult.Items || []) as AllocationRecord[];
  console.log(`   Found ${allocations.length} allocation records`);

  // Validate allocations
  console.log("\n🔍 Validating allocations...");
  let orphanCount = 0;
  let wrongPkCount = 0;
  let missingMonthCount = 0;
  let validCount = 0;

  for (const alloc of allocations) {
    const issues: string[] = [];

    // Check projectId exists
    if (!alloc.projectId || !projectIds.has(alloc.projectId)) {
      orphanCount++;
      issues.push("orphan (project not found)");
    }

    // Check pk format
    if (alloc.projectId && !alloc.pk.startsWith(`PROJECT#${alloc.projectId}`)) {
      wrongPkCount++;
      issues.push(`wrong pk format (expected PROJECT#${alloc.projectId}, got ${alloc.pk})`);
    }

    // Check if pk has MONTH suffix (old format)
    if (alloc.pk.includes("#MONTH#")) {
      wrongPkCount++;
      issues.push("old pk format with #MONTH# suffix");
    }

    // Check month attribute
    if (!alloc.month) {
      missingMonthCount++;
      issues.push("missing month attribute");
    }

    if (issues.length > 0) {
      console.log(`   ⚠️  ${alloc.sk}: ${issues.join(", ")}`);
    } else {
      validCount++;
    }
  }

  // Summary
  console.log("\n📊 Validation Summary");
  console.log("─".repeat(80));
  console.log(`   Total allocations: ${allocations.length}`);
  console.log(`   ✅ Valid allocations: ${validCount}`);
  console.log(`   ⚠️  Orphan allocations (project not found): ${orphanCount}`);
  console.log(`   ⚠️  Wrong pk format: ${wrongPkCount}`);
  console.log(`   ⚠️  Missing month attribute: ${missingMonthCount}`);
  console.log("─".repeat(80));

  if (validCount === allocations.length) {
    console.log("\n✅ All allocations are valid!");
  } else {
    console.log("\n⚠️  Some allocations have issues. Review the details above.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
