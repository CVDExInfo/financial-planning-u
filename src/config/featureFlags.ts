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
   * Enable Forecast V2 (Pronóstico V2)
   * 
   * When enabled, shows the Pronóstico V2 navigation item and enables
   * the /sdmt/cost/forecast-v2 route with the new SDMTForecastV2 component.
   * 
   * Default: controlled by VITE_FINZ_NEW_FORECAST_LAYOUT environment variable
   * 
   * To enable in production:
   *   Set environment variable: VITE_FINZ_NEW_FORECAST_LAYOUT=true
   * 
   * To enable in development:
   *   Add to .env.development: VITE_FINZ_NEW_FORECAST_LAYOUT=true
   */
  USE_FORECAST_V2: import.meta.env.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true',
} as const;

// Development-only logging
if (import.meta.env.DEV) {
  console.log('[FeatureFlags] Loaded configuration:', FEATURE_FLAGS);
}
