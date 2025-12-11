/**
 * Verification Script: Payroll vs Projects
 * 
 * Validates that:
 * 1. Every payroll.projectId exists in the projects table
 * 2. Every payroll has the correct pk format: PROJECT#{projectId}
 * 3. Every payroll has month/period data for filtering
 * 
 * Usage:
 *   ts-node scripts/verify-payroll-vs-projects.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_PAYROLL = process.env.TABLE_PAYROLL || "finz_payroll_actuals";

const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

interface PayrollRecord {
  pk: string;
  sk: string;
  projectId?: string;
  month?: string;
  period?: string;
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
  console.log("🔍 Verifying Payroll vs Projects");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Projects table: ${TABLE_PROJECTS}`);
  console.log(`   Payroll table: ${TABLE_PAYROLL}`);
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

  // Scan payroll table
  console.log("\n📊 Scanning payroll table...");
  const payrollResult = await ddb.send(
    new ScanCommand({
      TableName: TABLE_PAYROLL,
    })
  );

  const payrolls = (payrollResult.Items || []) as PayrollRecord[];
  console.log(`   Found ${payrolls.length} payroll records`);

  // Validate payroll records
  console.log("\n🔍 Validating payroll records...");
  let orphanCount = 0;
  let wrongPkCount = 0;
  let missingPeriodCount = 0;
  let validCount = 0;

  for (const payroll of payrolls) {
    const issues: string[] = [];

    // Check projectId exists
    if (!payroll.projectId || !projectIds.has(payroll.projectId)) {
      orphanCount++;
      issues.push("orphan (project not found)");
    }

    // Check pk format
    if (payroll.projectId && !payroll.pk.startsWith(`PROJECT#${payroll.projectId}`)) {
      wrongPkCount++;
      issues.push(`wrong pk format (expected PROJECT#${payroll.projectId}, got ${payroll.pk})`);
    }

    // Check if pk has MONTH suffix (old format)
    if (payroll.pk.includes("#MONTH#")) {
      wrongPkCount++;
      issues.push("old pk format with #MONTH# suffix");
    }

    // Check month/period attribute
    if (!payroll.month && !payroll.period) {
      missingPeriodCount++;
      issues.push("missing month/period attribute");
    }

    if (issues.length > 0) {
      console.log(`   ⚠️  ${payroll.sk}: ${issues.join(", ")}`);
    } else {
      validCount++;
    }
  }

  // Summary
  console.log("\n📊 Validation Summary");
  console.log("─".repeat(80));
  console.log(`   Total payroll records: ${payrolls.length}`);
  console.log(`   ✅ Valid records: ${validCount}`);
  console.log(`   ⚠️  Orphan records (project not found): ${orphanCount}`);
  console.log(`   ⚠️  Wrong pk format: ${wrongPkCount}`);
  console.log(`   ⚠️  Missing month/period attribute: ${missingPeriodCount}`);
  console.log("─".repeat(80));

  if (validCount === payrolls.length) {
    console.log("\n✅ All payroll records are valid!");
  } else {
    console.log("\n⚠️  Some payroll records have issues. Review the details above.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
