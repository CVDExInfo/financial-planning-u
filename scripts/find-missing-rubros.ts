#!/usr/bin/env tsx
/**
 * Diagnostic Script: Find Missing Rubros Keys
 * 
 * This script analyzes allocation data to identify rubro IDs that are not
 * present in the canonical taxonomy or legacy map.
 * 
 * Usage:
 *   npx tsx scripts/find-missing-rubros.ts [optional-path-to-allocations.json]
 * 
 * If no file is provided, the script will list the expected canonical keys
 * and legacy mappings for verification.
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  CANONICAL_RUBROS_TAXONOMY, 
  LEGACY_RUBRO_ID_MAP,
  LABOR_CANONICAL_KEYS,
  normalizeKey,
  getCanonicalRubroId,
  isValidRubroId,
} from '../src/lib/rubros/canonical-taxonomy';

console.log('=== Rubros Taxonomy Diagnostic ===\n');

// Display canonical rubros count
console.log(`Total Canonical Rubros: ${CANONICAL_RUBROS_TAXONOMY.length}`);
console.log(`Legacy Mappings: ${Object.keys(LEGACY_RUBRO_ID_MAP).length}`);
console.log(`Labor Canonical Keys: ${LABOR_CANONICAL_KEYS.length}\n`);

// Check if a sample allocations file was provided
const allocationsPath = process.argv[2];

if (!allocationsPath) {
  console.log('No allocations file provided.');
  console.log('\nTo analyze allocations, run:');
  console.log('  npx tsx scripts/find-missing-rubros.ts <path-to-allocations.json>\n');
  
  // Display newly added aliases
  console.log('=== Newly Added Aliases (from this PR) ===');
  const newAliases = [
    'mod-lead-ingeniero-delivery',
    'mod-lead-ingeniero',
    'ingeniero-delivery',
    'Ingeniero Delivery',
    'mod-sdm-service-delivery-manager',
    'mod-sdm-sdm',
    'MOD-PM',  // Added: Legacy PMO identifier
    'MOD-PMO', // Added: Legacy PMO variant
  ];
  
  console.log('\nMOD-LEAD aliases:');
  newAliases.filter(a => a.toLowerCase().includes('lead') || a.toLowerCase().includes('ingeniero') || a.toLowerCase().includes('pm'))
    .forEach(alias => {
      const canonical = getCanonicalRubroId(alias);
      const valid = isValidRubroId(alias);
      console.log(`  ${alias} → ${canonical} (valid: ${valid})`);
    });
  
  console.log('\nMOD-SDM aliases:');
  newAliases.filter(a => a.toLowerCase().includes('sdm') || a.toLowerCase().includes('service'))
    .forEach(alias => {
      const canonical = getCanonicalRubroId(alias);
      const valid = isValidRubroId(alias);
      console.log(`  ${alias} → ${canonical} (valid: ${valid})`);
    });
  
  console.log('\n✅ All aliases validated successfully!\n');
  process.exit(0);
}

// Load and analyze allocations file
if (!fs.existsSync(allocationsPath)) {
  console.error(`❌ Error: File not found: ${allocationsPath}`);
  process.exit(1);
}

console.log(`Analyzing allocations from: ${allocationsPath}\n`);

const fileContent = fs.readFileSync(allocationsPath, 'utf8');
const allocations = JSON.parse(fileContent);

if (!Array.isArray(allocations)) {
  console.error('❌ Error: Expected allocations to be an array');
  process.exit(1);
}

console.log(`Total allocations to analyze: ${allocations.length}\n`);

// Build set of canonical keys
const canonicalKeysSet = new Set(
  CANONICAL_RUBROS_TAXONOMY.map(r => normalizeKey(r.id))
);

// Add legacy map keys
Object.keys(LEGACY_RUBRO_ID_MAP).forEach(key => {
  canonicalKeysSet.add(normalizeKey(key));
});

// Add labor canonical keys
LABOR_CANONICAL_KEYS.forEach(key => {
  canonicalKeysSet.add(normalizeKey(key));
});

// Track missing keys
const missingKeys = new Set<string>();
const foundKeys = new Set<string>();
const allSeenKeys = new Set<string>();

// Analyze each allocation
allocations.forEach((row: any) => {
  const candidates = [
    row.rubroId,
    row.rubro_id,
    row.line_item_id,
    row.lineItemId,
    row.name,
    row.description,
  ].filter(Boolean);

  candidates.forEach(candidate => {
    const normalized = normalizeKey(candidate as string);
    allSeenKeys.add(normalized);
    
    if (!canonicalKeysSet.has(normalized)) {
      missingKeys.add(normalized);
    } else {
      foundKeys.add(normalized);
    }
  });
});

// Display results
console.log('=== Analysis Results ===\n');
console.log(`Unique keys found in allocations: ${allSeenKeys.size}`);
console.log(`Keys matching canonical/legacy: ${foundKeys.size}`);
console.log(`Missing normalized keys: ${missingKeys.size}\n`);

if (missingKeys.size > 0) {
  console.log('Missing Keys (normalized):');
  console.log('─'.repeat(50));
  Array.from(missingKeys).sort().forEach(key => {
    console.log(key);
  });
  console.log('\n❌ Found missing keys. Consider adding them to canonical taxonomy or legacy map.\n');
} else {
  console.log('✅ All allocation keys are recognized!\n');
}

// Summary
console.log('=== Summary ===');
console.log(`Coverage: ${((foundKeys.size / allSeenKeys.size) * 100).toFixed(1)}%`);
console.log(`Missing: ${missingKeys.size} unique normalized keys\n`);
