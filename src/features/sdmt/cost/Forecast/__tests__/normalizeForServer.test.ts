/**
 * normalizeForServer.test.ts
 * 
 * Tests for the normalizeForServer utility that ensures canonical rubros
 * integration for all server payloads.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeForecastRowForServer,
  normalizeForecastRowsForServer,
  normalizeAllocationPayload,
  type ForecastRowInput,
} from '../utils/normalizeForServer';

describe('normalizeForServer', () => {
  describe('normalizeForecastRowForServer', () => {
    it('should normalize row with rubroId field', () => {
      const row: ForecastRowInput = {
        rubroId: 'MOD-ING',
        month: 1,
        forecast: 10000,
      };

      const result = normalizeForecastRowForServer(row);

      assert.strictEqual(result.line_item_id, 'MOD-ING');
      assert.strictEqual(result.linea_codigo, 'MOD-ING');
      assert.strictEqual(result.rubro_canonical, 'MOD-ING');
      assert.ok(result.descripcion); // Should be populated from taxonomy
      assert.ok(result.categoria); // Should be populated from taxonomy
    });

    it('should normalize row with line_item_id field', () => {
      const row: ForecastRowInput = {
        line_item_id: 'MOD-LEAD',
        month: 2,
        forecast: 15000,
      };

      const result = normalizeForecastRowForServer(row);

      assert.strictEqual(result.line_item_id, 'MOD-LEAD');
      assert.strictEqual(result.linea_codigo, 'MOD-LEAD');
      assert.strictEqual(result.rubro_canonical, 'MOD-LEAD');
    });

    it('should canonicalize legacy rubro IDs', () => {
      const row: ForecastRowInput = {
        rubroId: 'RB0001', // Legacy ID that maps to MOD-ING
        month: 3,
        forecast: 8000,
      };

      const result = normalizeForecastRowForServer(row);

      assert.strictEqual(result.line_item_id, 'MOD-ING');
      assert.strictEqual(result.linea_codigo, 'MOD-ING');
      assert.strictEqual(result.rubro_canonical, 'MOD-ING');
    });

    it('should preserve existing description if provided', () => {
      const row: ForecastRowInput = {
        rubroId: 'MOD-ING',
        description: 'Custom Description',
        category: 'Custom Category',
        month: 1,
        forecast: 10000,
      };

      const result = normalizeForecastRowForServer(row);

      assert.strictEqual(result.descripcion, 'Custom Description');
      assert.strictEqual(result.categoria, 'Custom Category');
    });

    it('should populate description from taxonomy if not provided', () => {
      const row: ForecastRowInput = {
        rubroId: 'MOD-SDM',
        month: 1,
        forecast: 12000,
      };

      const result = normalizeForecastRowForServer(row);

      // Should populate from taxonomy
      assert.ok(result.descripcion);
      assert.ok(result.categoria);
      assert.notStrictEqual(result.descripcion, '');
      assert.notStrictEqual(result.categoria, '');
    });

    it('should handle unknown rubro IDs gracefully', () => {
      const row: ForecastRowInput = {
        rubroId: 'UNKNOWN-RUBRO',
        month: 1,
        forecast: 5000,
      };

      const result = normalizeForecastRowForServer(row);

      // Should preserve the unknown ID as-is
      assert.strictEqual(result.line_item_id, 'UNKNOWN-RUBRO');
      assert.strictEqual(result.rubro_canonical, 'UNKNOWN-RUBRO');
      // Description and category should be empty strings
      assert.strictEqual(result.descripcion, '');
      assert.strictEqual(result.categoria, '');
    });

    it('should preserve other fields in the row', () => {
      const row: ForecastRowInput = {
        rubroId: 'TEC-HW-RPL',
        month: 5,
        forecast: 20000,
        actual: 18000,
        projectId: 'PRJ-001',
        notes: 'Test notes',
      };

      const result = normalizeForecastRowForServer(row);

      assert.strictEqual(result.month, 5);
      assert.strictEqual(result.forecast, 20000);
      assert.strictEqual(result.actual, 18000);
      assert.strictEqual(result.projectId, 'PRJ-001');
      assert.strictEqual(result.notes, 'Test notes');
    });

    it('should handle MOD-PM legacy mapping', () => {
      const row: ForecastRowInput = {
        rubroId: 'MOD-PM', // Legacy ID that should map to MOD-LEAD
        month: 1,
        forecast: 15000,
      };

      const result = normalizeForecastRowForServer(row);

      assert.strictEqual(result.line_item_id, 'MOD-LEAD');
      assert.strictEqual(result.linea_codigo, 'MOD-LEAD');
      assert.strictEqual(result.rubro_canonical, 'MOD-LEAD');
    });
  });

  describe('normalizeForecastRowsForServer', () => {
    it('should normalize an array of rows', () => {
      const rows: ForecastRowInput[] = [
        { rubroId: 'MOD-ING', month: 1, forecast: 10000 },
        { rubroId: 'MOD-LEAD', month: 2, forecast: 15000 },
        { rubroId: 'RB0001', month: 3, forecast: 8000 }, // Legacy
      ];

      const results = normalizeForecastRowsForServer(rows);

      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].line_item_id, 'MOD-ING');
      assert.strictEqual(results[1].line_item_id, 'MOD-LEAD');
      assert.strictEqual(results[2].line_item_id, 'MOD-ING'); // RB0001 maps to MOD-ING
    });

    it('should handle empty array', () => {
      const rows: ForecastRowInput[] = [];
      const results = normalizeForecastRowsForServer(rows);

      assert.strictEqual(results.length, 0);
    });
  });

  describe('normalizeAllocationPayload', () => {
    it('should normalize allocation payload', () => {
      const payload: ForecastRowInput = {
        line_item_id: 'GSV-REU',
        amount: 5000,
        allocation_mode: 'spread_evenly',
      };

      const result = normalizeAllocationPayload(payload);

      assert.strictEqual(result.line_item_id, 'GSV-REU');
      assert.strictEqual(result.linea_codigo, 'GSV-REU');
      assert.strictEqual(result.rubro_canonical, 'GSV-REU');
      assert.strictEqual(result.amount, 5000);
      assert.strictEqual(result.allocation_mode, 'spread_evenly');
    });
  });
});
