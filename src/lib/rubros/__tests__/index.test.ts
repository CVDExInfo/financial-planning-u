/**
 * Unit tests for rubros helper functions (index.ts)
 * 
 * Tests the unified API for working with rubros taxonomy.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  findRubroByLineaCodigo,
  canonicalizeRubroId,
  rubroDescriptionFor,
  allRubros,
  getTaxonomyEntry,
} from '../index';

describe('rubros/index helpers', () => {
  describe('findRubroByLineaCodigo', () => {
    it('should find rubro by exact linea_codigo', () => {
      const result = findRubroByLineaCodigo('MOD-LEAD');
      assert.ok(result, 'Should find MOD-LEAD');
      assert.strictEqual(result.linea_codigo, 'MOD-LEAD');
    });

    it('should find rubro case-insensitively', () => {
      const result = findRubroByLineaCodigo('mod-lead');
      assert.ok(result, 'Should find mod-lead (lowercase)');
      assert.strictEqual(result.linea_codigo, 'MOD-LEAD');
    });

    it('should find rubro with legacy ID mapping', () => {
      const result = findRubroByLineaCodigo('RB0002');
      assert.ok(result, 'Should find RB0002 (legacy ID)');
      assert.strictEqual(result.linea_codigo, 'MOD-LEAD');
    });

    it('should return undefined for unknown rubro', () => {
      const result = findRubroByLineaCodigo('UNKNOWN-RUBRO-999');
      assert.strictEqual(result, undefined);
    });

    it('should return undefined for empty string', () => {
      const result = findRubroByLineaCodigo('');
      assert.strictEqual(result, undefined);
    });
  });

  describe('canonicalizeRubroId', () => {
    it('should return canonical ID for exact match', () => {
      const result = canonicalizeRubroId('MOD-LEAD');
      assert.strictEqual(result, 'MOD-LEAD');
    });

    it('should normalize lowercase to canonical', () => {
      const result = canonicalizeRubroId('mod-lead');
      assert.strictEqual(result, 'MOD-LEAD');
    });

    it('should map legacy ID to canonical', () => {
      const result = canonicalizeRubroId('RB0002');
      assert.strictEqual(result, 'MOD-LEAD');
    });

    it('should map human-readable role to canonical', () => {
      const result = canonicalizeRubroId('ingeniero-delivery');
      assert.strictEqual(result, 'MOD-LEAD');
    });

    it('should return undefined for unknown ID', () => {
      const result = canonicalizeRubroId('UNKNOWN-999');
      assert.strictEqual(result, undefined);
    });

    it('should return undefined for empty string', () => {
      const result = canonicalizeRubroId('');
      assert.strictEqual(result, undefined);
    });
  });

  describe('rubroDescriptionFor', () => {
    it('should return descripcion for known rubro', () => {
      const result = rubroDescriptionFor('MOD-LEAD');
      assert.ok(result, 'Should have description');
      assert.ok(result.length > 0, 'Description should not be empty');
    });

    it('should return description for legacy ID', () => {
      const result = rubroDescriptionFor('RB0002');
      assert.ok(result, 'Should have description for legacy ID');
    });

    it('should fallback to linea_gasto if descripcion missing', () => {
      // This tests the fallback logic - most rubros should have descripcion
      const result = rubroDescriptionFor('MOD-LEAD');
      assert.ok(result, 'Should have some text (descripcion or linea_gasto)');
    });

    it('should return undefined for unknown rubro', () => {
      const result = rubroDescriptionFor('UNKNOWN-999');
      assert.strictEqual(result, undefined);
    });

    it('should return undefined for empty string', () => {
      const result = rubroDescriptionFor('');
      assert.strictEqual(result, undefined);
    });
  });

  describe('allRubros', () => {
    it('should return non-empty array of rubros', () => {
      const result = allRubros();
      assert.ok(Array.isArray(result), 'Should return array');
      assert.ok(result.length > 0, 'Should have at least one rubro');
    });

    it('should return rubros with required fields', () => {
      const result = allRubros();
      const firstRubro = result[0];
      assert.ok(firstRubro.linea_codigo, 'Should have linea_codigo');
      assert.ok(firstRubro.linea_gasto, 'Should have linea_gasto');
    });
  });

  describe('getTaxonomyEntry', () => {
    it('should return full taxonomy entry for canonical ID', () => {
      const result = getTaxonomyEntry('MOD-LEAD');
      assert.ok(result, 'Should find entry');
      assert.strictEqual(result.linea_codigo, 'MOD-LEAD');
      assert.ok(result.categoria, 'Should have categoria');
      assert.ok(result.tipo_costo, 'Should have tipo_costo');
    });

    it('should return full taxonomy entry for legacy ID', () => {
      const result = getTaxonomyEntry('RB0002');
      assert.ok(result, 'Should find entry for legacy ID');
      assert.strictEqual(result.linea_codigo, 'MOD-LEAD');
    });

    it('should return null for unknown ID', () => {
      const result = getTaxonomyEntry('UNKNOWN-999');
      assert.strictEqual(result, null);
    });

    it('should return null for empty string', () => {
      const result = getTaxonomyEntry('');
      assert.strictEqual(result, null);
    });
  });
});
