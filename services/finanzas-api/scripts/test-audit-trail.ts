#!/usr/bin/env node
/**
 * DynamoDB Audit Trail Verification Script
 *
 * Purpose: Verify that all data entries have proper audit trails
 * - created_by field
 * - created_at field
 * - audit_log entries
 */

import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const REGION = "us-east-2";
const client = new DynamoDBClient({ region: REGION });

interface AuditTrailReport {
  table: string;
  totalItems: number;
  withCreatedBy: number;
  withCreatedAt: number;
  withBoth: number;
  samples: Record<string, unknown>[];
}

async function scanTableWithAudit(
  tableName: string
): Promise<AuditTrailReport> {
  const scanCommand = new ScanCommand({
    TableName: tableName,
  });

  const response = await client.send(scanCommand);
  const items = (response.Items || []).map((item) => unmarshall(item));

  let withCreatedBy = 0;
  let withCreatedAt = 0;
  let withBoth = 0;

  items.forEach((item) => {
    if (item.created_by) withCreatedBy++;
    if (item.created_at) withCreatedAt++;
    if (item.created_by && item.created_at) withBoth++;
  });

  return {
    table: tableName,
    totalItems: items.length,
    withCreatedBy,
    withCreatedAt,
    withBoth,
    samples: items.slice(0, 3), // First 3 items as samples
  };
}

async function checkAuditLog() {
  const scanCommand = new ScanCommand({
    TableName: "finz_audit_log",
  });

  const response = await client.send(scanCommand);
  const items = (response.Items || []).map((item) => unmarshall(item));

  console.log("\n📋 AUDIT LOG ENTRIES");
  console.log("=".repeat(80));
  console.log(`Total entries: ${items.length}\n`);

  if (items.length === 0) {
    console.log("⚠️  No audit log entries found");
    return;
  }

  // Group by action
  const byAction: Record<string, number> = {};
  items.forEach((item) => {
    const action = item.action || "UNKNOWN";
    byAction[action] = (byAction[action] || 0) + 1;
  });

  console.log("Actions recorded:");
  Object.entries(byAction).forEach(([action, count]) => {
    console.log(`  ${action}: ${count} entries`);
  });

  console.log("\n📝 Sample audit entries:\n");
  items.slice(0, 5).forEach((entry, idx) => {
    console.log(`${idx + 1}. ${entry.action} by ${entry.user || "unknown"}`);
    console.log(
      `   Resource: ${entry.resource_type} ${entry.resource_id || ""}`
    );
    console.log(`   Timestamp: ${entry.timestamp}`);
    console.log(
      `   Source: ${entry.source || "N/A"}, IP: ${entry.ip_address || "N/A"}`
    );
    console.log();
  });
}

async function main() {
  console.log("🔍 DynamoDB Audit Trail Verification\n");
  console.log("Region:", REGION);
  console.log("=".repeat(80) + "\n");

  const tables = [
    "finz_projects",
    "finz_rubros",
    "finz_rubros_taxonomia",
    "finz_allocations",
    "finz_providers",
  ];

  console.log("📊 CHECKING DATA TABLES\n");

  for (const table of tables) {
    try {
      process.stdout.write(`Analyzing ${table}... `);
      const report = await scanTableWithAudit(table);

      console.log(`✅ ${report.totalItems} items`);

      if (report.totalItems > 0) {
        const auditCoverage = Math.round(
          (report.withBoth / report.totalItems) * 100
        );
        console.log(
          `  Audit Trail Coverage: ${auditCoverage}% (${report.withBoth}/${report.totalItems} items)`
        );

        if (auditCoverage < 100) {
          console.log(`  ⚠️  Missing audit fields:`);
          console.log(
            `     - created_by: ${
              report.totalItems - report.withCreatedBy
            } items`
          );
          console.log(
            `     - created_at: ${
              report.totalItems - report.withCreatedAt
            } items`
          );
        }

        // Show sample with audit fields
        const sampleWithAudit = report.samples.find(
          (s) => s.created_by && s.created_at
        );
        if (sampleWithAudit) {
          console.log(`  📝 Sample:`);
          console.log(
            `     ID: ${sampleWithAudit.id || sampleWithAudit.codigo || "N/A"}`
          );
          console.log(`     Created by: ${sampleWithAudit.created_by}`);
          console.log(`     Created at: ${sampleWithAudit.created_at}`);
        }
      }
      console.log();
    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Check audit log
  await checkAuditLog();

  console.log("=".repeat(80));
  console.log("\n✅ VERIFICATION COMPLETE\n");

  console.log("📌 RECOMMENDATIONS:");
  console.log(
    "  1. All new data entries should include created_by and created_at fields"
  );
  console.log("  2. All write operations should log to finz_audit_log");
  console.log(
    "  3. Audit log should include: action, user, timestamp, resource_type, resource_id"
  );
  console.log(
    "  4. Consider adding IP address and user agent for security tracking"
  );
  console.log(
    "  5. Implement audit log retention policy (e.g., TTL after 1 year)"
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
