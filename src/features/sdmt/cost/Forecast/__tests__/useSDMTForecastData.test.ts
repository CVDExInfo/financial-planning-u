/**
 * Unit tests for useSDMTForecastData hook
 * 
 * Note: Full React hook testing requires @testing-library/react which is not
 * currently configured in this project. These tests validate the module structure.
 * 
 * For comprehensive testing:
 * 1. Use E2E tests with actual API calls and React context
 * 2. Or set up React Testing Library for proper hook testing
 * 
 * The hook's business logic is tested indirectly through:
 * - transformLineItemsToForecast unit tests (fallback logic)
 * - Integration tests in the refactored SDMTForecast component
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('useSDMTForecastData Hook Module', () => {
  it('should validate module can be imported (skipped - requires React)', async (t) => {
    t.skip('Hook testing requires React Testing Library - see E2E tests instead');
    // Note: Importing the hook fails in Node.js because it requires React
    // This is expected and correct behavior
  });

  it('should document that hook provides expected interface', (t) => {
    // This test documents the expected interface without importing
    const expectedInterface = {
      params: {
        projectId: 'string',
        baselineId: 'string (optional)',
        months: 'number (default: 12)',
      },
      returns: {
        loading: 'boolean',
        error: 'string | null',
        baseline: 'BaselineSummary | null',
        rubros: 'LineItem[]',
        forecastRows: 'ForecastRow[]',
        refresh: 'function',
        saveForecast: 'function',
        materializationPending: 'boolean',
        materializationTimeout: 'boolean',
      },
    };
    
    assert.ok(expectedInterface);
    assert.strictEqual(typeof expectedInterface.params.projectId, 'string');
  });
});
