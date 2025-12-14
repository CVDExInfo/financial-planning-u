/**
 * Migration Script: Backfill SDM Manager Email
 * 
 * Purpose:
 * Backfills `sdm_manager_email` field for existing projects that are missing it.
 * This fixes the RBAC regression where SDM users can't see projects without this field.
 * 
 * Strategy:
 * 1. For projects with accepted_by/aceptado_por: use that email
 * 2. For projects with created_by: use that email as fallback
 * 3. For projects without any email: report them for manual review
 * 
 * Safety:
 * - Dry run mode by default (use --apply to execute changes)
 * - Idempotent: skips projects that already have sdm_manager_email
 * - Never overwrites existing non-empty sdm_manager_email values
 * - Creates audit trail of all changes
 * 
 * Usage:
 *   # Dry run (shows what would change)
 *   AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects ts-node scripts/backfill-sdm-manager-email.ts
 * 
 *   # Apply changes
 *   AWS_REGION=us-east-2 TABLE_PROJECTS=finz_projects ts-node scripts/backfill-sdm-manager-email.ts --apply
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

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--apply");
const OUTPUT_FILE = args.includes("--output") 
  ? args[args.indexOf("--output") + 1] 
  : `migration-results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

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
  action: "updated" | "skipped" | "needs_manual_review";
  reason: string;
  derivedEmail?: string;
  existingEmail?: string;
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
  // - created_by, createdBy (fallback fields)
  
  // Priority 1: accepted_by (most reliable indicator of SDM)
  const acceptedBy = record.accepted_by || record.acceptedBy || record.aceptado_por;
  if (acceptedBy && typeof acceptedBy === "string") {
    return acceptedBy;
  }
  
  // Priority 2: created_by (fallback for SDM-created projects)
  const createdBy = record.created_by || record.createdBy;
  if (createdBy && typeof createdBy === "string") {
    return createdBy;
  }
  
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
  sdmEmail: string
): Promise<void> {
  const projectId = extractProjectId(record);
  const now = new Date().toISOString();
  
  // Update project record
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_PROJECTS,
      Key: {
        pk: record.pk,
        sk: record.sk,
      },
      UpdateExpression: "SET sdm_manager_email = :email, updated_at = :now",
      ExpressionAttributeValues: {
        ":email": sdmEmail,
        ":now": now,
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
}

async function main() {
  console.log("🔧 SDM Manager Email Backfill Migration");
  console.log("═".repeat(80));
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "APPLY (will update database)"}`);
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Projects table: ${TABLE_PROJECTS}`);
  console.log(`   Audit table: ${TABLE_AUDIT}`);
  console.log(`   Output file: ${OUTPUT_FILE}`);
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
  let updatedCount = 0;
  let skippedCount = 0;
  let needsReviewCount = 0;
  
  for (const project of projects) {
    const projectId = extractProjectId(project);
    const existingEmail = extractExistingSdmEmail(project);
    
    // Skip if already has sdm_manager_email
    if (existingEmail) {
      console.log(`✅ SKIP: ${projectId} - already has sdm_manager_email: ${existingEmail}`);
      results.push({
        projectId,
        action: "skipped",
        reason: "already_has_sdm_manager_email",
        existingEmail,
      });
      skippedCount++;
      continue;
    }
    
    // Try to derive SDM email
    const derivedEmail = deriveSDMEmail(project);
    
    if (derivedEmail) {
      // Can update
      console.log(`📝 UPDATE: ${projectId} - will set sdm_manager_email to ${derivedEmail}`);
      
      if (!DRY_RUN) {
        try {
          await updateProjectSDMEmail(project, derivedEmail);
          console.log(`   ✅ Updated successfully`);
        } catch (error) {
          console.error(`   ❌ Update failed:`, error);
          results.push({
            projectId,
            action: "needs_manual_review",
            reason: `update_failed: ${(error as Error).message}`,
            derivedEmail,
          });
          needsReviewCount++;
          continue;
        }
      }
      
      results.push({
        projectId,
        action: "updated",
        reason: "derived_from_accepted_by_or_created_by",
        derivedEmail,
      });
      updatedCount++;
    } else {
      // Cannot derive - needs manual review
      console.log(`⚠️  REVIEW: ${projectId} - no email fields found (accepted_by, created_by missing)`);
      results.push({
        projectId,
        action: "needs_manual_review",
        reason: "no_email_fields_available",
      });
      needsReviewCount++;
    }
  }
  
  // Summary
  console.log("\n" + "═".repeat(80));
  console.log("📊 Migration Summary");
  console.log("═".repeat(80));
  console.log(`   Total projects: ${projects.length}`);
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
  console.log(`\n💾 Results saved to: ${OUTPUT_FILE}`);
  
  // Show manual review items
  if (needsReviewCount > 0) {
    console.log("\n⚠️  Projects needing manual review:");
    const reviewItems = results.filter(r => r.action === "needs_manual_review");
    reviewItems.forEach(item => {
      console.log(`   - ${item.projectId}: ${item.reason}`);
    });
    console.log("\n   These projects need manual assignment of sdm_manager_email");
    console.log("   Consider using the Admin UI or running an UPDATE command");
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
