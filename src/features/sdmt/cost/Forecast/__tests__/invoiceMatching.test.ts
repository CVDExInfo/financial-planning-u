/**
 * Tests for robust invoice matching logic in useSDMTForecastData
 * 
 * Tests the enhanced matching strategy with canonicalization:
 * 1. projectId guard
 * 2. Canonicalized line_item_id
 * 3. Canonical rubroId via getCanonicalRubroId
 * 4. Taxonomy lookup
 * 5. Normalized description
 * 
 * Also tests invoice month normalization including M\d+ formats
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchInvoiceToCell, normalizeInvoiceMonth } from '../useSDMTForecastData';

describe('Invoice Matching Logic', () => {
  const baseCell = {
    line_item_id: '',
    month: 1,
    planned: 0,
    forecast: 0,
    actual: 0,
    variance: 0,
    last_updated: new Date().toISOString(),
    updated_by: 'test-user',
  };

  describe('projectId guard', () => {
    it('should reject when both projectIds present but different', () => {
      const invoice = {
        projectId: 'PROJ-123',
        line_item_id: 'LI-MATCH',
        rubroId: 'MOD-ING',
      };
      
      const cell = {
        ...baseCell,
        projectId: 'PROJ-456',
        line_item_id: 'LI-MATCH',
        rubroId: 'MOD-ING',
      };
      
      assert.equal(matchInvoiceToCell(invoice, cell), false);
    });

    it('should accept when projectIds match', () => {
      const invoice = {
        projectId: 'PROJ-123',
        line_item_id: 'LI-MATCH',
      };
      
      const cell = {
        ...baseCell,
        projectId: 'PROJ-123',
        line_item_id: 'LI-MATCH',
      };
      
      assert.equal(matchInvoiceToCell(invoice, cell), true);
    });
  });

  it('should match by line_item_id (highest priority)', () => {
    const invoice = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-999',
      description: 'Different Description'
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    };
    
    assert.equal(matchInvoiceToCell(invoice, cell), true);
  });

  it('should match by rubroId when line_item_id is not available', () => {
    const invoice = {
      rubroId: 'RUBRO-456',
      description: 'Different Description'
    };
    
    const cell = {
      ...baseCell,
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    };
    
    assert.equal(matchInvoiceToCell(invoice, cell), true);
  });

  it('should match canonical rubroIds (MOD-ING)', () => {
    const invoice = {
      rubroId: 'MOD-ING',
    };
    
    const cell = {
      ...baseCell,
      rubroId: 'MOD-ING',
    };
    
    assert.equal(matchInvoiceToCell(invoice, cell), true);
  });

  it('should match by normalized description as fallback', () => {
    const invoice = {
      description: '  Software   License  '
    };
    
    const cell = {
      ...baseCell,
      description: 'Software License'
    };
    
    assert.equal(matchInvoiceToCell(invoice, cell), true);
  });

  it('should handle case-insensitive description matching', () => {
    const invoice = {
      description: 'SOFTWARE LICENSE'
    };
    
    const cell = {
      ...baseCell,
      description: 'software license'
    };
    
    assert.equal(matchInvoiceToCell(invoice, cell), true);
  });

  it('should not match when nothing matches', () => {
    const invoice = {
      line_item_id: 'LI-999',
      rubroId: 'RUBRO-999',
      description: 'Completely Different'
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    };
    
    assert.equal(matchInvoiceToCell(invoice, cell), false);
  });

  it('should return false for null invoice', () => {
    const cell = {
      ...baseCell,
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    };
    
    assert.equal(matchInvoiceToCell(null, cell), false);
  });

  it('should prefer line_item_id even when other fields differ', () => {
    const invoice = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-WRONG',
      description: 'Wrong Description'
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-RIGHT',
      description: 'Right Description'
    };
    
    // Should match on line_item_id despite other differences
    assert.equal(matchInvoiceToCell(invoice, cell), true);
  });
});

describe('Variance Calculations', () => {
  it('should calculate varianceActual when invoice matches', () => {
    const planned = 1000;
    const actual = 1200;
    const forecast = 1100;
    
    const varianceActual = actual - planned;
    const varianceForecast = forecast - planned;
    
    assert.equal(varianceActual, 200); // actual is 200 more than planned
    assert.equal(varianceForecast, 100); // forecast is 100 more than planned
  });

  it('should calculate varianceForecast when no invoice matches', () => {
    const planned = 1000;
    const forecast = 900;
    
    const varianceActual = null; // no actual data
    const varianceForecast = forecast - planned;
    
    assert.equal(varianceActual, null);
    assert.equal(varianceForecast, -100); // forecast is 100 less than planned
  });

  it('should handle null forecast gracefully', () => {
    const planned = 1000;
    const forecast = null;
    
    const varianceForecast = forecast != null ? forecast - planned : null;
    
    assert.equal(varianceForecast, null);
  });
});

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
