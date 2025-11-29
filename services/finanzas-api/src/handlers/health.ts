import { ok, bad } from "../lib/http";
import { ddb, tableName } from "../lib/dynamo";
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";

// Deep health check validates that all required infrastructure exists
// This helps diagnose deployment issues early
async function deepHealthCheck() {
  const requiredTables = [
    "projects",
    "changes",
    "rubros",
    "rubros_taxonomia",
    "allocations",
    "payroll_actuals",
    "adjustments",
    "alerts",
    "providers",
    "audit_log",
    "docs",
    "prefacturas",
  ];

  const missingTables: string[] = [];
  const existingTables: string[] = [];

  for (const table of requiredTables) {
    const fullTableName = tableName(table);
    try {
      await ddb.send(
        new DescribeTableCommand({
          TableName: fullTableName,
        })
      );
      existingTables.push(fullTableName);
    } catch (error) {
      if ((error as { name?: string }).name === "ResourceNotFoundException") {
        missingTables.push(fullTableName);
      } else {
        // Other errors (like access denied) are also problems
        console.error(`Error checking table ${fullTableName}:`, error);
        missingTables.push(`${fullTableName} (error: ${(error as Error).message})`);
      }
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
      console.error("Deep health check failed:", error);
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
