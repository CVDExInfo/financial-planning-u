// src/api/finanzas.baseline.ts
import finanzasClient from './finanzasClient';
import log from '@/utils/diagnostic-logging';

export interface BaselineSummary {
  baselineId: string;
  total: number;
  totalLabor: number;
  totalNonLabor: number;
  ftes: number;
  rolesCount: number;
  signedBy: string | null;
  signedAt: string | null;
  contractValue: number;
  currency: string;
  doc: {
    objectKey: string | null;
    s3Url: string;
  } | null;
  baselinePayloadExists: boolean;
  error?: string;
  message?: string;
}

export interface BackfillResult {
  success: boolean;
  dryRun: boolean;
  baselineId: string;
  result: {
    rubrosPlanned?: number;
    rubrosWritten?: number;
  };
  error?: string;
  message?: string;
}

/**
 * Get baseline summary for a project
 * Returns original baseline values (totals, FTEs, roles) and PDF link
 */
export async function getBaselineSummary(
  projectId: string
): Promise<BaselineSummary> {
  const url = `projects/${projectId}/baseline-summary`;
  try {
    const res = await finanzasClient.http<BaselineSummary>(url);
    log.logQueryDiagnostic('getBaselineSummary', { projectId }, 1);
    return res;
  } catch (err) {
    log.logDebug('getBaselineSummary error', {
      projectId,
      err: String(err),
    });
    throw err;
  }
}

/**
 * Run backfill (admin). dryRun defaults to true.
 * Requires admin privileges.
 */
export async function runBackfill(
  projectId: string,
  dryRun: boolean = true
): Promise<BackfillResult> {
  const url = `admin/backfill`;
  try {
    const res = await finanzasClient.http<BackfillResult>(url, {
      method: 'POST',
      body: JSON.stringify({ projectId, dryRun }),
      headers: { 'Content-Type': 'application/json' },
    });
    log.logDataHealth('backfill', 'healthy', {
      projectId,
      dryRun,
      result: res,
    });
    return res;
  } catch (err) {
    log.logDataHealth('backfill', 'error', { projectId, err: String(err) });
    throw err;
  }
}
