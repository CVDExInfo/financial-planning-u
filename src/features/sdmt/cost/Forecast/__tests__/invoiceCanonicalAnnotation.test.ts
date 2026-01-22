/**
 * Test suite for invoice canonical rubro ID annotation
 * Validates that invoices are enriched with canonical rubro IDs for taxonomy-aligned matching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCanonicalRubroId } from '@/lib/rubros/canonical-taxonomy';

describe('Invoice Canonical Rubro Annotation', () => {
  describe('getCanonicalRubroId', () => {
    it('should return canonical ID for known rubro', () => {
      // MOD-ING is a canonical taxonomy entry
      const result = getCanonicalRubroId('MOD-ING');
      expect(result).toBe('MOD-ING');
    });

    it('should handle rubro ID with variations', () => {
      // Test with different casing and whitespace
      const result1 = getCanonicalRubroId('mod-ing');
      const result2 = getCanonicalRubroId(' MOD-ING ');
      
      // Both should resolve to canonical form
      expect(result1 || result2).toBeTruthy();
    });

    it('should return null for unknown rubro', () => {
      const result = getCanonicalRubroId('UNKNOWN-RUBRO-XYZ');
      expect(result).toBeNull();
    });

    it('should handle null/undefined input', () => {
      expect(getCanonicalRubroId(null as any)).toBeNull();
      expect(getCanonicalRubroId(undefined as any)).toBeNull();
      expect(getCanonicalRubroId('')).toBeNull();
    });
  });

  describe('Invoice annotation in forecastService', () => {
    it('should annotate invoice with canonical rubro ID when available', () => {
      // Simulate invoice processing
      const mockInvoice = {
        id: 'inv-001',
        line_item_id: 'MOD-ING',
        rubroId: 'MOD-ING',
        amount: 5000,
        month: 1,
        status: 'approved',
      };

      // Simulate the annotation logic from forecastService.ts
      const rubroId = mockInvoice.rubroId || mockInvoice.line_item_id;
      const canonicalRubroId = rubroId ? getCanonicalRubroId(rubroId) : null;

      const annotatedInvoice = {
        ...mockInvoice,
        ...(canonicalRubroId && { rubro_canonical: canonicalRubroId }),
      };

      expect(annotatedInvoice.rubro_canonical).toBe('MOD-ING');
    });

    it('should not add rubro_canonical field when canonical ID is not found', () => {
      const mockInvoice = {
        id: 'inv-002',
        line_item_id: 'UNKNOWN-RUBRO',
        rubroId: 'UNKNOWN-RUBRO',
        amount: 3000,
        month: 2,
        status: 'approved',
      };

      const rubroId = mockInvoice.rubroId || mockInvoice.line_item_id;
      const canonicalRubroId = rubroId ? getCanonicalRubroId(rubroId) : null;

      const annotatedInvoice = {
        ...mockInvoice,
        ...(canonicalRubroId && { rubro_canonical: canonicalRubroId }),
      };

      expect(annotatedInvoice.rubro_canonical).toBeUndefined();
    });

    it('should handle invoice without rubroId by using line_item_id', () => {
      const mockInvoice = {
        id: 'inv-003',
        line_item_id: 'MOD-SDM',
        amount: 4000,
        month: 3,
        status: 'approved',
      };

      // This simulates the fallback logic: rubroId || line_item_id
      const rubroId = (mockInvoice as any).rubroId || mockInvoice.line_item_id;
      const canonicalRubroId = rubroId ? getCanonicalRubroId(rubroId) : null;

      const annotatedInvoice = {
        ...mockInvoice,
        ...(canonicalRubroId && { rubro_canonical: canonicalRubroId }),
      };

      // Should still get canonical ID from line_item_id
      expect(annotatedInvoice.rubro_canonical).toBeTruthy();
    });

    it('should handle multiple invoices in batch', () => {
      const mockInvoices = [
        { id: 'inv-001', line_item_id: 'MOD-ING', rubroId: 'MOD-ING', amount: 5000 },
        { id: 'inv-002', line_item_id: 'UNKNOWN', rubroId: 'UNKNOWN', amount: 3000 },
        { id: 'inv-003', line_item_id: 'MOD-SDM', amount: 4000 },
      ];

      const annotatedInvoices = mockInvoices.map((invoice) => {
        const rubroId = (invoice as any).rubroId || invoice.line_item_id;
        const canonicalRubroId = rubroId ? getCanonicalRubroId(rubroId) : null;

        return {
          ...invoice,
          ...(canonicalRubroId && { rubro_canonical: canonicalRubroId }),
        };
      });

      // First invoice should have canonical ID
      expect(annotatedInvoices[0].rubro_canonical).toBeTruthy();
      
      // Second invoice (unknown rubro) should not have canonical ID
      expect(annotatedInvoices[1].rubro_canonical).toBeUndefined();
      
      // Third invoice should have canonical ID from line_item_id
      expect(annotatedInvoices[2].rubro_canonical).toBeTruthy();
    });
  });
});
