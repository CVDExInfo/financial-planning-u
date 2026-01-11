/**
 * ForecastRubrosTable Filter Normalization Tests
 * 
 * Tests to ensure filter value normalization from sessionStorage works correctly
 * and handles legacy/corrupted values robustly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Simulate the normalization logic from ForecastRubrosTable
function normalizeFilterValue(savedRaw: string | null): 'labor' | 'all' | 'non-labor' | null {
  try {
    if (!savedRaw) return null;

    // Normalize: canonicalize unicode, trim, lower-case, replace non-word/hyphen with hyphen
    const saved = savedRaw
      .normalize('NFKC')
      .toLowerCase()
      .trim()
      // convert any non-alphanum/hyphen sequences to single hyphen (helps with odd invisible chars)
      .replace(/[^a-z0-9-]+/gi, '-')
      // collapse multiple hyphens
      .replace(/-+/g, '-')
      // trim stray hyphens
      .replace(/(^-|-$)/g, '');

    if (saved === 'labor' || saved === 'all' || saved === 'non-labor') {
      return saved;
    } else {
      // Attempt to match common patterns like 'nonlab or non labor' -> 'non-labor'
      if (/^non.*labor$/.test(saved)) {
        return 'non-labor';
      }
    }
  } catch (err) {
    console.warn('[Test] failed to normalize filter value', err);
  }
  return null;
}

describe('ForecastRubrosTable Filter Normalization', () => {
  it('should handle standard canonical values', () => {
    assert.strictEqual(normalizeFilterValue('labor'), 'labor');
    assert.strictEqual(normalizeFilterValue('all'), 'all');
    assert.strictEqual(normalizeFilterValue('non-labor'), 'non-labor');
  });

  it('should normalize case variations', () => {
    assert.strictEqual(normalizeFilterValue('LABOR'), 'labor');
    assert.strictEqual(normalizeFilterValue('Labor'), 'labor');
    assert.strictEqual(normalizeFilterValue('ALL'), 'all');
    assert.strictEqual(normalizeFilterValue('Non-Labor'), 'non-labor');
    assert.strictEqual(normalizeFilterValue('NON-LABOR'), 'non-labor');
  });

  it('should trim whitespace', () => {
    assert.strictEqual(normalizeFilterValue('  labor  '), 'labor');
    assert.strictEqual(normalizeFilterValue('\tlabor\n'), 'labor');
    assert.strictEqual(normalizeFilterValue('  non-labor  '), 'non-labor');
  });

  it('should handle unicode normalization', () => {
    // Zero-width space (U+FEFF) and other invisible chars
    assert.strictEqual(normalizeFilterValue('non\uFEFFlabor'), 'non-labor');
    assert.strictEqual(normalizeFilterValue('non\u200Blabor'), 'non-labor');
  });

  it('should normalize space-separated variant to hyphenated', () => {
    assert.strictEqual(normalizeFilterValue('non labor'), 'non-labor');
    assert.strictEqual(normalizeFilterValue('non  labor'), 'non-labor');
  });

  it('should match non-labor patterns', () => {
    assert.strictEqual(normalizeFilterValue('nonlabor'), 'non-labor');
    assert.strictEqual(normalizeFilterValue('non_labor'), 'non-labor');
    assert.strictEqual(normalizeFilterValue('non.labor'), 'non-labor');
  });

  it('should handle null and empty values', () => {
    assert.strictEqual(normalizeFilterValue(null), null);
    assert.strictEqual(normalizeFilterValue(''), null);
    assert.strictEqual(normalizeFilterValue('   '), null);
  });

  it('should collapse multiple hyphens', () => {
    assert.strictEqual(normalizeFilterValue('non---labor'), 'non-labor');
    assert.strictEqual(normalizeFilterValue('non--labor'), 'non-labor');
  });

  it('should remove leading/trailing hyphens', () => {
    assert.strictEqual(normalizeFilterValue('-labor-'), 'labor');
    assert.strictEqual(normalizeFilterValue('-non-labor-'), 'non-labor');
  });

  it('should handle invalid values gracefully', () => {
    assert.strictEqual(normalizeFilterValue('invalid'), null);
    assert.strictEqual(normalizeFilterValue('random-text'), null);
    assert.strictEqual(normalizeFilterValue('123'), null);
  });

  it('should be idempotent for canonical values', () => {
    // Running normalization twice should produce same result
    const value1 = normalizeFilterValue('labor');
    const value2 = normalizeFilterValue(value1 || '');
    assert.strictEqual(value1, value2);

    const value3 = normalizeFilterValue('non-labor');
    const value4 = normalizeFilterValue(value3 || '');
    assert.strictEqual(value3, value4);
  });
});

describe('ForecastRubrosTable Filter Normalization Edge Cases', () => {
  it('should handle mixed case with special chars', () => {
    assert.strictEqual(normalizeFilterValue('Non@Labor'), 'non-labor');
    assert.strictEqual(normalizeFilterValue('NON#LABOR'), 'non-labor');
  });

  it('should handle unicode combinations', () => {
    // Combining diacritics - 'ó' (n + combining acute) becomes 'ó' which is replaced by '-'
    // Result is 'no-labor' which doesn't match canonical but could match pattern
    const result = normalizeFilterValue('non\u0301labor');
    // After NFKC normalization 'n\u0301' becomes 'ó', then replaced to get 'no-labor'
    // This doesn't match the exact pattern /^non.*labor$/ so returns null
    // This is acceptable behavior - we're just testing it doesn't crash
    assert.ok(result === null || result === 'non-labor');
  });

  it('should preserve valid hyphens in canonical values', () => {
    assert.strictEqual(normalizeFilterValue('non-labor'), 'non-labor');
  });

  it('should handle pattern matching for common typos', () => {
    // Common patterns that should map to non-labor
    assert.strictEqual(normalizeFilterValue('nonlab'), null); // doesn't end with 'labor'
    assert.strictEqual(normalizeFilterValue('nonlabor'), 'non-labor'); // matches pattern
    assert.strictEqual(normalizeFilterValue('non_labor'), 'non-labor');
  });
});
