/**
 * Baseline-Aware Project Resolution for Handoff
 * 
 * This module provides functions to ensure that each baseline gets its own
 * distinct PROJECT#.../METADATA record, preventing cross-baseline overwrites
 * that caused multiple baselines to be incorrectly grouped under a single project.
 * 
 * Key Requirements:
 * - One SDMT project per baseline
 * - No cross-baseline METADATA overwrite
 * - Idempotency preserved
 * - Backward compatible with both baseline_id and baselineId fields
 */

import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";

export interface ResolveProjectParams {
  ddb: DynamoDBDocumentClient;
  tableName: (name: "projects") => string;
  incomingProjectId?: string;
  baselineId?: string;
  projectCode?: string;
  clientName?: string;
  idempotencyKey: string;
}

export interface ResolveProjectResult {
  resolvedProjectId: string;
  existingProjectMetadata?: Record<string, unknown>;
  isNewProject: boolean;
  baselineId: string;
}

/**
 * Configuration constants
 */
const MAX_SCAN_ITERATIONS = 20; // Safety limit for DynamoDB scans
const DEFAULT_PAGINATION_LIMIT = 100; // Items per scan page

/**
 * Custom error for idempotency conflicts
 */
export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

/**
 * Normalize baseline ID from various field names
 */
function normalizeBaselineId(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;
  return (obj.baseline_id as string) || (obj.baselineId as string) || null;
}

/**
 * Check if an idempotency key has been used before
 */
async function checkIdempotency(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  idempotencyKey: string
): Promise<{ exists: boolean; result?: Record<string, unknown> }> {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: "IDEMPOTENCY#HANDOFF",
        sk: idempotencyKey,
      },
    })
  );

  if (result.Item) {
    return { exists: true, result: result.Item.result as Record<string, unknown> };
  }

  return { exists: false };
}

/**
 * Get project metadata by projectId
 */
async function getProjectMetadata(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  projectId: string
): Promise<Record<string, unknown> | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: "METADATA",
      },
    })
  );

  return result.Item ? (result.Item as Record<string, unknown>) : null;
}

/**
 * Search for a project by baseline ID
 * Scans the projects table to find any project with matching baseline_id in METADATA
 */
async function findProjectByBaseline(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  baselineId: string
): Promise<{ projectId: string; metadata: Record<string, unknown> } | null> {
  console.info("[resolveProject] Searching for existing project with baseline", { baselineId });

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let iterations = 0;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression:
          "begins_with(#pk, :pkPrefix) AND #sk = :metadata AND (#baselineId = :baseline OR #baseline_id = :baseline)",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#sk": "sk",
          "#baselineId": "baselineId",
          "#baseline_id": "baseline_id",
        },
        ExpressionAttributeValues: {
          ":pkPrefix": "PROJECT#",
          ":metadata": "METADATA",
          ":baseline": baselineId,
        },
        Limit: DEFAULT_PAGINATION_LIMIT,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0] as Record<string, unknown>;
      const pk = item.pk as string;
      const projectId = pk.replace("PROJECT#", "");
      
      console.info("[resolveProject] Found existing project for baseline", {
        projectId,
        baselineId,
      });

      return { projectId, metadata: item };
    }

    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    iterations++;

    if (iterations >= MAX_SCAN_ITERATIONS) {
      console.warn("[resolveProject] Reached max scan iterations", { baselineId });
      break;
    }
  } while (lastEvaluatedKey);

  console.info("[resolveProject] No existing project found for baseline", { baselineId });
  return null;
}

/**
 * Resolve which project ID to use for a handoff based on baseline
 * 
 * This is the core function that prevents baseline collision by ensuring:
 * 1. Each baseline gets its own project
 * 2. Idempotency is preserved
 * 3. No cross-baseline overwrites
 */
export async function resolveProjectForHandoff(
  params: ResolveProjectParams
): Promise<ResolveProjectResult> {
  const {
    ddb,
    tableName,
    incomingProjectId,
    baselineId,
    idempotencyKey,
  } = params;

  const normalizedBaselineId = baselineId?.trim();

  if (!normalizedBaselineId) {
    throw new Error("baselineId is required for handoff project resolution");
  }

  console.info("[resolveProject] Starting project resolution", {
    incomingProjectId,
    baselineId: normalizedBaselineId,
    idempotencyKey,
  });

  const projectsTable = tableName("projects");

  // Step 1: Check idempotency first
  const idempotencyCheck = await checkIdempotency(ddb, projectsTable, idempotencyKey);

  if (idempotencyCheck.exists && idempotencyCheck.result) {
    const cachedProjectId = idempotencyCheck.result.projectId as string;
    const cachedBaselineId = (idempotencyCheck.result.baselineId as string) || undefined;

    console.info("[resolveProject] strategy", {
      baselineId: normalizedBaselineId,
      idempotencyKey,
      strategy: "reuse-idempotent" as const,
      resolvedProjectId: cachedProjectId,
    });

    // Verify the cached result matches the current baseline
    if (cachedBaselineId === normalizedBaselineId) {
      const metadata = await getProjectMetadata(ddb, projectsTable, cachedProjectId);

      return {
        resolvedProjectId: cachedProjectId,
        existingProjectMetadata: metadata || undefined,
        isNewProject: false,
        baselineId: normalizedBaselineId,
      };
    }

    console.warn("[resolveProject] Idempotency conflict: same key, different baseline", {
      cachedBaselineId,
      newBaselineId: normalizedBaselineId,
      idempotencyKey,
    });
    throw new IdempotencyConflictError(
      `Idempotency key "${idempotencyKey}" was previously used with baseline "${cachedBaselineId}" but is now being used with baseline "${normalizedBaselineId}"`
    );
  }

  // Step 2: Find an existing project that already owns this baseline
  const projectWithBaseline = await findProjectByBaseline(ddb, projectsTable, normalizedBaselineId);
  if (projectWithBaseline) {
    console.info("[resolveProject] strategy", {
      baselineId: normalizedBaselineId,
      idempotencyKey,
      strategy: "reuse-existing-baseline" as const,
      resolvedProjectId: projectWithBaseline.projectId,
    });

    return {
      resolvedProjectId: projectWithBaseline.projectId,
      existingProjectMetadata: projectWithBaseline.metadata,
      isNewProject: false,
      baselineId: normalizedBaselineId,
    };
  }

  // Step 3: No project owns this baseline yet - decide what to do with incomingProjectId
  let resolvedProjectId = incomingProjectId ?? `P-${crypto.randomUUID()}`;
  let existingProjectMetadata: Record<string, unknown> | undefined;

  // If a projectId was provided in the path (e.g., QA project or existing project),
  // check if it can be reused for this baseline
  if (incomingProjectId) {
    const incomingMetadata = await getProjectMetadata(ddb, projectsTable, incomingProjectId);

    if (incomingMetadata) {
      const existingBaseline = normalizeBaselineId(incomingMetadata);
      
      // CRITICAL: Never reuse a project that already has a DIFFERENT baseline
      // This prevents cross-baseline METADATA overwrites
      if (existingBaseline && existingBaseline !== normalizedBaselineId) {
        console.info("[resolveProject] Incoming project has different baseline, creating new project", {
          incomingProjectId,
          existingBaseline,
          newBaseline: normalizedBaselineId,
        });
        resolvedProjectId = `P-${crypto.randomUUID()}`;
      } else if (!existingBaseline) {
        // Project exists but has no baseline yet (e.g., QA project)
        // Assign this baseline to the project. Note: This does not verify
        // if other baselines were previously assigned and then removed; it only
        // checks that no baseline currently exists in METADATA.
        console.info("[resolveProject] Assigning baseline to project with no existing baseline", {
          incomingProjectId,
          baseline: normalizedBaselineId,
        });
        resolvedProjectId = incomingProjectId;
        existingProjectMetadata = incomingMetadata;
      } else {
        // existingBaseline === normalizedBaselineId
        // This project already owns this baseline, reuse it
        existingProjectMetadata = incomingMetadata;
      }
    }
    // else: incomingProjectId doesn't exist yet, so we can use it as-is
  }

  const strategy = existingProjectMetadata ? "reuse-existing-baseline" : "create-new-project";

  console.info("[resolveProject] strategy", {
    baselineId: normalizedBaselineId,
    idempotencyKey,
    strategy,
    resolvedProjectId,
  });

  return {
    resolvedProjectId,
    existingProjectMetadata,
    isNewProject: !existingProjectMetadata,
    baselineId: normalizedBaselineId,
  };
}
