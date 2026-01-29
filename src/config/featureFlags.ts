/**
 * Feature Flags Configuration
 * 
 * Central location for all feature flags used in the application.
 * Feature flags enable safe, incremental rollout of new features.
 * 
 * Usage:
 *   import { FEATURE_FLAGS } from '@/config/featureFlags';
 *   
 *   if (FEATURE_FLAGS.ENABLE_RUBROS_ADAPTER) {
 *     // Render new adapter
 *   } else {
 *     // Render legacy table
 *   }
 */

export const FEATURE_FLAGS = {
  /**
   * Enable ForecastRubrosAdapter for Position #7 in SDMTForecast
   * 
   * When enabled, replaces the legacy forecast table with the new
   * ForecastRubrosAdapter component that delegates to ForecastRubrosTable.
   * 
   * Default: false (legacy table is default)
   * 
   * To enable in staging:
   *   Set environment variable: REACT_APP_ENABLE_RUBROS_ADAPTER=true
   * 
   * To enable in development:
   *   Add to .env.development: VITE_ENABLE_RUBROS_ADAPTER=true
   */
  ENABLE_RUBROS_ADAPTER: import.meta.env.VITE_ENABLE_RUBROS_ADAPTER === 'true' ||
                         process.env.REACT_APP_ENABLE_RUBROS_ADAPTER === 'true',
  
  /**
   * Enable Forecast V2 (Pronóstico V2 / Resumen Ejecutivo SDMT)
   * 
   * When enabled, shows the Pronóstico V2 navigation item and enables
   * the /sdmt/cost/forecast-v2 route with the new SDMTForecastV2 component.
   * 
   * Supports two environment variables for backward compatibility:
   *   - VITE_FINZ_USE_FORECAST_V2 (preferred, semantic master flag)
   *   - VITE_FINZ_NEW_FORECAST_LAYOUT (legacy, maintained for backward compatibility)
   * 
   * The flag is enabled when EITHER variable is set to 'true'.
   * 
   * Default: false (prod), true (dev via workflow)
   * 
   * To enable in production (preferred):
   *   Set environment variable: VITE_FINZ_USE_FORECAST_V2=true
   * 
   * To enable in production (legacy):
   *   Set environment variable: VITE_FINZ_NEW_FORECAST_LAYOUT=true
   * 
   * To enable in development:
   *   Add to .env.development: VITE_FINZ_USE_FORECAST_V2=true
   *   OR: VITE_FINZ_NEW_FORECAST_LAYOUT=true
   */
  USE_FORECAST_V2: (import.meta.env.VITE_FINZ_USE_FORECAST_V2 === 'true') ||
                   (import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true'),

  // V2 Per-Position Flags (Executive Dashboard Positions 1-5)
  V2_SHOW_POSITION_1_EXEC_SUMMARY: import.meta.env.VITE_FINZ_V2_SHOW_POSITION_1_EXEC_SUMMARY === 'true',
  V2_SHOW_POSITION_2_PAYROLL_MONTHLY: import.meta.env.VITE_FINZ_V2_SHOW_POSITION_2_PAYROLL_MONTHLY === 'true',
  V2_SHOW_POSITION_3_FORECAST_GRID: import.meta.env.VITE_FINZ_V2_SHOW_POSITION_3_FORECAST_GRID === 'true',
  V2_SHOW_POSITION_4_MATRIZ_MONTH_BAR: import.meta.env.VITE_FINZ_V2_SHOW_POSITION_4_MATRIZ_MONTH_BAR === 'true',
  V2_SHOW_POSITION_5_CHARTS_PANEL: import.meta.env.VITE_FINZ_V2_SHOW_POSITION_5_CHARTS_PANEL === 'true',

  // Executive-Specific Flags
  V2_SHOW_KEYTRENDS: import.meta.env.VITE_FINZ_V2_SHOW_KEYTRENDS === 'true',
  V2_SHOW_PORTFOLIO_KPIS: import.meta.env.VITE_FINZ_V2_SHOW_PORTFOLIO_KPIS === 'true',
  V2_ALLOW_BUDGET_EDIT: import.meta.env.VITE_FINZ_V2_ALLOW_BUDGET_EDIT === 'true',
  V2_MONTHS_DEFAULT: Number(import.meta.env.VITE_FINZ_V2_MONTHS_DEFAULT || '60'),

  // BAU (V1) Flags - Preserve existing behavior
  BAU_NEW_FORECAST_LAYOUT: import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true',
  BAU_SHOW_KEYTRENDS: import.meta.env.VITE_FINZ_SHOW_KEYTRENDS === 'true',
  BAU_HIDE_KEY_TRENDS: import.meta.env.VITE_FINZ_HIDE_KEY_TRENDS === 'true',
  BAU_HIDE_PROJECT_SUMMARY: import.meta.env.VITE_FINZ_HIDE_PROJECT_SUMMARY === 'true',
  BAU_HIDE_REAL_ANNUAL_KPIS: import.meta.env.VITE_FINZ_HIDE_REAL_ANNUAL_KPIS === 'true',
} as const;

// Development-only logging
if (import.meta.env.DEV) {
  console.log('[FeatureFlags] Loaded configuration:', FEATURE_FLAGS);
}
