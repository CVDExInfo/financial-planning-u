/**
 * Grid Empty State Test
 * 
 * Tests that the 12-month grid shows P and/or F by default for new projects
 * and only shows "No hay datos" when truly no data exists.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeTotals } from '@/lib/forecast/analytics';

/**
 * Test: hasGridData logic should return true when P > 0 (even without F or A)
 */
describe('Grid Empty State - hasGridData Logic', () => {
  it('should have data when only Planned (P) exists', () => {
    // Simulate new project with baseline but no forecast or actuals yet
    const forecastData = [
      { month: 1, planned: 1000, forecast: 0, actual: 0 },
      { month: 2, planned: 1500, forecast: 0, actual: 0 },
      { month: 3, planned: 2000, forecast: 0, actual: 0 },
    ];

    const totals = computeTotals(forecastData, [1, 2, 3]);

    // Check that totals.overall has planned > 0
    const hasP = totals.overall.planned > 0;
    const hasF = totals.overall.forecast > 0;
    const hasA = totals.overall.actual > 0;

    const hasGridData = hasP || hasF || hasA;

    // Assert
    assert.strictEqual(hasP, true, 'Should have planned data');
    assert.strictEqual(hasF, false, 'Should not have forecast data');
    assert.strictEqual(hasA, false, 'Should not have actual data');
    assert.strictEqual(hasGridData, true, 'hasGridData should be true when P > 0');
    assert.strictEqual(totals.overall.planned, 4500, 'Total planned should be 4500');
  });

  it('should have data when only Forecast (F) exists', () => {
    // Simulate project with forecast but no planned or actuals
    const forecastData = [
      { month: 1, planned: 0, forecast: 1200, actual: 0 },
      { month: 2, planned: 0, forecast: 1800, actual: 0 },
      { month: 3, planned: 0, forecast: 2100, actual: 0 },
    ];

    const totals = computeTotals(forecastData, [1, 2, 3]);

    // Check that totals.overall has forecast > 0
    const hasP = totals.overall.planned > 0;
    const hasF = totals.overall.forecast > 0;
    const hasA = totals.overall.actual > 0;

    const hasGridData = hasP || hasF || hasA;

    // Assert
    assert.strictEqual(hasP, false, 'Should not have planned data');
    assert.strictEqual(hasF, true, 'Should have forecast data');
    assert.strictEqual(hasA, false, 'Should not have actual data');
    assert.strictEqual(hasGridData, true, 'hasGridData should be true when F > 0');
    assert.strictEqual(totals.overall.forecast, 5100, 'Total forecast should be 5100');
  });

  it('should have data when P and F exist (baseline fallback)', () => {
    // Simulate project using baseline fallback - both P and F are set from line items
    const forecastData = [
      { month: 1, planned: 1000, forecast: 1000, actual: 0 },
      { month: 2, planned: 1500, forecast: 1500, actual: 0 },
      { month: 3, planned: 2000, forecast: 2000, actual: 0 },
    ];

    const totals = computeTotals(forecastData, [1, 2, 3]);

    // Check that totals.overall has both planned and forecast > 0
    const hasP = totals.overall.planned > 0;
    const hasF = totals.overall.forecast > 0;
    const hasA = totals.overall.actual > 0;

    const hasGridData = hasP || hasF || hasA;

    // Assert
    assert.strictEqual(hasP, true, 'Should have planned data');
    assert.strictEqual(hasF, true, 'Should have forecast data');
    assert.strictEqual(hasA, false, 'Should not have actual data');
    assert.strictEqual(hasGridData, true, 'hasGridData should be true when P and F > 0');
    assert.strictEqual(totals.overall.planned, 4500, 'Total planned should be 4500');
    assert.strictEqual(totals.overall.forecast, 4500, 'Total forecast should be 4500');
  });

  it('should NOT have data when all are zero', () => {
    // Simulate truly empty state - no data at all
    const forecastData = [
      { month: 1, planned: 0, forecast: 0, actual: 0 },
      { month: 2, planned: 0, forecast: 0, actual: 0 },
      { month: 3, planned: 0, forecast: 0, actual: 0 },
    ];

    const totals = computeTotals(forecastData, [1, 2, 3]);

    // Check that totals.overall has all zeros
    const hasP = totals.overall.planned > 0;
    const hasF = totals.overall.forecast > 0;
    const hasA = totals.overall.actual > 0;

    const hasGridData = hasP || hasF || hasA;

    // Assert
    assert.strictEqual(hasP, false, 'Should not have planned data');
    assert.strictEqual(hasF, false, 'Should not have forecast data');
    assert.strictEqual(hasA, false, 'Should not have actual data');
    assert.strictEqual(hasGridData, false, 'hasGridData should be false when all are zero');
  });

  it('should have data with mixed P, F, A values', () => {
    // Simulate project with some actuals recorded
    const forecastData = [
      { month: 1, planned: 1000, forecast: 1100, actual: 900 },
      { month: 2, planned: 1500, forecast: 1600, actual: 0 },
      { month: 3, planned: 2000, forecast: 2100, actual: 0 },
    ];

    const totals = computeTotals(forecastData, [1, 2, 3]);

    // Check that totals.overall has all values > 0
    const hasP = totals.overall.planned > 0;
    const hasF = totals.overall.forecast > 0;
    const hasA = totals.overall.actual > 0;

    const hasGridData = hasP || hasF || hasA;

    // Assert
    assert.strictEqual(hasP, true, 'Should have planned data');
    assert.strictEqual(hasF, true, 'Should have forecast data');
    assert.strictEqual(hasA, true, 'Should have actual data');
    assert.strictEqual(hasGridData, true, 'hasGridData should be true when any P, F, or A > 0');
    assert.strictEqual(totals.overall.planned, 4500, 'Total planned should be 4500');
    assert.strictEqual(totals.overall.forecast, 4800, 'Total forecast should be 4800');
    assert.strictEqual(totals.overall.actual, 900, 'Total actual should be 900');
  });

  it('should NOT have data when forecastData array is empty', () => {
    // Simulate empty forecast data array
    const forecastData: Array<{ month: number; planned: number; forecast: number; actual: number }> = [];

    const totals = computeTotals(forecastData, []);

    // Check that totals.overall has all zeros
    const hasP = totals.overall.planned > 0;
    const hasF = totals.overall.forecast > 0;
    const hasA = totals.overall.actual > 0;

    const hasGridData = hasP || hasF || hasA;

    // Assert
    assert.strictEqual(hasP, false, 'Should not have planned data');
    assert.strictEqual(hasF, false, 'Should not have forecast data');
    assert.strictEqual(hasA, false, 'Should not have actual data');
    assert.strictEqual(hasGridData, false, 'hasGridData should be false when forecastData is empty');
  });
});

/**
 * Test: Baseline fallback scenario
 */
describe('Grid Empty State - Baseline Fallback', () => {
  it('should populate P and F from baseline when server forecast is empty', () => {
    // This simulates what transformLineItemsToForecast does:
    // It sets both planned and forecast to the same amount from line items
    const lineItemAmount = 5000;
    const months = 12;
    const monthlyAmount = lineItemAmount / months;

    const forecastData = Array.from({ length: months }, (_, i) => ({
      month: i + 1,
      planned: monthlyAmount,
      forecast: monthlyAmount, // Same as planned when using baseline fallback
      actual: 0,
    }));

    const totals = computeTotals(forecastData, Array.from({ length: 12 }, (_, i) => i + 1));

    // Check that both P and F are populated
    const hasP = totals.overall.planned > 0;
    const hasF = totals.overall.forecast > 0;
    const hasA = totals.overall.actual > 0;

    const hasGridData = hasP || hasF || hasA;

    // Assert
    assert.strictEqual(hasP, true, 'Should have planned data from baseline');
    assert.strictEqual(hasF, true, 'Should have forecast data from baseline');
    assert.strictEqual(hasA, false, 'Should not have actual data yet');
    assert.strictEqual(hasGridData, true, 'hasGridData should be true with baseline data');
    
    // Verify totals match expected amounts (with small tolerance for floating point)
    const tolerance = 0.01;
    assert.ok(
      Math.abs(totals.overall.planned - lineItemAmount) < tolerance,
      `Total planned should be approximately ${lineItemAmount}`
    );
    assert.ok(
      Math.abs(totals.overall.forecast - lineItemAmount) < tolerance,
      `Total forecast should be approximately ${lineItemAmount}`
    );
  });
});
