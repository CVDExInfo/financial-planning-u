#!/usr/bin/env node
// scripts/sanitize-sourcemaps.js
// Sanitizes .map files by removing dev-host references from sources and sourcesContent

import fs from 'fs';
import path from 'path';

const DEV_PAT = /github\.dev|codespaces|githubusercontent\.com|localhost:3000|127\.0\.0\.1/i;

/**
 * Recursively list all .map files in a directory
 */
function listMaps(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      listMaps(p).forEach(f => files.push(f));
    } else if (p.endsWith('.map')) {
      files.push(p);
    }
  }
  return files;
}

/**
 * Sanitize a single .map file
 */
function sanitizeMapFile(mapPath) {
  const raw = fs.readFileSync(mapPath, 'utf8');
  let map;
  
  try {
    map = JSON.parse(raw);
  } catch (e) {
    return { mapPath, error: 'invalid-json' };
  }
  
  const findings = [];
  
  // Sanitize sources array
  if (Array.isArray(map.sources)) {
    map.sources = map.sources.map(s => {
      if (!s) return s;
      
      if (DEV_PAT.test(s)) {
        findings.push({ mapPath, type: 'sources', original: s });
        // Choose a safe fallback: basename of the path
        return path.basename(s);
      }
      
      // Map absolute file: URLs to basename
      try {
        const u = new URL(s);
        if (u.protocol.startsWith('http') && DEV_PAT.test(s)) {
          findings.push({ mapPath, type: 'sources', original: s });
          return path.basename(u.pathname);
        }
      } catch (_) {
        // Not a URL, continue
      }
      
      return s;
    });
  }
  
  // Sanitize sourcesContent array
  if (Array.isArray(map.sourcesContent)) {
    map.sourcesContent = map.sourcesContent.map((sc, idx) => {
      if (typeof sc === 'string' && DEV_PAT.test(sc)) {
        findings.push({ 
          mapPath, 
          type: 'sourcesContent', 
          index: idx, 
          snippet: sc.slice(0, 200) 
        });
        // Remove the content to avoid leaking dev code
        return '';
      }
      return sc;
    });
  }
  
  // Create backup if we found issues
  if (findings.length > 0) {
    const backupDir = path.join('dist-finanzas', 'maps-backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(backupDir, path.basename(mapPath) + '.orig'), 
      raw
    );
    fs.writeFileSync(mapPath, JSON.stringify(map));
  }
  
  return { mapPath, findings };
}

/**
 * Main execution
 */
(function main() {
  const dir = 'dist-finanzas';
  
  if (!fs.existsSync(dir)) {
    console.error('❌ dist-finanzas not found. Run build first.');
    process.exit(2);
  }
  
  console.log('🗺️  Sanitizing source maps...');
  console.log(`   Directory: ${dir}`);
  console.log('');
  
  const maps = listMaps(dir);
  console.log(`   Found ${maps.length} source map file(s)`);
  
  const summary = [];
  
  for (const m of maps) {
    const res = sanitizeMapFile(m);
    if (res.error) {
      console.error(`   ⚠️  Failed to parse ${m}: ${res.error}`);
    } else {
      if (res.findings && res.findings.length) {
        summary.push(res);
        console.log(`   🔧 Sanitized ${path.basename(m)} (${res.findings.length} finding(s))`);
      }
    }
  }
  
  // Ensure reports directory exists
  if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports', { recursive: true });
  }
  
  fs.writeFileSync(
    'reports/dev-url-guard-sanitize.json', 
    JSON.stringify(summary, null, 2)
  );
  
  console.log('');
  
  if (summary.length > 0) {
    console.error('⚠️  Sanitizer found and fixed dev URL entries in source maps');
    console.error(`   Report: reports/dev-url-guard-sanitize.json`);
    console.error(`   Backups: dist-finanzas/maps-backup/`);
    console.error('');
    console.error('   Summary:');
    
    let totalFindings = 0;
    summary.forEach(s => {
      totalFindings += s.findings.length;
      console.error(`   - ${path.basename(s.mapPath)}: ${s.findings.length} finding(s)`);
    });
    
    console.error('');
    console.error(`   Total: ${totalFindings} dev URL reference(s) sanitized`);
    console.error('');
    console.error('💡 Recommendations:');
    console.error('   1. Review the sanitize report to understand the source');
    console.error('   2. Configure build to avoid embedding dev URLs in source maps');
    console.error('   3. Consider building in CI instead of Codespaces');
    console.error('   4. Set sourcesContent: false in bundler if not needed');
    console.error('');
    
    // Exit with 1 to signal that sanitization occurred
    // CI should review changes before proceeding
    process.exit(1);
  } else {
    console.log('✅ No dev URLs found inside source map files.');
    console.log('   Source maps are clean.');
    process.exit(0);
  }
})();
