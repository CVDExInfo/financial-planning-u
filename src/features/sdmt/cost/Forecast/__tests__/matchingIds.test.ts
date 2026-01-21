/**
 * Tests for matchingIds array functionality in invoice matching
 * 
 * Validates that the new matchingIds array enables robust matching
 * when IDs come from different sources (allocations, synthetic, backend)
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchInvoiceToCell } from '../useSDMTForecastData';

describe('matchingIds Array Functionality', () => {
  const baseCell = {
    line_item_id: 'CANONICAL-ID',
    month: 1,
    planned: 0,
    forecast: 0,
    actual: 0,
    variance: 0,
    last_updated: new Date().toISOString(),
    updated_by: 'test-user',
  };

  it('should match when invoice ID is in matchingIds array', () => {
    const invoice = {
      line_item_id: 'SYNTHETIC-ID-123',
      rubroId: 'SYNTHETIC-ID-123',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'CANONICAL-ID',
      matchingIds: ['CANONICAL-ID', 'SYNTHETIC-ID-123', 'ALIAS-ID'],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, true, 'Should match via matchingIds array');
  });

  it('should match when invoice rubroId is in matchingIds array', () => {
    const invoice = {
      rubroId: 'MATERIALIZED-RUBRO-456',
      line_item_id: 'OTHER-ID',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'CANONICAL-ID',
      matchingIds: ['CANONICAL-ID', 'MATERIALIZED-RUBRO-456', 'BACKEND-ID'],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, true, 'Should match via matchingIds array using rubroId');
  });

  it('should match normalized versions in matchingIds array', () => {
    const invoice = {
      line_item_id: 'RUBRO#MOD-ING',
      rubroId: 'RUBRO#MOD-ING',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'MOD-ING',
      matchingIds: ['MOD-ING', 'LINEITEM#MOD-ING'],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, true, 'Should match normalized ID in matchingIds');
  });

  it('should not match when invoice ID is not in matchingIds', () => {
    const invoice = {
      line_item_id: 'UNRELATED-ID',
      rubroId: 'UNRELATED-RUBRO',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'CANONICAL-ID',
      matchingIds: ['CANONICAL-ID', 'ALIAS-1', 'ALIAS-2'],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, false, 'Should not match when ID not in matchingIds');
  });

  it('should handle multiple ID variants in single matchingIds array', () => {
    const invoice = {
      line_item_id: 'linea_codigo_123',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'backend-id-primary',
      matchingIds: [
        'backend-id-primary',
        'rubroId-variant',
        'linea_codigo_123',
        'synthetic-materialized-id',
        'RUBRO#linea_codigo_123', // With prefix
      ],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, true, 'Should match any variant in matchingIds');
  });

  it('should prioritize exact line_item_id match over matchingIds', () => {
    const invoice = {
      line_item_id: 'EXACT-MATCH',
      rubroId: 'DIFFERENT',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'EXACT-MATCH',
      matchingIds: ['OTHER-ID', 'ANOTHER-ID'],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, true, 'Should match via exact line_item_id first');
  });

  it('should handle empty matchingIds array gracefully', () => {
    const invoice = {
      line_item_id: 'INVOICE-ID',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'CELL-ID',
      matchingIds: [],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, false, 'Should not match with empty matchingIds');
  });

  it('should handle undefined matchingIds gracefully', () => {
    const invoice = {
      line_item_id: 'INVOICE-ID',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'CELL-ID',
      matchingIds: undefined,
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, false, 'Should not match when matchingIds undefined');
  });

  it('should match backend ID in matchingIds for allocation-generated cells', () => {
    // Simulates a cell generated from allocations that has a synthetic ID
    // but includes the backend canonical ID in matchingIds
    const invoice = {
      line_item_id: 'BACKEND-CANONICAL-MOD-ING',
      rubroId: 'MOD-ING',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'ALLOCATION-SYNTHETIC-123',
      matchingIds: [
        'ALLOCATION-SYNTHETIC-123',
        'BACKEND-CANONICAL-MOD-ING',
        'MOD-ING',
      ],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, true, 'Should match backend ID via matchingIds');
  });

  it('should match prefixed IDs in matchingIds', () => {
    const invoice = {
      line_item_id: 'RUBRO#GSV-REU',
    };
    
    const cell = {
      ...baseCell,
      line_item_id: 'GSV-REU',
      matchingIds: ['GSV-REU', 'RUBRO#GSV-REU', 'LINEITEM#GSV-REU'],
    } as any;
    
    const result = matchInvoiceToCell(invoice, cell);
    assert.equal(result, true, 'Should match prefixed ID in matchingIds');
  });
});

describe('Month Normalization Extended Range', () => {
  const { normalizeInvoiceMonth } = require('../useSDMTForecastData');
  
  it('should handle extended month range 1-60', () => {
    assert.equal(normalizeInvoiceMonth(1), 1);
    assert.equal(normalizeInvoiceMonth(12), 12);
    assert.equal(normalizeInvoiceMonth(13), 13);
    assert.equal(normalizeInvoiceMonth(24), 24);
    assert.equal(normalizeInvoiceMonth(36), 36);
    assert.equal(normalizeInvoiceMonth(48), 48);
    assert.equal(normalizeInvoiceMonth(60), 60);
  });

  it('should reject months outside 1-60 range', () => {
    assert.equal(normalizeInvoiceMonth(0), 0);
    assert.equal(normalizeInvoiceMonth(61), 0);
    assert.equal(normalizeInvoiceMonth(100), 0);
    assert.equal(normalizeInvoiceMonth(-1), 0);
  });

  it('should parse M format with extended range', () => {
    assert.equal(normalizeInvoiceMonth('M13'), 13);
    assert.equal(normalizeInvoiceMonth('M24'), 24);
    assert.equal(normalizeInvoiceMonth('m36'), 36);
    assert.equal(normalizeInvoiceMonth('M60'), 60);
  });

  it('should parse M format with leading zeros', () => {
    assert.equal(normalizeInvoiceMonth('M01'), 1);
    assert.equal(normalizeInvoiceMonth('M09'), 9);
    assert.equal(normalizeInvoiceMonth('m06'), 6);
  });

  it('should handle YYYY-MM format for calendar months', () => {
    assert.equal(normalizeInvoiceMonth('2026-01'), 1);
    assert.equal(normalizeInvoiceMonth('2026-06'), 6);
    assert.equal(normalizeInvoiceMonth('2026-12'), 12);
    assert.equal(normalizeInvoiceMonth('2025-03'), 3);
  });

  it('should handle ISO date format YYYY-MM-DD', () => {
    assert.equal(normalizeInvoiceMonth('2026-01-15'), 1);
    assert.equal(normalizeInvoiceMonth('2026-07-20'), 7);
    assert.equal(normalizeInvoiceMonth('2025-12-31'), 12);
  });

  it('should handle ISO datetime format', () => {
    assert.equal(normalizeInvoiceMonth('2026-01-20T18:13:42.272Z'), 1);
    assert.equal(normalizeInvoiceMonth('2026-06-15T12:00:00Z'), 6);
    assert.equal(normalizeInvoiceMonth('2025-12-25T23:59:59Z'), 12);
  });

  it('should parse numeric strings in extended range', () => {
    assert.equal(normalizeInvoiceMonth('1'), 1);
    assert.equal(normalizeInvoiceMonth('12'), 12);
    assert.equal(normalizeInvoiceMonth('24'), 24);
    assert.equal(normalizeInvoiceMonth('60'), 60);
  });

  it('should return 0 for invalid formats', () => {
    assert.equal(normalizeInvoiceMonth('invalid'), 0);
    assert.equal(normalizeInvoiceMonth('M0'), 0);
    assert.equal(normalizeInvoiceMonth('M61'), 0);
    assert.equal(normalizeInvoiceMonth('2026'), 0);
    assert.equal(normalizeInvoiceMonth(''), 0);
    assert.equal(normalizeInvoiceMonth(null), 0);
    assert.equal(normalizeInvoiceMonth(undefined), 0);
  });
});
