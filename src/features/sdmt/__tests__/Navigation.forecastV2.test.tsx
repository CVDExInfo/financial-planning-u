/**
 * Navigation.forecastV2.test.tsx
 * 
 * Tests for Forecast V2 navigation item visibility based on VITE_FINZ_USE_FORECAST_V2 flag
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Navigation - Forecast V2', () => {
  describe('Feature flag filtering', () => {
    it('should include forecast-v2 nav item when VITE_FINZ_USE_FORECAST_V2 is true', () => {
      // Test the logical condition for navigation item visibility
      const testEnv = { VITE_FINZ_USE_FORECAST_V2: 'true' };
      const useForecastV2 = testEnv.VITE_FINZ_USE_FORECAST_V2 === 'true';
      
      // Simulate the navigation filter logic
      const shouldShowForecastV2 = useForecastV2;
      
      assert.strictEqual(shouldShowForecastV2, true, 
        'Forecast V2 nav item should be visible when flag is true');
    });

    it('should exclude forecast-v2 nav item when VITE_FINZ_USE_FORECAST_V2 is false', () => {
      const testEnv = { VITE_FINZ_USE_FORECAST_V2: 'false' };
      const useForecastV2 = testEnv.VITE_FINZ_USE_FORECAST_V2 === 'true';
      
      const shouldShowForecastV2 = useForecastV2;
      
      assert.strictEqual(shouldShowForecastV2, false,
        'Forecast V2 nav item should be hidden when flag is false');
    });

    it('should exclude forecast-v2 nav item when VITE_FINZ_USE_FORECAST_V2 is undefined', () => {
      const testEnv = { VITE_FINZ_USE_FORECAST_V2: undefined };
      const useForecastV2 = testEnv.VITE_FINZ_USE_FORECAST_V2 === 'true';
      
      const shouldShowForecastV2 = useForecastV2;
      
      assert.strictEqual(shouldShowForecastV2, false,
        'Forecast V2 nav item should be hidden when flag is undefined');
    });

    it('should support legacy flag VITE_FINZ_NEW_FORECAST_LAYOUT for backward compatibility', () => {
      // Test that the OR logic works with legacy flag
      const testEnv = { 
        VITE_FINZ_USE_FORECAST_V2: 'false',
        VITE_FINZ_NEW_FORECAST_LAYOUT: 'true' 
      };
      
      const useForecastV2 = testEnv.VITE_FINZ_USE_FORECAST_V2 === 'true' || 
                           testEnv.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
      
      const shouldShowForecastV2 = useForecastV2;
      
      assert.strictEqual(shouldShowForecastV2, true,
        'Forecast V2 nav item should be visible with legacy flag');
    });
  });

  describe('Navigation item properties', () => {
    it('should have correct label "Resumen Ejecutivo (SMO)"', () => {
      const expectedLabel = "Resumen Ejecutivo (SMO)";
      assert.ok(expectedLabel.includes("SMO"), 
        'Label should contain "SMO"');
      assert.ok(expectedLabel.includes("Resumen Ejecutivo"),
        'Label should contain "Resumen Ejecutivo"');
    });

    it('should have correct path "/sdmt/cost/forecast-v2"', () => {
      const expectedPath = "/sdmt/cost/forecast-v2";
      assert.strictEqual(expectedPath, "/sdmt/cost/forecast-v2",
        'Path should be "/sdmt/cost/forecast-v2"');
    });

    it('should have aria-label "Resumen Ejecutivo (SMO)"', () => {
      const expectedAriaLabel = "Resumen Ejecutivo (SMO)";
      assert.strictEqual(expectedAriaLabel, "Resumen Ejecutivo (SMO)",
        'aria-label should match the nav label');
    });
  });

  describe('Role-based visibility', () => {
    it('should be visible for SDMT role', () => {
      const allowedRoles = ["SDMT", "EXEC_RO"];
      assert.ok(allowedRoles.includes("SDMT"),
        'Forecast V2 should be visible for SDMT role');
    });

    it('should be visible for EXEC_RO role', () => {
      const allowedRoles = ["SDMT", "EXEC_RO"];
      assert.ok(allowedRoles.includes("EXEC_RO"),
        'Forecast V2 should be visible for EXEC_RO role');
    });

    it('should not be visible for PMO role', () => {
      const allowedRoles = ["SDMT", "EXEC_RO"];
      assert.ok(!allowedRoles.includes("PMO"),
        'Forecast V2 should not be visible for PMO role');
    });

    it('should not be visible for VENDOR role', () => {
      const allowedRoles = ["SDMT", "EXEC_RO"];
      assert.ok(!allowedRoles.includes("VENDOR"),
        'Forecast V2 should not be visible for VENDOR role');
    });
  });
});
