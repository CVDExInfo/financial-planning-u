/**
 * Taxonomy Lookup - Cache All Candidates Test
 * 
 * Validates that lookupTaxonomy caches results under ALL candidate keys,
 * not just the primary key. This prevents cache inconsistencies where
 * different lookups for the same rubro might get different results.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  lookupTaxonomy,
  buildTaxonomyMap,
  type TaxonomyEntry,
  type RubroRow,
} from '../lib/taxonomyLookup';

describe('Taxonomy Lookup - Cache All Candidates', () => {
  it('should cache under all candidate keys after exact match', () => {
    const taxonomy: Record<string, TaxonomyEntry> = {
      'MOD-SDM': {
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra (MOD)',
      },
    };

    const map = buildTaxonomyMap(taxonomy);
    const cache = new Map<string, TaxonomyEntry | null>();

    // First lookup with multiple candidate keys
    const rubroRow: RubroRow = {
      rubroId: 'MOD-SDM',
      rubro_id: 'MOD_SDM',
      line_item_id: 'Service Delivery Manager',
      description: 'SDM role',
    };

    const result = lookupTaxonomy(map, rubroRow, cache);

    assert.ok(result);
    assert.strictEqual(result.rubroId, 'MOD-SDM');

    // Cache should have entries for ALL normalized candidate keys
    assert.ok(cache.has('mod-sdm'), 'Cache should have rubroId');
    assert.ok(cache.has('mod-sdm'), 'Cache should have rubro_id (normalized same as rubroId)');
    assert.ok(cache.has('service-delivery-manager'), 'Cache should have line_item_id');
    assert.ok(cache.has('sdm-role'), 'Cache should have description');

    // All cached entries should point to the same result
    assert.strictEqual(cache.get('mod-sdm'), result);
    assert.strictEqual(cache.get('service-delivery-manager'), result);
    assert.strictEqual(cache.get('sdm-role'), result);
  });

  it('should cache under all candidate keys after canonical labor match', () => {
    const taxonomy: Record<string, TaxonomyEntry> = {};
    const map = buildTaxonomyMap(taxonomy);
    const cache = new Map<string, TaxonomyEntry | null>();

    // Lookup with a canonical labor key not in taxonomy
    const rubroRow: RubroRow = {
      rubroId: 'MOD-LEAD',
      rubro_id: 'MOD_LEAD',
      name: 'Ingeniero Lider',
      description: 'Lead Engineer',
    };

    const result = lookupTaxonomy(map, rubroRow, cache);

    assert.ok(result);
    assert.strictEqual(result.isLabor, true);
    assert.strictEqual(result.rubroId, 'MOD');

    // Cache should have entries for all candidate keys
    assert.ok(cache.has('mod-lead'), 'Cache should have rubroId');
    assert.ok(cache.has('mod-lead'), 'Cache should have rubro_id (normalized same)');
    assert.ok(cache.has('ingeniero-lider'), 'Cache should have name');
    assert.ok(cache.has('lead-engineer'), 'Cache should have description');

    // All cached entries should point to the synthetic labor taxonomy
    assert.strictEqual(cache.get('mod-lead')?.isLabor, true);
    assert.strictEqual(cache.get('ingeniero-lider')?.isLabor, true);
    assert.strictEqual(cache.get('lead-engineer')?.isLabor, true);
  });

  it('should cache under all candidate keys after tolerant match', () => {
    const taxonomy: Record<string, TaxonomyEntry> = {
      'EQUIPMENT-SERVER': {
        rubroId: 'EQUIPMENT-SERVER',
        description: 'Server Equipment',
        category: 'IT Infrastructure',
      },
    };

    const map = buildTaxonomyMap(taxonomy);
    const cache = new Map<string, TaxonomyEntry | null>();

    // Lookup with partial/similar keys (substring will match)
    // 'equipment-serv' is contained in 'equipment-server'
    // similarity: 14 / 16 = 0.875 which is > 0.6
    const rubroRow: RubroRow = {
      rubroId: 'EQUIPMENT-SERV',
      rubro_id: 'EQUIPMENT_SERV',
      description: 'Server Equip',
    };

    const result = lookupTaxonomy(map, rubroRow, cache);

    // Should find via tolerant matching (substring match)
    assert.ok(result);
    assert.strictEqual(result.description, 'Server Equipment');

    // Cache should have entries for all candidate keys
    assert.ok(cache.has('equipment-serv'), 'Cache should have rubroId');
    assert.ok(cache.has('equipment-serv'), 'Cache should have rubro_id (normalized same)');
    assert.ok(cache.has('server-equip'), 'Cache should have description');

    // All cached entries should point to the same result
    assert.strictEqual(cache.get('equipment-serv'), result);
    assert.strictEqual(cache.get('server-equip'), result);
  });

  it('should prevent cache misses when looking up by different candidate keys', () => {
    const taxonomy: Record<string, TaxonomyEntry> = {
      'GSV-CLOUD': {
        rubroId: 'GSV-CLOUD',
        description: 'Cloud Services',
        category: 'IT Infrastructure',
      },
    };

    const map = buildTaxonomyMap(taxonomy);
    const cache = new Map<string, TaxonomyEntry | null>();

    // First lookup by rubroId
    const firstRow: RubroRow = {
      rubroId: 'GSV-CLOUD',
      description: 'Cloud Hosting',
    };

    const result1 = lookupTaxonomy(map, firstRow, cache);
    assert.ok(result1);

    // Second lookup by description only (different candidate order)
    const secondRow: RubroRow = {
      description: 'Cloud Hosting',
    };

    const result2 = lookupTaxonomy(map, secondRow, cache);

    // Should get the same result from cache (no re-computation)
    assert.strictEqual(result1, result2, 'Results should be identical from cache');
    
    // Both lookups should have used the cache
    assert.ok(cache.has('gsv-cloud'));
    assert.ok(cache.has('cloud-hosting'));
  });

  it('should cache null results under all candidate keys when no match found', () => {
    const taxonomy: Record<string, TaxonomyEntry> = {};
    const map = buildTaxonomyMap(taxonomy);
    const cache = new Map<string, TaxonomyEntry | null>();

    const rubroRow: RubroRow = {
      rubroId: 'UNKNOWN-RUBRO',
      description: 'Unknown Item',
    };

    const result = lookupTaxonomy(map, rubroRow, cache);

    assert.strictEqual(result, null);

    // Cache should have null entries for all candidates
    assert.strictEqual(cache.get('unknown-rubro'), null);
    assert.strictEqual(cache.get('unknown-item'), null);
  });

  it('should maintain cache consistency across multiple lookups with overlapping candidates', () => {
    const taxonomy: Record<string, TaxonomyEntry> = {
      'MOD-ING': {
        rubroId: 'MOD-ING',
        description: 'Ingeniero Soporte',
        category: 'Mano de Obra (MOD)',
      },
    };

    const map = buildTaxonomyMap(taxonomy);
    const cache = new Map<string, TaxonomyEntry | null>();

    // First lookup
    const row1: RubroRow = {
      rubroId: 'MOD-ING',
      name: 'Ingeniero',
    };
    const result1 = lookupTaxonomy(map, row1, cache);
    assert.ok(result1);

    // Second lookup with overlapping candidate
    const row2: RubroRow = {
      rubroId: 'DIFFERENT-ID',
      name: 'Ingeniero', // Same as row1's name
    };
    const result2 = lookupTaxonomy(map, row2, cache);

    // Should get the same cached result for the overlapping candidate
    assert.strictEqual(result1, result2);
    assert.strictEqual(cache.get('ingeniero'), result1);
  });
});
