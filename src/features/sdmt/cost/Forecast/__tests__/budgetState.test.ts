import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveAnnualBudgetState } from '../budgetState';

describe('resolveAnnualBudgetState', () => {
  it('returns missing state for 404 errors', () => {
    const resolution = resolveAnnualBudgetState({
      error: { status: 404 },
      year: 2026,
    });

    assert.strictEqual(resolution.status, 'missing');
    assert.strictEqual(resolution.state.amount, '');
    assert.strictEqual(resolution.state.currency, 'USD');
    assert.strictEqual(resolution.state.lastUpdated, null);
    assert.strictEqual(resolution.state.missingYear, 2026);
  });

  it('returns ok state when budget is present', () => {
    const resolution = resolveAnnualBudgetState({
      budget: { amount: 120000, currency: 'MXN', updated_at: '2025-01-01T00:00:00Z' },
      year: 2025,
    });

    assert.strictEqual(resolution.status, 'ok');
    assert.strictEqual(resolution.state.amount, '120000');
    assert.strictEqual(resolution.state.currency, 'MXN');
    assert.strictEqual(resolution.state.lastUpdated, '2025-01-01T00:00:00Z');
    assert.strictEqual(resolution.state.missingYear, null);
  });

  it('returns error state for non-404 errors', () => {
    const resolution = resolveAnnualBudgetState({
      error: { status: 500 },
      year: 2027,
    });

    assert.strictEqual(resolution.status, 'error');
    assert.strictEqual(resolution.state.missingYear, null);
    assert.strictEqual(resolution.state.amount, '');
  });
});
