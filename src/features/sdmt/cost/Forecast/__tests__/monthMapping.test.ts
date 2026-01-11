/**
 * Unit tests for project-relative month mapping (M1-M60)
 * 
 * Validates that month mapping correctly computes absolute month
 * based on project baseline start month index.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Compute absolute month from project baseline start and selected M index
 * @param projectBaselineStart - The baseline start month index (absolute month number)
 * @param selectedM - Selected relative month (1-60)
 * @returns Absolute month number
 */
function computeAbsoluteMonth(projectBaselineStart: number | undefined, selectedM: number): number {
  if (!projectBaselineStart || projectBaselineStart < 1) {
    // No anchor available, treat Mx as absolute month
    return selectedM;
  }
  
  // Project relative: absoluteMonth = baselineStart + (selectedM - 1)
  return projectBaselineStart + (selectedM - 1);
}

describe('Month Mapping - M1-M60', () => {
  it('should compute absolute month with baseline start', () => {
    const projectBaselineStart = 10; // Project starts at month 10
    const selectedM = 5; // User selects M5
    
    const absoluteMonth = computeAbsoluteMonth(projectBaselineStart, selectedM);
    
    // M5 relative to start at 10 = 10 + (5-1) = 14
    assert.strictEqual(absoluteMonth, 14, 'Should compute correct absolute month');
  });

  it('should treat M1 as baseline start month', () => {
    const projectBaselineStart = 15;
    const selectedM = 1;
    
    const absoluteMonth = computeAbsoluteMonth(projectBaselineStart, selectedM);
    
    // M1 should equal baseline start
    assert.strictEqual(absoluteMonth, 15, 'M1 should equal baseline start');
  });

  it('should handle M35 correctly', () => {
    const projectBaselineStart = 20;
    const selectedM = 35;
    
    const absoluteMonth = computeAbsoluteMonth(projectBaselineStart, selectedM);
    
    // M35 from month 20 = 20 + 34 = 54
    assert.strictEqual(absoluteMonth, 54, 'Should handle M35 correctly');
  });

  it('should fallback to absolute when no baseline start', () => {
    const projectBaselineStart = undefined;
    const selectedM = 25;
    
    const absoluteMonth = computeAbsoluteMonth(projectBaselineStart, selectedM);
    
    // No anchor, so M25 = absolute month 25
    assert.strictEqual(absoluteMonth, 25, 'Should fallback to absolute month when no baseline start');
  });

  it('should handle baseline start at month 1', () => {
    const projectBaselineStart = 1;
    const selectedM = 12;
    
    const absoluteMonth = computeAbsoluteMonth(projectBaselineStart, selectedM);
    
    // M12 from month 1 = 1 + 11 = 12
    assert.strictEqual(absoluteMonth, 12, 'Should handle baseline start at month 1');
  });

  it('should handle M60 (max months)', () => {
    const projectBaselineStart = 5;
    const selectedM = 60;
    
    const absoluteMonth = computeAbsoluteMonth(projectBaselineStart, selectedM);
    
    // M60 from month 5 = 5 + 59 = 64
    assert.strictEqual(absoluteMonth, 64, 'Should handle M60 correctly');
  });

  it('should handle invalid baseline start (< 1)', () => {
    const projectBaselineStart = 0;
    const selectedM = 10;
    
    const absoluteMonth = computeAbsoluteMonth(projectBaselineStart, selectedM);
    
    // Invalid baseline, fallback to absolute
    assert.strictEqual(absoluteMonth, 10, 'Should fallback when baseline start is invalid');
  });
});
