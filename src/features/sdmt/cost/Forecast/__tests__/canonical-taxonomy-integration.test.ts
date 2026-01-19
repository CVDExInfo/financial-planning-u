/**
 * Integration test for canonical-taxonomy-first rubros mapping
 * 
 * Validates that the entire lookup chain respects canonical taxonomy
 * and correctly classifies Labor vs Non-Labor rubros
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeKey, isLaborByKey, lookupTaxonomy, buildTaxonomyMap, LABOR_CANONICAL_KEYS } from '../lib/taxonomyLookup';
import { lookupTaxonomyCanonical } from '../lib/lookupTaxonomyCanonical';
import type { TaxonomyEntry, RubroRow } from '../lib/taxonomyLookup';

test('canonical-taxonomy-first integration', async (t) => {
  await t.test('normalizeKey preserves rubro token from allocation SKs', () => {
    // Test cases from the problem statement
    assert.strictEqual(
      normalizeKey('ALLOCATION#base_bbf111163bb7#2025-06#MOD-LEAD'),
      'mod-lead',
      'Should extract MOD-LEAD from allocation SK'
    );
    
    assert.strictEqual(
      normalizeKey('ALLOCATION#base_xxx#2025-06#MOD-SDM'),
      'mod-sdm',
      'Should extract MOD-SDM from allocation SK'
    );
    
    assert.strictEqual(
      normalizeKey('ALLOCATION#base_xxx#2025-06#MOD-EXT'),
      'mod-ext',
      'Should extract MOD-EXT from allocation SK'
    );
    
    // Should not return 'allocation' - that was the bug
    const result = normalizeKey('ALLOCATION#base_xxx#2025-06#MOD-LEAD');
    assert.notStrictEqual(result, 'allocation', 'Should NOT return "allocation"');
    assert.notStrictEqual(result, '', 'Should NOT return empty string');
  });

  await t.test('LABOR_CANONICAL_KEYS includes all MOD variants', () => {
    // Verify all canonical MOD rubros are included
    const modRubros = ['MOD-EXT', 'MOD-OT', 'MOD-ING', 'MOD-LEAD', 'MOD-CONT', 'MOD-SDM'];
    
    for (const rubro of modRubros) {
      const normalized = normalizeKey(rubro);
      assert.ok(
        LABOR_CANONICAL_KEYS.includes(normalized),
        `${rubro} (normalized: ${normalized}) should be in LABOR_CANONICAL_KEYS`
      );
    }
    
    // Verify LINEA# prefixed variants are included
    for (const rubro of modRubros) {
      const linea = `LINEA#${rubro}`;
      const normalized = normalizeKey(linea);
      assert.ok(
        LABOR_CANONICAL_KEYS.includes(normalized),
        `${linea} (normalized: ${normalized}) should be in LABOR_CANONICAL_KEYS`
      );
    }
  });

  await t.test('isLaborByKey correctly identifies canonical labor keys', () => {
    // Test all canonical MOD rubros
    assert.strictEqual(isLaborByKey('MOD-LEAD'), true, 'MOD-LEAD should be labor');
    assert.strictEqual(isLaborByKey('MOD-SDM'), true, 'MOD-SDM should be labor');
    assert.strictEqual(isLaborByKey('MOD-EXT'), true, 'MOD-EXT should be labor');
    assert.strictEqual(isLaborByKey('MOD-ING'), true, 'MOD-ING should be labor');
    assert.strictEqual(isLaborByKey('MOD-OT'), true, 'MOD-OT should be labor');
    assert.strictEqual(isLaborByKey('MOD-CONT'), true, 'MOD-CONT should be labor');
    
    // Test with different casing (should be case-insensitive)
    assert.strictEqual(isLaborByKey('mod-lead'), true, 'mod-lead should be labor');
    assert.strictEqual(isLaborByKey('Mod-Lead'), true, 'Mod-Lead should be labor');
    
    // Test non-labor rubros
    assert.strictEqual(isLaborByKey('TEC-ITSM'), false, 'TEC-ITSM should NOT be labor');
    assert.strictEqual(isLaborByKey('GSV-REU'), false, 'GSV-REU should NOT be labor');
    assert.strictEqual(isLaborByKey('INF-CLOUD'), false, 'INF-CLOUD should NOT be labor');
  });

  await t.test('lookupTaxonomyCanonical returns synthetic labor entry for canonical keys', () => {
    // Empty taxonomy map (to ensure canonical keys work without taxonomy entries)
    const taxonomyMap = new Map<string, TaxonomyEntry>();
    const cache = new Map<string, TaxonomyEntry | null>();
    
    const row: RubroRow = {
      rubroId: 'MOD-LEAD',
      description: 'Team Lead',
    };
    
    const result = lookupTaxonomyCanonical(taxonomyMap, row, cache);
    
    assert.ok(result, 'Should return a result for canonical labor key');
    assert.strictEqual(result.rubroId, 'MOD', 'Should return MOD category');
    assert.strictEqual(result.category, 'Mano de Obra (MOD)', 'Should have correct category');
    assert.strictEqual(result.isLabor, true, 'Should be flagged as labor');
  });

  await t.test('lookupTaxonomyCanonical uses map entry if available', () => {
    const taxonomyMap = new Map<string, TaxonomyEntry>([
      ['mod-lead', {
        rubroId: 'MOD-LEAD',
        description: 'Ingeniero Líder',
        category: 'Mano de Obra Directa',
        isLabor: true,
      }]
    ]);
    const cache = new Map<string, TaxonomyEntry | null>();
    
    const row: RubroRow = {
      rubroId: 'MOD-LEAD',
    };
    
    const result = lookupTaxonomyCanonical(taxonomyMap, row, cache);
    
    assert.ok(result, 'Should return a result');
    assert.strictEqual(result.description, 'Ingeniero Líder', 'Should use taxonomy entry description');
    assert.strictEqual(result.category, 'Mano de Obra Directa', 'Should use taxonomy entry category');
    assert.strictEqual(result.isLabor, true, 'Should be flagged as labor');
  });

  await t.test('lookupTaxonomyCanonical caches results under all candidate keys', () => {
    const taxonomyMap = new Map<string, TaxonomyEntry>([
      ['mod-lead', {
        rubroId: 'MOD-LEAD',
        description: 'Team Lead',
        category: 'Labor',
        isLabor: true,
      }]
    ]);
    const cache = new Map<string, TaxonomyEntry | null>();
    
    const row: RubroRow = {
      rubroId: 'MOD-LEAD',
      rubro_id: 'MOD_LEAD',
      line_item_id: 'LINEA#MOD-LEAD',
    };
    
    lookupTaxonomyCanonical(taxonomyMap, row, cache);
    
    // All normalized candidate keys should be in cache
    assert.ok(cache.has('mod-lead'), 'Should cache under rubroId');
    assert.ok(cache.has('mod-lead'), 'Should cache under rubro_id (normalized)');
    assert.ok(cache.has('mod-lead'), 'Should cache under line_item_id (normalized)');
  });

  await t.test('allocation SK to labor classification end-to-end', () => {
    // Simulate the full flow: allocation SK -> normalized key -> labor detection
    const allocationSK = 'ALLOCATION#base_bbf111163bb7#2025-06#MOD-LEAD';
    
    // Step 1: Extract rubro token
    const normalized = normalizeKey(allocationSK);
    assert.strictEqual(normalized, 'mod-lead', 'Should extract mod-lead from allocation SK');
    
    // Step 2: Check if it's a labor key
    const isLabor = isLaborByKey(normalized);
    assert.strictEqual(isLabor, true, 'mod-lead should be identified as labor');
    
    // Step 3: Lookup using canonical-first
    const taxonomyMap = new Map<string, TaxonomyEntry>();
    const cache = new Map<string, TaxonomyEntry | null>();
    
    const row: RubroRow = {
      rubroId: normalized,
      description: 'Ingeniero Líder',
    };
    
    const result = lookupTaxonomyCanonical(taxonomyMap, row, cache);
    
    assert.ok(result, 'Should find taxonomy entry');
    assert.strictEqual(result.isLabor, true, 'Should be classified as labor');
    assert.strictEqual(result.category, 'Mano de Obra (MOD)', 'Should have MOD category');
  });

  await t.test('non-labor rubros are not misclassified', () => {
    const taxonomyMap = new Map<string, TaxonomyEntry>();
    const cache = new Map<string, TaxonomyEntry | null>();
    
    const nonLaborRubros = [
      'TEC-ITSM',
      'GSV-REU',
      'INF-CLOUD',
      'TEL-CCTS',
      'SEC-SOC',
    ];
    
    for (const rubroId of nonLaborRubros) {
      const row: RubroRow = { rubroId };
      const result = lookupTaxonomyCanonical(taxonomyMap, row, cache);
      
      // Should either return null or a non-labor entry
      if (result) {
        assert.notStrictEqual(
          result.isLabor,
          true,
          `${rubroId} should NOT be classified as labor`
        );
      }
    }
  });
});
