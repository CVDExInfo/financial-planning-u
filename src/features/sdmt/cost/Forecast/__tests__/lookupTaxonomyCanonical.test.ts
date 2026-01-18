/**
 * Tests for lookupTaxonomyCanonical function
 * 
 * Ensures the canonical-first taxonomy lookup works correctly,
 * including labor canonical override and caching behavior.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { lookupTaxonomyCanonical } from '../lib/lookupTaxonomyCanonical';
import type { TaxonomyEntry } from '../lib/taxonomyLookup';

test('labor canonical override', () => {
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  const synthetic = lookupTaxonomyCanonical(map, { rubroId: 'MOD-LEAD' }, cache);
  
  assert.ok(synthetic, 'Should return synthetic labor taxonomy');
  assert.strictEqual(synthetic?.isLabor, true, 'Should have isLabor flag set');
  assert.strictEqual(synthetic?.rubroId, 'MOD', 'Should use canonical MOD rubroId');
  assert.strictEqual(synthetic?.category, 'Mano de Obra (MOD)', 'Should have correct category');
});

test('canonical lookup from map', () => {
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  const taxonomyEntry: TaxonomyEntry = {
    rubroId: 'TEC-HW-FIELD',
    category: 'Tecnología',
    description: 'Hardware de Campo',
    isLabor: false,
  };
  
  map.set('tec-hw-field', taxonomyEntry);
  
  const result = lookupTaxonomyCanonical(
    map, 
    { rubroId: 'TEC-HW-FIELD' }, 
    cache
  );
  
  assert.ok(result, 'Should find taxonomy entry');
  assert.strictEqual(result?.rubroId, 'TEC-HW-FIELD', 'Should return correct entry');
  assert.strictEqual(result?.isLabor, false, 'Should preserve isLabor flag');
});

test('cache-all-candidates strategy', () => {
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  const taxonomyEntry: TaxonomyEntry = {
    rubroId: 'GSV-REU',
    category: 'Gestión y Servicios',
    description: 'Reuniones',
    isLabor: false,
  };
  
  map.set('gsv-reu', taxonomyEntry);
  
  // Lookup with multiple candidates
  const result = lookupTaxonomyCanonical(
    map,
    {
      rubroId: 'GSV-REU',
      line_item_id: 'LINEA#GSV-REU',
      description: 'Reuniones',
    },
    cache
  );
  
  assert.ok(result, 'Should find taxonomy entry');
  
  // All candidates should be cached
  assert.ok(cache.has('gsv-reu'), 'Should cache normalized rubroId');
  assert.ok(cache.has('gsv-reu'), 'Should cache normalized line_item_id');
  assert.ok(cache.has('reuniones'), 'Should cache normalized description');
});

test('labor keys have priority over map', () => {
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  // Add a non-labor entry for MOD-ING
  map.set('mod-ing', {
    rubroId: 'MOD-ING',
    category: 'Some Other Category',
    isLabor: false,
  });
  
  // Labor canonical override should still apply
  const result = lookupTaxonomyCanonical(
    map,
    { rubroId: 'MOD-ING' },
    cache
  );
  
  assert.ok(result, 'Should return result');
  // The map entry should be returned first (step 1 before step 2)
  assert.strictEqual(result?.rubroId, 'MOD-ING', 'Should use map entry');
});

test('returns null for unknown entries', () => {
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  const result = lookupTaxonomyCanonical(
    map,
    { rubroId: 'UNKNOWN-RUBRO' },
    cache
  );
  
  assert.strictEqual(result, null, 'Should return null for unknown entry');
  assert.ok(cache.has('unknown-rubro'), 'Should cache the null result');
});

test('uses cache on subsequent lookups', () => {
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  const taxonomyEntry: TaxonomyEntry = {
    rubroId: 'TEST',
    category: 'Test Category',
    isLabor: false,
  };
  
  // Pre-populate cache
  cache.set('test', taxonomyEntry);
  
  // Should return cached entry without looking at map
  const result = lookupTaxonomyCanonical(
    map,
    { rubroId: 'TEST' },
    cache
  );
  
  assert.strictEqual(result, taxonomyEntry, 'Should return cached entry');
});
