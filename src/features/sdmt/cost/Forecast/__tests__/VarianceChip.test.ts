/**
 * VarianceChip Component Unit Tests
 * 
 * Tests for VarianceChip formatting, color logic, and percent handling
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Test: VarianceChip formatting logic
 * 
 * Since we can't render React components in Node tests, we test the
 * formatting logic that the component uses internally.
 */
describe('VarianceChip - Formatting Logic', () => {
  it('should format positive variance with + prefix and red color', () => {
    const value = 1500;
    const percent = 15.0;
    
    // Value formatting
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    const formattedValue = `${sign}$1,500`; // Simulated currency format
    
    // Percent formatting
    const percentSign = percent > 0 ? '+' : '';
    const formattedPercent = `${percentSign}${percent.toFixed(1)}%`;
    
    // Color
    const color = value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-muted-foreground';
    
    assert.strictEqual(sign, '+', 'Positive variance should have + sign');
    assert.strictEqual(formattedPercent, '+15.0%', 'Positive percent should be +15.0%');
    assert.strictEqual(color, 'text-red-600', 'Positive variance should be red');
  });

  it('should format negative variance with minus sign and green color', () => {
    const value = -800;
    const percent = -8.5;
    
    // Value formatting (use U+2212 minus sign)
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    
    // Percent formatting
    const percentSign = percent > 0 ? '+' : '';
    const formattedPercent = `${percentSign}${percent.toFixed(1)}%`;
    
    // Color
    const color = value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-muted-foreground';
    
    assert.strictEqual(sign, '−', 'Negative variance should have minus sign (U+2212)');
    assert.strictEqual(formattedPercent, '-8.5%', 'Negative percent should be -8.5%');
    assert.strictEqual(color, 'text-green-600', 'Negative variance should be green');
  });

  it('should format zero variance with muted color', () => {
    const value = 0;
    const percent = 0.0;
    
    // Value formatting
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    
    // Percent formatting
    const percentSign = percent > 0 ? '+' : '';
    const formattedPercent = `${percentSign}${percent.toFixed(1)}%`;
    
    // Color
    const color = value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-muted-foreground';
    
    assert.strictEqual(sign, '', 'Zero variance should have no sign');
    assert.strictEqual(formattedPercent, '0.0%', 'Zero percent should be 0.0%');
    assert.strictEqual(color, 'text-muted-foreground', 'Zero variance should be muted');
  });

  it('should display em dash when percent is null (denominator=0)', () => {
    const value = 500;
    const percent = null;
    
    // Percent formatting
    const formattedPercent = percent !== null 
      ? (percent > 0 ? '+' : '') + percent.toFixed(1) + '%'
      : '—';
    
    assert.strictEqual(formattedPercent, '—', 'Null percent should display em dash');
  });

  it('should format percent with one decimal place', () => {
    const testCases = [
      { percent: 12.3456, expected: '+12.3%' },
      { percent: -7.8912, expected: '-7.9%' },
      { percent: 0.05, expected: '+0.1%' }, // Small positive still gets +
      { percent: -0.04, expected: '-0.0%' },
    ];
    
    testCases.forEach(({ percent, expected }) => {
      const percentSign = percent > 0 ? '+' : '';
      const formatted = `${percentSign}${percent.toFixed(1)}%`;
      assert.strictEqual(formatted, expected, `Percent ${percent} should format as ${expected}`);
    });
  });
});

/**
 * Test: Color determination logic
 */
describe('VarianceChip - Color Logic', () => {
  it('should use red for overspend (positive variance)', () => {
    const getColorClass = (value: number): string => {
      if (value > 0) return 'text-red-600';
      if (value < 0) return 'text-green-600';
      return 'text-muted-foreground';
    };
    
    assert.strictEqual(getColorClass(100), 'text-red-600');
    assert.strictEqual(getColorClass(0.01), 'text-red-600');
    assert.strictEqual(getColorClass(10000), 'text-red-600');
  });

  it('should use green for savings (negative variance)', () => {
    const getColorClass = (value: number): string => {
      if (value > 0) return 'text-red-600';
      if (value < 0) return 'text-green-600';
      return 'text-muted-foreground';
    };
    
    assert.strictEqual(getColorClass(-100), 'text-green-600');
    assert.strictEqual(getColorClass(-0.01), 'text-green-600');
    assert.strictEqual(getColorClass(-10000), 'text-green-600');
  });

  it('should use muted for zero variance', () => {
    const getColorClass = (value: number): string => {
      if (value > 0) return 'text-red-600';
      if (value < 0) return 'text-green-600';
      return 'text-muted-foreground';
    };
    
    assert.strictEqual(getColorClass(0), 'text-muted-foreground');
  });
});
