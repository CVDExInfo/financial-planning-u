/**
 * Tests for normalizeRubroItem helper
 * 
 * Ensures the normalizeRubroItem function correctly handles various backend
 * response formats and provides canonical fields.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeRubroItem } from '../finanzasClient';

test('normalizeRubroItem handles standard format with rubro_id', () => {
  const input = {
    rubro_id: 'MOD-LEAD',
    descripcion: 'Service Delivery Manager',
    linea_codigo: 'LEAD-001'
  };
  
  const result = normalizeRubroItem(input);
  
  assert.strictEqual(result.rubro_id, 'MOD-LEAD', 'Should preserve rubro_id');
  assert.strictEqual(result.linea_codigo, 'LEAD-001', 'Should preserve linea_codigo');
  assert.strictEqual(result.description, 'Service Delivery Manager', 'Should set description from descripcion');
  assert.strictEqual(result.descripcion, 'Service Delivery Manager', 'Should preserve descripcion');
});

test('normalizeRubroItem fallback to id when rubro_id missing', () => {
  const input = {
    id: 'MOD-ING',
    description: 'Engineering Manager',
  };
  
  const result = normalizeRubroItem(input);
  
  assert.strictEqual(result.rubro_id, 'MOD-ING', 'Should use id as rubro_id fallback');
  assert.strictEqual(result.linea_codigo, 'MOD-ING', 'Should use id as linea_codigo fallback');
  assert.strictEqual(result.description, 'Engineering Manager', 'Should preserve description');
});

test('normalizeRubroItem fallback to code when rubro_id and id missing', () => {
  const input = {
    code: 'MOD-SDM',
    name: 'Service Delivery Manager',
  };
  
  const result = normalizeRubroItem(input);
  
  assert.strictEqual(result.rubro_id, 'MOD-SDM', 'Should use code as rubro_id fallback');
  assert.strictEqual(result.linea_codigo, 'MOD-SDM', 'Should use code as linea_codigo fallback');
  assert.strictEqual(result.description, 'Service Delivery Manager', 'Should use name as description');
  assert.strictEqual(result.descripcion, 'Service Delivery Manager', 'Should use name as descripcion');
});

test('normalizeRubroItem handles linea_gasto field', () => {
  const input = {
    linea_id: 'GSV-REU',
    linea_gasto: 'Reuniones y Viáticos',
  };
  
  const result = normalizeRubroItem(input);
  
  assert.strictEqual(result.rubro_id, 'GSV-REU', 'Should use linea_id as rubro_id');
  assert.strictEqual(result.description, 'Reuniones y Viáticos', 'Should use linea_gasto as description');
});

test('normalizeRubroItem preserves all original fields', () => {
  const input = {
    rubro_id: 'MOD-PM',
    descripcion: 'Project Manager',
    categoria: 'Personal',
    tipo_costo: 'OPEX',
    customField: 'customValue'
  };
  
  const result = normalizeRubroItem(input);
  
  assert.strictEqual(result.rubro_id, 'MOD-PM', 'Should preserve rubro_id');
  assert.strictEqual(result.categoria, 'Personal', 'Should preserve categoria');
  assert.strictEqual(result.tipo_costo, 'OPEX', 'Should preserve tipo_costo');
  assert.strictEqual(result.customField, 'customValue', 'Should preserve custom fields');
});

test('normalizeRubroItem handles empty/missing descriptions', () => {
  const input = {
    rubro_id: 'MOD-OT',
  };
  
  const result = normalizeRubroItem(input);
  
  assert.strictEqual(result.description, '', 'Should provide empty string when no description available');
  assert.strictEqual(result.descripcion, '', 'Should provide empty string when no descripcion available');
});

test('normalizeRubroItem handles nombre field', () => {
  const input = {
    rubro_id: 'TEC-LIC-MON',
    nombre: 'Licencias Mensuales',
  };
  
  const result = normalizeRubroItem(input);
  
  assert.strictEqual(result.description, 'Licencias Mensuales', 'Should use nombre as description');
  assert.strictEqual(result.descripcion, 'Licencias Mensuales', 'Should use nombre as descripcion');
});
