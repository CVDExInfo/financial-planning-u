/**
 * Migration Script: Backfill SDM Manager Email
 * 
 * Purpose:
 * Backfills `sdm_manager_email` field for existing projects that are missing it.
 * This fixes the RBAC regression where SDM users can't see projects without this field.
 * 
 * Strategy:
 * 1. For projects with accepted_by/aceptado_por: use that email
 * 2. For projects without accepted_by: report them for manual review in needs_manual_assignment.json
 * 
 * CRITICAL SAFETY:
 * - Does NOT use created_by as fallback (RBAC filter handles that at runtime)
 * - Dry run mode by default (use --apply to execute changes)
 * - Requires CONFIRM_PROD_BACKFILL=YES for prod/stg environments
 * - Idempotent: skips projects that already have sdm_manager_email
 * - Never overwrites existing non-empty sdm_manager_email values
 * - Creates audit trail of all changes
 * - Throttling: processes in batches with delays
 * - Retry logic: exponential backoff on throttling errors
 * 
 * Usage:
 *   # Dry run (shows what would change) - ALWAYS RUN THIS FIRST
 *   AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects STAGE=dev \
 *     ts-node scripts/backfill-sdm-manager-email.ts
 * 
 *   # Apply changes (dev/test environments)
 *   AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects STAGE=dev \
 *     ts-node scripts/backfill-sdm-manager-email.ts --apply
 * 
 *   # Apply changes (prod/stg - requires explicit confirmation)
 *   AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects STAGE=prod \
 *     CONFIRM_PROD_BACKFILL=YES \
 *     ts-node scripts/backfill-sdm-manager-email.ts --apply
 * 
 *   # With custom output file
 *   ts-node scripts/backfill-sdm-manager-email.ts --apply --output migration-results.json
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { writeFileSync } from "fs";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_AUDIT = process.env.TABLE_AUDIT || "finz_audit_log";
const STAGE = process.env.STAGE || process.env.ENVIRONMENT || "dev";

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--apply");
const OUTPUT_FILE = args.includes("--output") 
  ? args[args.indexOf("--output") + 1] 
  : `migration-results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const MANUAL_ASSIGNMENTS_FILE = `needs_manual_assignment-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

// SAFETY: Require explicit confirmation for prod/stg environments
if ((STAGE === "prod" || STAGE === "production" || STAGE === "stg" || STAGE === "staging") && !DRY_RUN) {
  const confirmProd = process.env.CONFIRM_PROD_BACKFILL;
  if (confirmProd !== "YES") {
    console.error("❌ SAFETY CHECK FAILED");
    console.error(`   Attempting to run migration in ${STAGE} environment`);
    console.error("   Set CONFIRM_PROD_BACKFILL=YES environment variable to proceed");
    console.error("   Example: CONFIRM_PROD_BACKFILL=YES ts-node scripts/backfill-sdm-manager-email.ts --apply");
    process.exit(1);
  }
}

const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

// Throttling configuration
const UPDATE_BATCH_SIZE = 25; // Process in batches
const BATCH_DELAY_MS = 1000; // 1 second between batches

interface ProjectRecord {
  pk: string;
  sk: string;
  projectId?: string;
  project_id?: string;
  name?: string;
  nombre?: string;
  sdm_manager_email?: string;
  accepted_by?: string;
  acceptedBy?: string;
  aceptado_por?: string;
  created_by?: string;
  createdBy?: string;
  baseline_id?: string;
  baselineId?: string;
  [key: string]: unknown;
}

interface MigrationResult {
  projectId: string;
  pk: string;
  action: "updated" | "skipped" | "needs_manual_review";
  reason: string;
  derivedEmail?: string;
  existingEmail?: string;
  existingFields?: {
    sdm_manager_email?: string;
    accepted_by?: string;
    aceptado_por?: string;
    created_by?: string;
  };
}

interface MigrationSummary {
  timestamp: string;
  dryRun: boolean;
  totalProjects: number;
  updated: number;
  skipped: number;
  needsManualReview: number;
  results: MigrationResult[];
}

function extractProjectId(record: ProjectRecord): string {
  // Support multiple field name formats for backward compatibility:
  // - projectId (camelCase, newer records)
  // - project_id (snake_case, legacy records)
  // - pk extraction (fallback for very old records)
  return (
    record.projectId ||
    record.project_id ||
    (record.pk?.startsWith("PROJECT#") ? record.pk.replace("PROJECT#", "") : "") ||
    "UNKNOWN"
  );
}

function extractExistingSdmEmail(record: ProjectRecord): string | undefined {
  return record.sdm_manager_email;
}

function deriveSDMEmail(record: ProjectRecord): string | undefined {
  // Support multiple field name formats for backward compatibility:
  // - accepted_by, acceptedBy (camelCase/snake_case variants)
  // - aceptado_por (Spanish legacy field)
  
  // CRITICAL SAFETY: ONLY derive from accepted_by/aceptado_por fields
  // DO NOT use created_by as fallback (per security requirement)
  // The RBAC filter handles created_by visibility at runtime
  
  // Priority: accepted_by (most reliable indicator of SDM)
  const acceptedBy = record.accepted_by || record.acceptedBy || record.aceptado_por;
  if (acceptedBy && typeof acceptedBy === "string") {
    return acceptedBy;
  }
  
  // No fallback to created_by - return undefined for manual review
  return undefined;
}

async function scanAllProjects(): Promise<ProjectRecord[]> {
  const projects: ProjectRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_PROJECTS,
        FilterExpression: "begins_with(pk, :pkPrefix) AND (#sk = :metadata OR #sk = :meta)",
        ExpressionAttributeNames: {
          "#sk": "sk",
        },
        ExpressionAttributeValues: {
          ":pkPrefix": "PROJECT#",
          ":metadata": "METADATA",
          ":meta": "META",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    
    projects.push(...(result.Items || []) as ProjectRecord[]);
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);
  
  return projects;
}

async function updateProjectSDMEmail(
  record: ProjectRecord,
  sdmEmail: string,
  retryCount = 0
): Promise<void> {
  const projectId = extractProjectId(record);
  const now = new Date().toISOString();
  
  const maxRetries = 3;
  const backoffMs = 1000 * Math.pow(2, retryCount); // Exponential backoff
  
  try {
    // Update project record with safety condition
    // Only update if sdm_manager_email doesn't exist or is empty
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_PROJECTS,
        Key: {
          pk: record.pk,
          sk: record.sk,
        },
        UpdateExpression: "SET sdm_manager_email = :email, updated_at = :now",
        ConditionExpression: "(attribute_not_exists(sdm_manager_email) OR sdm_manager_email = :empty)",
        ExpressionAttributeValues: {
          ":email": sdmEmail,
          ":now": now,
          ":empty": "",
        },
      })
    );
    
    // Create audit trail
    await ddb.send(
      new PutCommand({
        TableName: TABLE_AUDIT,
        Item: {
          pk: `ENTITY#PROJECT#${projectId}`,
          sk: `TS#${now}`,
          action: "BACKFILL_SDM_MANAGER_EMAIL",
          resource_type: "project",
          resource_id: projectId,
          user: "migration-script",
          timestamp: now,
          before: {
            sdm_manager_email: record.sdm_manager_email,
          },
          after: {
            sdm_manager_email: sdmEmail,
          },
          source: "MIGRATION",
          migration_script: "backfill-sdm-manager-email.ts",
        },
      })
    );
  } catch (error) {
    const errorName = (error as any).name;
    
    // Skip if condition fails (sdm_manager_email was set by another process)
    if (errorName === "ConditionalCheckFailedException") {
      console.log(`   ⚠️  Skipped - sdm_manager_email already set (concurrent update)`);
      throw new Error("SKIP_CONCURRENT_UPDATE");
    }
    
    // Retry on throttling errors
    if (retryCount < maxRetries && errorName === "ProvisionedThroughputExceededException") {
      console.log(`   ⚠️  Throttled, retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return updateProjectSDMEmail(record, sdmEmail, retryCount + 1);
    }
    throw error;
  }
}

// Helper to sleep between batches
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🔧 SDM Manager Email Backfill Migration");
  console.log("═".repeat(80));
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "APPLY (will update database)"}`);
  console.log(`   Stage: ${STAGE}`);
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Projects table: ${TABLE_PROJECTS}`);
  console.log(`   Audit table: ${TABLE_AUDIT}`);
  console.log(`   Output file: ${OUTPUT_FILE}`);
  console.log(`   Manual assignments file: ${MANUAL_ASSIGNMENTS_FILE}`);
  console.log("═".repeat(80));
  
  if (DRY_RUN) {
    console.log("\n⚠️  DRY RUN MODE: No changes will be made to the database");
    console.log("   Use --apply flag to execute changes");
  }
  
  // Scan all projects
  console.log("\n📊 Scanning projects table...");
  const projects = await scanAllProjects();
  console.log(`   Found ${projects.length} projects`);
  
  // Analyze and migrate
  console.log("\n🔍 Analyzing projects...\n");
  const results: MigrationResult[] = [];
  const manualAssignments: Array<{
    projectId: string;
    pk: string;
    reason: string;
    existingFields: Record<string, unknown>;
  }> = [];
  let updatedCount = 0;
  let skippedCount = 0;
  let needsReviewCount = 0;
  let batchCount = 0;
  
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const projectId = extractProjectId(project);
    const existingEmail = extractExistingSdmEmail(project);
    
    // Skip if already has sdm_manager_email
    if (existingEmail) {
      console.log(`✅ SKIP: ${projectId} - already has sdm_manager_email: ${existingEmail}`);
      results.push({
        projectId,
        pk: project.pk,
        action: "skipped",
        reason: "already_has_sdm_manager_email",
        existingEmail,
      });
      skippedCount++;
      continue;
    }
    
    // Try to derive SDM email (only from accepted_by, NOT created_by)
    const derivedEmail = deriveSDMEmail(project);
    
    if (derivedEmail) {
      // Can update
      console.log(`📝 UPDATE: ${projectId} - will set sdm_manager_email to ${derivedEmail}`);
      
      if (!DRY_RUN) {
        try {
          await updateProjectSDMEmail(project, derivedEmail);
          console.log(`   ✅ Updated successfully`);
          
          // Throttle: small delay after each update to reduce write bursts
          await sleep(200); // 200ms delay as recommended
          
          // Additional batch-level throttle
          batchCount++;
          if (batchCount % UPDATE_BATCH_SIZE === 0) {
            console.log(`   ⏳ Processed ${batchCount} updates, sleeping ${BATCH_DELAY_MS}ms...`);
            await sleep(BATCH_DELAY_MS);
          }
        } catch (error) {
          const errorMsg = (error as Error).message;
          
          // Handle concurrent update (ConditionExpression failed)
          if (errorMsg === "SKIP_CONCURRENT_UPDATE") {
            console.log(`   ℹ️  Skipping - already has sdm_manager_email`);
            results.push({
              projectId,
              pk: project.pk,
              action: "skipped",
              reason: "concurrent_update_detected",
              existingEmail: "(set by another process)",
            });
            skippedCount++;
            continue;
          }
          
          console.error(`   ❌ Update failed:`, error);
          results.push({
            projectId,
            pk: project.pk,
            action: "needs_manual_review",
            reason: `update_failed: ${errorMsg}`,
            derivedEmail,
            existingFields: {
              accepted_by: project.accepted_by,
              aceptado_por: project.aceptado_por,
              created_by: project.created_by,
            },
          });
          manualAssignments.push({
            projectId,
            pk: project.pk,
            reason: `update_failed: ${errorMsg}`,
            existingFields: {
              accepted_by: project.accepted_by,
              aceptado_por: project.aceptado_por,
              created_by: project.created_by,
              name: project.name || project.nombre,
            },
          });
          needsReviewCount++;
          continue;
        }
      }
      
      results.push({
        projectId,
        pk: project.pk,
        action: "updated",
        reason: "derived_from_accepted_by",
        derivedEmail,
      });
      updatedCount++;
    } else {
      // Cannot derive - needs manual review
      console.log(`⚠️  REVIEW: ${projectId} - no accepted_by field found (created_by is NOT used for backfill)`);
      results.push({
        projectId,
        pk: project.pk,
        action: "needs_manual_review",
        reason: "no_accepted_by_field_available",
        existingFields: {
          accepted_by: project.accepted_by,
          aceptado_por: project.aceptado_por,
          created_by: project.created_by,
        },
      });
      manualAssignments.push({
        projectId,
        pk: project.pk,
        reason: "no_accepted_by_field_available",
        existingFields: {
          accepted_by: project.accepted_by,
          aceptado_por: project.aceptado_por,
          created_by: project.created_by,
          name: project.name || project.nombre,
          client: project.client || project.cliente,
        },
      });
      needsReviewCount++;
    }
  }
  
  // Summary
  console.log("\n" + "═".repeat(80));
  console.log("📊 Migration Summary");
  console.log("═".repeat(80));
  console.log(`   Total projects scanned: ${projects.length}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped (already set): ${skippedCount}`);
  console.log(`   Needs manual review: ${needsReviewCount}`);
  console.log("═".repeat(80));
  
  // Create summary object
  const summary: MigrationSummary = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    totalProjects: projects.length,
    updated: updatedCount,
    skipped: skippedCount,
    needsManualReview: needsReviewCount,
    results,
  };
  
  // Write results to file
  writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Full results saved to: ${OUTPUT_FILE}`);
  
  // Write manual assignments file
  if (manualAssignments.length > 0) {
    writeFileSync(MANUAL_ASSIGNMENTS_FILE, JSON.stringify(manualAssignments, null, 2));
    console.log(`💾 Manual assignments file saved to: ${MANUAL_ASSIGNMENTS_FILE}`);
  }
  
  // Show manual review items
  if (needsReviewCount > 0) {
    console.log("\n⚠️  Projects needing manual review:");
    const reviewItems = results.filter(r => r.action === "needs_manual_review");
    reviewItems.slice(0, 10).forEach(item => {
      console.log(`   - ${item.projectId} (${item.pk}): ${item.reason}`);
    });
    if (reviewItems.length > 10) {
      console.log(`   ... and ${reviewItems.length - 10} more (see ${MANUAL_ASSIGNMENTS_FILE})`);
    }
    console.log("\n   ℹ️  These projects need manual assignment of sdm_manager_email");
    console.log(`   ℹ️  Full list exported to: ${MANUAL_ASSIGNMENTS_FILE}`);
    console.log("   ℹ️  Options:");
    console.log("      1. Use Admin UI to assign SDM manager");
    console.log("      2. Run DynamoDB UpdateItem commands manually");
    console.log("      3. Contact PMO to determine correct SDM assignment");
  }
  
  if (DRY_RUN) {
    console.log("\n⚠️  This was a DRY RUN - no changes were made");
    console.log("   Run with --apply flag to execute the migration");
  } else {
    console.log("\n✅ Migration completed successfully");
  }
}

// Run migration
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
