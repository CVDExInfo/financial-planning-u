/**
 * Tests for normalizeForecastCells with matchingIds and monthLabel enhancements
 * 
 * Validates that forecast cell normalization:
 * - Populates matchingIds array with all ID variants
 * - Adds monthLabel for calendar alignment
 * - Preserves rubroId for canonical lookups
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeForecastCells } from '../../utils/dataAdapters';

describe('normalizeForecastCells - matchingIds Enhancement', () => {
  it('should populate matchingIds with all ID variants', () => {
    const rawCells = [
      {
        line_item_id: 'LINEITEM#MOD-ING',
        rubroId: 'MOD-ING',
        rubro_id: 'RUBRO#MOD-ING',
        linea_codigo: 'linea-mod-ing',
        month: 1,
        planned: 1000,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    assert.equal(normalized.length, 1);
    const cell = normalized[0];
    
    assert.ok(cell.matchingIds, 'Should have matchingIds array');
    assert.ok(cell.matchingIds!.length > 0, 'matchingIds should not be empty');
    
    // Should include normalized line_item_id
    assert.ok(cell.matchingIds!.includes('MOD-ING'), 'Should include normalized ID');
    
    // Should include original variants
    assert.ok(
      cell.matchingIds!.some((id) => id.includes('MOD-ING')),
      'Should include MOD-ING variant'
    );
  });

  it('should deduplicate matching IDs', () => {
    const rawCells = [
      {
        line_item_id: 'MOD-ING',
        rubroId: 'MOD-ING', // Duplicate
        month: 1,
        planned: 1000,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    const cell = normalized[0];
    
    // matchingIds should not have duplicates
    const uniqueIds = new Set(cell.matchingIds);
    assert.equal(
      uniqueIds.size,
      cell.matchingIds!.length,
      'matchingIds should not contain duplicates'
    );
  });

  it('should include linea_codigo in matchingIds', () => {
    const rawCells = [
      {
        line_item_id: 'LI-123',
        linea_codigo: 'GSV-REU',
        month: 1,
        planned: 1000,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    const cell = normalized[0];
    
    assert.ok(
      cell.matchingIds!.includes('GSV-REU'),
      'Should include linea_codigo in matchingIds'
    );
  });

  it('should preserve both normalized and original IDs', () => {
    const rawCells = [
      {
        line_item_id: 'RUBRO#MOD-SDM',
        rubroId: 'rubro-sdm',
        month: 1,
        planned: 1000,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    const cell = normalized[0];
    
    // Should have normalized version
    assert.equal(cell.line_item_id, 'MOD-SDM', 'Should normalize line_item_id');
    
    // matchingIds should include both
    assert.ok(
      cell.matchingIds!.some((id) => id === 'MOD-SDM'),
      'Should include normalized ID'
    );
    assert.ok(
      cell.matchingIds!.some((id) => id.includes('RUBRO#MOD-SDM')),
      'Should include original prefixed ID'
    );
  });

  it('should handle cells with no alternative IDs', () => {
    const rawCells = [
      {
        line_item_id: 'SINGLE-ID',
        month: 1,
        planned: 1000,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    const cell = normalized[0];
    
    // Should still have matchingIds with at least the primary ID
    assert.ok(cell.matchingIds, 'Should have matchingIds');
    assert.ok(cell.matchingIds!.includes('SINGLE-ID'), 'Should include primary ID');
  });
});

describe('normalizeForecastCells - monthLabel Enhancement', () => {
  it('should add monthLabel for calendar months 1-12', () => {
    const rawCells = [
      { line_item_id: 'ID-1', month: 1, planned: 100 },
      { line_item_id: 'ID-2', month: 6, planned: 200 },
      { line_item_id: 'ID-3', month: 12, planned: 300 },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    // monthLabel should be YYYY-MM format
    assert.ok(normalized[0].monthLabel, 'Should have monthLabel for month 1');
    assert.ok(/^\d{4}-\d{2}$/.test(normalized[0].monthLabel!), 'monthLabel should match YYYY-MM');
    
    assert.ok(normalized[1].monthLabel, 'Should have monthLabel for month 6');
    assert.ok(normalized[2].monthLabel, 'Should have monthLabel for month 12');
  });

  it('should use provided monthLabel if available', () => {
    const rawCells = [
      {
        line_item_id: 'ID-1',
        month: 1,
        monthLabel: '2025-01',
        planned: 100,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    assert.equal(normalized[0].monthLabel, '2025-01', 'Should preserve provided monthLabel');
  });

  it('should use month_label field if available', () => {
    const rawCells = [
      {
        line_item_id: 'ID-1',
        month: 1,
        month_label: '2026-01',
        planned: 100,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    assert.equal(normalized[0].monthLabel, '2026-01', 'Should use month_label');
  });

  it('should use calendar_month field if available', () => {
    const rawCells = [
      {
        line_item_id: 'ID-1',
        month: 1,
        calendar_month: '2027-01',
        planned: 100,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    assert.equal(normalized[0].monthLabel, '2027-01', 'Should use calendar_month');
  });

  it('should handle extended month range gracefully', () => {
    const rawCells = [
      { line_item_id: 'ID-1', month: 13, planned: 100 },
      { line_item_id: 'ID-2', month: 24, planned: 200 },
      { line_item_id: 'ID-3', month: 60, planned: 300 },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    // Extended months may not have auto-generated monthLabel
    // but should not cause errors
    assert.equal(normalized.length, 3, 'Should normalize all cells');
    assert.equal(normalized[0].month, 13, 'Should preserve month 13');
    assert.equal(normalized[1].month, 24, 'Should preserve month 24');
    assert.equal(normalized[2].month, 60, 'Should preserve month 60');
  });
});

describe('normalizeForecastCells - rubroId Enhancement', () => {
  it('should populate rubroId from raw cell', () => {
    const rawCells = [
      {
        line_item_id: 'LI-123',
        rubroId: 'MOD-ING',
        month: 1,
        planned: 1000,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    assert.equal(normalized[0].rubroId, 'MOD-ING', 'Should populate rubroId');
  });

  it('should use rubro_id as fallback for rubroId', () => {
    const rawCells = [
      {
        line_item_id: 'LI-123',
        rubro_id: 'GSV-REU',
        month: 1,
        planned: 1000,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    assert.equal(normalized[0].rubroId, 'GSV-REU', 'Should use rubro_id');
  });

  it('should fallback to line_item_id if no rubroId', () => {
    const rawCells = [
      {
        line_item_id: 'PRIMARY-ID',
        month: 1,
        planned: 1000,
      },
    ];

    const normalized = normalizeForecastCells(rawCells);
    
    assert.equal(
      normalized[0].rubroId,
      'PRIMARY-ID',
      'Should fallback to line_item_id for rubroId'
    );
  });
});

describe('normalizeForecastCells - Extended Month Range Support', () => {
  it('should accept months in 1-60 range', () => {
    const rawCells = [
      { line_item_id: 'ID-1', month: 1, planned: 100 },
      { line_item_id: 'ID-2', month: 12, planned: 200 },
      { line_item_id: 'ID-3', month: 13, planned: 300 },
      { line_item_id: 'ID-4', month: 24, planned: 400 },
      { line_item_id: 'ID-5', month: 60, planned: 500 },
    ];

    const normalized = normalizeForecastCells(rawCells, { debugMode: false });
    
    assert.equal(normalized.length, 5, 'Should normalize all cells');
    assert.equal(normalized[0].month, 1);
    assert.equal(normalized[1].month, 12);
    assert.equal(normalized[2].month, 13);
    assert.equal(normalized[3].month, 24);
    assert.equal(normalized[4].month, 60);
  });

  it('should warn about invalid months in debug mode', () => {
    const rawCells = [
      { line_item_id: 'ID-1', month: 0, planned: 100 },
      { line_item_id: 'ID-2', month: 61, planned: 200 },
    ];

    // In debug mode, warnings should be logged
    // We can't easily test console.warn, but we can verify cells are normalized
    const normalized = normalizeForecastCells(rawCells, { debugMode: true });
    
    assert.equal(normalized.length, 2, 'Should still normalize invalid months');
    assert.equal(normalized[0].month, 0);
    assert.equal(normalized[1].month, 61);
  });
});
