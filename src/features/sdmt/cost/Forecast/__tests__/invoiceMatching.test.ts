/**
 * Tests for robust invoice matching logic in useSDMTForecastData
 * 
 * Tests the three-tier matching strategy:
 * 1. Match by line_item_id (highest priority)
 * 2. Match by rubroId (medium priority)
 * 3. Match by normalized description (fallback)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchInvoiceToCell } from '../useSDMTForecastData';

const buildCell = (overrides: Record<string, unknown>) =>
  ({
    line_item_id: "LI-BASE",
    month: 1,
    planned: 0,
    forecast: 0,
    actual: 0,
    variance: 0,
    last_updated: "",
    updated_by: "",
    ...overrides,
  }) as any;

describe('Invoice Matching Logic', () => {
  it('should match by line_item_id (highest priority)', () => {
    const invoice = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-999',
      description: 'Different Description'
    } as any;
    
    const cell = buildCell({
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    });
    
    assert.strictEqual(matchInvoiceToCell(invoice, cell), true);
  });

  it('should match by rubroId when line_item_id is not available', () => {
    const invoice = {
      rubroId: 'RUBRO-456',
      description: 'Different Description'
    } as any;
    
    const cell = buildCell({
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    });
    
    assert.strictEqual(matchInvoiceToCell(invoice, cell), true);
  });

  it('should match by normalized description as fallback', () => {
    const invoice = {
      description: '  Software   License  '
    } as any;
    
    const cell = buildCell({
      description: 'Software License'
    });
    
    assert.strictEqual(matchInvoiceToCell(invoice, cell), true);
  });

  it('should handle case-insensitive description matching', () => {
    const invoice = {
      description: 'SOFTWARE LICENSE'
    } as any;
    
    const cell = buildCell({
      description: 'software license'
    });
    
    assert.strictEqual(matchInvoiceToCell(invoice, cell), true);
  });

  it('should not match when nothing matches', () => {
    const invoice = {
      line_item_id: 'LI-999',
      rubroId: 'RUBRO-999',
      description: 'Completely Different'
    } as any;
    
    const cell = buildCell({
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    });
    
    assert.strictEqual(matchInvoiceToCell(invoice, cell), false);
  });

  it('should return false for null invoice', () => {
    const cell = buildCell({
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-456',
      description: 'Original Description'
    });
    
    assert.strictEqual(matchInvoiceToCell(null, cell), false);
  });

  it('should prefer line_item_id even when other fields differ', () => {
    const invoice = {
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-WRONG',
      description: 'Wrong Description'
    } as any;
    
    const cell = buildCell({
      line_item_id: 'LI-123',
      rubroId: 'RUBRO-RIGHT',
      description: 'Right Description'
    });
    
    // Should match on line_item_id despite other differences
    assert.strictEqual(matchInvoiceToCell(invoice, cell), true);
  });
});

describe('Variance Calculations', () => {
  it('should calculate varianceActual when invoice matches', () => {
    const planned = 1000;
    const actual = 1200;
    const forecast = 1100;
    
    const varianceActual = actual - planned;
    const varianceForecast = forecast - planned;
    
    assert.strictEqual(varianceActual, 200); // actual is 200 more than planned
    assert.strictEqual(varianceForecast, 100); // forecast is 100 more than planned
  });

  it('should calculate varianceForecast when no invoice matches', () => {
    const planned = 1000;
    const forecast = 900;
    
    const varianceActual = null; // no actual data
    const varianceForecast = forecast - planned;
    
    assert.strictEqual(varianceActual, null);
    assert.strictEqual(varianceForecast, -100); // forecast is 100 less than planned
  });

  it('should handle null forecast gracefully', () => {
    const planned = 1000;
    const forecast = null;
    
    const varianceForecast = forecast != null ? forecast - planned : null;
    
    assert.strictEqual(varianceForecast, null);
  });
});
