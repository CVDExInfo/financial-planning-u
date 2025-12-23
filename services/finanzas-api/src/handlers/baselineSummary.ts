// services/finanzas-api/src/handlers/baselineSummary.ts
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { withCors, ok, bad, serverError } from "../lib/http";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_PREFACTURAS = process.env.TABLE_PREFACTURAS || "finz_prefacturas";
const TABLE_DOCS = process.env.TABLE_DOCS || "finz_docs";
const DOCS_BUCKET = process.env.DOCS_BUCKET || process.env.S3_BUCKET;

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({ region: REGION });

function safeNumber(n: unknown): number {
  if (typeof n === "number") return n;
  if (typeof n === "string") return Number(n || 0);
  return 0;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
      return withCors(bad({ error: "missing_projectId" }));
    }

    // 1) fetch project metadata
    const projRes = await ddb.send(
      new GetCommand({
        TableName: TABLE_PROJECTS,
        Key: { pk: `PROJECT#${projectId}`, sk: "METADATA" },
      })
    );
    const proj = projRes.Item;
    if (!proj) {
      return withCors(
        ok({ error: "project_not_found", message: "Project not found" })
      );
    }

    const baselineId = proj.baselineId || proj.baseline_id;
    if (!baselineId) {
      return withCors(
        ok({
          error: "no_baseline",
          message: "Project has no baseline",
        })
      );
    }

    // 2) fetch baseline payload (prefactura baseline)
    const baselineRes = await ddb.send(
      new GetCommand({
        TableName: TABLE_PREFACTURAS,
        Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      })
    );
    const baseline = baselineRes.Item;
    if (!baseline) {
      return withCors(
        ok({
          error: "baseline_not_found",
          message: "Baseline data not found in prefacturas table",
        })
      );
    }

    // compute totals (use precomputed fields if present)
    const total = safeNumber(
      baseline.total_amount ||
        baseline.total ||
        baseline.total_project_cost ||
        0
    );
    const totalLabor = safeNumber(
      baseline.total_labor || baseline.totalLabor || baseline.labor_total || 0
    );
    const totalNonLabor = safeNumber(
      baseline.total_non_labor ||
        baseline.totalNonLabor ||
        baseline.non_labor_total ||
        0
    );

    // FTEs & roles
    const laborEstimates =
      baseline.labor_estimates || baseline.payload?.labor_estimates || [];
    const ftes = Array.isArray(laborEstimates)
      ? laborEstimates.reduce(
          (acc, it) => acc + Number(it?.fte_count || it?.fte || 0),
          0
        )
      : 0;
    const rolesCount = Array.isArray(laborEstimates) ? laborEstimates.length : 0;

    // Signed metadata
    const signedBy = baseline.signed_by || baseline.created_by || null;
    const signedAt = baseline.signed_at || baseline.created_at || null;

    // contract value / currency
    const contractValue = safeNumber(
      baseline.contract_value || baseline.contractValue || 0
    );
    const currency = baseline.currency || baseline.currencyCode || "USD";

    // 3) fetch doc (prefer TABLE_DOCS items for module='prefactura' and projectId)
    let s3SignedUrl: string | null = null;
    let objectKey: string | null = null;
    try {
      const docQuery = await ddb.send(
        new QueryCommand({
          TableName: TABLE_DOCS,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": `DOC#${projectId}`,
          },
          Limit: 10,
        })
      );
      
      // Find a doc with module 'prefactura' or 'baseline'
      const docItem = docQuery.Items?.find(
        (item) =>
          item.module === "prefactura" ||
          item.module === "baseline" ||
          item.documentType === "prefactura"
      ) || docQuery.Items?.[0];
      
      objectKey = docItem?.objectKey || docItem?.s3Key || null;
      
      if (objectKey && DOCS_BUCKET) {
        const command = new GetObjectCommand({
          Bucket: DOCS_BUCKET,
          Key: objectKey,
        });
        s3SignedUrl = await getSignedUrl(s3Client, command, {
          expiresIn: 60 * 10,
        }); // 10 min
      }
    } catch (err) {
      // swallow doc errors, but continue with baseline summary
      // (we log in CloudWatch for debugging)
      console.warn("doc fetch error", err);
    }

    const response = {
      baselineId,
      total,
      totalLabor,
      totalNonLabor,
      ftes,
      rolesCount,
      signedBy,
      signedAt,
      contractValue,
      currency,
      doc: s3SignedUrl ? { objectKey, s3Url: s3SignedUrl } : null,
      baselinePayloadExists: !!baseline,
    };

    return withCors(ok(response));
  } catch (err) {
    console.error("baselineSummary error", err);
    return withCors(
      serverError(String(err))
    );
  }
};
