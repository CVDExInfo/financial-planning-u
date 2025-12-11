/**
 * Seed Demo Scenarios - Main Entry Point
 * 
 * This script seeds the 5 canonical demo projects into DynamoDB.
 * 
 * Usage:
 *   npm run finz:seed-demo
 * 
 * Environment variables:
 *   AWS_REGION (default: us-east-2)
 *   STAGE or ENV - Must be 'dev' or 'test' (aborts on prod/stg)
 *   FINZ_SEED_DEMO - Must be 'true' to enable (safety check)
 *   TABLE_PROJECTS (default: finz_projects)
 *   TABLE_ALLOC (default: finz_allocations)
 *   TABLE_PAYROLL (default: finz_payroll_actuals)
 */

import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { DEMO_SCENARIOS } from "./finzDemoScenarios";
import {
  buildDemoProjectItems,
  buildDemoBaselineItems,
  buildDemoAllocationItems,
  buildDemoPayrollActuals,
} from "./finzDemoSeedBuilders";

// =============================================================================
// Configuration
// =============================================================================

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const STAGE = process.env.STAGE || process.env.ENV || "dev";
const FINZ_SEED_DEMO = process.env.FINZ_SEED_DEMO === "true";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_ALLOC = process.env.TABLE_ALLOC || "finz_allocations";
const TABLE_PAYROLL = process.env.TABLE_PAYROLL || "finz_payroll_actuals";

const ddb = new DynamoDBClient({ region: AWS_REGION });

// =============================================================================
// Safety Checks
// =============================================================================

/**
 * Abort if environment is not safe for seeding
 */
function checkEnvironmentSafety() {
  const stage = STAGE.toLowerCase();
  if (stage === "prod" || stage === "production" || stage === "stg" || stage === "staging") {
    console.error("❌ FATAL: Cannot run demo seed in production/staging environment!");
    console.error(`   Detected STAGE/ENV: ${STAGE}`);
    console.error("   This script is for dev/test environments only.");
    process.exit(1);
  }
  
  if (!FINZ_SEED_DEMO) {
    console.error("❌ FATAL: FINZ_SEED_DEMO environment variable not set!");
    console.error("   Set FINZ_SEED_DEMO=true to explicitly enable demo seeding.");
    console.error("   This is a safety measure to prevent accidental execution.");
    process.exit(1);
  }
  
  console.log(`✓ Environment check passed: ${STAGE}`);
  console.log(`✓ Demo seeding explicitly enabled: FINZ_SEED_DEMO=${FINZ_SEED_DEMO}`);
}

// =============================================================================
// DynamoDB Operations
// =============================================================================

/**
 * Put item (idempotent - overwrites if exists)
 */
async function putItem(tableName: string, item: Record<string, any>): Promise<void> {
  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  );
}

/**
 * Batch write items using BatchWriteItem with DynamoDB 25-item limit handling
 * This is significantly more efficient than individual PutItem calls
 */
async function batchPutItems(tableName: string, items: Record<string, any>[]): Promise<void> {
  if (items.length === 0) return;
  
  // Process in batches of 25 (DynamoDB BatchWriteItem limit)
  const BATCH_SIZE = 25;
  let processedCount = 0;
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    
    // Build BatchWriteItem request
    const writeRequests = batch.map((item) => ({
      PutRequest: {
        Item: marshall(item, { removeUndefinedValues: true }),
      },
    }));
    
    // Send batch write
    await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: writeRequests,
        },
      })
    );
    
    processedCount += batch.length;
    
    // Progress indicator for large batches
    if (processedCount % 50 === 0 || processedCount === items.length) {
      console.log(`     ... ${processedCount}/${items.length} records`);
    }
  }
}

// =============================================================================
// Seed Orchestration
// =============================================================================

/**
 * Seed all demo scenarios
 */
async function seedDemoScenarios() {
  console.log("\n🌱 Starting Demo Scenarios Seed");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Stage: ${STAGE}`);
  console.log(`   Projects table: ${TABLE_PROJECTS}`);
  console.log(`   Allocations table: ${TABLE_ALLOC}`);
  console.log(`   Payroll table: ${TABLE_PAYROLL}`);
  console.log(`   Demo scenarios: ${DEMO_SCENARIOS.length}`);
  console.log("═".repeat(80));

  // Safety checks
  checkEnvironmentSafety();

  let totalProjects = 0;
  let totalBaselines = 0;
  let totalAllocations = 0;
  let totalPayrolls = 0;

  // Seed each demo scenario
  for (const scenario of DEMO_SCENARIOS) {
    console.log(`\n📦 Seeding: ${scenario.projectId} (${scenario.name})`);
    console.log(`   Client: ${scenario.client}`);
    console.log(`   Duration: ${scenario.durationMonths} months`);
    console.log(`   Total MOD: $${scenario.modTotal.toLocaleString()}`);

    // Build records
    const projects = buildDemoProjectItems(scenario);
    const baselines = buildDemoBaselineItems(scenario);
    const allocations = buildDemoAllocationItems(scenario);
    const payrolls = buildDemoPayrollActuals(scenario);

    // Write projects and baselines (small count, use individual puts for clarity)
    console.log(`   ├─ Writing project metadata...`);
    for (const item of projects) {
      await putItem(TABLE_PROJECTS, item);
      console.log(`   │  ✓ Project written`);
    }

    console.log(`   ├─ Writing baselines and handoff...`);
    for (const item of baselines) {
      await putItem(TABLE_PROJECTS, item);
      console.log(`   │  ✓ ${item.sk} written`);
    }

    // Write allocations (large count, use batch)
    console.log(`   ├─ Writing ${allocations.length} allocation records...`);
    await batchPutItems(TABLE_ALLOC, allocations);
    console.log(`   │  ✓ Allocations written`);

    // Write payroll actuals (large count, use batch)
    console.log(`   └─ Writing ${payrolls.length} payroll actual records...`);
    await batchPutItems(TABLE_PAYROLL, payrolls);
    console.log(`      ✓ Payroll actuals written`);

    totalProjects += projects.length;
    totalBaselines += baselines.length;
    totalAllocations += allocations.length;
    totalPayrolls += payrolls.length;

    console.log(`   ✅ ${scenario.projectId} seeded successfully`);
  }

  // Summary
  console.log("\n✅ Demo scenarios seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log(`   Projects: ${totalProjects}`);
  console.log(`   Baselines/Handoffs: ${totalBaselines}`);
  console.log(`   Allocations: ${totalAllocations}`);
  console.log(`   Payroll actuals: ${totalPayrolls}`);
  console.log(`   Total records: ${totalProjects + totalBaselines + totalAllocations + totalPayrolls}`);

  const totalPortfolioValue = DEMO_SCENARIOS.reduce((sum, s) => sum + s.modTotal, 0);
  console.log(`\n💰 Total Portfolio Value: $${totalPortfolioValue.toLocaleString()} USD`);
}

// =============================================================================
// Main Execution
// =============================================================================

/**
 * Main entry point
 */
async function main() {
  try {
    await seedDemoScenarios();
  } catch (error) {
    console.error("\n❌ Error during seed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for testing
export { seedDemoScenarios };
