#!/usr/bin/env ts-node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { fileURLToPath } from "node:url";
import { normalizeBaselineId } from "./migrate-handoff-baseline-projects";

const STAGE = process.env.STAGE || process.argv.find(arg => arg.startsWith("--stage="))?.split("=")[1] || "dev";
const TABLE_NAME = process.env.TABLE_PROJECTS || `finz_projects_${STAGE}`;
const MAX_SCAN_ITERATIONS = parseInt(process.env.MAX_SCAN_ITERATIONS || "1000", 10);

interface CollisionSummary {
  projectId: string;
  metadataBaseline: string | null;
  handoffBaselines: string[];
}

async function diagnose(tableName: string) {
  const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-2" });
  const ddb = DynamoDBDocumentClient.from(client);

  const collisions: CollisionSummary[] = [];
  const projectsMap = new Map<string, { metadata?: Record<string, unknown>; handoffs: Record<string, unknown>[] }>();

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let iterations = 0;

  do {
    const scanResult = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(pk, :pkPrefix)",
        ExpressionAttributeValues: {
          ":pkPrefix": "PROJECT#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of scanResult.Items || []) {
      const pk = item.pk as string;
      const sk = item.sk as string;
      if (!projectsMap.has(pk)) {
        projectsMap.set(pk, { handoffs: [] });
      }

      if (sk === "METADATA") {
        projectsMap.get(pk)!.metadata = item;
      } else if (sk.startsWith("HANDOFF#")) {
        projectsMap.get(pk)!.handoffs.push(item);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
    iterations++;
  } while (lastEvaluatedKey && iterations < MAX_SCAN_ITERATIONS);

  for (const [pk, data] of projectsMap.entries()) {
    if (!data.metadata) continue;
    const metadataBaseline = normalizeBaselineId(data.metadata);
    const handoffBaselines = Array.from(
      new Set(
        data.handoffs
          .map(h => normalizeBaselineId(h))
          .filter((b): b is string => Boolean(b))
      )
    );

    const collisionBaselines = handoffBaselines.filter(b => metadataBaseline && b !== metadataBaseline);
    if (collisionBaselines.length > 0) {
      collisions.push({
        projectId: pk.replace("PROJECT#", ""),
        metadataBaseline,
        handoffBaselines,
      });
    }
  }

  return collisions;
}

const isDirectRun = fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  diagnose(TABLE_NAME)
    .then(collisions => {
      if (collisions.length === 0) {
        console.log("No baseline collisions detected.");
        return;
      }

      console.log(JSON.stringify(collisions, null, 2));
    })
    .catch(error => {
      console.error("Failed to diagnose collisions", error);
      process.exit(1);
    });
}

export { diagnose };
