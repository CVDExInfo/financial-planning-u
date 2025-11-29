import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-2",
});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

const env = process.env;

type TableKey =
  | "projects"
  | "rubros"
  | "rubros_taxonomia"
  | "allocations"
  | "payroll_actuals"
  | "adjustments"
  | "alerts"
  | "providers"
  | "audit_log"
  | "docs"
  | "prefacturas"
  | "changes";

// Conservative defaults to reduce hard failures if env wiring is missing.
const FALLBACKS: Record<TableKey, string> = {
  projects: "finz_projects",
  rubros: "finz_rubros",
  rubros_taxonomia: "finz_rubros_taxonomia",
  allocations: "finz_allocations",
  payroll_actuals: "finz_payroll_actuals",
  adjustments: "finz_adjustments",
  alerts: "finz_alerts",
  providers: "finz_providers",
  audit_log: "finz_audit_log",
  docs: "finz_docs",
  prefacturas: "finz_prefacturas",
  changes: "finz_changes",
};

export const tableName = (key: TableKey): string => {
  const envKey = `TABLE_${key.toUpperCase()}`;
  const name = env[envKey] || FALLBACKS[key];
  if (!name) {
    throw new Error(`Environment variable ${envKey} is not defined`);
  }
  return name;
};

// Export commands for convenience
export {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand,
};
