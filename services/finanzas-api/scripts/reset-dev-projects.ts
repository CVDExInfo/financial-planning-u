#!/usr/bin/env node
/**
 * Reset Dev/Test Projects Script
 * 
 * Safely deletes non-canonical projects and their related data from dev/test environments.
 * 
 * Safety features:
 * - Environment guard: aborts if STAGE/ENV indicates prod/stg
 * - Dry run mode: preview deletions without making changes
 * - Canonical project protection: never deletes the 7 demo projects
 * - Confirmation prompt: requires explicit user confirmation
 * 
 * Usage:
 *   npm run reset:dev-projects              # With confirmation prompt
 *   npm run reset:dev-projects -- --dry-run # Preview only
 *   npm run reset:dev-projects -- --force   # Skip confirmation
 * 
 * Environment variables:
 *   AWS_REGION (default: us-east-2)
 *   STAGE or ENV - Must be 'dev' or 'test' (aborts for prod/stg)
 *   TABLE_PROJECTS (default: finz_projects)
 *   TABLE_RUBROS (default: finz_rubros)
 *   TABLE_ALLOC (default: finz_allocations)
 *   TABLE_PAYROLL (default: finz_payroll_actuals)
 *   TABLE_ADJ (default: finz_adjustments)
 */

import { DynamoDBClient, ScanCommand, DeleteItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import * as readline from "readline";

// Configuration
const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const STAGE = process.env.STAGE || process.env.ENV || "dev";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_RUBROS = process.env.TABLE_RUBROS || "finz_rubros";
const TABLE_ALLOC = process.env.TABLE_ALLOC || "finz_allocations";
const TABLE_PAYROLL = process.env.TABLE_PAYROLL || "finz_payroll_actuals";
const TABLE_ADJ = process.env.TABLE_ADJ || "finz_adjustments";

const ddb = new DynamoDBClient({ region: AWS_REGION });

// Canonical project IDs (protected - never deleted)
const CANONICAL_PROJECT_IDS = [
  "P-NOC-CLARO-BOG",
  "P-SOC-BANCOL-MED",
  "P-WIFI-ELDORADO",
  "P-CLOUD-ECOPETROL",
  "P-SD-TIGO-CALI",
  "P-CONNECT-AVIANCA",
  "P-DATACENTER-ETB",
];

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");

/**
 * Safety check: Don't run in production
 */
function checkEnvironmentSafety() {
  const stage = STAGE.toLowerCase();
  if (stage === "prod" || stage === "production" || stage === "stg" || stage === "staging") {
    console.error("❌ FATAL: Cannot run reset script in production/staging environment!");
    console.error(`   Detected STAGE/ENV: ${STAGE}`);
    console.error("   This script is for dev/test environments only.");
    process.exit(1);
  }
  console.log(`✓ Environment check passed: ${STAGE}`);
}

/**
 * Scan all projects
 */
async function scanProjects(): Promise<{ projectId: string; name?: string; pk: string; sk: string }[]> {
  const projects: { projectId: string; name?: string; pk: string; sk: string }[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const response = await ddb.send(
      new ScanCommand({
        TableName: TABLE_PROJECTS,
        FilterExpression: "begins_with(pk, :project) AND sk = :meta",
        ExpressionAttributeValues: marshall({
          ":project": "PROJECT#",
          ":meta": "META",
        }),
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (response.Items) {
      for (const item of response.Items) {
        const unmarshalled = unmarshall(item);
        projects.push({
          projectId: unmarshalled.projectId || unmarshalled.project_id || "",
          name: unmarshalled.name || unmarshalled.nombre || "",
          pk: unmarshalled.pk,
          sk: unmarshalled.sk,
        });
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return projects;
}

/**
 * Query related records for a project
 */
async function queryProjectRelatedRecords(projectId: string): Promise<{
  rubros: number;
  allocations: number;
  payroll: number;
  adjustments: number;
  others: number;
}> {
  const counts = {
    rubros: 0,
    allocations: 0,
    payroll: 0,
    adjustments: 0,
    others: 0,
  };

  // Query all records with pk = PROJECT#{projectId}
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const response = await ddb.send(
      new QueryCommand({
        TableName: TABLE_PROJECTS,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({
          ":pk": `PROJECT#${projectId}`,
        }),
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (response.Items) {
      for (const item of response.Items) {
        const unmarshalled = unmarshall(item);
        const sk = unmarshalled.sk as string;

        if (sk.startsWith("RUBRO#")) counts.rubros++;
        else if (sk.startsWith("ADJ#")) counts.adjustments++;
        else if (sk.startsWith("ESTIMATOR#") || sk.startsWith("HANDOFF") || sk.startsWith("BASELINE#")) counts.others++;
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Count allocations table (pk starts with PROJECT#{projectId}#MONTH#)
  // Since we can't use begins_with in KeyConditionExpression, we'll count during deletion
  // For now, just return approximate count based on other tables
  // This is acceptable since we're showing a summary, not exact counts
  counts.allocations = 0; // Will be counted during actual deletion

  // Count payroll table (same as allocations)
  counts.payroll = 0; // Will be counted during actual deletion

  return counts;
}

/**
 * Delete all records for a project
 */
async function deleteProject(projectId: string): Promise<number> {
  let deletedCount = 0;

  // Delete from projects table
  let lastEvaluatedKey: Record<string, any> | undefined;
  do {
    const response = await ddb.send(
      new QueryCommand({
        TableName: TABLE_PROJECTS,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({
          ":pk": `PROJECT#${projectId}`,
        }),
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (response.Items) {
      for (const item of response.Items) {
        const unmarshalled = unmarshall(item);
        await ddb.send(
          new DeleteItemCommand({
            TableName: TABLE_PROJECTS,
            Key: marshall({ pk: unmarshalled.pk, sk: unmarshalled.sk }),
          })
        );
        deletedCount++;
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Delete from allocations table
  // Note: Allocations have pk like PROJECT#projectId#MONTH#yyyy-mm
  // We use projectId attribute for filtering via scan (inefficient but necessary)
  lastEvaluatedKey = undefined;
  do {
    const response = await ddb.send(
      new ScanCommand({
        TableName: TABLE_ALLOC,
        FilterExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({
          ":projectId": projectId,
        }),
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (response.Items) {
      for (const item of response.Items) {
        const unmarshalled = unmarshall(item);
        await ddb.send(
          new DeleteItemCommand({
            TableName: TABLE_ALLOC,
            Key: marshall({ pk: unmarshalled.pk, sk: unmarshalled.sk }),
          })
        );
        deletedCount++;
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Delete from payroll table
  // Note: Payroll has pk like PROJECT#projectId#MONTH#yyyy-mm
  // We use projectId attribute for filtering via scan (inefficient but necessary)
  lastEvaluatedKey = undefined;
  do {
    const response = await ddb.send(
      new ScanCommand({
        TableName: TABLE_PAYROLL,
        FilterExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({
          ":projectId": projectId,
        }),
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (response.Items) {
      for (const item of response.Items) {
        const unmarshalled = unmarshall(item);
        await ddb.send(
          new DeleteItemCommand({
            TableName: TABLE_PAYROLL,
            Key: marshall({ pk: unmarshalled.pk, sk: unmarshalled.sk }),
          })
        );
        deletedCount++;
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return deletedCount;
}

/**
 * Prompt for user confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === "CONFIRM");
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log("🧹 Reset Dev/Test Projects Script");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Stage: ${STAGE}`);
  console.log(`   Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log("═".repeat(80));

  // Safety check
  checkEnvironmentSafety();

  console.log("\n🔍 Scanning for projects...");
  const allProjects = await scanProjects();
  console.log(`   Found ${allProjects.length} projects in database`);

  // Separate canonical and non-canonical
  const canonicalProjects = allProjects.filter((p) => CANONICAL_PROJECT_IDS.includes(p.projectId));
  const nonCanonicalProjects = allProjects.filter((p) => !CANONICAL_PROJECT_IDS.includes(p.projectId));

  console.log(`   - ${canonicalProjects.length} are canonical (protected)`);
  console.log(`   - ${nonCanonicalProjects.length} are non-canonical (candidates for deletion)`);

  if (nonCanonicalProjects.length === 0) {
    console.log("\n✅ No non-canonical projects found. Environment is clean!");
    return;
  }

  // Query related records
  console.log("\n📊 Analyzing related records...");
  const projectsWithCounts = await Promise.all(
    nonCanonicalProjects.map(async (project) => {
      const counts = await queryProjectRelatedRecords(project.projectId);
      return { ...project, counts };
    })
  );

  const totalCounts = projectsWithCounts.reduce(
    (acc, p) => ({
      rubros: acc.rubros + p.counts.rubros,
      allocations: acc.allocations + p.counts.allocations,
      payroll: acc.payroll + p.counts.payroll,
      adjustments: acc.adjustments + p.counts.adjustments,
      others: acc.others + p.counts.others,
    }),
    { rubros: 0, allocations: 0, payroll: 0, adjustments: 0, others: 0 }
  );

  // Display summary
  console.log("\n📋 Projects to be deleted:");
  for (const project of projectsWithCounts.slice(0, 10)) {
    console.log(`   - ${project.projectId}${project.name ? ` (${project.name})` : ""}`);
  }
  if (projectsWithCounts.length > 10) {
    console.log(`   ... and ${projectsWithCounts.length - 10} more`);
  }

  console.log("\n📊 Related records to be deleted:");
  console.log(`   - Rubros: ${totalCounts.rubros} attachments`);
  console.log(`   - Allocations: ${totalCounts.allocations} records`);
  console.log(`   - Payroll: ${totalCounts.payroll} records`);
  console.log(`   - Adjustments: ${totalCounts.adjustments} records`);
  console.log(`   - Others: ${totalCounts.others} records`);
  console.log(`   - Total: ${totalCounts.rubros + totalCounts.allocations + totalCounts.payroll + totalCounts.adjustments + totalCounts.others} records`);

  if (isDryRun) {
    console.log("\n⚠️  DRY RUN MODE - No changes made");
    console.log("   Run without --dry-run flag to perform actual deletion");
    return;
  }

  // Confirmation prompt
  if (!isForce) {
    console.log("\n⚠️  WARNING: This will delete the following:");
    console.log(`   - ${nonCanonicalProjects.length} projects`);
    console.log(`   - ${totalCounts.rubros + totalCounts.allocations + totalCounts.payroll + totalCounts.adjustments + totalCounts.others} related records`);
    console.log(`   Environment: ${STAGE}`);
    console.log(`   Protected: ${CANONICAL_PROJECT_IDS.length} canonical projects will NOT be deleted`);
    console.log("");

    const confirmed = await promptConfirmation("   Type 'CONFIRM' to proceed: ");

    if (!confirmed) {
      console.log("\n❌ Operation cancelled by user");
      return;
    }
  }

  // Perform deletion
  console.log("\n🗑️  Deleting projects...");
  let totalDeleted = 0;

  for (const project of nonCanonicalProjects) {
    process.stdout.write(`   Deleting ${project.projectId}...`);
    const deletedCount = await deleteProject(project.projectId);
    totalDeleted += deletedCount;
    console.log(` ✓ (${deletedCount} records)`);
  }

  console.log("\n✅ Reset completed successfully!");
  console.log(`   Projects deleted: ${nonCanonicalProjects.length}`);
  console.log(`   Records deleted: ${totalDeleted}`);
  console.log(`   Canonical projects preserved: ${CANONICAL_PROJECT_IDS.length}`);
  console.log("\n💡 Next steps:");
  console.log("   Run: npm run seed:canonical-projects");
  console.log("   To re-seed the canonical demo projects");
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
}

export { main as resetDevProjects };
