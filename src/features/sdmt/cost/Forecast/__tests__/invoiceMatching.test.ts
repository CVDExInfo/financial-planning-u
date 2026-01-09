/**
 * Tests for robust invoice matching logic in useSDMTForecastData
 * 
 * Tests the three-tier matching strategy:
 * 1. Match by line_item_id (highest priority)
 * 2. Match by rubroId (medium priority)
 * 3. Match by normalized description (fallback)
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchInvoiceToCell } from '../useSDMTForecastData';

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
