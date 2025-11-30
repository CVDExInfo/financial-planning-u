import { ok, bad } from "../lib/http";
import { ddb } from "../lib/dynamo";
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";

// Deep health check validates that all required infrastructure exists
// This helps diagnose deployment issues early
async function deepHealthCheck() {
  const requiredTables: Array<{ key: string; envVar: string; fallback: string }> = [
    { key: "projects", envVar: "TABLE_PROJECTS", fallback: "finz_projects" },
    { key: "changes", envVar: "TABLE_CHANGES", fallback: "finz_changes" },
    { key: "rubros", envVar: "TABLE_RUBROS", fallback: "finz_rubros" },
    { key: "rubros_taxonomia", envVar: "TABLE_RUBROS_TAXONOMIA", fallback: "finz_rubros_taxonomia" },
    { key: "allocations", envVar: "TABLE_ALLOCATIONS", fallback: "finz_allocations" },
    { key: "payroll_actuals", envVar: "TABLE_PAYROLL_ACTUALS", fallback: "finz_payroll_actuals" },
    { key: "adjustments", envVar: "TABLE_ADJUSTMENTS", fallback: "finz_adjustments" },
    { key: "alerts", envVar: "TABLE_ALERTS", fallback: "finz_alerts" },
    { key: "providers", envVar: "TABLE_PROVIDERS", fallback: "finz_providers" },
    { key: "audit_log", envVar: "TABLE_AUDIT_LOG", fallback: "finz_audit_log" },
    { key: "docs", envVar: "TABLE_DOCS", fallback: "finz_docs" },
    { key: "prefacturas", envVar: "TABLE_PREFACTURAS", fallback: "finz_prefacturas" },
  ];

  const missingTables: string[] = [];
  const existingTables: string[] = [];

  // Check all tables in parallel for better performance
  const results = await Promise.allSettled(
    requiredTables.map(async (table) => {
      const fullTableName = process.env[table.envVar] || table.fallback;
      try {
        await ddb.send(
          new DescribeTableCommand({
            TableName: fullTableName,
          })
        );
        return { status: "exists", tableName: fullTableName };
      } catch (error) {
        if ((error as { name?: string }).name === "ResourceNotFoundException") {
          return { status: "missing", tableName: fullTableName };
        } else {
          // Other errors (like access denied) are also problems
          console.error(`Error checking table ${fullTableName}:`, error);
          return {
            status: "error",
            tableName: fullTableName,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    })
  );

  // Process results
  for (const result of results) {
    if (result.status === "fulfilled") {
      const tableResult = result.value;
      if (tableResult.status === "exists") {
        existingTables.push(tableResult.tableName);
      } else if (tableResult.status === "missing") {
        missingTables.push(tableResult.tableName);
      } else {
        missingTables.push(`${tableResult.tableName} (error: ${tableResult.error})`);
      }
    } else {
      // Promise was rejected
      console.error("Health check promise rejected:", result.reason);
    }
  }

  return {
    healthy: missingTables.length === 0,
    missingTables,
    existingTables,
  };
}

export const handler = async (event?: { queryStringParameters?: { deep?: string } }) => {
  const env = process.env.STAGE_NAME || process.env.STAGE || "dev";
  const version = process.env.GIT_SHA || process.env.API_VERSION || "1.0.0";
  const timestamp = new Date().toISOString();

  // Support deep health check via ?deep=true query parameter
  const performDeepCheck = event?.queryStringParameters?.deep === "true";

  if (performDeepCheck) {
    try {
      const healthCheck = await deepHealthCheck();

      if (!healthCheck.healthy) {
        return bad(
          {
            status: "unhealthy",
            message: "Required DynamoDB tables not found",
            missing_tables: healthCheck.missingTables,
            existing_tables: healthCheck.existingTables,
            env,
            version,
            timestamp,
          },
          503
        );
      }

      return ok({
        ok: true,
        status: "ok",
        infrastructure: {
          tables: {
            status: "all_present",
            count: healthCheck.existingTables.length,
            tables: healthCheck.existingTables,
          },
        },
        env,
        version,
        timestamp,
      });
    } catch (error) {
      console.error("Deep health check failed:", {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return bad(
        {
          status: "error",
          message: "Health check failed",
          error: error instanceof Error ? error.message : String(error),
          env,
          version,
          timestamp,
        },
        503
      );
    }
  }

  // Basic health check (fast, no infrastructure validation)
  return ok({
    ok: true,
    status: "ok",
    env,
    version,
    timestamp,
  });
};
