#!/usr/bin/env node
/**
 * ci/check-canonical-rubros.js
 * 
 * Validates that all rubro IDs used in the codebase are either:
 * 1. Present in data/rubros.taxonomy.json (canonical IDs), OR
 * 2. Mapped in the LEGACY_RUBRO_ID_MAP (legacy IDs with known mappings)
 * 
 * This ensures the canonical taxonomy (data/rubros.taxonomy.json) is the
 * single source of truth for all rubro identifiers.
 * 
 * Exit codes:
 *   0 - All rubro IDs are valid (canonical or legacy-mapped)
 *   1 - Found rubro IDs that are not in taxonomy or legacy map
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load canonical taxonomy
const taxonomyPath = path.join(__dirname, '../data/rubros.taxonomy.json');
let canonicalIds = new Set();

try {
  const taxonomyData = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
  canonicalIds = new Set(
    (taxonomyData.items || []).map(item => item.linea_codigo.toUpperCase())
  );
  console.log(`✅ Loaded ${canonicalIds.size} canonical rubro IDs from taxonomy`);
} catch (err) {
  console.error(`❌ Failed to load canonical taxonomy from ${taxonomyPath}`);
  console.error(err.message);
  process.exit(1);
}

// Load legacy mappings from backend canonical-taxonomy.ts
const backendCanonicalPath = path.join(__dirname, '../services/finanzas-api/src/lib/canonical-taxonomy.ts');
const frontendCanonicalPath = path.join(__dirname, '../src/lib/rubros/canonical-taxonomy.ts');

const legacyMappedIds = new Set();

function extractLegacyMappings(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Extract LEGACY_RUBRO_ID_MAP entries
    const mapMatch = content.match(/LEGACY_RUBRO_ID_MAP[^{]*{([^}]+)}/s);
    if (mapMatch) {
      const mapContent = mapMatch[1];
      // Extract keys from 'key': 'value' pairs
      const keyMatches = mapContent.matchAll(/'([^']+)':\s*'[^']+'/g);
      for (const match of keyMatches) {
        legacyMappedIds.add(match[1].toUpperCase());
      }
    }
  } catch (err) {
    console.warn(`⚠️  Could not load legacy mappings from ${filePath}: ${err.message}`);
  }
}

extractLegacyMappings(backendCanonicalPath);
extractLegacyMappings(frontendCanonicalPath);

console.log(`✅ Found ${legacyMappedIds.size} legacy rubro IDs with known mappings`);

// Rubro ID pattern - matches typical rubro ID formats
// MOD-*, GSV-*, TEC-*, etc. (canonical format)
// RB#### (old catalog format)
// mod-*-* (legacy human-readable format)
const rubroPatterns = [
  /\b([A-Z]{3}-[A-Z0-9-]+)\b/g,           // Canonical: MOD-LEAD, GSV-REU, etc.
  /\b(RB\d{4})\b/g,                        // Legacy catalog: RB0001, RB0002, etc.
  /\b(mod-[a-z0-9-]+)\b/gi,                // Legacy lowercase: mod-lead-ingeniero-delivery
  /\b(ingeniero-[a-z-]+)\b/gi,             // Human-readable: ingeniero-delivery
  /\b(service-delivery-manager)\b/gi,      // Human-readable: service-delivery-manager
  /\b(project-manager)\b/gi,               // Human-readable: project-manager
];

// Files/patterns to exclude from search
const excludePatterns = [
  'node_modules',
  'pnpm-lock.yaml',
  '*.log',
  '*.md',
  'ci/check-forbidden-rubros.sh',
  'ci/check-canonical-rubros.js',
  'scripts/fix-noncanonical-rubros.js',
  'scripts/find-missing-rubros.ts',
  'services/finanzas-api/src/lib/canonical-taxonomy.ts',
  'src/lib/rubros/canonical-taxonomy.ts',
  '**/__tests__/**',
  '**/tests/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  'artifacts-*.txt',
  'tmp/**',
  '.git/**',
];

// Patterns that look like rubro IDs but are actually something else (projects, invoices, etc.)
const falsePositivePatterns = [
  /^PRJ-/i,          // Project IDs
  /^INV-/i,          // Invoice IDs
  /^NOC-/i,          // Project IDs (NOC projects)
  /^SOC-/i,          // Project IDs (SOC projects)
  /^LAB-/i,          // Project/Lab IDs
  /^AWS-/i,          // AWS-specific identifiers
  /^SOI-/i,          // SOI identifiers
  /-001$/i,          // Numbered identifiers (likely test data)
  /-\d{3,}$/i,       // Identifiers ending with 3+ digits
  /MOD-aggregated/i, // Descriptive text, not an ID
  /MOD-only/i,       // Descriptive text
  /MOD-specific/i,   // Descriptive text
  /mod-roles/i,      // Variable/file names
  /mod-percentage/i, // Variable names
  /mod-performance/i,// Variable names
];

function isFalsePositive(rubroId) {
  return falsePositivePatterns.some(pattern => pattern.test(rubroId));
}

// Search for rubro IDs in source code
console.log('\n🔍 Scanning source code for rubro IDs...\n');

let foundIssues = false;
const violations = new Map(); // Map of invalid ID -> files where it appears

// Use git grep to search for potential rubro IDs
const excludeArgs = excludePatterns.map(p => `:!${p}`).join(' ');

// Search for patterns that look like rubro IDs
const searchPatterns = [
  'MOD-',
  'GSV-',
  'TEC-',
  'INF-',
  'REM-',
  'TEL-',
  'SEC-',
  'LOG-',
  'RIE-',
  'ADM-',
  'QLT-',
  'PLT-',
  'DEP-',
  'COL-',
  'VIA-',
  'LIC-',
  'CTR-',
  'INN-',
  'RB0',
  'mod-',
  'ingeniero-',
];

for (const pattern of searchPatterns) {
  try {
    const cmd = `git grep -i -h "${pattern}" -- ${excludeArgs}`;
    const output = execSync(cmd, { encoding: 'utf-8', cwd: path.join(__dirname, '..'), maxBuffer: 10 * 1024 * 1024 }).trim();
    
    if (!output) continue;
    
    const lines = output.split('\n');
    for (const line of lines) {
      // Extract potential rubro IDs from each line
      for (const regex of rubroPatterns) {
        const matches = line.matchAll(regex);
        for (const match of matches) {
          const rubroId = match[1];
          const normalized = rubroId.toUpperCase();
          
          // Skip false positives (project IDs, invoice IDs, etc.)
          if (isFalsePositive(rubroId)) {
            continue;
          }
          
          // Skip if it's canonical or legacy-mapped
          if (canonicalIds.has(normalized) || legacyMappedIds.has(normalized)) {
            continue;
          }
          
          // Found a potential violation
          if (!violations.has(rubroId)) {
            violations.set(rubroId, new Set());
          }
        }
      }
    }
  } catch (err) {
    // git grep returns exit code 1 if no matches, which is fine
    if (err.status !== 1) {
      console.warn(`⚠️  Error searching for pattern "${pattern}": ${err.message}`);
    }
  }
}

// Report violations
if (violations.size > 0) {
  console.log('❌ Found rubro IDs that are NOT in canonical taxonomy or legacy map:\n');
  
  const sortedViolations = Array.from(violations.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [rubroId] of sortedViolations) {
    console.log(`  • ${rubroId}`);
    foundIssues = true;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('HOW TO FIX:');
  console.log('='.repeat(80));
  console.log('1. If this is a valid rubro, add it to data/rubros.taxonomy.json');
  console.log('2. If this is a legacy alias, add it to LEGACY_RUBRO_ID_MAP in:');
  console.log('   - services/finanzas-api/src/lib/canonical-taxonomy.ts (backend)');
  console.log('   - src/lib/rubros/canonical-taxonomy.ts (frontend)');
  console.log('3. If this is a typo or invalid ID, replace it with the correct canonical ID');
  console.log('='.repeat(80) + '\n');
}

if (foundIssues) {
  console.log('❌ VALIDATION FAILED: Non-canonical rubro IDs found\n');
  process.exit(1);
} else {
  console.log('✅ SUCCESS: All rubro IDs are canonical or legacy-mapped\n');
  process.exit(0);
}
