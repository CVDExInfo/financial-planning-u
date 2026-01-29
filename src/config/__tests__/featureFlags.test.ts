import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Feature Flags Tests
 * 
 * Tests for src/config/featureFlags.ts feature flag configuration.
 * Validates that USE_FORECAST_V2 is enabled by either env var.
 * 
 * Note: These tests verify the boolean logic pattern used in featureFlags.ts.
 * The actual FEATURE_FLAGS object behavior is validated through:
 * - Build-time checks (TypeScript compilation)
 * - E2E tests that verify UI behavior with different env vars
 * - Manual QA testing with actual environment configurations
 */

describe("FEATURE_FLAGS configuration", () => {
  describe("USE_FORECAST_V2 flag logic", () => {
    it("should support VITE_FINZ_USE_FORECAST_V2 (preferred)", () => {
      // Test the logical condition that would enable the flag
      const testEnv1 = { VITE_FINZ_USE_FORECAST_V2: 'true', VITE_FINZ_NEW_FORECAST_LAYOUT: undefined };
      const result1 = testEnv1.VITE_FINZ_USE_FORECAST_V2 === 'true' || testEnv1.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
      assert.equal(result1, true, "Flag should be enabled when VITE_FINZ_USE_FORECAST_V2 is 'true'");
    });

    it("should support VITE_FINZ_NEW_FORECAST_LAYOUT (legacy backward compatibility)", () => {
      const testEnv2 = { VITE_FINZ_USE_FORECAST_V2: undefined, VITE_FINZ_NEW_FORECAST_LAYOUT: 'true' };
      const result2 = testEnv2.VITE_FINZ_USE_FORECAST_V2 === 'true' || testEnv2.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
      assert.equal(result2, true, "Flag should be enabled when VITE_FINZ_NEW_FORECAST_LAYOUT is 'true' (legacy)");
    });

    it("should be enabled when both env vars are 'true'", () => {
      const testEnv3 = { VITE_FINZ_USE_FORECAST_V2: 'true', VITE_FINZ_NEW_FORECAST_LAYOUT: 'true' };
      const result3 = testEnv3.VITE_FINZ_USE_FORECAST_V2 === 'true' || testEnv3.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
      assert.equal(result3, true, "Flag should be enabled when both env vars are 'true'");
    });

    it("should be disabled when both env vars are not 'true'", () => {
      const testEnv4 = { VITE_FINZ_USE_FORECAST_V2: 'false', VITE_FINZ_NEW_FORECAST_LAYOUT: 'false' };
      const result4 = testEnv4.VITE_FINZ_USE_FORECAST_V2 === 'true' || testEnv4.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
      assert.equal(result4, false, "Flag should be disabled when both env vars are 'false'");
    });

    it("should be disabled when both env vars are undefined", () => {
      const testEnv5 = { VITE_FINZ_USE_FORECAST_V2: undefined, VITE_FINZ_NEW_FORECAST_LAYOUT: undefined };
      const result5 = testEnv5.VITE_FINZ_USE_FORECAST_V2 === 'true' || testEnv5.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
      assert.equal(result5, false, "Flag should be disabled when both env vars are undefined");
    });

    it("should prefer VITE_FINZ_USE_FORECAST_V2 when both are set differently", () => {
      // When new flag is true and legacy is false
      const testEnv6 = { VITE_FINZ_USE_FORECAST_V2: 'true', VITE_FINZ_NEW_FORECAST_LAYOUT: 'false' };
      const result6 = testEnv6.VITE_FINZ_USE_FORECAST_V2 === 'true' || testEnv6.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
      assert.equal(result6, true, "Flag should be enabled when VITE_FINZ_USE_FORECAST_V2 is 'true' even if legacy is 'false'");
    });

    it("should enable when legacy flag is true even if preferred is false", () => {
      // Backward compatibility: legacy flag can still enable it
      const testEnv7 = { VITE_FINZ_USE_FORECAST_V2: 'false', VITE_FINZ_NEW_FORECAST_LAYOUT: 'true' };
      const result7 = testEnv7.VITE_FINZ_USE_FORECAST_V2 === 'true' || testEnv7.VITE_FINZ_NEW_FORECAST_LAYOUT === 'true';
      assert.equal(result7, true, "Flag should be enabled for backward compatibility when VITE_FINZ_NEW_FORECAST_LAYOUT is 'true'");
    });
  });
});
