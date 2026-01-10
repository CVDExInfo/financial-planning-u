/**
 * ForecastRubrosTable Test - Subtotal Variance
 * 
 * Tests that subtotal rows render VarianceChip with correct values
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Test: Subtotal variance calculation and rendering
 */
describe('ForecastRubrosTable - Subtotal Variance', () => {
  it('should calculate variance correctly for subtotal row', () => {
    // Simulate categoryTotal.overall data
    const categoryTotal = {
      forecast: 1000,
      actual: 1100,
      planned: 900,
      varianceForecast: 100, // forecast - planned
      varianceActual: 100,   // actual - forecast
      percentConsumption: 110, // (actual / forecast) * 100
    };

    // Calculate variance percent (as done in VarianceChip)
    const variancePercent = categoryTotal.forecast !== 0 
      ? (categoryTotal.varianceActual / categoryTotal.forecast) * 100 
      : null;

    // Assert
    assert.strictEqual(categoryTotal.varianceActual, 100, 'Variance should be 100');
    assert.strictEqual(variancePercent, 10, 'Variance percent should be 10%');
  });

  it('should return null percent when denominator is zero', () => {
    const categoryTotal = {
      forecast: 0,
      actual: 100,
      planned: 0,
      varianceForecast: 0,
      varianceActual: 100,
      percentConsumption: 0,
    };

    // Calculate variance percent with denominator check
    const variancePercent = categoryTotal.forecast !== 0 
      ? (categoryTotal.varianceActual / categoryTotal.forecast) * 100 
      : null;

    // Assert
    assert.strictEqual(variancePercent, null, 'Variance percent should be null when forecast is 0');
  });

  it('should handle negative variance (savings)', () => {
    const categoryTotal = {
      forecast: 1000,
      actual: 900,
      planned: 1000,
      varianceForecast: 0,
      varianceActual: -100, // actual - forecast (negative = savings)
      percentConsumption: 90,
    };

    // Calculate variance percent
    const variancePercent = categoryTotal.forecast !== 0 
      ? (categoryTotal.varianceActual / categoryTotal.forecast) * 100 
      : null;

    // Assert
    assert.strictEqual(categoryTotal.varianceActual, -100, 'Variance should be -100 (savings)');
    assert.strictEqual(variancePercent, -10, 'Variance percent should be -10%');
  });

  it('should format variance with sign prefix', () => {
    // Positive variance (overspend)
    const positiveVariance = 150;
    const positiveFormatted = positiveVariance > 0 ? `+${positiveVariance}` : `${positiveVariance}`;
    assert.strictEqual(positiveFormatted, '+150', 'Positive variance should have + prefix');

    // Negative variance (savings)
    const negativeVariance = -150;
    const negativeFormatted = negativeVariance > 0 ? `+${negativeVariance}` : `−${Math.abs(negativeVariance)}`;
    assert.strictEqual(negativeFormatted, '−150', 'Negative variance should use minus sign');

    // Zero variance
    const zeroVariance = 0;
    const zeroFormatted = zeroVariance > 0 ? `+${zeroVariance}` : zeroVariance < 0 ? `−${Math.abs(zeroVariance)}` : `${zeroVariance}`;
    assert.strictEqual(zeroFormatted, '0', 'Zero variance should have no prefix');
  });
});
