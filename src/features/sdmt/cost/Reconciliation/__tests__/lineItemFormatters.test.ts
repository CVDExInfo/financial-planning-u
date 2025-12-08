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

test('formatLineItemDisplay - formats line item with all fields', () => {
  const item = {
    id: 'li-001',
    categoria: 'Infraestructura / Nube',
    description: 'Data Center Hosting',
    linea_codigo: 'INF-CLOUD',
    tipo_costo: 'OPEX',
  } as any as LineItem;

  const result = formatLineItemDisplay(item, 2);

  assert.strictEqual(result.primary, 'Infraestructura / Nube — Data Center Hosting');
  assert.strictEqual(result.secondary, 'Code: INF-CLOUD · Type: OPEX · Period: Month 2');
  assert.ok(result.tooltip.includes('Infraestructura / Nube'));
  assert.ok(result.tooltip.includes('[INF-CLOUD]'));
  assert.ok(result.tooltip.includes('OPEX'));
  assert.ok(result.tooltip.includes('(Month 2)'));
});

test('formatLineItemDisplay - handles missing optional fields', () => {
  const item = {
    id: 'li-002',
    description: 'Basic Line Item',
  } as any as LineItem;

  const result = formatLineItemDisplay(item);

  assert.strictEqual(result.primary, 'General — Basic Line Item');
  assert.strictEqual(result.secondary, '');
  assert.ok(result.tooltip.includes('General'));
  assert.ok(result.tooltip.includes('Basic Line Item'));
});

test('formatLineItemDisplay - handles undefined item', () => {
  const result = formatLineItemDisplay(undefined);

  assert.strictEqual(result.primary, 'Line item');
  assert.strictEqual(result.secondary, '');
  assert.strictEqual(result.tooltip, 'Line item');
});

test('formatLineItemDisplay - respects options flags', () => {
  const item = {
    id: 'li-003',
    categoria: 'Software',
    description: 'License',
    linea_codigo: 'SW-LIC',
    tipo_costo: 'CAPEX',
  } as any as LineItem;

  const result = formatLineItemDisplay(item, 3, {
    showHierarchy: true,
    showCode: true,
    showType: false,
    showPeriod: false,
  });

  assert.strictEqual(result.primary, 'Software — License');
  assert.strictEqual(result.secondary, 'Code: SW-LIC');
  assert.ok(!result.secondary.includes('Type:'));
  assert.ok(!result.secondary.includes('Period:'));
});

test('formatRubroLabel - formats rubro with all fields', () => {
  const item = {
    id: 'li-001',
    categoria: 'Hardware',
    description: 'Servers',
    linea_codigo: 'HW-SRV',
    tipo_costo: 'CAPEX',
  } as any as LineItem;

  const result = formatRubroLabel(item);

  assert.strictEqual(result, 'Hardware — Servers [HW-SRV] • CAPEX');
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
    id: 'li-001',
    categoria: 'Services',
    description: 'Consulting',
    linea_codigo: 'SVC-CON',
  } as any as LineItem;

  const result = formatMatrixLabel(item, 5);

  assert.ok(result.includes('Services — Consulting'));
  assert.ok(result.includes('(Month 5)'));
});

test('formatMatrixLabel - omits month suffix when month is not provided', () => {
  const item = {
    id: 'li-001',
    categoria: 'Services',
    description: 'Consulting',
  } as any as LineItem;

  const result = formatMatrixLabel(item);

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
