// services/finanzas-api/src/handlers/admin/backfillHandler.ts
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { materializeRubrosForBaseline } from "../../lib/materializers";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { withCors, ok, bad, serverError } from "../../lib/http";

const REGION = process.env.AWS_REGION || "us-east-1";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const TABLE_PREFACTURAS = process.env.TABLE_PREFACTURAS || "finz_prefacturas";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";

async function fetchBaselinePayload(baselineId: string) {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE_PREFACTURAS,
      Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
    })
  );
  return res.Item || null;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // NOTE: secure this endpoint — only admin users or internal network should call it.
    // Input: JSON body { projectId, baselineId, dryRun }
    const body = event.body ? JSON.parse(event.body) : {};
    const { projectId, baselineId, dryRun = true } = body;
    
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

    const baseline = await fetchBaselinePayload(resolvedBaselineId);
    if (!baseline) {
      return withCors(
        bad({
          error: "baseline_not_found",
          message: `Baseline ${resolvedBaselineId} not found in prefacturas table`,
        })
      );
    }

    // call materializer
    // materializeRubrosForBaseline(baseline, { dryRun: true })
    const result = await materializeRubrosForBaseline(baseline, {
      dryRun: !!dryRun,
    });

    return withCors(
      ok({
        success: true,
        dryRun: !!dryRun,
        baselineId: resolvedBaselineId,
        result,
      })
    );
  } catch (err) {
    console.error("admin/backfill error", err);
    return withCors(
      serverError(err instanceof Error ? err.message : String(err))
    );
  }
};
