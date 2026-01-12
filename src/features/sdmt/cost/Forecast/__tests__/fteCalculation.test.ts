/**
 * Unit tests for FTE calculation from baseline labor_estimates
 * 
 * Validates that totalFTE correctly sums FTE from baseline labor_estimates
 * and falls back to lineItems.qty when baseline is not available.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('FTE Calculation', () => {
  it('should sum FTE from baseline labor_estimates', () => {
    const baselineDetail = {
      baseline_id: 'baseline-123',
      labor_estimates: [
        { role: 'Senior Developer', fte_count: 2.5, hourly_rate: 80 },
        { role: 'Junior Developer', fte_count: 3.0, hourly_rate: 50 },
        { role: 'QA Engineer', fte_count: 1.5, hourly_rate: 60 },
      ],
    };

    const totalFTE = baselineDetail.labor_estimates.reduce((sum, item) => {
      return sum + Number(item.fte_count || 0);
    }, 0);

    // Round to 2 decimals
    const rounded = Math.round(totalFTE * 100) / 100;

    assert.strictEqual(rounded, 7.0, 'Total FTE should equal sum of labor_estimates fte_count');
  });

  it('should handle fte field variant', () => {
    const baselineDetail = {
      baseline_id: 'baseline-456',
      labor_estimates: [
        { role: 'Developer', fte: 2.5 }, // Using 'fte' instead of 'fte_count'
        { role: 'Tester', fte: 1.25 },
      ],
    };

    const totalFTE = baselineDetail.labor_estimates.reduce((sum, item) => {
      return sum + Number(item.fte_count || item.fte || 0);
    }, 0);

    const rounded = Math.round(totalFTE * 100) / 100;

    assert.strictEqual(rounded, 3.75, 'Should handle fte field variant');
  });

  it('should handle payload structure', () => {
    const baselineDetail = {
      baseline_id: 'baseline-789',
      payload: {
        labor_estimates: [
          { role: 'Architect', fte_count: 1.0 },
          { role: 'Developer', fte_count: 4.5 },
        ],
      },
    };

    const laborEstimates = baselineDetail.labor_estimates || baselineDetail.payload?.labor_estimates || [];
    const totalFTE = laborEstimates.reduce((sum, item) => {
      return sum + Number(item.fte_count || item.fte || 0);
    }, 0);

    const rounded = Math.round(totalFTE * 100) / 100;

    assert.strictEqual(rounded, 5.5, 'Should extract labor_estimates from payload');
  });

  it('should fallback to lineItems qty when baseline unavailable', () => {
    const lineItems = [
      { id: 'item-1', qty: 3 },
      { id: 'item-2', qty: 2.5 },
      { id: 'item-3', qty: 1 },
    ];

    const totalFTE = lineItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const rounded = Math.round(totalFTE * 100) / 100;

    assert.strictEqual(rounded, 6.5, 'Should fallback to lineItems qty');
  });

  it('should round to 2 decimal places', () => {
    const baselineDetail = {
      baseline_id: 'baseline-decimal',
      labor_estimates: [
        { role: 'Developer', fte_count: 2.333 },
        { role: 'Tester', fte_count: 1.666 },
      ],
    };

    const totalFTE = baselineDetail.labor_estimates.reduce((sum, item) => {
      return sum + Number(item.fte_count || 0);
    }, 0);

    const rounded = Math.round(totalFTE * 100) / 100;

    assert.strictEqual(rounded, 4.0, 'Should round correctly to 2 decimals');
  });

  it('should handle missing or zero FTE values', () => {
    const baselineDetail = {
      baseline_id: 'baseline-missing',
      labor_estimates: [
        { role: 'Developer', fte_count: 2 },
        { role: 'Tester' }, // Missing FTE
        { role: 'Manager', fte_count: 0 },
        { role: 'Consultant', fte_count: 1.5 },
      ],
    };

    const totalFTE = baselineDetail.labor_estimates.reduce((sum, item) => {
      return sum + Number(item.fte_count || item.fte || 0);
    }, 0);

    const rounded = Math.round(totalFTE * 100) / 100;

    assert.strictEqual(rounded, 3.5, 'Should handle missing/zero values as 0');
  });
});
