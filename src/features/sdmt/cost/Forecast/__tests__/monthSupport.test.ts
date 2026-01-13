import { describe, it } from 'node:test';
import assert from 'node:assert';
import { clampMonthIndex, getBaselineDuration } from '../SDMTForecast';

describe('Month support helpers', () => {
  it('getBaselineDuration fallback to 60 when baselineDetail absent', () => {
    assert.strictEqual(getBaselineDuration(null), 60);
  });

  it('getBaselineDuration reads payload.duration_months', () => {
    assert.strictEqual(getBaselineDuration({ payload: { duration_months: 36 } }), 36);
  });

  it('clampMonthIndex clamps above baseline duration', () => {
    const baseline = { payload: { duration_months: 36 } };
    assert.strictEqual(clampMonthIndex(40, baseline), 36);
  });

  it('clampMonthIndex clamps below 1 to 1', () => {
    assert.strictEqual(clampMonthIndex(0, null), 1);
  });

  it('clampMonthIndex falls back to 60 if baseline missing', () => {
    assert.strictEqual(clampMonthIndex(70, null), 60);
  });
});
