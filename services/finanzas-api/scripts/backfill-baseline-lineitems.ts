#!/usr/bin/env ts-node
/**
 * Backfill Baseline Line Items Migration Script
 * 
 * Purpose:
 * - Iterates through accepted baselines
 * - Checks if baseline line items (rubros) exist
 * - If missing, materializes them from the baseline payload
 * - Idempotent: safe to run multiple times
 * 
 * Usage:
 *   ts-node scripts/backfill-baseline-lineitems.ts [--project PROJECT_ID] [--dry-run=false]
 * 
 * Examples:
 *   # Dry run for all projects (default)
 *   ts-node scripts/backfill-baseline-lineitems.ts
 * 
 *   # Dry run for specific project
 *   ts-node scripts/backfill-baseline-lineitems.ts --project P-c046b5d6...
 * 
 *   # Actually write changes for specific project
 *   ts-node scripts/backfill-baseline-lineitems.ts --project P-c046b5d6... --dry-run=false
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { materializeRubrosForBaseline } from "../src/lib/materializers";

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const ddb = DynamoDBDocumentClient.from(client);

// Parse command line arguments
const args = process.argv.slice(2);
const projectIdArg = args.find((arg) => arg.startsWith("--project="))?.split("=")[1];
const dryRunArg = args.find((arg) => arg.startsWith("--dry-run="))?.split("=")[1];
const isDryRun = dryRunArg !== "false"; // Default to dry run

// Table names from environment or use defaults
const PROJECTS_TABLE = process.env.PROJECTS_TABLE || "finanzas-sd-projects";
const RUBROS_TABLE = process.env.RUBROS_TABLE || "finanzas-sd-rubros";
const PREFACTURAS_TABLE = process.env.PREFACTURAS_TABLE || "finanzas-sd-prefacturas";

// Constants
const MAX_SCAN_PAGES = 100; // Safety limit to prevent infinite pagination loops

interface ProjectMetadata {
  pk: string;
  sk: string;
  project_id?: string;
  projectId?: string;
  baseline_id?: string;
  baselineId?: string;
  baseline_status?: string;
  baselineStatus?: string;
  [key: string]: unknown;
}

interface BaselineMetadata {
  pk: string;
  sk: string;
  baseline_id?: string;
  baselineId?: string;
  project_id?: string;
  projectId?: string;
  payload?: {
    labor_estimates?: any[];
    non_labor_estimates?: any[];
    [key: string]: unknown;
  };
  labor_estimates?: any[];
  non_labor_estimates?: any[];
  [key: string]: unknown;
}

/**
 * Get accepted baselines from projects table
 */
async function getAcceptedBaselines(targetProjectId?: string): Promise<ProjectMetadata[]> {
  const acceptedBaselines: ProjectMetadata[] = [];
  
  if (targetProjectId) {
    // Query specific project
    console.log(`📋 Fetching project: ${targetProjectId}`);
    
    const result = await ddb.send(
      new GetCommand({
        TableName: PROJECTS_TABLE,
        Key: {
          pk: `PROJECT#${targetProjectId}`,
          sk: "METADATA",
        },
      })
    );
    
    if (result.Item) {
      const baselineStatus = result.Item.baseline_status || result.Item.baselineStatus;
      if (baselineStatus === "accepted") {
        acceptedBaselines.push(result.Item as ProjectMetadata);
      } else {
        console.log(`⚠️  Project ${targetProjectId} baseline status: ${baselineStatus} (not accepted)`);
      }
    } else {
      console.log(`❌ Project ${targetProjectId} not found`);
    }
  } else {
    // Scan all projects for accepted baselines
    console.log("📋 Scanning all projects for accepted baselines...");
    
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    let pageCount = 0;
    
    do {
      const result = await ddb.send(
        new ScanCommand({
          TableName: PROJECTS_TABLE,
          FilterExpression:
            "begins_with(pk, :pkPrefix) AND sk = :sk AND (#baseline_status = :accepted)",
          ExpressionAttributeNames: {
            "#baseline_status": "baseline_status",
          },
          ExpressionAttributeValues: {
            ":pkPrefix": "PROJECT#",
            ":sk": "METADATA",
            ":accepted": "accepted",
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
      
      if (result.Items) {
        acceptedBaselines.push(...(result.Items as ProjectMetadata[]));
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
      pageCount++;
      
      if (pageCount > MAX_SCAN_PAGES) {
        console.warn(`⚠️  Exceeded ${MAX_SCAN_PAGES} pages while scanning projects. Stopping.`);
        break;
      }
    } while (lastEvaluatedKey);
  }
  
  console.log(`✅ Found ${acceptedBaselines.length} accepted baseline(s)`);
  return acceptedBaselines;
}

/**
 * Check if baseline has existing rubros
 */
async function hasBaselineRubros(projectId: string, baselineId: string): Promise<boolean> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: RUBROS_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `PROJECT#${projectId}`,
        ":sk": `RUBRO#`,
      },
      Limit: 10, // Just check if any exist
    })
  );
  
  // Check if any rubros match this baseline
  const rubros = result.Items || [];
  const matchingRubros = rubros.filter((rubro) => {
    // Check both top-level and metadata baseline_id
    const rubroBaselineId =
      rubro.baselineId ||
      rubro.baseline_id ||
      rubro.metadata?.baseline_id ||
      rubro.metadata?.baselineId;
    
    // Also check if SK contains the baseline ID
    const skContainsBaseline = rubro.sk?.includes(baselineId);
    
    return rubroBaselineId === baselineId || skContainsBaseline;
  });
  
  return matchingRubros.length > 0;
}

/**
 * Get baseline payload from prefacturas table
 */
async function getBaselinePayload(baselineId: string): Promise<BaselineMetadata | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: PREFACTURAS_TABLE,
      Key: {
        pk: `BASELINE#${baselineId}`,
        sk: "METADATA",
      },
    })
  );
  
  return result.Item as BaselineMetadata | null;
}

/**
 * Backfill baseline line items for a single project
 */
async function backfillProject(
  project: ProjectMetadata,
  dryRun: boolean
): Promise<{ success: boolean; error?: string; materialized?: number }> {
  const projectId = project.project_id || project.projectId || project.pk.replace("PROJECT#", "");
  const baselineId = project.baseline_id || project.baselineId;
  
  if (!baselineId) {
    return { success: false, error: "No baseline_id found" };
  }
  
  console.log(`\n📦 Processing: ${projectId} (baseline: ${baselineId})`);
  
  // Check if rubros already exist
  const hasRubros = await hasBaselineRubros(projectId, baselineId);
  
  if (hasRubros) {
    console.log(`  ✓ Rubros already exist for this baseline. Skipping.`);
    return { success: true, materialized: 0 };
  }
  
  console.log(`  ⚠️  No rubros found. Fetching baseline payload...`);
  
  // Get baseline payload
  const baseline = await getBaselinePayload(baselineId);
  
  if (!baseline) {
    return { success: false, error: "Baseline payload not found in prefacturas table" };
  }
  
  // Check if baseline has estimates
  const payload = baseline.payload || {};
  const laborEstimates = baseline.labor_estimates || payload.labor_estimates || [];
  const nonLaborEstimates = baseline.non_labor_estimates || payload.non_labor_estimates || [];
  
  if (laborEstimates.length === 0 && nonLaborEstimates.length === 0) {
    console.log(`  ⚠️  Baseline has no estimates to materialize.`);
    return { success: true, materialized: 0 };
  }
  
  console.log(
    `  📊 Found ${laborEstimates.length} labor + ${nonLaborEstimates.length} non-labor estimates`
  );
  
  // Materialize rubros
  if (dryRun) {
    console.log(`  🔍 [DRY RUN] Would materialize rubros for baseline ${baselineId}`);
    const result = await materializeRubrosForBaseline(baseline as any, { dryRun: true });
    return { success: true, materialized: result.rubrosPlanned || 0 };
  } else {
    console.log(`  ✍️  Materializing rubros for baseline ${baselineId}...`);
    try {
      const result = await materializeRubrosForBaseline(baseline as any, { dryRun: false });
      console.log(`  ✅ Materialized ${result.rubrosWritten || 0} rubros`);
      return { success: true, materialized: result.rubrosWritten || 0 };
    } catch (error) {
      console.error(`  ❌ Failed to materialize rubros:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 Baseline Line Items Backfill Script");
  console.log("======================================\n");
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes will be made)" : "LIVE (will write to database)"}`);
  console.log(`Target: ${projectIdArg || "All accepted baselines"}\n`);
  
  const acceptedBaselines = await getAcceptedBaselines(projectIdArg);
  
  if (acceptedBaselines.length === 0) {
    console.log("\n✅ No baselines to process. Exiting.");
    return;
  }
  
  const results = {
    total: acceptedBaselines.length,
    skipped: 0,
    materialized: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  for (const project of acceptedBaselines) {
    const result = await backfillProject(project, isDryRun);
    
    if (result.success) {
      if (result.materialized && result.materialized > 0) {
        results.materialized++;
      } else {
        results.skipped++;
      }
    } else {
      results.failed++;
      if (result.error) {
        results.errors.push(result.error);
      }
    }
  }
  
  console.log("\n\n📊 Summary");
  console.log("==========");
  console.log(`Total baselines:     ${results.total}`);
  console.log(`Skipped (existing):  ${results.skipped}`);
  console.log(`Materialized:        ${results.materialized}`);
  console.log(`Failed:              ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log("\n❌ Errors:");
    results.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  if (isDryRun) {
    console.log("\n💡 This was a dry run. Use --dry-run=false to apply changes.");
  } else {
    console.log("\n✅ Backfill complete!");
  }
}

// Run the script
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
