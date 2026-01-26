/**
 * Tests for line item formatters
 * Run with: npm run test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  formatLineItemDisplay,
  formatRubroLabel,
  formatMatrixLabel,
  extractFriendlyFilename,
} from '../lineItemFormatters';
import type { LineItem } from '@/types/domain';

test('formatLineItemDisplay - uses canonical taxonomy when available', () => {
  const item = {
    id: 'MOD-PMO', // This should map to canonical MOD-LEAD
  } as any as LineItem;

  const result = formatLineItemDisplay(item, 2);

  // Should use canonical linea_codigo and linea_gasto
  assert.ok(result.primary.includes('MOD-LEAD'));
  assert.ok(result.primary.includes('Ingeniero Lider'));
  assert.ok(result.secondary.includes('Category:'));
  assert.ok(result.secondary.includes('Type:'));
  assert.ok(result.secondary.includes('Period: Month 2'));
});

test('formatLineItemDisplay - formats canonical rubro with full metadata', () => {
  const item = {
    id: 'INF-CLOUD', // Canonical ID
  } as any as LineItem;

  const result = formatLineItemDisplay(item, undefined);

  assert.ok(result.primary.includes('INF-CLOUD'));
  assert.ok(result.primary.includes('Servicios Cloud / hosting'));
  assert.ok(result.secondary.includes('Category:'));
  assert.ok(result.secondary.includes('Infraestructura'));
  assert.ok(result.tooltip.includes('INF-CLOUD'));
  assert.ok(result.tooltip.includes('OPEX'));
});

test('formatLineItemDisplay - handles missing optional fields', () => {
  const item = {
    id: 'li-002',
    description: 'Basic Line Item',
  } as any as LineItem;

  const result = formatLineItemDisplay(item);

  assert.ok(result.primary.includes('li-002'));
  assert.ok(result.primary.includes('Basic Line Item'));
});

test('formatLineItemDisplay - handles undefined item', () => {
  const result = formatLineItemDisplay(undefined);

  assert.strictEqual(result.primary, 'Line item');
  assert.strictEqual(result.secondary, '');
  assert.strictEqual(result.tooltip, 'Line item');
});

test('formatLineItemDisplay - respects options flags', () => {
  const item = {
    id: 'TEC-ITSM', // Canonical ID
  } as any as LineItem;

  const result = formatLineItemDisplay(item, 3, {
    showHierarchy: true,
    showCode: true,
    showType: false,
    showPeriod: false,
  });

  assert.ok(result.primary.includes('TEC-ITSM'));
  assert.ok(result.secondary.includes('Category:'));
  assert.ok(!result.secondary.includes('Type:'));
  assert.ok(!result.secondary.includes('Period:'));
});

test('formatRubroLabel - uses canonical taxonomy format', () => {
  const item = {
    id: 'MOD-ING', // Canonical ID
  } as any as LineItem;

  const result = formatRubroLabel(item);

  // Should use canonical format: ${linea_codigo} — ${linea_gasto}
  assert.strictEqual(result, 'MOD-ING — Ingeniero Soporte N1');
});

test('formatRubroLabel - handles legacy ID mapping', () => {
  const item = {
    id: 'MOD-PMO', // Legacy ID that maps to MOD-LEAD
  } as any as LineItem;

  const result = formatRubroLabel(item);

  // Should map to canonical and use canonical format
  assert.strictEqual(result, 'MOD-LEAD — Ingeniero Lider');
});

test('formatRubroLabel - falls back to legacy format for non-canonical IDs', () => {
  const item = {
    id: 'li-001',
    categoria: 'Hardware',
    description: 'Servers',
    linea_codigo: 'HW-SRV',
    tipo_costo: 'CAPEX',
  } as any as LineItem;

  const result = formatRubroLabel(item);

  // Should fall back to legacy format since it's not in canonical taxonomy
  assert.ok(result.includes('Hardware'));
  assert.ok(result.includes('Servers'));
  assert.ok(result.includes('HW-SRV'));
});

test('formatRubroLabel - uses fallbackId when item is undefined', () => {
  const result = formatRubroLabel(undefined, 'fallback-123');

  assert.strictEqual(result, 'fallback-123');
});

test('formatRubroLabel - defaults to "Line item" when no fallback', () => {
  const result = formatRubroLabel(undefined);

  assert.strictEqual(result, 'Line item');
});

test('formatMatrixLabel - adds month suffix when month is provided', () => {
  const item = {
    id: 'GSV-REU', // Canonical ID
  } as any as LineItem;

  const result = formatMatrixLabel(item, 5);

  assert.ok(result.includes('GSV-REU'));
  assert.ok(result.includes('Reuniones de seguimiento'));
  assert.ok(result.includes('(Month 5)'));
});

test('formatMatrixLabel - omits month suffix when month is not provided', () => {
  const item = {
    id: 'NOC-MON', // Canonical ID
  } as any as LineItem;

  const result = formatMatrixLabel(item);

  assert.ok(result.includes('NOC-MON'));
  assert.ok(!result.includes('(Month'));
});

test('extractFriendlyFilename - returns originalName when provided', () => {
  const result = extractFriendlyFilename(
    'docs/P-abc123/long-path/invoice.pdf',
    'My Invoice.pdf'
  );

  assert.strictEqual(result, 'My Invoice.pdf');
});

test('extractFriendlyFilename - extracts filename from storage key', () => {
  const result = extractFriendlyFilename(
    'docs/P-abc123/screenshots/Screenshot 2025-12-04.png',
    undefined
  );

  assert.strictEqual(result, 'Screenshot 2025-12-04.png');
});

test('extractFriendlyFilename - returns storage key if no slash in path', () => {
  const result = extractFriendlyFilename('simple-file.pdf', undefined);

  assert.strictEqual(result, 'simple-file.pdf');
});

test('extractFriendlyFilename - returns "Pending document" when no data', () => {
  const result = extractFriendlyFilename(undefined, undefined);

  assert.strictEqual(result, 'Pending document');
});
