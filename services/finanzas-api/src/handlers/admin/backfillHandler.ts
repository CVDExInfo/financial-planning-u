// services/finanzas-api/src/handlers/admin/backfillHandler.ts
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { materializeRubrosFromBaseline, materializeAllocationsForBaseline } from "../../lib/materializers";
import { ddb, GetCommand } from "../../lib/dynamo";
import { withCors, ok, bad, serverError } from "../../lib/http";
import { ensureCanWrite } from "../../lib/auth";

const TABLE_PREFACTURAS = process.env.TABLE_PREFACTURAS || "finz_prefacturas";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";

async function fetchBaselinePayload(baselineId: string) {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE_PREFACTURAS,
      Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      ConsistentRead: true,
    })
  );
  return res.Item || null;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // SECURITY: Ensure only authorized users (PMO, SDMT, SDM) can run backfill
    await ensureCanWrite(event as never);
    
    // Input: JSON body { projectId, baselineId, dryRun, forceRewriteZeros }
    const body = event.body ? JSON.parse(event.body) : {};
    const { projectId, baselineId, dryRun = true, forceRewriteZeros = false } = body;
    
    if (!projectId && !baselineId) {
      return withCors(
        bad({
          error: "missing_projectId_or_baselineId",
          message: "Either projectId or baselineId must be provided",
        })
      );
    }

    // If projectId provided, fetch project metadata to resolve baselineId if not present
    let resolvedBaselineId = baselineId;
    if (!resolvedBaselineId && projectId) {
      const projRes = await ddb.send(
        new GetCommand({
          TableName: TABLE_PROJECTS,
          Key: { pk: `PROJECT#${projectId}`, sk: "METADATA" },
        })
      );
      resolvedBaselineId =
        projRes.Item?.baselineId || projRes.Item?.baseline_id;
    }

    if (!resolvedBaselineId) {
      return withCors(
        bad({
          error: "no_baseline_id",
          message: "Could not resolve baseline ID from project",
        })
      );
    }

    // Fetch baseline payload once (needed for both projectId resolution and allocations)
    let baselinePayload = null;
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      baselinePayload = await fetchBaselinePayload(resolvedBaselineId);
      resolvedProjectId =
        baselinePayload?.project_id ||
        baselinePayload?.projectId ||
        baselinePayload?.payload?.project_id ||
        baselinePayload?.payload?.projectId;
    }

    // Materialize rubros (existing behavior)
    const rubrosResult = await materializeRubrosFromBaseline({
      projectId: resolvedProjectId,
      baselineId: resolvedBaselineId,
      dryRun: !!dryRun,
    });

    // ALSO materialize allocations so the UI "Materializar Baseline" produces both rubros and allocations
    // We call the allocations materializer directly to produce idempotent writes.
    
    // Fetch baseline payload if not already fetched
    if (!baselinePayload) {
      baselinePayload = await fetchBaselinePayload(resolvedBaselineId);
    }
    
    // Normalize/unpack payload robustly so materializer always receives the real payload
    // The function below unwraps common envelope shapes: baseline.payload, baseline.payload.payload, etc.
    const unwrapBaselinePayload = (raw: any): any => {
      if (!raw) return raw;
      // If metadata stored at top-level (legacy)
      if (Array.isArray(raw.labor_estimates) || Array.isArray(raw.non_labor_estimates)) {
        return raw;
      }
      // If the metadata has a 'payload' wrapper, prefer its content
      const singleNestedPayload = raw.payload ?? raw;
      if (Array.isArray(singleNestedPayload.labor_estimates) || Array.isArray(singleNestedPayload.non_labor_estimates)) {
        return singleNestedPayload;
      }
      // One additional defensive level: payload.payload
      const doubleNestedPayload = (singleNestedPayload && typeof singleNestedPayload === 'object' && singleNestedPayload.payload) ? singleNestedPayload.payload : singleNestedPayload;
      if (Array.isArray(doubleNestedPayload.labor_estimates) || Array.isArray(doubleNestedPayload.non_labor_estimates)) {
        return doubleNestedPayload;
      }
      // Last resort: return singleNestedPayload even if empty (the materializer will validate)
      return singleNestedPayload;
    };

    const suppliedPayload = unwrapBaselinePayload(baselinePayload);

    // Add a helpful log with a preview of the payload so we can diagnose quick failures
    console.info('[backfill] calling allocations materializer', {
      baselineId: resolvedBaselineId,
      projectId: resolvedProjectId,
      forceRewriteZeros: !!forceRewriteZeros,
      preview: {
        start_date: suppliedPayload?.start_date ?? null,
        duration_months: suppliedPayload?.duration_months ?? null,
        laborEstimatesCount: Array.isArray(suppliedPayload?.labor_estimates)
          ? suppliedPayload.labor_estimates.length
          : 0,
        nonLaborEstimatesCount: Array.isArray(suppliedPayload?.non_labor_estimates)
          ? suppliedPayload.non_labor_estimates.length
          : 0
      }
    });

    // Call allocations materializer with the normalized payload and forceRewriteZeros flag
    const allocationsResult = await materializeAllocationsForBaseline(
      {
        baseline_id: resolvedBaselineId,
        project_id: resolvedProjectId,
        // Pass the normalized suppliedPayload if present, otherwise the raw baselinePayload
        payload: suppliedPayload || baselinePayload || {},
      },
      { dryRun: !!dryRun, forceRewriteZeros: !!forceRewriteZeros }
    );

    return withCors(
      ok({
        success: true,
        dryRun: !!dryRun,
        baselineId: resolvedBaselineId,
        result: {
          rubrosResult,
          allocationsResult,
        },
      })
    );
  } catch (err) {
    console.error("admin/backfill error", err);
    const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
    if (statusCode) {
      return withCors(
        bad({
          error: "materialization_failed",
          message: err instanceof Error ? err.message : String(err),
        }, statusCode)
      );
    }
    return withCors(
      serverError(err instanceof Error ? err.message : String(err))
    );
  }
};
