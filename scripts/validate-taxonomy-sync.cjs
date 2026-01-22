#!/usr/bin/env node
// scripts/validate-taxonomy-sync.js
// Validates that frontend and backend taxonomy IDs are in sync
const fs = require('fs');
const path = require('path');

const frontendPath = path.resolve(__dirname, '..', 'src', 'lib', 'rubros', 'canonical-taxonomy.ts');
const backendPath = path.resolve(__dirname, '..', 'services', 'finanzas-api', 'src', 'lib', 'canonical-taxonomy.ts');

if (!fs.existsSync(frontendPath) || !fs.existsSync(backendPath)) {
  console.log('⚠️  One or both taxonomy files missing; skipping validation');
  console.log(`  Frontend: ${fs.existsSync(frontendPath) ? 'exists' : 'missing'}`);
  console.log(`  Backend: ${fs.existsSync(backendPath) ? 'exists' : 'missing'}`);
  process.exit(0);
}

const extractIds = (text) => {
  const ids = new Set();
  // Match patterns like: id: 'MOD-XXX' or id: "MOD-XXX"
  const re = /id:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    ids.add(m[1]);
  }
  return ids;
};

const f = fs.readFileSync(frontendPath, 'utf8');
const b = fs.readFileSync(backendPath, 'utf8');

const fIds = extractIds(f);
const bIds = extractIds(b);

const onlyF = [...fIds].filter(i => !bIds.has(i));
const onlyB = [...bIds].filter(i => !fIds.has(i));

if (onlyF.length || onlyB.length) {
  console.error('❌ Taxonomy mismatch detected between frontend and backend');
  if (onlyF.length) {
    console.error('\n📍 Only in frontend:', onlyF);
  }
  if (onlyB.length) {
    console.error('\n📍 Only in backend:', onlyB);
  }
  console.error('\n💡 Fix: Ensure both files have the same canonical taxonomy IDs');
  process.exit(2);
}

console.log('✅ Taxonomy sync validation passed');
console.log(`   Found ${fIds.size} taxonomy IDs in sync`);
process.exit(0);
