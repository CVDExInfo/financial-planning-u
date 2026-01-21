/**
 * Task 6: Invoice-to-Forecast Matching Logic Tests
 * 
 * Tests the enhanced matching strategy with:
 * - Robust lookup chain: rubroId || rubro_id || line_item_id || linea_codigo || linea_id
 * - Description-based taxonomy lookup with normalizeKey
 * - DEV-mode logging
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchInvoiceToCell } from '../useSDMTForecastData';
import { buildTaxonomyMap } from '../lib/taxonomyLookup';
import { CANONICAL_RUBROS_TAXONOMY } from '@/lib/rubros/canonical-taxonomy';

describe('Task 6: Invoice Matching - Robust Lookup Chain', () => {
  const baseCell = {
    line_item_id: 'MOD-SDM',
    rubroId: 'MOD-SDM',
    month: 1,
    planned: 1000,
    forecast: 1000,
    actual: 0,
    variance: 0,
    last_updated: new Date().toISOString(),
    updated_by: 'test-user',
    description: 'Service Delivery Manager',
  };

  // Build taxonomy map for tests
  const taxonomyMap = buildTaxonomyMap(CANONICAL_RUBROS_TAXONOMY);
  const taxonomyCache = new Map();

  describe('linea_codigo field matching', () => {
    it('should match invoice with linea_codigo field', () => {
      const invoice = {
        id: 'INV-001',
        linea_codigo: 'MOD-SDM',
        amount: 1000,
        month: '2025-01',
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match via linea_codigo');
    });

    it('should normalize linea_codigo for matching', () => {
      const invoice = {
        id: 'INV-002',
        linea_codigo: 'mod-sdm', // lowercase
        amount: 1000,
        month: '2025-01',
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match via normalized linea_codigo');
    });

    it('should match linea_codigo with variant cell line_item_id', () => {
      const invoice = {
        id: 'INV-003',
        linea_codigo: 'MOD_SDM', // underscore variant
        amount: 1000,
        month: '2025-01',
      };
      
      const cell = {
        ...baseCell,
        line_item_id: 'MOD-SDM',
      };
      
      const result = matchInvoiceToCell(invoice, cell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match via normalized linea_codigo variant');
    });
  });

  describe('linea_id field matching', () => {
    it('should match invoice with linea_id field', () => {
      const invoice = {
        id: 'INV-004',
        linea_id: 'MOD-SDM',
        amount: 1000,
        month: '2025-01',
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match via linea_id');
    });

    it('should normalize linea_id for matching', () => {
      const invoice = {
        id: 'INV-005',
        linea_id: 'mod-sdm', // lowercase
        amount: 1000,
        month: '2025-01',
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match via normalized linea_id');
    });

    it('should prefer linea_id over description', () => {
      const invoice = {
        id: 'INV-006',
        linea_id: 'MOD-SDM',
        description: 'Wrong Description',
        amount: 1000,
        month: '2025-01',
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match via linea_id, ignoring mismatched description');
    });
  });

  describe('descripcion field with taxonomy lookup', () => {
    it('should resolve "Service Delivery Manager" to MOD-SDM via taxonomy', () => {
      const invoice = {
        id: 'INV-007',
        descripcion: 'Service Delivery Manager',
        amount: 1000,
        month: '2025-01',
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match via taxonomy lookup from descripcion');
    });

    it('should resolve Spanish description to taxonomy', () => {
      const invoice = {
        id: 'INV-008',
        descripcion: 'Mano de Obra',
        amount: 1000,
        month: '2025-01',
      };
      
      const laborCell = {
        ...baseCell,
        line_item_id: 'MOD',
        rubroId: 'MOD',
        description: 'Mano de Obra',
      };
      
      const result = matchInvoiceToCell(invoice, laborCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match labor category via taxonomy');
    });

    it('should handle normalized descripcion with accents', () => {
      const invoice = {
        id: 'INV-009',
        descripcion: 'Mañana de Obra', // with accent
        amount: 1000,
        month: '2025-01',
      };
      
      const cell = {
        ...baseCell,
        description: 'Manana de Obra', // without accent
      };
      
      const result = matchInvoiceToCell(invoice, cell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should normalize accents in descripcion');
    });
  });

  describe('month format support', () => {
    it('should handle invoice months in YYYY-MM format', () => {
      const invoice = {
        id: 'INV-010',
        line_item_id: 'MOD-SDM',
        amount: 1000,
        month: '2025-01',
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should handle YYYY-MM month format');
    });

    it('should handle invoice months in M1 format', () => {
      const invoice = {
        id: 'INV-011',
        line_item_id: 'MOD-SDM',
        amount: 1000,
        month: 'M1',
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should handle M1 month format');
    });

    it('should handle invoice with month as number', () => {
      const invoice = {
        id: 'INV-012',
        line_item_id: 'MOD-SDM',
        amount: 1000,
        month: 1,
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should handle numeric month');
    });
  });

  describe('lookup chain priority', () => {
    it('should prioritize line_item_id over other fields', () => {
      const invoice = {
        id: 'INV-013',
        rubroId: 'WRONG-ID',
        rubro_id: 'ALSO-WRONG',
        line_item_id: 'MOD-SDM',
        linea_codigo: 'WRONG-CODE',
        linea_id: 'WRONG-LINEA',
        amount: 1000,
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match via line_item_id with highest priority');
    });

    it('should fallback to linea_codigo when line_item_id missing', () => {
      const invoice = {
        id: 'INV-014',
        linea_codigo: 'MOD-SDM',
        description: 'Wrong description',
        amount: 1000,
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should fallback to linea_codigo');
    });

    it('should fallback to linea_id when line_item_id and linea_codigo missing', () => {
      const invoice = {
        id: 'INV-015',
        linea_id: 'MOD-SDM',
        description: 'Wrong description',
        amount: 1000,
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should fallback to linea_id');
    });

    it('should fallback to taxonomy lookup from description when all ID fields missing', () => {
      const invoice = {
        id: 'INV-016',
        description: 'Service Delivery Manager',
        amount: 1000,
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should fallback to taxonomy lookup from description');
    });
  });

  describe('no match scenarios', () => {
    it('should not match when all fields differ', () => {
      const invoice = {
        id: 'INV-017',
        rubroId: 'DIFFERENT-ID',
        line_item_id: 'DIFFERENT-LINE',
        linea_codigo: 'DIFFERENT-CODE',
        linea_id: 'DIFFERENT-LINEA',
        description: 'Completely Different',
        amount: 1000,
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, false, 'Should not match when all fields differ');
    });

    it('should not match null invoice', () => {
      const result = matchInvoiceToCell(null, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, false, 'Should not match null invoice');
    });

    it('should not match when projectIds differ', () => {
      const invoice = {
        id: 'INV-018',
        projectId: 'PROJ-123',
        line_item_id: 'MOD-SDM',
        amount: 1000,
      };
      
      const cell = {
        ...baseCell,
        projectId: 'PROJ-456',
      };
      
      const result = matchInvoiceToCell(invoice, cell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, false, 'Should not match when projectIds differ');
    });
  });

  describe('edge cases', () => {
    it('should handle invoice with empty strings', () => {
      const invoice = {
        id: 'INV-019',
        rubroId: '',
        line_item_id: '',
        description: '',
        amount: 1000,
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, false, 'Should not match invoice with all empty strings');
    });

    it('should handle cell with missing optional fields', () => {
      const invoice = {
        id: 'INV-020',
        line_item_id: 'MOD-SDM',
        amount: 1000,
      };
      
      const minimalCell = {
        line_item_id: 'MOD-SDM',
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
        last_updated: new Date().toISOString(),
        updated_by: 'test',
      };
      
      const result = matchInvoiceToCell(invoice, minimalCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should match minimal cell via line_item_id');
    });

    it('should handle mixed case in all ID fields', () => {
      const invoice = {
        id: 'INV-021',
        linea_codigo: 'MoD-SdM',
        amount: 1000,
      };
      
      const result = matchInvoiceToCell(invoice, baseCell, taxonomyMap, taxonomyCache);
      assert.strictEqual(result, true, 'Should normalize mixed case in linea_codigo');
    });
  });
});
