/**
 * Test suite for budget normalization helper
 * Validates that monthly budget data from API is correctly transformed to monthlyMap
 */

import { describe, it, expect } from 'vitest';

// This helper is internal to useSDMTForecastData, so we test the concept here
function normalizeBudgetMonths(budgetData: {
  months: Array<{ month: string; amount: number }>;
} | null): Record<number, number> {
  if (!budgetData || !Array.isArray(budgetData.months)) {
    return {};
  }

  const monthlyMap: Record<number, number> = {};
  
  for (const entry of budgetData.months) {
    if (!entry || typeof entry.month !== 'string' || typeof entry.amount !== 'number') {
      continue;
    }

    // Parse month string (format: YYYY-MM)
    const match = entry.month.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const monthNum = parseInt(match[2], 10);
      if (monthNum >= 1 && monthNum <= 12) {
        monthlyMap[monthNum] = entry.amount;
      }
    }
  }

  return monthlyMap;
}

describe('normalizeBudgetMonths', () => {
  it('should convert months array to monthlyMap', () => {
    const budgetData = {
      year: 2026,
      currency: 'USD',
      months: [
        { month: '2026-01', amount: 1000000 },
        { month: '2026-02', amount: 6000000 },
        { month: '2026-03', amount: 2500000 },
      ],
    };

    const result = normalizeBudgetMonths(budgetData);

    expect(result).toEqual({
      1: 1000000,
      2: 6000000,
      3: 2500000,
    });
  });

  it('should handle empty months array', () => {
    const budgetData = {
      year: 2026,
      currency: 'USD',
      months: [],
    };

    const result = normalizeBudgetMonths(budgetData);

    expect(result).toEqual({});
  });

  it('should handle null budgetData', () => {
    const result = normalizeBudgetMonths(null);

    expect(result).toEqual({});
  });

  it('should skip invalid month formats', () => {
    const budgetData = {
      year: 2026,
      currency: 'USD',
      months: [
        { month: '2026-01', amount: 1000000 },
        { month: 'invalid', amount: 5000000 },
        { month: '2026-02', amount: 6000000 },
      ],
    };

    const result = normalizeBudgetMonths(budgetData);

    expect(result).toEqual({
      1: 1000000,
      2: 6000000,
    });
  });

  it('should skip months with invalid month numbers', () => {
    const budgetData = {
      year: 2026,
      currency: 'USD',
      months: [
        { month: '2026-01', amount: 1000000 },
        { month: '2026-13', amount: 5000000 }, // Invalid month number
        { month: '2026-00', amount: 3000000 }, // Invalid month number
        { month: '2026-02', amount: 6000000 },
      ],
    };

    const result = normalizeBudgetMonths(budgetData);

    expect(result).toEqual({
      1: 1000000,
      2: 6000000,
    });
  });

  it('should handle all 12 months', () => {
    const budgetData = {
      year: 2026,
      currency: 'USD',
      months: [
        { month: '2026-01', amount: 100 },
        { month: '2026-02', amount: 200 },
        { month: '2026-03', amount: 300 },
        { month: '2026-04', amount: 400 },
        { month: '2026-05', amount: 500 },
        { month: '2026-06', amount: 600 },
        { month: '2026-07', amount: 700 },
        { month: '2026-08', amount: 800 },
        { month: '2026-09', amount: 900 },
        { month: '2026-10', amount: 1000 },
        { month: '2026-11', amount: 1100 },
        { month: '2026-12', amount: 1200 },
      ],
    };

    const result = normalizeBudgetMonths(budgetData);

    expect(result).toEqual({
      1: 100,
      2: 200,
      3: 300,
      4: 400,
      5: 500,
      6: 600,
      7: 700,
      8: 800,
      9: 900,
      10: 1000,
      11: 1100,
      12: 1200,
    });
  });

  it('should skip entries with missing or invalid fields', () => {
    const budgetData = {
      year: 2026,
      currency: 'USD',
      months: [
        { month: '2026-01', amount: 1000000 },
        { month: '2026-02', amount: null as any }, // Invalid amount
        { month: null as any, amount: 3000000 }, // Invalid month
        { month: '2026-03', amount: 2500000 },
      ],
    };

    const result = normalizeBudgetMonths(budgetData);

    expect(result).toEqual({
      1: 1000000,
      3: 2500000,
    });
  });
});
