#!/usr/bin/env tsx
import { normalizeKey } from '../src/lib/rubros/normalize-key';

// Test cases from problem statement
const testCases = [
  'ALLOCATION#base_xxx#YYYY-MM#MOD-LEAD',
  'ALLOCATION#base_xxx#2025-06#MOD-LEAD',
  'MOD-LEAD',
  'mod-lead-ingeniero-delivery',
  'Ingeniero Delivery',
  'Service Delivery Manager',
  'Mañana de Obra', // Test diacritics
  'LINEA#MOD-ING',
  'Ñoño',
  'café',
];

console.log('Testing normalizeKey function:\n');
testCases.forEach(test => {
  const result = normalizeKey(test);
  console.log(`"${test}" => "${result}"`);
});
