import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_ALLOC = process.env.TABLE_ALLOC || "finz_allocations";

const APPLY_CHANGES = process.argv.includes("--apply");
const LIMIT_ARG = getArgValue("--limit");
const PROJECT_FILTER = getArgValue("--project");
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG) : undefined;

if (LIMIT !== undefined && Number.isNaN(LIMIT)) {
  console.error(`❌ Invalid --limit value: ${LIMIT_ARG}`);
  process.exit(1);
}

interface AllocationRecord {
  pk: string;
  sk: string;
  projectId?: string;
  baselineId?: string;
  month?: string;
  [key: string]: any;
}

interface CandidateFix {
  original: AllocationRecord;
  normalizedProjectId: string;
  expectedPk: string;
}

const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

function getArgValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function normalizeProjectId(value?: string | null): string | null {
  if (!value) return null;
  let normalized = value.trim();
  if (!normalized) return null;

  if (normalized.toUpperCase().startsWith("PROJECT#")) {
    normalized = normalized.slice("PROJECT#".length);
  }

  if (normalized.toUpperCase().startsWith("BASELINE#")) {
    normalized = normalized.replace(/^BASELINE#+/i, "");
  }

  normalized = normalized.replace(/^#/, "").trim();
  return normalized || null;
}

async function main() {
  console.log("\n📦 Allocations PK Migration");
  console.log("────────────────────────────────────────────");
  console.log(`Region:             ${AWS_REGION}`);
  console.log(`Allocations table:  ${TABLE_ALLOC}`);
  console.log(`Mode:               ${APPLY_CHANGES ? "APPLY" : "DRY-RUN"}`);
  if (PROJECT_FILTER) console.log(`Project filter:     ${PROJECT_FILTER}`);
  if (LIMIT !== undefined) console.log(`Limit:              ${LIMIT}`);
  console.log("────────────────────────────────────────────\n");

  let lastEvaluatedKey: Record<string, any> | undefined;
  let scanned = 0;
  const candidates: CandidateFix[] = [];

  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: TABLE_ALLOC,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = (page.Items || []) as AllocationRecord[];
    scanned += items.length;

    for (const record of items) {
      const normalizedProjectId = normalizeProjectId(record.projectId);
      if (!normalizedProjectId) {
        continue;
      }

      if (PROJECT_FILTER && normalizedProjectId !== PROJECT_FILTER) {
        continue;
      }

      const expectedPk = `PROJECT#${normalizedProjectId}`;
      if (record.pk !== expectedPk) {
        candidates.push({ original: record, normalizedProjectId, expectedPk });
      }
    }

    lastEvaluatedKey = page.LastEvaluatedKey;
    if (LIMIT !== undefined && candidates.length >= LIMIT) {
      break;
    }
  } while (lastEvaluatedKey);

  const considered =
    LIMIT !== undefined ? candidates.slice(0, LIMIT) : candidates;

  console.log(`🔎 Scanned allocations: ${scanned}`);
  console.log(
    `⚠️  Found ${candidates.length} allocations with unexpected pk (showing ${considered.length})`
  );

  if (candidates.length === 0) {
    console.log("✅ No pk issues detected");
    return;
  }

  considered.slice(0, 10).forEach((candidate, index) => {
    console.log(
      `   [${index + 1}] ${candidate.original.sk} :: pk=${
        candidate.original.pk
      } ➜ expected=${candidate.expectedPk}`
    );
  });

  if (!APPLY_CHANGES) {
    console.error(
      "\n❌ Dry-run detected pk mismatches. Re-run with --apply to fix."
    );
    process.exit(1);
  }

  let migrated = 0;
  for (const candidate of considered) {
    await migrateCandidate(candidate);
    migrated++;
  }

  console.log(`\n✅ Migration complete. Updated ${migrated} allocations.`);

  if (candidates.length > considered.length) {
    console.warn(
      `⚠️  ${
        candidates.length - considered.length
      } additional mismatched allocations remain. Re-run without --limit to process all.`
    );
    process.exit(1);
  }
}

async function migrateCandidate(candidate: CandidateFix) {
  const { original, normalizedProjectId, expectedPk } = candidate;
  const updatedItem = {
    ...original,
    pk: expectedPk,
    projectId: normalizedProjectId,
  } as AllocationRecord;

  console.log(
    `   ↪️  Migrating ${original.sk}: ${original.pk} ➜ ${expectedPk}`
  );

  await ddb.send(
    new PutCommand({
      TableName: TABLE_ALLOC,
      Item: updatedItem,
      ConditionExpression: "attribute_not_exists(#pk)",
      ExpressionAttributeNames: {
        "#pk": "pk",
      },
    })
  );

  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_ALLOC,
      Key: { pk: original.pk, sk: original.sk },
    })
  );
}

main().catch((error) => {
  console.error("❌ Migration failed", error);
  process.exit(1);
});
