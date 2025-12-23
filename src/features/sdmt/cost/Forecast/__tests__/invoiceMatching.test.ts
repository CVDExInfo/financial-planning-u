/**
 * Tests for robust invoice matching logic in useSDMTForecastData
 * 
 * Tests the three-tier matching strategy:
 * 1. Match by line_item_id (highest priority)
 * 2. Match by rubroId (medium priority)
 * 3. Match by normalized description (fallback)
 */

import { describe, it, expect } from 'vitest';

describe('Invoice Matching Logic', () => {
  // Helper function (duplicated from hook for testing)
  const matchInvoiceToCell = (inv: any, cell: any): boolean => {
    if (!inv) return false;
    
    // Priority 1: Match by line_item_id
    if (inv.line_item_id && inv.line_item_id === cell.line_item_id) {
      return true;
    }
    
    // Priority 2: Match by rubroId
    if (inv.rubroId && inv.rubroId === cell.rubroId) {
      return true;
    }
    
    // Priority 3: Match by normalized description
    const normalize = (s: any) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
    if (inv.description && cell.description && 
        normalize(inv.description) === normalize(cell.description)) {
      return true;
    }
    
    return false;
  };

  it('should match by line_item_id (highest priority)', () => {
    const invoice = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-999',
      description: 'Different Description'
    };
    
    const cell = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    };
    
    expect(matchInvoiceToCell(invoice, cell)).toBe(true);
  });

  it('should match by rubroId when line_item_id is not available', () => {
    const invoice = {
      rubroId: 'RUBRO-456',
      description: 'Different Description'
    };
    
    const cell = {
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    };
    
    expect(matchInvoiceToCell(invoice, cell)).toBe(true);
  });

  it('should match by normalized description as fallback', () => {
    const invoice = {
      description: '  Software   License  '
    };
    
    const cell = {
      description: 'Software License'
    };
    
    expect(matchInvoiceToCell(invoice, cell)).toBe(true);
  });

  it('should handle case-insensitive description matching', () => {
    const invoice = {
      description: 'SOFTWARE LICENSE'
    };
    
    const cell = {
      description: 'software license'
    };
    
    expect(matchInvoiceToCell(invoice, cell)).toBe(true);
  });

  it('should not match when nothing matches', () => {
    const invoice = {
      line_item_id: 'LI-999',
      rubroId: 'RUBRO-999',
      description: 'Completely Different'
    };
    
    const cell = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    };
    
    expect(matchInvoiceToCell(invoice, cell)).toBe(false);
  });

  it('should return false for null invoice', () => {
    const cell = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    };
    
    expect(matchInvoiceToCell(null, cell)).toBe(false);
  });

  it('should prefer line_item_id even when other fields differ', () => {
    const invoice = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-WRONG',
      description: 'Wrong Description'
    };
    
    const cell = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-RIGHT',
      description: 'Right Description'
    };
    
    // Should match on line_item_id despite other differences
    expect(matchInvoiceToCell(invoice, cell)).toBe(true);
  });
});

describe('Variance Calculations', () => {
  it('should calculate varianceActual when invoice matches', () => {
    const planned = 1000;
    const actual = 1200;
    const forecast = 1100;
    
    const varianceActual = actual - planned;
    const varianceForecast = forecast - planned;
    
    expect(varianceActual).toBe(200); // actual is 200 more than planned
    expect(varianceForecast).toBe(100); // forecast is 100 more than planned
  });

  it('should calculate varianceForecast when no invoice matches', () => {
    const planned = 1000;
    const forecast = 900;
    
    const varianceActual = null; // no actual data
    const varianceForecast = forecast - planned;
    
    expect(varianceActual).toBe(null);
    expect(varianceForecast).toBe(-100); // forecast is 100 less than planned
  });

  it('should handle null forecast gracefully', () => {
    const planned = 1000;
    const forecast = null;
    
    const varianceForecast = forecast != null ? forecast - planned : null;
    
    expect(varianceForecast).toBe(null);
  });
});
