/**
 * Integration tests for taxonomy alias resolution
 * Validates that common rubro textual forms correctly map to canonical IDs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeKey } from '@/lib/rubros/normalize-key';
import { CANONICAL_ALIASES } from '@/lib/rubros/canonical-taxonomy';
import {
  buildTaxonomyMap,
  lookupTaxonomy,
  type TaxonomyEntry,
  type RubroRow,
} from '../lib/taxonomyLookup';

describe('Taxonomy Aliases Integration', () => {
  describe('Service Delivery Manager variations', () => {
    it('should map "Service Delivery Manager" to MOD-SDM', () => {
      const normalized = normalizeKey('Service Delivery Manager');
      assert.strictEqual(normalized, 'service-delivery-manager');
      assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-SDM');
    });

    it('should map "Service Delivery Manager (SDM)" to MOD-SDM', () => {
      const normalized = normalizeKey('Service Delivery Manager (SDM)');
      // The parentheses get converted to hyphens, so we need an alias for this variant
      assert.ok(normalized);
      // Check if this variant is handled
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Mano de Obra (MOD)',
          linea_gasto: 'Service Delivery Manager (SDM)',
        } as any,
      };
      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();
      
      const rubroRow: RubroRow = {
        description: 'Service Delivery Manager (SDM)',
      };
      
      const result = lookupTaxonomy(map, rubroRow, cache);
      assert.ok(result, 'Should find taxonomy entry for "Service Delivery Manager (SDM)"');
      assert.strictEqual(result.rubroId, 'MOD-SDM');
    });

    it('should map "SDM" to MOD-SDM', () => {
      const normalized = normalizeKey('SDM');
      assert.strictEqual(normalized, 'sdm');
      assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-SDM');
    });

    it('should map "service-delivery-manager" (hyphenated) to MOD-SDM', () => {
      const normalized = normalizeKey('service-delivery-manager');
      assert.strictEqual(normalized, 'service-delivery-manager');
      assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-SDM');
    });

    it('should handle case-insensitive matching', () => {
      const variations = [
        'SERVICE DELIVERY MANAGER',
        'Service Delivery Manager',
        'service delivery manager',
        'SERVice DeLIVery MaNaGer',
      ];
      
      variations.forEach(variant => {
        const normalized = normalizeKey(variant);
        assert.strictEqual(normalized, 'service-delivery-manager', `Failed for variant: ${variant}`);
        assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-SDM', `Alias not found for variant: ${variant}`);
      });
    });
  });

  describe('Project Manager variations', () => {
    it('should map "Project Manager" to MOD-LEAD', () => {
      const normalized = normalizeKey('Project Manager');
      assert.strictEqual(normalized, 'project-manager');
      assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-LEAD');
    });

    it('should map "PM" to MOD-LEAD', () => {
      const normalized = normalizeKey('PM');
      assert.strictEqual(normalized, 'pm');
      assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-LEAD');
    });

    it('should map "project mgr" to MOD-LEAD', () => {
      const normalized = normalizeKey('project mgr');
      assert.strictEqual(normalized, 'project-mgr');
      assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-LEAD');
    });
  });

  describe('Spanish variations with diacritics', () => {
    it('should normalize "Ingeniero Líder" (with accent) correctly', () => {
      const normalized = normalizeKey('Ingeniero Líder');
      // normalizeKey removes diacritics: í → i
      assert.strictEqual(normalized, 'ingeniero-lider');
      assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-LEAD');
    });

    it('should normalize "Ingeniero Lider" (no accent) correctly', () => {
      const normalized = normalizeKey('Ingeniero Lider');
      assert.strictEqual(normalized, 'ingeniero-lider');
      assert.strictEqual(CANONICAL_ALIASES[normalized], 'MOD-LEAD');
    });

    it('should handle "técnicos" with and without accent', () => {
      const withAccent = normalizeKey('Contratistas técnicos internos');
      const withoutAccent = normalizeKey('Contratistas tecnicos internos');
      // Both should normalize to the same key
      assert.strictEqual(withAccent, 'contratistas-tecnicos-internos');
      assert.strictEqual(withoutAccent, 'contratistas-tecnicos-internos');
    });
  });

  describe('End-to-end taxonomy lookup with aliases', () => {
    it('should lookup "Service Delivery Manager" via alias and return MOD-SDM taxonomy', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Mano de Obra (MOD)',
          isLabor: true,
        },
        'MOD-LEAD': {
          rubroId: 'MOD-LEAD',
          description: 'Project Manager',
          category: 'Mano de Obra (MOD)',
          isLabor: true,
        },
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      // Test various input forms
      const testCases = [
        { description: 'Service Delivery Manager', expectedId: 'MOD-SDM' },
        { description: 'SDM', expectedId: 'MOD-SDM' },
        { description: 'Project Manager', expectedId: 'MOD-LEAD' },
        { description: 'PM', expectedId: 'MOD-LEAD' },
      ];

      testCases.forEach(({ description, expectedId }) => {
        const rubroRow: RubroRow = { description };
        const result = lookupTaxonomy(map, rubroRow, cache);
        
        assert.ok(result, `Should find taxonomy for "${description}"`);
        assert.strictEqual(result.rubroId, expectedId, `Expected ${expectedId} for "${description}"`);
      });
    });

    it('should prefer linea_gasto indexed field over alias for exact matches', () => {
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'SDM Role',
          category: 'Mano de Obra (MOD)',
          linea_gasto: 'Service Delivery Manager (SDM)',
        } as any,
      };

      const map = buildTaxonomyMap(taxonomy);
      const cache = new Map<string, TaxonomyEntry | null>();

      // This should match via indexed linea_gasto field
      const rubroRow: RubroRow = {
        description: 'Service Delivery Manager (SDM)',
      };

      const result = lookupTaxonomy(map, rubroRow, cache);
      assert.ok(result, 'Should find taxonomy via linea_gasto indexing');
      assert.strictEqual(result.rubroId, 'MOD-SDM');
      assert.strictEqual(result.description, 'SDM Role');
    });
  });

  describe('normalizeKey edge cases', () => {
    it('should handle parentheses correctly', () => {
      const withParens = normalizeKey('Service Delivery Manager (SDM)');
      const withoutParens = normalizeKey('Service Delivery Manager');
      
      // Parentheses get converted to hyphens
      assert.strictEqual(withParens, 'service-delivery-manager-sdm');
      assert.strictEqual(withoutParens, 'service-delivery-manager');
      assert.notStrictEqual(withParens, withoutParens);
    });

    it('should handle forward slashes', () => {
      const withSlash = normalizeKey('Ingeniero Líder / Coordinador');
      assert.strictEqual(withSlash, 'ingeniero-lider-coordinador');
    });

    it('should collapse multiple spaces/hyphens', () => {
      const multiSpace = normalizeKey('Service  Delivery   Manager');
      const multiHyphen = normalizeKey('Service--Delivery---Manager');
      assert.strictEqual(multiSpace, 'service-delivery-manager');
      assert.strictEqual(multiHyphen, 'service-delivery-manager');
    });

    it('should trim leading and trailing hyphens', () => {
      const leadingTrailing = normalizeKey('-Service Delivery Manager-');
      assert.strictEqual(leadingTrailing, 'service-delivery-manager');
    });
  });
});
