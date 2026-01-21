/**
 * Unit Tests for normalizeKey Function
 * 
 * Comprehensive test coverage for:
 * - Diacritics removal
 * - Parenthetical content removal
 * - Multi-space handling
 * - Punctuation normalization
 * - Edge cases (null, undefined, empty)
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeKey } from '../normalizeKey';

test('normalizeKey - diacritics removal', () => {
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
  
  assert.strictEqual(
    normalizeKey('Administración & Gestión'),
    'administracion-gestion',
    'Should handle multiple diacritics and special chars'
  );

  // French diacritics
  assert.strictEqual(
    normalizeKey('Café français'),
    'cafe-francais',
    'Should remove French accents'
  );

  // German umlauts (note: ß doesn't fully decompose via NFKD)
  assert.strictEqual(
    normalizeKey('Größe'),
    'gro-e',
    'Should handle German umlauts (ß becomes -)'
  );
});

test('normalizeKey - parenthetical content removal', () => {
  assert.strictEqual(
    normalizeKey('Service Delivery Manager (SDM)'),
    'service-delivery-manager',
    'Should remove parenthetical abbreviation'
  );
  
  assert.strictEqual(
    normalizeKey('Test (Value)'),
    'test',
    'Should remove parenthetical content completely'
  );
  
  assert.strictEqual(
    normalizeKey('Multiple (One) Words (Two)'),
    'multiple-words',
    'Should remove multiple parenthetical sections'
  );
  
  assert.strictEqual(
    normalizeKey('Service (Monthly Cost)'),
    'service',
    'Should remove parenthetical descriptions'
  );

  assert.strictEqual(
    normalizeKey('(Prefix) Content'),
    'content',
    'Should remove parenthetical prefix'
  );

  assert.strictEqual(
    normalizeKey('Before (Middle) After'),
    'before-after',
    'Should remove middle parenthetical content'
  );
});

test('normalizeKey - multi-space and whitespace handling', () => {
  assert.strictEqual(
    normalizeKey('Mano   de    Obra'),
    'mano-de-obra',
    'Should normalize multiple spaces to single hyphen'
  );
  
  assert.strictEqual(
    normalizeKey('  Spaces  Around  '),
    'spaces-around',
    'Should trim and normalize internal spaces'
  );
  
  assert.strictEqual(
    normalizeKey('Tab\tSeparated\tWords'),
    'tab-separated-words',
    'Should convert tabs to hyphens'
  );
  
  assert.strictEqual(
    normalizeKey('New\nLine\nBreaks'),
    'new-line-breaks',
    'Should convert newlines to hyphens'
  );
});

test('normalizeKey - punctuation normalization', () => {
  assert.strictEqual(
    normalizeKey('MOD@EXT'),
    'mod-ext',
    'Should convert @ to hyphen'
  );
  
  assert.strictEqual(
    normalizeKey('Test & Value'),
    'test-value',
    'Should convert & to hyphen'
  );
  
  assert.strictEqual(
    normalizeKey('Dash-Separated'),
    'dash-separated',
    'Should preserve hyphens'
  );
  
  assert.strictEqual(
    normalizeKey('Under_Score'),
    'under-score',
    'Should convert underscore to hyphen'
  );
  
  assert.strictEqual(
    normalizeKey('Dot.Separated.Value'),
    'dot-separated-value',
    'Should convert dots to hyphens'
  );
  
  assert.strictEqual(
    normalizeKey('Comma,Separated,List'),
    'comma-separated-list',
    'Should convert commas to hyphens'
  );
});

test('normalizeKey - hyphen collapsing and trimming', () => {
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
  
  assert.strictEqual(
    normalizeKey('---'),
    '',
    'Should return empty for only hyphens'
  );
  
  assert.strictEqual(
    normalizeKey('A---B---C'),
    'a-b-c',
    'Should collapse multiple consecutive hyphens'
  );
});

test('normalizeKey - allocation SK segment extraction', () => {
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
  
  assert.strictEqual(
    normalizeKey('ALLOCATION#base#2025-06#MOD@EXT'),
    'mod-ext',
    'Should extract last segment and normalize special chars'
  );
  
  assert.strictEqual(
    normalizeKey('ALLOCATION#base_xxx#2025-06#Gestión'),
    'gestion',
    'Should extract last segment and remove diacritics'
  );
});

test('normalizeKey - simple strings', () => {
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
  
  assert.strictEqual(
    normalizeKey('UPPERCASE'),
    'uppercase',
    'Should convert to lowercase'
  );
  
  assert.strictEqual(
    normalizeKey('CamelCase'),
    'camelcase',
    'Should convert camelCase to lowercase'
  );
});

test('normalizeKey - edge cases', () => {
  assert.strictEqual(
    normalizeKey(''),
    null,
    'Should return null for empty string'
  );
  
  assert.strictEqual(
    normalizeKey(null),
    null,
    'Should return null for null input'
  );
  
  assert.strictEqual(
    normalizeKey(undefined),
    null,
    'Should return null for undefined input'
  );
  
  assert.strictEqual(
    normalizeKey('   '),
    null,
    'Should return null for whitespace-only string'
  );
  
  assert.strictEqual(
    normalizeKey('123'),
    '123',
    'Should handle numeric strings'
  );
  
  assert.strictEqual(
    normalizeKey('MOD-123'),
    'mod-123',
    'Should preserve alphanumeric combinations'
  );
});

test('normalizeKey - combined complex cases', () => {
  assert.strictEqual(
    normalizeKey('Service Delivery Manager (SDM) - Español'),
    'service-delivery-manager-espanol',
    'Should handle parentheses + diacritics + punctuation'
  );
  
  assert.strictEqual(
    normalizeKey('Café (Morning)  &  Té (Afternoon)'),
    'cafe-te',
    'Should handle multiple parentheses + diacritics + multiple spaces'
  );
  
  assert.strictEqual(
    normalizeKey('ALLOCATION#2025#Gestión (Admin) & Operación'),
    'gestion-operacion',
    'Should handle SK + parentheses + diacritics + special chars'
  );
  
  assert.strictEqual(
    normalizeKey('Mañana   (Early)---(Late)'),
    'manana',
    'Should handle diacritics + parentheses + multiple hyphens + spaces'
  );
});

test('normalizeKey - real-world rubro examples', () => {
  assert.strictEqual(
    normalizeKey('Ingeniero líder / coordinador'),
    'ingeniero-lider-coordinador',
    'Should normalize engineer coordinator role'
  );
  
  assert.strictEqual(
    normalizeKey('Horas extra / guardias'),
    'horas-extra-guardias',
    'Should normalize overtime/on-call'
  );
  
  assert.strictEqual(
    normalizeKey('Gestión operativa, relación con cliente'),
    'gestion-operativa-relacion-con-cliente',
    'Should normalize operational management'
  );
  
  assert.strictEqual(
    normalizeKey('Mano de Obra Directa'),
    'mano-de-obra-directa',
    'Should normalize direct labor category'
  );
});
