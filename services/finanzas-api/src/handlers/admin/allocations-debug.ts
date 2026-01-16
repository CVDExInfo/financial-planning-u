import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { ddb, tableName, QueryCommand, GetCommand } from "../../lib/dynamo";
import { ok, bad, serverError } from "../../lib/http";
import { logError } from "../../utils/logging";

/**
 * Admin debug endpoint for diagnosing allocation retrieval issues
 * GET /admin/allocations/verify?projectId=<id>
 * 
 * Returns diagnostic information about which partition keys exist in the allocations table
 * and sample items for each attempted key.
 * 
 * IMPORTANT: This endpoint should be gated by ENABLE_ADMIN_DEBUG environment variable
 * to prevent exposure in production.
 */

/**
 * Configuration constants for debug endpoint
 */
const DEBUG_CONFIG = {
  /** Maximum number of items to query for debugging */
  QUERY_LIMIT: 100,
  /** Maximum number of sample items to return per key */
  MAX_SAMPLES: 5,
} as const;

interface TriedKey {
  key: string;
  count: number;
  sampleItems?: any[];
}

/**
 * Get baseline metadata from DynamoDB
 */
async function getBaselineMetadata(baselineId: string): Promise<any> {
  try {
    const prefacturasTable = tableName("prefacturas");
    const lookup = await ddb.send(
      new GetCommand({
        TableName: prefacturasTable,
        Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      })
    );
    return lookup.Item || null;
  } catch (err: any) {
    console.error('[allocations-debug] Failed to get baseline metadata', {
      baselineId,
      error: err.name,
      message: err.message,
    });
    return null;
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResult> => {
  try {
    // Gate endpoint behind environment variable
    if (process.env.ENABLE_ADMIN_DEBUG !== "true") {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: "Admin debug endpoint is disabled. Set ENABLE_ADMIN_DEBUG=true to enable." 
        }),
      };
    }

    const incomingId = event.queryStringParameters?.projectId;
    
    if (!incomingId) {
      return bad(event, "Missing projectId query parameter");
    }

    const allocationsTable = tableName("allocations");
    const triedKeys: TriedKey[] = [];
    const timestamp = new Date().toISOString();

    // Helper to query and capture results
    async function queryByPK(pk: string): Promise<any[]> {
      const queryResult = await ddb.send(
        new QueryCommand({
          TableName: allocationsTable,
          KeyConditionExpression: "#pk = :pk",
          ExpressionAttributeNames: {
            "#pk": "pk",
          },
          ExpressionAttributeValues: {
            ":pk": pk,
          },
          Limit: DEBUG_CONFIG.QUERY_LIMIT,
        })
      );

      const items = queryResult.Items || [];
      const sampleItems = items.slice(0, DEBUG_CONFIG.MAX_SAMPLES);
      
      triedKeys.push({
        key: pk,
        count: items.length,
        sampleItems,
      });

      return items;
    }

    // Check if incoming ID looks like a baseline ID
    const isBaselineLike = /^(base_|base-|base|BL-|BL_)/i.test(incomingId);

    // Attempt 1: PROJECT#${incomingId}
    let pkCandidate = `PROJECT#${incomingId}`;
    let items = await queryByPK(pkCandidate);

    // Attempt 2: If baseline-like, resolve baseline→project
    let resolvedProjectId: string | null = null;
    if (isBaselineLike) {
      const baseline = await getBaselineMetadata(incomingId);
      if (baseline) {
        resolvedProjectId = baseline.project_id || baseline.projectId;
        if (resolvedProjectId && resolvedProjectId !== incomingId) {
          pkCandidate = `PROJECT#${resolvedProjectId}`;
          items = await queryByPK(pkCandidate);
        }
      }
    }

    // Attempt 3: If baseline-like, try BASELINE# pk
    if (isBaselineLike) {
      pkCandidate = `BASELINE#${incomingId}`;
      items = await queryByPK(pkCandidate);
    }

    // Build diagnostic response
    const diagnostics = {
      timestamp,
      incomingId,
      isBaselineLike,
      resolvedProjectId,
      allocationsTable,
      triedKeys,
      summary: {
        totalAttempts: triedKeys.length,
        keysWithAllocations: triedKeys.filter(k => k.count > 0).length,
        totalAllocationsFound: triedKeys.reduce((sum, k) => sum + k.count, 0),
      },
      recommendation: triedKeys.some(k => k.count > 0)
        ? `Allocations found under key: ${triedKeys.find(k => k.count > 0)?.key}`
        : `No allocations found. Check if allocations have been materialized for ${incomingId}.`,
    };

    console.log('[allocations-debug] Verification complete', {
      incomingId,
      summary: diagnostics.summary,
    });

    return ok(event, diagnostics);
  } catch (error) {
    logError("[allocations-debug] Error during verification", error);
    return serverError(event, "Failed to verify allocations");
  }
};
