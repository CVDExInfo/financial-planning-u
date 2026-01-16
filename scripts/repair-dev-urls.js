#!/usr/bin/env node
// scripts/repair-dev-urls.js
// Conservative automated repair of dev URLs found in build artifacts
// This script attempts to fix dev-URL leaks by:
// 1. Replacing dev URLs in repo source files with safe placeholders
// 2. Creating patch-package patches for node_modules issues
// 3. Rewriting inline source maps as a last resort

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PATTERN = /github\.dev|codespaces|githubusercontent\.com|localhost:3000|127\.0\.0\.1/gi;
const SAFE_PLACEHOLDER = 'REMOVED_DEV_URL';
const CHANGES_LOG = 'scripts/repair-dev-urls.changes.json';
const FINDINGS_FILE = 'reports/dev-url-guard-findings.json';

let changes = {
  timestamp: new Date().toISOString(),
  sourceFiles: [],
  dependencies: [],
  inlineMaps: [],
  backups: []
};

/**
 * Check if a file is in the git repository (not in node_modules)
 */
function isGitTracked(filePath) {
  try {
    const result = execSync(`git ls-files --error-unmatch "${filePath}"`, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Create a backup of a file before modification
 */
function createBackup(filePath) {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  changes.backups.push({
    original: filePath,
    backup: backupPath
  });
  return backupPath;
}

/**
 * Fix dev URLs in source files that are git-tracked
 */
function fixSourceFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(PATTERN);
  
  if (!matches) return false;
  
  console.log(`🔧 Fixing source file: ${filePath}`);
  const backupPath = createBackup(filePath);
  
  const fixed = content.replace(PATTERN, SAFE_PLACEHOLDER);
  fs.writeFileSync(filePath, fixed);
  
  changes.sourceFiles.push({
    file: filePath,
    backup: backupPath,
    matchesFound: matches.length,
    matchesReplaced: matches.filter((v, i, a) => a.indexOf(v) === i) // unique matches
  });
  
  console.log(`   ✅ Replaced ${matches.length} occurrence(s) with ${SAFE_PLACEHOLDER}`);
  console.log(`   📦 Backup created: ${backupPath}`);
  
  return true;
}

/**
 * Create a patch-package patch for a dependency
 */
function createDependencyPatch(packageName, filePath) {
  console.log(`📦 Creating patch for dependency: ${packageName}`);
  console.log(`   File: ${filePath}`);
  
  try {
    // First, check if patch-package is installed
    const hasPatchPackage = fs.existsSync('node_modules/patch-package');
    
    if (!hasPatchPackage) {
      console.log(`   ⚠️  patch-package not installed. Installing...`);
      execSync('pnpm add -D patch-package', { stdio: 'inherit' });
    }
    
    // Fix the file in node_modules
    const content = fs.readFileSync(filePath, 'utf8');
    const fixed = content.replace(PATTERN, SAFE_PLACEHOLDER);
    fs.writeFileSync(filePath, fixed);
    
    // Create the patch
    execSync(`npx patch-package ${packageName}`, { stdio: 'inherit' });
    
    changes.dependencies.push({
      package: packageName,
      file: filePath,
      patchCreated: true
    });
    
    console.log(`   ✅ Patch created for ${packageName}`);
    return true;
  } catch (e) {
    console.error(`   ❌ Failed to create patch: ${e.message}`);
    changes.dependencies.push({
      package: packageName,
      file: filePath,
      patchCreated: false,
      error: e.message
    });
    return false;
  }
}

/**
 * Fix dev URLs in inline source maps (last resort)
 */
function fixInlineSourceMap(filePath) {
  console.log(`🗺️  Rewriting inline source map: ${filePath}`);
  
  try {
    const backupPath = createBackup(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const match = content.match(/sourceMappingURL=data:application\/json;base64,([^\s'"\)]+)/m);
    if (!match) {
      console.log(`   ⚠️  No inline source map found`);
      return false;
    }
    
    const base64Data = match[1];
    const jsonStr = Buffer.from(base64Data, 'base64').toString('utf8');
    const map = JSON.parse(jsonStr);
    
    let modified = false;
    
    // Fix sources array
    if (map.sources) {
      map.sources = map.sources.map(src => {
        if (PATTERN.test(src)) {
          modified = true;
          return src.replace(PATTERN, SAFE_PLACEHOLDER);
        }
        return src;
      });
    }
    
    // Fix sourcesContent array
    if (map.sourcesContent) {
      map.sourcesContent = map.sourcesContent.map(sc => {
        if (sc && PATTERN.test(sc)) {
          modified = true;
          return sc.replace(PATTERN, SAFE_PLACEHOLDER);
        }
        return sc;
      });
    }
    
    if (modified) {
      const newJsonStr = JSON.stringify(map);
      const newBase64 = Buffer.from(newJsonStr).toString('base64');
      const newContent = content.replace(base64Data, newBase64);
      
      fs.writeFileSync(filePath, newContent);
      
      changes.inlineMaps.push({
        file: filePath,
        backup: backupPath,
        modified: true
      });
      
      console.log(`   ✅ Inline source map rewritten`);
      console.log(`   📦 Backup created: ${backupPath}`);
      return true;
    }
    
    console.log(`   ℹ️  No dev URLs found in source map`);
    return false;
  } catch (e) {
    console.error(`   ❌ Failed to rewrite inline source map: ${e.message}`);
    return false;
  }
}

/**
 * Determine the origin of a finding and apply appropriate fix
 */
function processFinding(finding) {
  const filePath = finding.file;
  
  // Check if file is in dist (build artifact)
  if (filePath.startsWith('dist-finanzas/')) {
    // For inline source maps, fix them directly
    if (finding.origin && finding.origin.includes('inline-sourcemap')) {
      return fixInlineSourceMap(filePath);
    }
    
    // For literal matches in dist, we need to find the source
    console.log(`⚠️  Dev URL found in build artifact: ${filePath}`);
    console.log(`   This likely comes from a source file or dependency.`);
    console.log(`   Please investigate the source and fix manually.`);
    return false;
  }
  
  // Check if it's a git-tracked source file
  if (isGitTracked(filePath)) {
    return fixSourceFile(filePath);
  }
  
  // Check if it's in node_modules (dependency)
  if (filePath.includes('node_modules/')) {
    const parts = filePath.split('node_modules/')[1].split('/');
    const packageName = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    return createDependencyPatch(packageName, filePath);
  }
  
  console.log(`⚠️  Unknown file origin: ${filePath}`);
  return false;
}

// Main execution
console.log('🔧 Dev URL Repair Tool');
console.log('═'.repeat(70));
console.log('');

if (!fs.existsSync(FINDINGS_FILE)) {
  console.log('ℹ️  No findings file found. Run find-dev-urls.js first.');
  console.log('   Command: pnpm run find:dev-urls');
  process.exit(0);
}

const findings = JSON.parse(fs.readFileSync(FINDINGS_FILE, 'utf8'));

if (findings.length === 0) {
  console.log('✅ No dev URLs to repair. Build is clean!');
  process.exit(0);
}

console.log(`Found ${findings.length} dev URL reference(s) to repair.`);
console.log('');

let repaired = 0;
let failed = 0;

findings.forEach((finding, idx) => {
  console.log(`\n[${idx + 1}/${findings.length}] Processing finding...`);
  console.log(`   File: ${finding.file}`);
  console.log(`   Origin: ${finding.origin}`);
  
  const success = processFinding(finding);
  if (success) {
    repaired++;
  } else {
    failed++;
  }
});

// Save changes log
fs.writeFileSync(CHANGES_LOG, JSON.stringify(changes, null, 2));

console.log('');
console.log('═'.repeat(70));
console.log('📊 Repair Summary');
console.log('─'.repeat(70));
console.log(`Total findings: ${findings.length}`);
console.log(`Repaired: ${repaired}`);
console.log(`Failed/Skipped: ${failed}`);
console.log(`Source files modified: ${changes.sourceFiles.length}`);
console.log(`Dependency patches created: ${changes.dependencies.filter(d => d.patchCreated).length}`);
console.log(`Inline maps rewritten: ${changes.inlineMaps.length}`);
console.log(`Backups created: ${changes.backups.length}`);
console.log('');
console.log(`Changes log saved to: ${CHANGES_LOG}`);
console.log('');

if (repaired > 0) {
  console.log('✅ Some issues were repaired automatically.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review the changes in the changes log');
  console.log('  2. Rebuild the project: BUILD_TARGET=finanzas pnpm run build:finanzas');
  console.log('  3. Re-run the scanner: pnpm run find:dev-urls');
  console.log('  4. Commit the changes if successful');
  console.log('');
}

if (failed > 0) {
  console.log('⚠️  Some issues require manual intervention.');
  console.log('   Review the output above and the changes log for details.');
  console.log('');
}

process.exit(failed > 0 ? 1 : 0);
