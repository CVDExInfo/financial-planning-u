import { ScanCommand, UpdateCommand, ddb, tableName } from "../src/lib/dynamo";

interface ProjectRecord {
  pk?: string;
  sk?: string;
  project_id?: string;
  projectId?: string;
  id?: string;
  sdm_manager_email?: string;
  accepted_by?: string;
  aceptado_por?: string;
  created_by?: string;
  createdBy?: string;
  [key: string]: unknown;
}

const DRY_RUN = !process.argv.includes("--apply");
const SAMPLE_LIMIT = 10;
const UPDATE_DELAY_MS = 250; // small delay to avoid DynamoDB throttling

async function scanProjectsMissingAssignment(): Promise<ProjectRecord[]> {
  let items: ProjectRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const response = await ddb.send(
      new ScanCommand({
        TableName: tableName("projects"),
        ExclusiveStartKey: lastKey,
        FilterExpression:
          "begins_with(#pk, :pkPrefix) AND (#sk = :metadata OR #sk = :meta) AND " +
          "(attribute_not_exists(#sdmEmail) OR #sdmEmail = :empty)",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#sk": "sk",
          "#sdmEmail": "sdm_manager_email",
        },
        ExpressionAttributeValues: {
          ":pkPrefix": "PROJECT#",
          ":metadata": "METADATA",
          ":meta": "META",
          ":empty": "",
        },
      }),
    );

    items = items.concat((response.Items || []) as ProjectRecord[]);
    lastKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

function deriveSdmEmail(record: ProjectRecord): string | undefined {
  return (
    (record.accepted_by as string | undefined) ||
    (record.aceptado_por as string | undefined) ||
    (record.created_by as string | undefined) ||
    (record.createdBy as string | undefined)
  );
}

async function backfill() {
  const candidates = await scanProjectsMissingAssignment();
  const derived: { record: ProjectRecord; sdmEmail: string }[] = [];
  const missing: ProjectRecord[] = [];

  for (const record of candidates) {
    const sdmEmail = deriveSdmEmail(record);
    if (sdmEmail) {
      derived.push({ record, sdmEmail });
    } else {
      missing.push(record);
    }
  }

  console.info("[backfill] projects missing sdm_manager_email", {
    totalMissing: candidates.length,
    willUpdate: derived.length,
    stillUnassigned: missing.length,
    sampleUnassigned: missing.slice(0, SAMPLE_LIMIT).map((p) => ({
      projectId: p.project_id || p.projectId || p.id,
      code: (p as Record<string, unknown>).code,
    })),
    mode: DRY_RUN ? "dry-run" : "apply",
  });

  if (DRY_RUN) {
    console.info("[backfill] dry-run complete. Re-run with --apply to persist changes.");
    return;
  }

  console.info(`[backfill] applying updates with delay ${UPDATE_DELAY_MS}ms`);

  for (let idx = 0; idx < derived.length; idx++) {
    const { record, sdmEmail } = derived[idx];
    const projectId = record.project_id || record.projectId || record.id;
    if (!projectId) continue;

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: tableName("projects"),
          Key: { pk: `PROJECT#${projectId}`, sk: record.sk || "METADATA" },
          UpdateExpression: "SET #sdmEmail = :sdmEmail",
          ConditionExpression:
            "begins_with(#pk, :pkPrefix) AND (#sk = :metadata OR #sk = :meta) AND (attribute_not_exists(#sdmEmail) OR #sdmEmail = :empty)",
          ExpressionAttributeNames: {
            "#pk": "pk",
            "#sk": "sk",
            "#sdmEmail": "sdm_manager_email",
          },
          ExpressionAttributeValues: {
            ":sdmEmail": sdmEmail,
            ":pkPrefix": "PROJECT#",
            ":metadata": "METADATA",
            ":meta": "META",
            ":empty": "",
          },
        }),
      );

      console.info("[backfill] updated project", {
        projectId,
        sdmEmail,
        idx: idx + 1,
        total: derived.length,
      });
    } catch (err: any) {
      console.error("[backfill] update failed for project", {
        projectId,
        sdmEmail,
        error: err?.message || err,
      });
    }

    await new Promise((res) => setTimeout(res, UPDATE_DELAY_MS));
  }

  console.info("[backfill] completed", {
    updated: derived.length,
    stillUnassigned: missing.length,
  });
}

backfill().catch((err) => {
  console.error("[backfill] failed", err);
  process.exit(1);
});
