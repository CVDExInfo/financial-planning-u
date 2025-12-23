/**
 * Diagnostic Logging Utilities
 * 
 * Dev-only logging helpers for debugging data quality issues
 * All functions are silent in production/test environments
 */

import { logger } from './logger';

/**
 * Log debug information (dev-only)
 * Silent in production and test environments
 * 
 * @param message - Debug message
 * @param data - Optional data to log
 */
export function logDebug(message: string, data?: Record<string, unknown>): void {
  // Only log in development
  if (import.meta.env.DEV) {
    if (data) {
      logger.debug(message, data);
    } else {
      logger.debug(message);
    }
  }
}

/**
 * Log data health diagnostic information
 * Used by Data Health Panel and diagnostic tools
 * 
 * @param category - Category of the diagnostic (e.g., 'rubros', 'endpoints', 'baseline')
 * @param status - Status (e.g., 'healthy', 'warning', 'error')
 * @param details - Diagnostic details
 */
export function logDataHealth(
  category: string,
  status: 'healthy' | 'warning' | 'error',
  details: Record<string, unknown>
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  
  const emoji = status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : '❌';
  logger.info(`${emoji} [Data Health][${category}] ${status}`, details);
}

/**
 * Log endpoint diagnostic information
 * Used to track API endpoint health
 * 
 * @param endpoint - Endpoint path
 * @param status - HTTP status code
 * @param responseTime - Response time in ms
 * @param error - Optional error
 */
export function logEndpointHealth(
  endpoint: string,
  status: number,
  responseTime?: number,
  error?: Error | unknown
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  
  const isSuccess = status >= 200 && status < 300;
  const emoji = isSuccess ? '✅' : '❌';
  
  const details: Record<string, unknown> = { endpoint, status };
  if (responseTime !== undefined) {
    details.responseTime = `${responseTime}ms`;
  }
  if (error) {
    details.error = error instanceof Error ? error.message : String(error);
  }
  
  logger.info(`${emoji} [Endpoint Health]`, details);
}

/**
 * Log query diagnostic information
 * Used to debug data queries (rubros, line items, etc.)
 * 
 * @param queryType - Type of query (e.g., 'queryProjectRubros', 'getLineItems')
 * @param filters - Query filters
 * @param resultCount - Number of results returned
 * @param duration - Query duration in ms
 */
export function logQueryDiagnostic(
  queryType: string,
  filters: Record<string, unknown>,
  resultCount: number,
  duration?: number
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  
  const details: Record<string, unknown> = {
    queryType,
    filters,
    resultCount,
  };
  
  if (duration !== undefined) {
    details.duration = `${duration}ms`;
  }
  
  // Warn if no results found
  if (resultCount === 0) {
    logger.warn('[Query Diagnostic] No results', details);
  } else {
    logger.debug('[Query Diagnostic]', details);
  }
}

export default {
  logDebug,
  logDataHealth,
  logEndpointHealth,
  logQueryDiagnostic,
};
