/**
 * Verification Script: Forecast Pipeline End-to-End
 * 
 * Tests the complete forecast data pipeline:
 * 1. Verifies project exists (P-CLOUD-ECOPETROL or other test project)
 * 2. Checks allocations table for data
 * 3. Checks payroll table for data
 * 4. Simulates forecast handler logic to ensure it returns data
 * 
 * Usage:
 *   ts-node scripts/verify-forecast-pipeline.ts [PROJECT_ID]
 * 
 * Example:
 *   ts-node scripts/verify-forecast-pipeline.ts P-CLOUD-ECOPETROL
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetItemCommand } from "@aws-sdk/lib-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_ALLOC = process.env.TABLE_ALLOC || "finz_allocations";
const TABLE_PAYROLL = process.env.TABLE_PAYROLL || "finz_payroll_actuals";

const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

const TEST_PROJECT_ID = process.argv[2] || "P-CLOUD-ECOPETROL";
const MONTHS = 12;

async function main() {
  console.log("🔍 Verifying Forecast Pipeline End-to-End");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Test Project: ${TEST_PROJECT_ID}`);
  console.log(`   Months: ${MONTHS}`);
  console.log("═".repeat(80));

  // Step 1: Verify project exists
  console.log("\n1️⃣  Verifying project exists...");
  const projectResult = await ddb.send(
    new GetItemCommand({
      TableName: TABLE_PROJECTS,
      Key: marshall({
        pk: `PROJECT#${TEST_PROJECT_ID}`,
        sk: "METADATA",
      }),
    })
  );

  if (!projectResult.Item) {
    console.log(`   ❌ Project ${TEST_PROJECT_ID} not found!`);
    console.log(`   💡 Run seed script first: npm run seed:canonical-projects`);
    process.exit(1);
  }

  const projectName = projectResult.Item.name || "Unknown";
  const baseline = projectResult.Item.baselineId || "N/A";
  console.log(`   ✅ Project found: ${projectName}`);
  console.log(`      Baseline: ${baseline}`);

  // Step 2: Query allocations
  console.log("\n2️⃣  Querying allocations...");
  const allocationsResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_ALLOC,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${TEST_PROJECT_ID}`,
      },
    })
  );

  const allocations = allocationsResult.Items || [];
  console.log(`   Found ${allocations.length} allocation records`);

  if (allocations.length === 0) {
    console.log(`   ⚠️  No allocations found for ${TEST_PROJECT_ID}`);
  } else {
    // Show sample allocation
    const sample = allocations[0];
    console.log(`   Sample allocation:`);
    console.log(`      pk: ${sample.pk}`);
    console.log(`      sk: ${sample.sk}`);
    console.log(`      month: ${sample.month}`);
    console.log(`      rubroId: ${sample.rubroId}`);
    console.log(`      amount: ${sample.amount}`);
    console.log(`      planned: ${sample.planned || 'N/A'}`);
    console.log(`      forecast: ${sample.forecast || 'N/A'}`);
    console.log(`      actual: ${sample.actual || 'N/A'}`);
  }

  // Step 3: Query payroll
  console.log("\n3️⃣  Querying payroll actuals...");
  const payrollResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_PAYROLL,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${TEST_PROJECT_ID}`,
      },
    })
  );

  const payrolls = payrollResult.Items || [];
  console.log(`   Found ${payrolls.length} payroll records`);

  if (payrolls.length === 0) {
    console.log(`   ⚠️  No payroll records found for ${TEST_PROJECT_ID}`);
  } else {
    // Show sample payroll
    const sample = payrolls[0];
    console.log(`   Sample payroll:`);
    console.log(`      pk: ${sample.pk}`);
    console.log(`      sk: ${sample.sk}`);
    console.log(`      month: ${sample.month || sample.period}`);
    console.log(`      rubroId: ${sample.rubroId}`);
    console.log(`      amount: ${sample.amount}`);
    console.log(`      kind: ${sample.kind || 'actual'}`);
  }

  // Step 4: Simulate forecast aggregation
  console.log("\n4️⃣  Simulating forecast aggregation...");
  const forecastData: any[] = [];

  // Process allocations
  if (allocations.length > 0) {
    for (const allocation of allocations) {
      const month = Number(allocation.month?.split("-")[1] || 1);
      if (month <= MONTHS) {
        const planned = Number(allocation.planned || allocation.amount || 0);
        const forecast = Number(allocation.forecast || allocation.amount || 0);
        const actual = Number(allocation.actual || 0);

        forecastData.push({
          line_item_id: allocation.rubroId || "unknown",
          month,
          planned,
          forecast,
          actual,
          variance: actual - planned,
        });
      }
    }
  }

  // Process payroll
  if (payrolls.length > 0) {
    for (const payroll of payrolls) {
      const month = Number(payroll.month?.split("-")[1] || payroll.period?.split("-")[1] || 1);
      if (month <= MONTHS) {
        const amount = Number(payroll.amount || 0);
        forecastData.push({
          line_item_id: `payroll-${payroll.id || "unknown"}`,
          month,
          planned: 0,
          forecast: 0,
          actual: amount,
          variance: amount,
        });
      }
    }
  }

  console.log(`   Generated ${forecastData.length} forecast cells`);

  // Calculate totals
  const totals = forecastData.reduce(
    (acc, cell) => ({
      planned: acc.planned + cell.planned,
      forecast: acc.forecast + cell.forecast,
      actual: acc.actual + cell.actual,
      variance: acc.variance + cell.variance,
    }),
    { planned: 0, forecast: 0, actual: 0, variance: 0 }
  );

  console.log(`   Totals:`);
  console.log(`      Planned: $${totals.planned.toLocaleString()}`);
  console.log(`      Forecast: $${totals.forecast.toLocaleString()}`);
  console.log(`      Actual: $${totals.actual.toLocaleString()}`);
  console.log(`      Variance: $${totals.variance.toLocaleString()}`);

  // Step 5: Final validation
  console.log("\n5️⃣  Final Validation");
  console.log("─".repeat(80));

  const checks = {
    projectExists: !!projectResult.Item,
    hasAllocations: allocations.length > 0,
    hasPayroll: payrolls.length > 0,
    hasForecastData: forecastData.length > 0,
    hasNonZeroTotals: totals.planned > 0 || totals.forecast > 0 || totals.actual > 0,
  };

  console.log(`   ✅ Project exists: ${checks.projectExists}`);
  console.log(`   ${checks.hasAllocations ? "✅" : "⚠️ "} Has allocations: ${checks.hasAllocations}`);
  console.log(`   ${checks.hasPayroll ? "✅" : "⚠️ "} Has payroll: ${checks.hasPayroll}`);
  console.log(`   ${checks.hasForecastData ? "✅" : "⚠️ "} Has forecast data: ${checks.hasForecastData}`);
  console.log(`   ${checks.hasNonZeroTotals ? "✅" : "⚠️ "} Has non-zero totals: ${checks.hasNonZeroTotals}`);

  const allPassed = Object.values(checks).every((v) => v);

  if (allPassed) {
    console.log("\n✅ Forecast pipeline validation PASSED!");
    console.log("   The forecast API should return non-zero data for this project.");
  } else {
    console.log("\n⚠️  Forecast pipeline validation has warnings.");
    console.log("   Some data may be missing. Check the details above.");
    if (!checks.hasAllocations && !checks.hasPayroll) {
      console.log("\n💡 Tip: Run seed script to populate data:");
      console.log("   cd services/finanzas-api && npm run seed:canonical-projects");
    }
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
