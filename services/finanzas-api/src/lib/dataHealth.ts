// services/finanzas-api/src/lib/dataHealth.ts
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "./dynamo";

export interface DataHealthEntry {
  projectId?: string;
  baselineId?: string;
  type: string;
  message: string;
  createdAt?: string;
}

export async function logDataHealth(entry: DataHealthEntry) {
  const Item = {
    pk: `DATA_HEALTH#${entry.projectId || 'unknown'}`,
    sk: `HEALTH#${Date.now()}`,
    ...entry,
    createdAt: entry.createdAt || new Date().toISOString()
  };
  
  // Use audit_log table if DATA_HEALTH_TABLE is not set (for backwards compatibility)
  const table = process.env.DATA_HEALTH_TABLE || tableName("audit_log");
  
  await ddb.send(new PutCommand({ TableName: table, Item }));
}
