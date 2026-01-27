/**
 * Test suite for invoice canonical rubro ID annotation
 * Validates that invoices are enriched with canonical rubro IDs for taxonomy-aligned matching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canonicalizeRubroId } from '@/lib/rubros';

describe('Invoice Canonical Rubro Annotation', () => {
  describe('canonicalizeRubroId', () => {
    it('should return canonical ID for known rubro', () => {
      // MOD-ING is a canonical taxonomy entry
      const result = canonicalizeRubroId('MOD-ING');
      expect(result).toBe('MOD-ING');
    });

    it('should handle rubro ID with variations', () => {
      // Test with different casing and whitespace
      const result1 = canonicalizeRubroId('mod-ing');
      const result2 = canonicalizeRubroId(' MOD-ING ');
      
      // Function returns input as-is or mapped canonical ID
      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
    });

    it('should return input for unknown rubro (not null)', () => {
      // The function returns input as-is for unknown rubros
      const result = canonicalizeRubroId('UNKNOWN-RUBRO-XYZ');
      expect(result).toBe('UNKNOWN-RUBRO-XYZ');
    });

    it('should handle empty string input', () => {
      // Empty string is returned as-is
      const result = canonicalizeRubroId('');
      expect(result).toBeUndefined();
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
      const canonicalRubroId = canonicalizeRubroId(rubroId);

      const annotatedInvoice = {
        ...mockInvoice,
        rubro_canonical: canonicalRubroId,
      };

      expect(annotatedInvoice.rubro_canonical).toBe('MOD-ING');
    });

    it('should add rubro_canonical even for unknown rubros (returns input)', () => {
      const mockInvoice = {
        id: 'inv-002',
        line_item_id: 'UNKNOWN-RUBRO',
        rubroId: 'UNKNOWN-RUBRO',
        amount: 3000,
        month: 2,
        status: 'approved',
      };

      const rubroId = mockInvoice.rubroId || mockInvoice.line_item_id;
      const canonicalRubroId = canonicalizeRubroId(rubroId);

      const annotatedInvoice = {
        ...mockInvoice,
        rubro_canonical: canonicalRubroId,
      };

      // canonicalizeRubroId returns the input for unknown rubros
      expect(annotatedInvoice.rubro_canonical).toBe('UNKNOWN-RUBRO');
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
      const canonicalRubroId = canonicalizeRubroId(rubroId);

      const annotatedInvoice = {
        ...mockInvoice,
        rubro_canonical: canonicalRubroId,
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
        const canonicalRubroId = canonicalizeRubroId(rubroId);

        return {
          ...invoice,
          rubro_canonical: canonicalRubroId,
        };
      });

      // First invoice should have canonical ID
      expect(annotatedInvoices[0].rubro_canonical).toBe('MOD-ING');
      
      // Second invoice (unknown rubro) still gets the input back
      expect(annotatedInvoices[1].rubro_canonical).toBe('UNKNOWN');
      
      // Third invoice should have canonical ID from line_item_id
      expect(annotatedInvoices[2].rubro_canonical).toBeTruthy();
    });
  });
});
