/**
 * Backfill script to materialize allocations and rubros for existing baselines.
 *
 * Usage:
 *   ts-node scripts/backfill-baseline-materialization.ts                         # Dry-run only
 *   CONFIRM=yes ts-node scripts/backfill-baseline-materialization.ts             # Execute writes
 *   FORCE_REWRITE_ZEROS=yes ts-node scripts/backfill-baseline-materialization.ts # Dry-run with force flag
 *   CONFIRM=yes FORCE_REWRITE_ZEROS=yes ts-node scripts/backfill-baseline-materialization.ts # Execute with force
 *
 * Safety:
 *   - Requires CONFIRM_PROD=YES when NODE_ENV=production or STAGE_NAME=prod.
 *   - FORCE_REWRITE_ZEROS=yes allows overwriting existing zero-amount allocations with positive values.
 */

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "../src/lib/dynamo";
import {
  materializeAllocationsForBaseline,
  materializeRubrosForBaseline,
} from "../src/lib/materializers";

const isProd =
  String(process.env.NODE_ENV).toLowerCase() === "production" ||
  String(process.env.STAGE_NAME).toLowerCase() === "prod";

const confirm = String(process.env.CONFIRM || "").toLowerCase() === "yes";
const confirmProd = String(process.env.CONFIRM_PROD || "").toLowerCase() === "yes";
const forceRewriteZeros = String(process.env.FORCE_REWRITE_ZEROS || "").toLowerCase() === "yes";

if (isProd && !confirmProd) {
  console.error("❌ Refusing to run materialization backfill in production without CONFIRM_PROD=YES");
  process.exit(1);
}

async function scanBaselines() {
  const result = await ddb.send(
    new ScanCommand({
      TableName: tableName("prefacturas"),
      FilterExpression: "begins_with(#pk, :pkPrefix) AND #sk = :meta",
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#sk": "sk",
      },
      ExpressionAttributeValues: {
        ":pkPrefix": "BASELINE#",
        ":meta": "METADATA",
      },
    })
  );

  return result.Items || [];
}

async function main() {
  console.log("🔁 Baseline materialization backfill (allocations + rubros)");
  console.log(`   Mode: ${confirm ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`   Force rewrite zeros: ${forceRewriteZeros ? "ENABLED" : "DISABLED"}`);
  
  if (forceRewriteZeros) {
    console.log("   ⚠️  AUDIT: forceRewriteZeros flag is enabled. Zero allocations will be overwritten with positive values.");
  }

  const baselines = await scanBaselines();
  console.log(`   Found ${baselines.length} baselines to evaluate`);

  for (const baseline of baselines) {
    const baselineId = (baseline as { baseline_id?: string; baselineId?: string }).baseline_id ||
      (baseline as { baseline_id?: string; baselineId?: string }).baselineId ||
      String((baseline as { pk?: string }).pk || "").replace("BASELINE#", "");

    const projectId = (baseline as { project_id?: string; projectId?: string }).project_id ||
      (baseline as { project_id?: string; projectId?: string }).projectId ||
      "unknown";

    console.log(`\n→ Baseline ${baselineId} (project ${projectId})`);

    const allocationDryRun = await materializeAllocationsForBaseline(baseline as any, { dryRun: true, forceRewriteZeros });
    const rubroDryRun = await materializeRubrosForBaseline(baseline as any, { dryRun: true });
    console.log(`   Planned allocations: ${allocationDryRun.allocationsPlanned}`);
    console.log(`   Planned rubros: ${rubroDryRun.rubrosPlanned}`);

    if (!confirm) {
      continue;
    }

    const [allocationsResult, rubrosResult] = await Promise.all([
      materializeAllocationsForBaseline(baseline as any, { dryRun: false, forceRewriteZeros }),
      materializeRubrosForBaseline(baseline as any, { dryRun: false }),
    ]);

    console.log(`   ✅ allocations written: ${allocationsResult.allocationsWritten || 0}`);
    console.log(`   ✅ rubros written: ${rubrosResult.rubrosWritten || 0}`);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error("❌ Error running backfill", error);
  process.exit(1);
});
