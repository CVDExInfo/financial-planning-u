/**
 * Standalone tests for normalizeInvoiceMonth utility
 * 
 * Tests month normalization for invoice matching
 * 
 * Note: This test file contains a copy of normalizeInvoiceMonth for standalone testing
 * without React dependencies. The production implementation is in useSDMTForecastData.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Test-only copy of normalizeInvoiceMonth
 * Production implementation is in useSDMTForecastData.ts
 * 
 * Normalize invoice month to match forecast cell month index
 * Handles numeric indices, YYYY-MM formats, and M\d+ formats (M1, M11, etc.)
 * 
 * @param invoiceMonth - Month value from invoice (could be number, "YYYY-MM", or "M11" string)
 * @param baselineStartMonth - Optional baseline start month for relative indexing
 * @returns Numeric month index (1-based) or 0 if invalid
 */
const normalizeInvoiceMonth = (invoiceMonth: any, baselineStartMonth?: number): number => {
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
    
    // Try M\d+ format (M1, M11, M12, m11, etc.)
    const mMatch = invoiceMonth.match(/^m\s*0?(\d{1,2})$/i);
    if (mMatch) {
      const mm = parseInt(mMatch[1], 10);
      if (mm >= 1 && mm <= 60) return mm;
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

  it('should parse M\\d+ format (M1, M11, M12)', () => {
    assert.equal(normalizeInvoiceMonth('M1'), 1);
    assert.equal(normalizeInvoiceMonth('M11'), 11);
    assert.equal(normalizeInvoiceMonth('M12'), 12);
    assert.equal(normalizeInvoiceMonth('M01'), 1);
    assert.equal(normalizeInvoiceMonth('M06'), 6);
    // Case insensitive
    assert.equal(normalizeInvoiceMonth('m1'), 1);
    assert.equal(normalizeInvoiceMonth('m11'), 11);
    // With spaces
    assert.equal(normalizeInvoiceMonth('M 1'), 1);
    assert.equal(normalizeInvoiceMonth('m 11'), 11);
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
    // M\d+ format also supports extended months
    assert.equal(normalizeInvoiceMonth('M13'), 13);
    assert.equal(normalizeInvoiceMonth('M24'), 24);
  });

  it('should reject months outside valid range', () => {
    assert.equal(normalizeInvoiceMonth(0), 0);
    assert.equal(normalizeInvoiceMonth(-1), 0);
    assert.equal(normalizeInvoiceMonth(61), 0); // > 60 months
    assert.equal(normalizeInvoiceMonth('M61'), 0); // > 60 months
  });
});
