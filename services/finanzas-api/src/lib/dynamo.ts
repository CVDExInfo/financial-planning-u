import AWS from "aws-sdk";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client);

const env = process.env;

type TableKey =
  | "projects"
  | "rubros"
  | "allocations"
  | "payroll_actuals"
  | "adjustments"
  | "alerts"
  | "providers"
  | "audit_log";

// Conservative defaults to reduce hard failures if env wiring is missing.
// We only default 'rubros' for R1 to unblock catalog; others still require explicit env to avoid accidental misuse.
const FALLBACKS: Partial<Record<TableKey, string>> = {
  rubros: "finz_rubros",
};

export const tableName = (key: TableKey) => {
  const envKey = `TABLE_${key.toUpperCase()}`;
  const name = env[envKey] || FALLBACKS[key];
  if (!name) {
    throw new Error(`Environment variable ${envKey} is not defined`);
  }
  return name;
};
