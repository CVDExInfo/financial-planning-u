/**
 * Tests for normalizeKey function
 * 
 * Ensures the normalizeKey function correctly preserves the last segment
 * for allocation SKs and handles edge cases.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeKey } from '../lib/taxonomyLookup';

test('normalizeKey keeps last segment', () => {
  assert.strictEqual(
    normalizeKey('ALLOCATION#base_xxx#2025-06#MOD-LEAD'),
    'mod-lead',
    'Should extract and normalize last segment from allocation SK'
  );
  
  assert.strictEqual(
    normalizeKey('LINEA#MOD-ING'),
    'mod-ing',
    'Should extract and normalize last segment from LINEA SK'
  );
});

test('normalizeKey handles simple strings', () => {
  assert.strictEqual(
    normalizeKey('MOD-EXT'),
    'mod-ext',
    'Should normalize simple string'
  );
  
  assert.strictEqual(
    normalizeKey('Mano de Obra'),
    'mano-de-obra',
    'Should normalize spaces to hyphens'
  );
});

test('normalizeKey handles edge cases', () => {
  assert.strictEqual(
    normalizeKey(''),
    '',
    'Should return empty string for empty input'
  );
  
  assert.strictEqual(
    normalizeKey(undefined),
    '',
    'Should return empty string for undefined'
  );
  
  assert.strictEqual(
    normalizeKey('MOD--LEAD'),
    'mod-lead',
    'Should collapse multiple hyphens'
  );
  
  assert.strictEqual(
    normalizeKey('---MOD-LEAD---'),
    'mod-lead',
    'Should trim leading and trailing hyphens'
  );
});

test('normalizeKey removes non-alphanumeric characters', () => {
  assert.strictEqual(
    normalizeKey('MOD@EXT'),
    'mod-ext',
    'Should convert special chars to hyphens'
  );
  
  assert.strictEqual(
    normalizeKey('Test (Value)'),
    'test-value',
    'Should remove parentheses and normalize'
  );
  
  assert.strictEqual(
    normalizeKey('ALLOCATION#base#2025-06#MOD@EXT'),
    'mod-ext',
    'Should extract last segment and normalize special chars'
  );
});

test('normalizeKey handles diacritics correctly', () => {
  // Spanish diacritics
  assert.strictEqual(
    normalizeKey('Mañana de Obra'),
    'manana-de-obra',
    'Should remove Spanish ñ diacritic'
  );
  
  assert.strictEqual(
    normalizeKey('café'),
    'cafe',
    'Should remove accents from vowels'
  );
  
  assert.strictEqual(
    normalizeKey('Ñoño'),
    'nono',
    'Should handle multiple ñ characters'
  );
  
  assert.strictEqual(
    normalizeKey('Ingeniero Líder'),
    'ingeniero-lider',
    'Should normalize Spanish accented í'
  );
  
  // Complex allocation SK with diacritics
  assert.strictEqual(
    normalizeKey('ALLOCATION#base_xxx#2025-06#Gestión'),
    'gestion',
    'Should extract last segment and remove diacritics'
  );
  
  // Combined test
  assert.strictEqual(
    normalizeKey('Administración & Gestión'),
    'administracion-gestion',
    'Should handle multiple diacritics and special chars'
  );
});
