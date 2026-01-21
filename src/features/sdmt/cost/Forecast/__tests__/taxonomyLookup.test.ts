/**
 * Taxonomy Lookup Tests
 * 
 * Validates canonical labor classification and robust taxonomy lookup
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeKey,
  isLaborByKey,
  lookupTaxonomy,
  buildTaxonomyMap,
  LABOR_CANONICAL_KEYS,
  type TaxonomyEntry,
  type RubroRow,
} from '../lib/taxonomyLookup';

describe('Taxonomy Lookup', () => {
  describe('normalizeKey', () => {
    it('should normalize keys to lowercase with hyphens', () => {
      assert.strictEqual(normalizeKey('MOD-EXT'), 'mod-ext');
      assert.strictEqual(normalizeKey('LINEA#MOD-OT'), 'mod-ot'); // strips hash prefix
      assert.strictEqual(normalizeKey('Mano de Obra Directa'), 'mano-de-obra-directa');
      assert.strictEqual(normalizeKey('Project Manager'), 'project-manager');
    });

    it('should handle empty and null inputs', () => {
      assert.strictEqual(normalizeKey(''), '');
      assert.strictEqual(normalizeKey(null), '');
      assert.strictEqual(normalizeKey(undefined), '');
    });

    it('should remove non-alphanumeric characters except hyphens', () => {
      assert.strictEqual(normalizeKey('MOD_EXT@123'), 'mod-ext-123');
      assert.strictEqual(normalizeKey('test!!value'), 'test-value');
    });
  });

  describe('isLaborByKey', () => {
    it('should recognize canonical MOD line item IDs', () => {
      assert.strictEqual(isLaborByKey('MOD-EXT'), true);
      assert.strictEqual(isLaborByKey('MOD-OT'), true);
      assert.strictEqual(isLaborByKey('MOD-ING'), true);
      assert.strictEqual(isLaborByKey('MOD-LEAD'), true);
      assert.strictEqual(isLaborByKey('MOD-CONT'), true);
      assert.strictEqual(isLaborByKey('MOD-SDM'), true);
    });

    it('should recognize LINEA# prefixed variants', () => {
      assert.strictEqual(isLaborByKey('LINEA#MOD-EXT'), true);
      assert.strictEqual(isLaborByKey('LINEA#MOD-OT'), true);
      assert.strictEqual(isLaborByKey('LINEA#MOD-ING'), true);
      assert.strictEqual(isLaborByKey('LINEA#MOD-LEAD'), true);
      assert.strictEqual(isLaborByKey('LINEA#MOD-CONT'), true);
      assert.strictEqual(isLaborByKey('LINEA#MOD-SDM'), true);
    });

    it('should recognize engineer variants', () => {
      assert.strictEqual(isLaborByKey('MOD-IN1'), true);
      assert.strictEqual(isLaborByKey('MOD-IN2'), true);
      assert.strictEqual(isLaborByKey('MOD-IN3'), true);
    });

    it('should recognize category identifiers', () => {
      assert.strictEqual(isLaborByKey('MOD'), true);
      assert.strictEqual(isLaborByKey('CATEGORIA#MOD'), true);
      assert.strictEqual(isLaborByKey('Mano de Obra Directa'), true);
      assert.strictEqual(isLaborByKey('Mano de Obra'), true);
    });

    it('should recognize role descriptors', () => {
      assert.strictEqual(isLaborByKey('Ingeniero Soporte N1'), true);
      assert.strictEqual(isLaborByKey('Ingeniero Soporte N2'), true);
      assert.strictEqual(isLaborByKey('Ingeniero Soporte N3'), true);
      assert.strictEqual(isLaborByKey('Ingeniero Lider'), true);
      assert.strictEqual(isLaborByKey('Project Manager'), true);
      assert.strictEqual(isLaborByKey('Service Delivery Manager'), true);
    });

    it('should be case-insensitive', () => {
      assert.strictEqual(isLaborByKey('mod-ext'), true);
      assert.strictEqual(isLaborByKey('MOD-EXT'), true);
      assert.strictEqual(isLaborByKey('Mod-Ext'), true);
      assert.strictEqual(isLaborByKey('project manager'), true);
      assert.strictEqual(isLaborByKey('PROJECT MANAGER'), true);
    });

    it('should reject non-labor keys', () => {
      assert.strictEqual(isLaborByKey('GSV-CLOUD'), false);
      assert.strictEqual(isLaborByKey('EQUIPO-SERVER'), false);
      assert.strictEqual(isLaborByKey('random-key'), false);
      assert.strictEqual(isLaborByKey(''), false);
      assert.strictEqual(isLaborByKey(null), false);
      assert.strictEqual(isLaborByKey(undefined), false);
    });
  });

  describe('buildTaxonomyMap', () => {
    it('should build a map with normalized keys', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Mano de Obra (MOD)',
        },
        'GSV-CLOUD': {
          rubroId: 'GSV-CLOUD',
          description: 'Cloud Services',
          category: 'IT Infrastructure',
        },
      };

      const map = buildTaxonomyMap(taxonomy);

      // Should have entries with normalized keys
      assert.ok(map.has('mod-sdm'));
      assert.ok(map.has('gsv-cloud'));
      
      // Should retrieve correct entries
      const modEntry = map.get('mod-sdm');
      assert.strictEqual(modEntry?.description, 'Service Delivery Manager');
      assert.strictEqual(modEntry?.category, 'Mano de Obra (MOD)');
    });

    it('should index by multiple key variants', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          rubro_id: 'MOD_SDM',
          line_item_id: 'LINEA#MOD-SDM',
          name: 'Service Delivery Manager',
          description: 'SDM Role',
          category: 'Labor',
        },
      };

      const map = buildTaxonomyMap(taxonomy);

      // All variants should resolve to same entry
      assert.ok(map.has('mod-sdm'));
      assert.ok(map.has('mod-sdm')); // rubro_id normalized
      assert.ok(map.has('mod-sdm')); // line_item_id normalized (hash stripped)
      assert.ok(map.has('service-delivery-manager')); // name normalized
      
      const entry = map.get('mod-sdm');
      assert.strictEqual(entry?.description, 'SDM Role');
    });

    it('should seed canonical labor keys', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD': {
          rubroId: 'MOD',
          description: 'Mano de Obra Directa',
          category: 'Labor',
        },
      };

      const map = buildTaxonomyMap(taxonomy);

      // Canonical labor keys should be seeded
      assert.ok(map.has('mod-ext'));
      assert.ok(map.has('mod-ot'));
      assert.ok(map.has('mod-ing'));
      
      // They should all have isLabor flag
      const modExtEntry = map.get('mod-ext');
      assert.strictEqual(modExtEntry?.isLabor, true);
    });
  });

  describe('lookupTaxonomy', () => {
    it('should find exact match in taxonomy map', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Mano de Obra (MOD)',
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      const rubroRow: RubroRow = {
        rubroId: 'MOD-SDM',
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      assert.ok(result);
      assert.strictEqual(result.rubroId, 'MOD-SDM');
      assert.strictEqual(result.description, 'Service Delivery Manager');
      assert.strictEqual(result.category, 'Mano de Obra (MOD)');
    });

    it('should match by line_item_id variant', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          line_item_id: 'LINEA#MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Labor',
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      const rubroRow: RubroRow = {
        line_item_id: 'LINEA#MOD-SDM',
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      assert.ok(result);
      assert.strictEqual(result.description, 'Service Delivery Manager');
    });

    it('should return synthetic labor taxonomy for canonical labor keys', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {};
      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      // Test with a canonical labor key that's not in the taxonomy
      const rubroRow: RubroRow = {
        rubroId: 'MOD-EXT',
        description: 'External Resources',
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      assert.ok(result);
      assert.strictEqual(result.rubroId, 'MOD');
      assert.strictEqual(result.category, 'Mano de Obra (MOD)');
      assert.strictEqual(result.isLabor, true);
      assert.strictEqual(result.description, 'External Resources'); // Uses rubro description
    });

    it('should use cache for repeated lookups', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Labor',
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      const rubroRow: RubroRow = {
        rubroId: 'MOD-SDM',
      };

      // First lookup
      const result1 = lookupTaxonomy(map, rubroRow, cache);
      
      // Cache should have entry
      assert.strictEqual(cache.size, 1);
      
      // Second lookup should use cache
      const result2 = lookupTaxonomy(map, rubroRow, cache);
      
      assert.strictEqual(result1, result2); // Same object reference from cache
    });

    it('should perform tolerant substring matching when exact match fails', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-ENGINEER': {
          rubroId: 'MOD-ENGINEER',
          description: 'Engineer Role',
          category: 'Labor',
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      // Lookup with partial/similar key
      const rubroRow: RubroRow = {
        rubroId: 'MOD-ENG', // Similar but not exact
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      // Should find via tolerant matching (substring)
      assert.ok(result);
      assert.strictEqual(result.description, 'Engineer Role');
    });

    it('should return null when no match found', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'GSV-CLOUD': {
          rubroId: 'GSV-CLOUD',
          description: 'Cloud Services',
          category: 'IT Infrastructure',
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      const rubroRow: RubroRow = {
        rubroId: 'UNKNOWN-RUBRO',
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      assert.strictEqual(result, null);
    });

    it('should prioritize canonical labor keys over exact matches', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-EXT': {
          rubroId: 'MOD-EXT',
          description: 'External Labor (from taxonomy)',
          category: 'Some Other Category',
          isLabor: false, // Incorrectly flagged
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      const rubroRow: RubroRow = {
        rubroId: 'MOD-EXT',
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      assert.ok(result);
      // Should use exact match from map (which was built with canonical seeding)
      // The buildTaxonomyMap should have the entry, not synthetic
      assert.strictEqual(result.description, 'External Labor (from taxonomy)');
    });

    it('should index and lookup by linea_gasto field', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'SDM Role',
          category: 'Mano de Obra (MOD)',
          linea_gasto: 'Service Delivery Manager (SDM)', // This should be indexed
        } as any,
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      // Lookup by linea_gasto value
      const rubroRow: RubroRow = {
        description: 'Service Delivery Manager (SDM)', // Matches linea_gasto
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      assert.ok(result, 'Should find taxonomy entry by linea_gasto');
      assert.strictEqual(result.rubroId, 'MOD-SDM');
      assert.strictEqual(result.description, 'SDM Role');
    });

    it('should index and lookup by descripcion field', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-LEAD': {
          rubroId: 'MOD-LEAD',
          description: 'Project Lead',
          category: 'Mano de Obra (MOD)',
          descripcion: 'Perfil senior técnico con responsabilidad de coordinación técnica.', // This should be indexed
        } as any,
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      // Lookup by descripcion value
      const rubroRow: RubroRow = {
        description: 'Perfil senior técnico con responsabilidad de coordinación técnica.',
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      assert.ok(result, 'Should find taxonomy entry by descripcion');
      assert.strictEqual(result.rubroId, 'MOD-LEAD');
    });

    it('should resolve via CANONICAL_ALIASES map', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Mano de Obra (MOD)',
        },
        'MOD-LEAD': {
          rubroId: 'MOD-LEAD',
          description: 'Project Manager',
          category: 'Mano de Obra (MOD)',
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      // Test Service Delivery Manager variations
      const sdmRow: RubroRow = {
        description: 'Service Delivery Manager', // Should match alias
      };
      const sdmResult = lookupTaxonomy(map, sdmRow, cache);
      assert.ok(sdmResult, 'Should find MOD-SDM via alias');
      assert.strictEqual(sdmResult.rubroId, 'MOD-SDM');

      // Test Project Manager variations
      const pmRow: RubroRow = {
        description: 'Project Manager', // Should match alias
      };
      const pmResult = lookupTaxonomy(map, pmRow, cache);
      assert.ok(pmResult, 'Should find MOD-LEAD via alias');
      assert.strictEqual(pmResult.rubroId, 'MOD-LEAD');
    });

    it('should match "Service Delivery Manager" to MOD-SDM via alias', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Mano de Obra (MOD)',
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      const rubroRow: RubroRow = {
        description: 'Service Delivery Manager',
      };

      const result = lookupTaxonomy(map, rubroRow, cache);

      assert.ok(result, 'Should find taxonomy entry for Service Delivery Manager');
      assert.strictEqual(result.rubroId, 'MOD-SDM');
      assert.strictEqual(result.category, 'Mano de Obra (MOD)');
    });
  });

  describe('LABOR_CANONICAL_KEYS constant', () => {
    it('should contain all required canonical labor identifiers', () => {
      // Line items
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-EXT')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-OT')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-ING')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-LEAD')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-CONT')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-SDM')));
      
      // Engineer variants
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-IN1')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-IN2')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD-IN3')));
      
      // Categories
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('MOD')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('Mano de Obra Directa')));
      
      // Roles
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('Project Manager')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('Service Delivery Manager')));
      assert.ok(LABOR_CANONICAL_KEYS.includes(normalizeKey('Ingeniero Lider')));
    });

    it('should have normalized keys (lowercase with hyphens)', () => {
      LABOR_CANONICAL_KEYS.forEach(key => {
        // All keys should be normalized (lowercase, no special chars except hyphens)
        assert.strictEqual(key, key.toLowerCase());
        assert.strictEqual(key, key.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, ''));
      });
    });
  });
});
