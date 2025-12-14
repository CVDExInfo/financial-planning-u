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
  BatchWriteCommand,
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
  BatchWriteCommand,
};

/**
 * Payroll-specific DynamoDB helpers
 */

import type { PayrollEntry, PayrollKind } from './types';
import { randomUUID } from 'node:crypto';

/**
 * Generate a unique payroll entry ID
 * Format: payroll_{kind}_{10-char-uuid}
 */
export function generatePayrollId(kind: PayrollKind): string {
  const uuid = randomUUID().replace(/-/g, '').slice(0, 10);
  return `payroll_${kind}_${uuid}`;
}

export function generatePayrollActualId(): string {
  const uuid = randomUUID().replace(/-/g, '').slice(0, 10);
  return `payroll_${uuid}`;
}

/**
 * Build DynamoDB keys for a payroll entry
 * 
 * Schema:
 * - pk: PROJECT#${projectId}#MONTH#${period}
 * - sk: PAYROLL#${kind}#${id}
 * 
 * This allows:
 * 1. Query all payroll types for a project+period
 * 2. Query specific kind for a project+period using begins_with
 * 3. Backwards compatible with existing PAYROLL# entries (treated as actual)
 */
export function buildPayrollKeys(projectId: string, period: string, kind: PayrollKind, id: string) {
  return {
    pk: `PROJECT#${projectId}#MONTH#${period}`,
    sk: `PAYROLL#${kind.toUpperCase()}#${id}`,
  };
}

/**
 * Write a payroll entry to DynamoDB
 * 
 * @param entry PayrollEntry to write (id will be generated if missing)
 * @param userId Email of the user creating/updating the entry
 * @returns The complete entry with generated fields
 */
export async function putPayrollEntry(
  entry: Partial<PayrollEntry> & { projectId: string; period: string; kind: PayrollKind; amount: number; currency: string },
  userId?: string
): Promise<PayrollEntry> {
  const id = entry.id || generatePayrollId(entry.kind);
  const keys = buildPayrollKeys(entry.projectId, entry.period, entry.kind, id);
  const now = new Date().toISOString();
  
  const item: PayrollEntry = {
    ...entry,
    id,
    ...keys,
    createdAt: entry.createdAt || now,
    createdBy: entry.createdBy || userId,
    updatedAt: now,
    updatedBy: userId,
  };
  
  await ddb.send(
    new PutCommand({
      TableName: tableName('payroll_actuals'),
      Item: item,
    })
  );
  
  return item;
}

/**
 * Query payroll entries for a single project+period
 * 
 * @param projectId Project identifier
 * @param period YYYY-MM format
 * @param kind Optional filter for specific kind (plan/forecast/actual)
 * @returns Array of payroll entries
 */
export async function queryPayrollByPeriod(
  projectId: string,
  period: string,
  kind?: PayrollKind
): Promise<PayrollEntry[]> {
  const skPrefix = kind ? `PAYROLL#${kind.toUpperCase()}#` : 'PAYROLL#';
  const legacyPk = `PROJECT#${projectId}#MONTH#${period}`;

  const [legacyResult, flatResult] = await Promise.all([
    ddb.send(
      new QueryCommand({
        TableName: tableName('payroll_actuals'),
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': legacyPk,
          ':sk': skPrefix,
        },
      })
    ),
    ddb.send(
      new ScanCommand({
        TableName: tableName('payroll_actuals'),
        FilterExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `PROJECT#${projectId}`,
          ':sk': `PAYROLL#${period}`,
        },
      })
    ),
  ]);

  const combined = [
    ...((legacyResult.Items || []) as PayrollEntry[]),
    ...((flatResult.Items || []) as PayrollEntry[]),
  ];

  return combined;
}

/**
 * Query all payroll entries for a project across all periods
 * 
 * Note: Since our pk includes MONTH, we need to scan or use a GSI.
 * For now, we'll scan with a filter. Consider adding a GSI on projectId if this becomes a bottleneck.
 * 
 * @param projectId Project identifier
 * @param kind Optional filter for specific kind
 * @returns Array of payroll entries sorted by period
 */
export async function queryPayrollByProject(
  projectId: string,
  kind?: PayrollKind
): Promise<PayrollEntry[]> {
  const skPrefix = kind ? `PAYROLL#${kind.toUpperCase()}#` : 'PAYROLL#';

  // Use Scan with filter since pk may vary by month or be flat per project
  const result = await ddb.send(
    new ScanCommand({
      TableName: tableName('payroll_actuals'),
      FilterExpression: 'begins_with(pk, :pkPrefix) AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pkPrefix': `PROJECT#${projectId}`,
        ':sk': skPrefix,
      },
    })
  );

  const items = (result.Items || []) as PayrollEntry[];

  // Sort by period
  return items.sort((a, b) => (a.period || '').localeCompare(b.period || ''));
}

/**
 * Query all payroll entries across all projects for a given period
 * Used for dashboard aggregations
 * 
 * @param period YYYY-MM format
 * @param kind Optional filter for specific kind
 * @returns Array of payroll entries
 */
export async function queryPayrollByPeriodAllProjects(
  period: string,
  kind?: PayrollKind
): Promise<PayrollEntry[]> {
  const skPrefix = kind ? `PAYROLL#${kind.toUpperCase()}#` : 'PAYROLL#';
  
  // This requires a scan since we're filtering across multiple projects
  // Consider adding a GSI on period+kind if this becomes performance-critical
  const result = await ddb.send(
    new ScanCommand({
      TableName: tableName('payroll_actuals'),
      FilterExpression: 'contains(pk, :period) AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':period': `#MONTH#${period}`,
        ':sk': skPrefix,
      },
    })
  );
  
  return (result.Items || []) as PayrollEntry[];
}
