/**
 * Migration Script: Normalize Project Data Model
 * 
 * Purpose: Populate canonical English fields on existing projects
 * 
 * This script:
 * 1. Scans all PROJECT# items from the projects table
 * 2. For each project, derives canonical fields from mixed Spanish/English data
 * 3. Updates each project with canonical fields (preserving existing fields)
 * 4. Logs any duplicates or ambiguities for manual review
 * 
 * Usage:
 *   AWS_PROFILE=finanzas-dev ts-node scripts/finanzas-migrations/2025-12-normalize-projects.ts
 *   
 * Or in CI with OIDC:
 *   ts-node scripts/finanzas-migrations/2025-12-normalize-projects.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-2";
const tableName = process.env.TABLE_PROJECTS || "finz_projects";

const client = new DynamoDBClient({ region });
const ddb = DynamoDBDocumentClient.from(client);

interface ProjectRecord {
  pk: string;
  sk: string;
  [key: string]: unknown;
}

interface CanonicalFields {
  // Core fields
  code?: string;
  name?: string;
  client?: string;
  description?: string;
  status?: string;
  currency?: string;
  modTotal?: number;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  
  // ABAC fields
  sdmManagerEmail?: string;
  sdmManagerName?: string;
  pmLeadEmail?: string;
  
  // Baseline
  baselineId?: string;
  baselineStatus?: string;
  baselineAcceptedAt?: string;
}

function firstNonEmpty(...values: Array<unknown>): string | undefined {
  for (const val of values) {
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
}

function firstNumber(...values: Array<unknown>): number | undefined {
  for (const val of values) {
    const num = Number(val);
    if (!Number.isNaN(num) && num >= 0) {
      return num;
    }
  }
  return undefined;
}

function firstDate(...values: Array<unknown>): string | undefined {
  for (const val of values) {
    if (typeof val === "string" && val.trim().length > 0) {
      const date = new Date(val);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  return undefined;
}

function extractSDMEmail(record: ProjectRecord): string | undefined {
  const explicit = firstNonEmpty(record.sdm_manager_email);
  if (explicit) return explicit;
  
  const acceptedBy = firstNonEmpty(
    record.accepted_by,
    record.acceptedBy,
    record.aceptado_por
  );
  
  if (acceptedBy) {
    const lower = acceptedBy.toLowerCase();
    if (lower.includes("sdm") || lower.includes("sd.")) {
      return acceptedBy;
    }
    return acceptedBy;
  }
  
  return undefined;
}

function extractPMEmail(record: ProjectRecord): string | undefined {
  return firstNonEmpty(record.pm_lead_email);
}

function generateProjectCode(projectId: string, baselineId?: string): string {
  const MAX_CLEAN_CODE_LENGTH = 20;
  const CODE_SUFFIX_LENGTH = 8;
  
  const isLongUuid = /^P-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  
  if (projectId.length > MAX_CLEAN_CODE_LENGTH || isLongUuid) {
    if (baselineId) {
      const baselineIdShort = baselineId
        .replace(/^base_/, '')
        .substring(0, CODE_SUFFIX_LENGTH);
      return `P-${baselineIdShort}`;
    }
    
    const uuidPart = projectId.replace(/^P-/, '').replace(/-/g, '');
    return `P-${uuidPart.substring(0, CODE_SUFFIX_LENGTH)}`;
  }
  
  return projectId;
}

function deriveCanonicalFields(record: ProjectRecord): CanonicalFields {
  let projectId = firstNonEmpty(
    record.project_id,
    record.projectId,
    record.id
  );
  
  if (!projectId && typeof record.pk === "string" && record.pk.startsWith("PROJECT#")) {
    projectId = record.pk.replace("PROJECT#", "");
  }
  
  if (!projectId) {
    projectId = String(record.pk ?? record.sk ?? "UNKNOWN");
  }
  
  const baselineId = firstNonEmpty(record.baseline_id, record.baselineId);
  const existingCode = firstNonEmpty(record.code, record.codigo);
  const code = existingCode || generateProjectCode(projectId, baselineId);
  
  return {
    code,
    name: firstNonEmpty(record.name, record.nombre),
    client: firstNonEmpty(record.client, record.cliente),
    description: firstNonEmpty(record.description, record.descripcion),
    status: firstNonEmpty(record.status, record.estado),
    currency: firstNonEmpty(record.currency, record.moneda),
    modTotal: firstNumber(
      record.mod_total,
      record.presupuesto_total,
      record.totalBudget
    ),
    startDate: firstDate(record.start_date, record.fecha_inicio),
    endDate: firstDate(record.end_date, record.fecha_fin),
    createdAt: firstDate(record.created_at),
    updatedAt: firstDate(record.updated_at),
    createdBy: firstNonEmpty(record.created_by),
    
    sdmManagerEmail: extractSDMEmail(record),
    sdmManagerName: firstNonEmpty(record.sdm_manager_name, record.sd_manager_name),
    pmLeadEmail: extractPMEmail(record),
    
    baselineId,
    baselineStatus: firstNonEmpty(record.baseline_status, record.baselineStatus),
    baselineAcceptedAt: firstDate(
      record.baseline_accepted_at,
      record.baselineAcceptedAt
    ),
  };
}

async function scanProjects(): Promise<ProjectRecord[]> {
  console.log(`[migration] Scanning table: ${tableName}`);
  
  const projects: ProjectRecord[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;
  
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(#pk, :prefix) AND (#sk = :metadata OR #sk = :meta)",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#sk": "sk",
        },
        ExpressionAttributeValues: {
          ":prefix": "PROJECT#",
          ":metadata": "METADATA",
          ":meta": "META",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    
    if (result.Items) {
      projects.push(...(result.Items as ProjectRecord[]));
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
    
    console.log(`[migration] Scanned ${projects.length} projects so far...`);
  } while (lastEvaluatedKey);
  
  console.log(`[migration] Scan complete. Total projects: ${projects.length}`);
  return projects;
}

async function updateProject(record: ProjectRecord, canonical: CanonicalFields) {
  const projectId = record.pk.replace("PROJECT#", "");
  
  // Build update expression
  const updates: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};
  
  let idx = 0;
  
  Object.entries(canonical).forEach(([key, value]) => {
    if (value !== undefined) {
      const attrName = `#attr${idx}`;
      const attrValue = `:val${idx}`;
      
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
      updates.push(`${attrName} = ${attrValue}`);
      
      idx++;
    }
  });
  
  if (updates.length === 0) {
    console.log(`[migration] No updates needed for ${projectId}`);
    return;
  }
  
  const updateExpression = `SET ${updates.join(", ")}`;
  
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          pk: record.pk,
          sk: record.sk,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
    
    console.log(`[migration] ✓ Updated ${projectId} with ${updates.length} canonical fields`);
  } catch (error) {
    console.error(`[migration] ✗ Failed to update ${projectId}:`, error);
    throw error;
  }
}

interface DuplicateReport {
  projectId: string;
  code: string;
  duplicateCount: number;
}

function detectDuplicates(projects: ProjectRecord[]): DuplicateReport[] {
  const codeMap = new Map<string, ProjectRecord[]>();
  
  projects.forEach((project) => {
    const canonical = deriveCanonicalFields(project);
    const code = canonical.code || "UNKNOWN";
    
    if (!codeMap.has(code)) {
      codeMap.set(code, []);
    }
    codeMap.get(code)!.push(project);
  });
  
  const duplicates: DuplicateReport[] = [];
  
  codeMap.forEach((records, code) => {
    if (records.length > 1) {
      records.forEach((record) => {
        const projectId = record.pk.replace("PROJECT#", "");
        duplicates.push({
          projectId,
          code,
          duplicateCount: records.length,
        });
      });
    }
  });
  
  return duplicates;
}

async function main() {
  console.log("[migration] Starting project data model normalization");
  console.log(`[migration] Target table: ${tableName}`);
  console.log(`[migration] Region: ${region}`);
  console.log("");
  
  try {
    // Step 1: Scan all projects
    const projects = await scanProjects();
    
    if (projects.length === 0) {
      console.log("[migration] No projects found. Exiting.");
      return;
    }
    
    // Step 2: Detect duplicates
    console.log("\n[migration] Checking for duplicates...");
    const duplicates = detectDuplicates(projects);
    
    if (duplicates.length > 0) {
      console.log(`\n[migration] ⚠️  Found ${duplicates.length} potential duplicate projects:`);
      duplicates.forEach((dup) => {
        console.log(`  - ${dup.projectId} (code: ${dup.code}, ${dup.duplicateCount} total with same code)`);
      });
      console.log("\n[migration] NOTE: These duplicates should be reviewed manually.");
      console.log("[migration] Migration will proceed to update all projects.\n");
    } else {
      console.log("[migration] No duplicates detected.\n");
    }
    
    // Step 3: Update each project
    console.log("[migration] Updating projects with canonical fields...\n");
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const project of projects) {
      try {
        const canonical = deriveCanonicalFields(project);
        
        // Check if project already has all canonical fields
        const hasAllFields = Object.keys(canonical).every((key) => {
          return project[key] !== undefined;
        });
        
        if (hasAllFields) {
          skipCount++;
          continue;
        }
        
        await updateProject(project, canonical);
        successCount++;
      } catch (error) {
        console.error(`[migration] Failed to process project:`, error);
        failCount++;
      }
    }
    
    console.log("\n[migration] Migration complete!");
    console.log(`[migration] Total projects: ${projects.length}`);
    console.log(`[migration] Updated: ${successCount}`);
    console.log(`[migration] Skipped (already canonical): ${skipCount}`);
    console.log(`[migration] Failed: ${failCount}`);
    
    if (duplicates.length > 0) {
      console.log(`\n[migration] ⚠️  ${duplicates.length} duplicate projects require manual review.`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("[migration] Fatal error:", error);
    process.exit(1);
  }
}

main();
