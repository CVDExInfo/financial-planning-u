/**
 * Standalone tests for normalizeInvoiceMonth utility
 * 
 * Tests month normalization for invoice matching
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Normalize invoice month to match forecast cell month index
 * Handles both numeric month indices (1-12) and YYYY-MM string formats
 * 
 * @param invoiceMonth - Month value from invoice (could be number or "YYYY-MM" string)
 * @param baselineStartMonth - Optional baseline start month for relative indexing
 * @returns Numeric month index (1-based) or 0 if invalid
 */
export const normalizeInvoiceMonth = (invoiceMonth: any, baselineStartMonth?: number): number => {
  // If already a valid numeric month index, return it
  if (typeof invoiceMonth === 'number' && invoiceMonth >= 1 && invoiceMonth <= 60) {
    return invoiceMonth;
  }
  
  // If string in YYYY-MM format, extract month number
  if (typeof invoiceMonth === 'string') {
    const match = invoiceMonth.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const monthNum = parseInt(match[2], 10);
      // If we have baseline start, could calculate relative index
      // For now, just return the month number (1-12)
      return monthNum;
    }
    
    // Try parsing as plain number string
    const parsed = parseInt(invoiceMonth, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) {
      return parsed;
    }
  }
  
  return 0; // Invalid month
};

describe('Invoice Month Normalization', () => {
  it('should return numeric month indices as-is', () => {
    assert.equal(normalizeInvoiceMonth(1), 1);
    assert.equal(normalizeInvoiceMonth(6), 6);
    assert.equal(normalizeInvoiceMonth(12), 12);
  });

  it('should extract month number from YYYY-MM format', () => {
    assert.equal(normalizeInvoiceMonth('2026-01'), 1);
    assert.equal(normalizeInvoiceMonth('2026-06'), 6);
    assert.equal(normalizeInvoiceMonth('2026-12'), 12);
    assert.equal(normalizeInvoiceMonth('2025-03'), 3);
  });

  it('should parse numeric strings', () => {
    assert.equal(normalizeInvoiceMonth('1'), 1);
    assert.equal(normalizeInvoiceMonth('6'), 6);
    assert.equal(normalizeInvoiceMonth('12'), 12);
  });

  it('should handle edge cases', () => {
    // Invalid month returns 0
    assert.equal(normalizeInvoiceMonth('invalid'), 0);
    assert.equal(normalizeInvoiceMonth(''), 0);
    assert.equal(normalizeInvoiceMonth(null), 0);
    assert.equal(normalizeInvoiceMonth(undefined), 0);
  });

  it('should support months beyond 12 (for multi-year projects)', () => {
    assert.equal(normalizeInvoiceMonth(13), 13);
    assert.equal(normalizeInvoiceMonth(24), 24);
    assert.equal(normalizeInvoiceMonth(36), 36);
  });

  it('should reject months outside valid range', () => {
    assert.equal(normalizeInvoiceMonth(0), 0);
    assert.equal(normalizeInvoiceMonth(-1), 0);
    assert.equal(normalizeInvoiceMonth(61), 0); // > 60 months
  });
});
