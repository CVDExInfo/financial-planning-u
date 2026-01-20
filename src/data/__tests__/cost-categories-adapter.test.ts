/**
 * Tests for cost-categories adapter
 * 
 * Verifies that COST_CATEGORIES is properly built from canonical taxonomy
 * and that helper functions work correctly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COST_CATEGORIES,
  getCategoryByCode,
  getLineItemByCode,
  getCategoryNames,
  getCategoryCodes,
} from '../cost-categories';

describe('cost-categories adapter', () => {
  describe('COST_CATEGORIES', () => {
    it('should contain categories from canonical taxonomy', () => {
      assert.ok(
        COST_CATEGORIES.length > 0,
        'COST_CATEGORIES should not be empty'
      );

      // Check for known canonical categories
      const categoryCodes = COST_CATEGORIES.map((c) => c.codigo);
      assert.ok(
        categoryCodes.includes('MOD'),
        'Should include MOD category'
      );
      assert.ok(
        categoryCodes.includes('TEC'),
        'Should include TEC category'
      );
      assert.ok(
        categoryCodes.includes('GSV'),
        'Should include GSV category'
      );
    });

    it('should have MOD category with expected line items', () => {
      const modCategory = COST_CATEGORIES.find((c) => c.codigo === 'MOD');
      assert.ok(modCategory, 'MOD category should exist');
      assert.strictEqual(
        modCategory.nombre,
        'Mano de Obra Directa',
        'MOD category should have correct name'
      );

      // Check for known MOD line items
      const lineItemCodes = modCategory.lineas.map((l) => l.codigo);
      assert.ok(
        lineItemCodes.includes('MOD-LEAD'),
        'MOD category should include MOD-LEAD'
      );
      assert.ok(
        lineItemCodes.includes('MOD-ING'),
        'MOD category should include MOD-ING'
      );
      assert.ok(
        lineItemCodes.includes('MOD-SDM'),
        'MOD category should include MOD-SDM'
      );
    });

    it('should have TEC category with expected line items', () => {
      const tecCategory = COST_CATEGORIES.find((c) => c.codigo === 'TEC');
      assert.ok(tecCategory, 'TEC category should exist');
      assert.strictEqual(
        tecCategory.nombre,
        'Equipos y Tecnología',
        'TEC category should have correct name'
      );

      const lineItemCodes = tecCategory.lineas.map((l) => l.codigo);
      assert.ok(
        lineItemCodes.includes('TEC-HW-RPL'),
        'TEC category should include TEC-HW-RPL'
      );
    });

    it('should have line items with required fields', () => {
      for (const category of COST_CATEGORIES) {
        assert.ok(category.codigo, 'Category should have codigo');
        assert.ok(category.nombre, 'Category should have nombre');
        assert.ok(Array.isArray(category.lineas), 'Category should have lineas array');

        for (const lineItem of category.lineas) {
          assert.ok(lineItem.codigo, 'Line item should have codigo');
          assert.ok(lineItem.nombre, 'Line item should have nombre');
          assert.ok(lineItem.descripcion, 'Line item should have descripcion');
          assert.ok(
            ['mensual', 'puntual/hito'].includes(lineItem.tipo_ejecucion),
            'Line item should have valid tipo_ejecucion'
          );
          assert.ok(
            ['OPEX', 'CAPEX'].includes(lineItem.tipo_costo),
            'Line item should have valid tipo_costo'
          );
          assert.ok(
            lineItem.fuente_referencia,
            'Line item should have fuente_referencia'
          );
        }
      }
    });
  });

  describe('getCategoryByCode', () => {
    it('should return MOD category', () => {
      const mod = getCategoryByCode('MOD');
      assert.ok(mod, 'Should find MOD category');
      assert.strictEqual(mod.codigo, 'MOD');
      assert.strictEqual(mod.nombre, 'Mano de Obra Directa');
    });

    it('should return TEC category', () => {
      const tec = getCategoryByCode('TEC');
      assert.ok(tec, 'Should find TEC category');
      assert.strictEqual(tec.codigo, 'TEC');
      assert.strictEqual(tec.nombre, 'Equipos y Tecnología');
    });

    it('should return undefined for non-existent category', () => {
      const result = getCategoryByCode('NON-EXISTENT');
      assert.strictEqual(result, undefined);
    });
  });

  describe('getLineItemByCode', () => {
    it('should find MOD-LEAD line item', () => {
      const result = getLineItemByCode('MOD-LEAD');
      assert.ok(result, 'Should find MOD-LEAD');
      assert.strictEqual(result.lineItem.codigo, 'MOD-LEAD');
      assert.strictEqual(result.category.codigo, 'MOD');
      assert.ok(
        result.lineItem.nombre.includes('líder') ||
          result.lineItem.nombre.includes('coordinador'),
        'MOD-LEAD should have appropriate name'
      );
    });

    it('should find TEC-HW-RPL line item', () => {
      const result = getLineItemByCode('TEC-HW-RPL');
      assert.ok(result, 'Should find TEC-HW-RPL');
      assert.strictEqual(result.lineItem.codigo, 'TEC-HW-RPL');
      assert.strictEqual(result.category.codigo, 'TEC');
    });

    it('should return undefined for non-existent line item', () => {
      const result = getLineItemByCode('NON-EXISTENT-LINE');
      assert.strictEqual(result, undefined);
    });
  });

  describe('getCategoryNames', () => {
    it('should return array of category names', () => {
      const names = getCategoryNames();
      assert.ok(Array.isArray(names), 'Should return an array');
      assert.ok(names.length > 0, 'Should have at least one name');
      assert.ok(
        names.includes('Mano de Obra Directa'),
        'Should include MOD name'
      );
      assert.ok(
        names.includes('Equipos y Tecnología'),
        'Should include TEC name'
      );
    });
  });

  describe('getCategoryCodes', () => {
    it('should return array of category codes', () => {
      const codes = getCategoryCodes();
      assert.ok(Array.isArray(codes), 'Should return an array');
      assert.ok(codes.length > 0, 'Should have at least one code');
      assert.ok(codes.includes('MOD'), 'Should include MOD');
      assert.ok(codes.includes('TEC'), 'Should include TEC');
      assert.ok(codes.includes('GSV'), 'Should include GSV');
    });
  });

  describe('canonical taxonomy consistency', () => {
    it('should have same categories as frontend canonical taxonomy', () => {
      // This test verifies we have all major categories from canonical taxonomy
      const expectedCategories = [
        'MOD', 'GSV', 'REM', 'TEC', 'INF', 'TEL', 'SEC', 'LOG',
        'RIE', 'ADM', 'QLT', 'PLT', 'DEP', 'NOC', 'COL', 'VIA',
        'INV', 'LIC', 'CTR', 'INN',
      ];

      const actualCodes = getCategoryCodes();
      
      for (const expectedCode of expectedCategories) {
        assert.ok(
          actualCodes.includes(expectedCode),
          `Should include ${expectedCode} category from canonical taxonomy`
        );
      }
    });
  });
});
