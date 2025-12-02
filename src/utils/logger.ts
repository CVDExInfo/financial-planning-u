/**
 * Centralized Logger Utility
 * 
 * Provides consistent logging across the application with environment-aware behavior:
 * - DEV: All log levels enabled (debug, info, warn, error)
 * - PROD: Only errors are logged to avoid console spam
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   
 *   logger.debug('Detailed debugging info', { data });
 *   logger.info('General information', value);
 *   logger.warn('Warning message', context);
 *   logger.error('Error occurred', error);
 */

const envSource =
  (typeof import.meta !== "undefined" && (import.meta as any)?.env) ||
  (typeof process !== "undefined" ? (process.env as Record<string, any>) : {});

const isDevelopment = envSource?.DEV === true || envSource?.DEV === "true";
const isProduction = envSource?.PROD === true || envSource?.PROD === "true";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableDebug: boolean;
  enableInfo: boolean;
  enableWarn: boolean;
  enableError: boolean;
}

// Configuration based on environment
const config: LoggerConfig = {
  enableDebug: isDevelopment,
  enableInfo: isDevelopment,
  enableWarn: isDevelopment || isProduction, // Keep warnings in prod for now
  enableError: true, // Always log errors
};

class Logger {
  private prefix: string;

  constructor(prefix = '[Finanzas]') {
    this.prefix = prefix;
  }

  /**
   * Debug level logging - detailed information for debugging
   * Only active in development
   */
  debug(message: string, ...args: any[]): void {
    if (config.enableDebug) {
      console.debug(`${this.prefix} 🔍`, message, ...args);
    }
  }

  /**
   * Info level logging - general informational messages
   * Only active in development
   */
  info(message: string, ...args: any[]): void {
    if (config.enableInfo) {
      console.info(`${this.prefix} ℹ️`, message, ...args);
    }
  }

  /**
   * Warning level logging - potentially harmful situations
   * Active in both development and production
   */
  warn(message: string, ...args: any[]): void {
    if (config.enableWarn) {
      console.warn(`${this.prefix} ⚠️`, message, ...args);
    }
  }

  /**
   * Error level logging - error events that might still allow the app to continue
   * Always active with optional correlation ID for tracking
   */
  error(message: string, error?: Error | unknown, correlationId?: string): void {
    if (config.enableError) {
      const errorDetails: any[] = [error];
      
      if (correlationId) {
        errorDetails.push({ correlationId });
      }
      
      // In production, also attempt to send to a monitoring service
      // (This is a placeholder - implement actual error tracking integration)
      if (isProduction && correlationId) {
        // Future: Send to CloudWatch, Sentry, etc.
        // sendToMonitoring({ message, error, correlationId });
      }
      
      console.error(`${this.prefix} ❌`, message, ...errorDetails);
    }
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(childPrefix: string): Logger {
    return new Logger(`${this.prefix}:${childPrefix}`);
  }
}

// Export singleton instance
export const logger = new Logger('[Finanzas]');

// Export for creating custom loggers
export { Logger };

// Helper to generate correlation IDs for error tracking
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
