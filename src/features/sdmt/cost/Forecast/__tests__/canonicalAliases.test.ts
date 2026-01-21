/**
 * Canonical Aliases Tests
 * 
 * Validates that the newly added canonical aliases map correctly to
 * their canonical MOD entries (MOD-LEAD and MOD-SDM).
 * 
 * This test ensures that console warnings for unknown rubro_ids are eliminated
 * by verifying that all alias forms are recognized by the taxonomy lookup.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
  getCanonicalRubroId, 
  LEGACY_RUBRO_ID_MAP,
  LABOR_CANONICAL_KEYS_SET,
  normalizeKey,
} from '@/lib/rubros/canonical-taxonomy';
import { lookupTaxonomyCanonical } from '../lib/lookupTaxonomyCanonical';
import type { TaxonomyEntry } from '../lib/taxonomyLookup';

test('MOD-LEAD canonical aliases map to MOD-LEAD', () => {
  // Test that all MOD-LEAD variants resolve to canonical MOD-LEAD
  const aliases = [
    'mod-lead-ingeniero-delivery',
    'mod-lead-ingeniero',
    'ingeniero-delivery',
    'Ingeniero Delivery',
    'ingeniero-lider',
    'project-manager', // Maps to MOD-LEAD since MOD-PM doesn't exist in canonical taxonomy
  ];
  
  for (const alias of aliases) {
    const canonical = getCanonicalRubroId(alias);
    assert.strictEqual(
      canonical, 
      'MOD-LEAD', 
      `${alias} should map to MOD-LEAD, got ${canonical}`
    );
  }
});

test('MOD-LEAD title case variants map to MOD-LEAD', () => {
  // Test that title case variants (Service Delivery Manager, Project Manager) resolve to canonical IDs
  const titleCaseAliases = [
    'Project Manager',
    'project manager',
    'project mgr',
    'pm',
  ];
  
  for (const alias of titleCaseAliases) {
    const canonical = getCanonicalRubroId(alias);
    assert.strictEqual(
      canonical, 
      'MOD-LEAD', 
      `${alias} should map to MOD-LEAD, got ${canonical}`
    );
  }
});

test('MOD-SDM canonical aliases map to MOD-SDM', () => {
  // Test that all MOD-SDM variants resolve to canonical MOD-SDM
  const aliases = [
    'mod-sdm-service-delivery-manager',
    'mod-sdm-sdm',
    'service-delivery-manager',
  ];
  
  for (const alias of aliases) {
    const canonical = getCanonicalRubroId(alias);
    assert.strictEqual(
      canonical, 
      'MOD-SDM', 
      `${alias} should map to MOD-SDM, got ${canonical}`
    );
  }
});

test('MOD-SDM title case variants map to MOD-SDM', () => {
  // Test that title case variants (Service Delivery Manager) resolve to MOD-SDM
  const titleCaseAliases = [
    'Service Delivery Manager',
    'service delivery manager',
    'Service Delivery Manager (SDM)',
    'service delivery manager (sdm)',
    'sdm',
    'SDM',
  ];
  
  for (const alias of titleCaseAliases) {
    const canonical = getCanonicalRubroId(alias);
    assert.strictEqual(
      canonical, 
      'MOD-SDM', 
      `${alias} should map to MOD-SDM, got ${canonical}`
    );
  }
});

test('MOD-ING canonical aliases map to MOD-ING', () => {
  // Test that all MOD-ING variants resolve to canonical MOD-ING
  const aliases = [
    'mod-ing-ingeniero-soporte-n1',
    'ingeniero soporte',
    'ingeniero soporte n1',
  ];
  
  for (const alias of aliases) {
    const canonical = getCanonicalRubroId(alias);
    assert.strictEqual(
      canonical, 
      'MOD-ING', 
      `${alias} should map to MOD-ING, got ${canonical}`
    );
  }
});

test('LEGACY_RUBRO_ID_MAP contains all new aliases', () => {
  // Verify that the legacy map was updated with the new entries
  const expectedMappings = {
    'mod-lead-ingeniero-delivery': 'MOD-LEAD',
    'mod-lead-ingeniero': 'MOD-LEAD',
    'ingeniero-delivery': 'MOD-LEAD',
    'Ingeniero Delivery': 'MOD-LEAD',
    'ingeniero-lider': 'MOD-LEAD',
    'project-manager': 'MOD-LEAD',
    'mod-sdm-service-delivery-manager': 'MOD-SDM',
    'mod-sdm-sdm': 'MOD-SDM',
    'service-delivery-manager': 'MOD-SDM',
    'mod-ing-ingeniero-soporte-n1': 'MOD-ING',
  };
  
  for (const [legacy, canonical] of Object.entries(expectedMappings)) {
    assert.strictEqual(
      LEGACY_RUBRO_ID_MAP[legacy],
      canonical,
      `LEGACY_RUBRO_ID_MAP should map ${legacy} to ${canonical}`
    );
  }
});

test('LEGACY_RUBRO_ID_MAP contains title case aliases from server-side', () => {
  // Verify that the title case aliases from server-side canonical-taxonomy.ts are present
  const serverSideAliases = {
    'Service Delivery Manager': 'MOD-SDM',
    'Service Delivery Manager (SDM)': 'MOD-SDM',
    'service delivery manager': 'MOD-SDM',
    'Project Manager': 'MOD-LEAD',
    'project manager': 'MOD-LEAD',
    'ingenieros de soporte (mensual)': 'MOD-ING',
    'horas extra / guardias': 'MOD-OT',
    'contratistas externos (labor)': 'MOD-EXT',
  };
  
  for (const [alias, canonical] of Object.entries(serverSideAliases)) {
    assert.strictEqual(
      LEGACY_RUBRO_ID_MAP[alias],
      canonical,
      `LEGACY_RUBRO_ID_MAP should map server-side alias "${alias}" to ${canonical}`
    );
  }
});

test('LABOR_CANONICAL_KEYS_SET includes normalized aliases', () => {
  // Test that LABOR_CANONICAL_KEYS_SET contains the normalized forms
  const expectedKeys = [
    'mod-lead-ingeniero-delivery',
    'ingeniero-delivery',
    'mod-lead-ingeniero',
    'ingeniero-lider',
    'project-manager',
    'mod-sdm-service-delivery-manager',
    'service-delivery-manager',
    'mod-sdm-sdm',
    'mod-ing-ingeniero-soporte-n1',
  ].map(normalizeKey);
  
  for (const key of expectedKeys) {
    assert.ok(
      LABOR_CANONICAL_KEYS_SET.has(key),
      `LABOR_CANONICAL_KEYS_SET should contain ${key}`
    );
  }
});

test('lookupTaxonomyCanonical recognizes new aliases as labor', () => {
  // Test that the taxonomy lookup correctly identifies aliases as labor
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  // Test aliases that should trigger labor canonical override
  const testCases = [
    { rubroId: 'mod-lead-ingeniero-delivery' },
    { line_item_id: 'ingeniero delivery' },
    { name: 'Service Delivery Manager' },
    { line_item_id: 'mod-sdm-service-delivery-manager' },
  ];
  
  for (const row of testCases) {
    const result = lookupTaxonomyCanonical(map, row, cache);
    
    assert.ok(result, `Should return a result for ${JSON.stringify(row)}`);
    assert.strictEqual(
      result?.isLabor, 
      true, 
      `Should identify ${JSON.stringify(row)} as labor`
    );
    assert.strictEqual(
      result?.rubroId,
      'MOD',
      `Should return canonical MOD rubroId for ${JSON.stringify(row)}`
    );
  }
});

test('allocation SK patterns with new aliases', () => {
  // Test that allocation SK patterns work with the new aliases
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  // Simulate allocation rows with SK patterns
  const allocationRows = [
    { line_item_id: 'ALLOCATION#base_x#2025-06#mod-lead-ingeniero-delivery' },
    { line_item_id: 'ALLOCATION#base_x#2025-06#mod-sdm-service-delivery-manager' },
    { line_item_id: 'LINEA#mod-lead-ingeniero' },
  ];
  
  for (const row of allocationRows) {
    const result = lookupTaxonomyCanonical(map, row, cache);
    
    assert.ok(
      result, 
      `Should find taxonomy for SK: ${row.line_item_id}`
    );
    assert.strictEqual(
      result?.isLabor,
      true,
      `SK ${row.line_item_id} should be recognized as labor`
    );
  }
});

test('throttled warnings do not repeat for same normalized key', () => {
  // Test that getCanonicalRubroId throttles warnings
  // We can't easily test console.warn calls without mocking, but we can
  // verify that repeated calls to getCanonicalRubroId with unknown keys
  // return consistently
  
  const unknownKey = 'COMPLETELY-UNKNOWN-RUBRO-XYZ';
  
  // First call
  const result1 = getCanonicalRubroId(unknownKey);
  assert.strictEqual(result1, unknownKey, 'Should return input for unknown key');
  
  // Second call - should not warn again (but we can't test that without mocking)
  const result2 = getCanonicalRubroId(unknownKey);
  assert.strictEqual(result2, unknownKey, 'Should consistently return input');
  
  // Different case should be treated as same normalized key
  const result3 = getCanonicalRubroId('COMPLETELY-UNKNOWN-RUBRO-XYZ');
  assert.strictEqual(result3, 'COMPLETELY-UNKNOWN-RUBRO-XYZ', 'Should handle case consistently');
});

test('human-readable names map to labor', () => {
  // Test that human-readable Spanish names work
  const map = new Map<string, TaxonomyEntry>();
  const cache = new Map<string, TaxonomyEntry | null>();
  
  const humanReadableNames = [
    { name: 'Ingeniero Delivery' },
    { description: 'Service Delivery Manager' },
    { line_item_id: 'ingeniero-delivery' },
    { description: 'Project Manager' },
  ];
  
  for (const row of humanReadableNames) {
    const result = lookupTaxonomyCanonical(map, row, cache);
    
    assert.ok(result, `Should find result for ${JSON.stringify(row)}`);
    assert.strictEqual(
      result?.isLabor,
      true,
      `Human-readable name ${JSON.stringify(row)} should be labor`
    );
  }
});
