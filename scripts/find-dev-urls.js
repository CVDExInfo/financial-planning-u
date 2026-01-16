#!/usr/bin/env node
// scripts/find-dev-urls.js
// Scans dist-finanzas for development URLs that should not be in production builds
// Includes detection of URLs in inline base64 source maps

const fs = require('fs');
const path = require('path');

// Development URL patterns to detect
const PATTERN = /github\.dev|codespaces|githubusercontent\.com|localhost:3000|127\.0\.0\.1/i;
let findings = [];

/**
 * Scans a file for development URL patterns line by line
 */
function scanFileForPattern(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    lines.forEach((ln, i) => {
      if (PATTERN.test(ln)) {
        findings.push({
          file: filePath,
          line: i + 1,
          text: ln.trim().slice(0, 200), // Truncate long lines
          origin: 'literal'
        });
      }
    });
  } catch (e) {
    console.error(`Error scanning ${filePath}: ${e.message}`);
  }
}

/**
 * Finds and decodes inline source maps in .js files, then scans for dev URLs
 */
function decodeInlineSourceMapAndScan(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/sourceMappingURL=data:application\/json;base64,([^\s'"\)]+)/m);
    
    if (!match) return;
    
    const base64Data = match[1];
    try {
      const jsonStr = Buffer.from(base64Data, 'base64').toString('utf8');
      const map = JSON.parse(jsonStr);
      
      // Scan sources array
      if (map.sources && Array.isArray(map.sources)) {
        map.sources.forEach((src, ix) => {
          if (PATTERN.test(src)) {
            findings.push({
              file: `${filePath}`,
              location: `inline map source[${ix}]`,
              text: src,
              origin: 'inline-sourcemap-sources'
            });
          }
        });
      }
      
      // Scan sourcesContent array
      if (map.sourcesContent && Array.isArray(map.sourcesContent)) {
        map.sourcesContent.forEach((sc, ix) => {
          if (sc && PATTERN.test(sc)) {
            findings.push({
              file: `${filePath}`,
              location: `inline map sourcesContent[${ix}]`,
              text: (sc || '').slice(0, 200), // Truncate long content
              origin: 'inline-sourcemap-content'
            });
          }
        });
      }
    } catch (e) {
      console.error(`Inline map decode failed for ${filePath}: ${e.message}`);
    }
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e.message}`);
  }
}

/**
 * Recursively walks through the dist directory
 */
function walkDist(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      
      if (ent.isDirectory()) {
        // Skip node_modules if somehow present in dist
        if (ent.name === 'node_modules') continue;
        walkDist(fullPath);
      } else if (ent.isFile()) {
        // Scan .map files if they exist separately
        if (fullPath.endsWith('.map')) {
          scanFileForPattern(fullPath);
        } else {
          // Scan all non-map files for literal patterns
          scanFileForPattern(fullPath);
          
          // For .js files, also check inline source maps
          if (fullPath.endsWith('.js')) {
            decodeInlineSourceMapAndScan(fullPath);
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error walking directory ${dir}: ${e.message}`);
  }
}

// Main execution
const distDir = 'dist-finanzas';

if (!fs.existsSync(distDir)) {
  console.error(`❌ Error: ${distDir} not found. Run build first.`);
  console.error('   Command: BUILD_TARGET=finanzas pnpm run build:finanzas');
  process.exit(2);
}

console.log('🔍 Scanning build artifacts for development URLs...');
console.log(`   Directory: ${distDir}`);
console.log(`   Patterns: github.dev, codespaces, githubusercontent.com, localhost:3000, 127.0.0.1`);
console.log('');

walkDist(distDir);

// Create reports directory if it doesn't exist
const reportsDir = 'reports';
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

if (findings.length > 0) {
  // Write detailed findings to JSON file
  const reportPath = path.join(reportsDir, 'dev-url-guard-findings.json');
  fs.writeFileSync(reportPath, JSON.stringify(findings, null, 2));
  
  console.error('❌ Found development URLs in built artifacts!');
  console.error(`   Report saved to: ${reportPath}`);
  console.error('');
  console.error('Findings:');
  console.error('─'.repeat(70));
  
  findings.forEach((f, idx) => {
    const location = f.location ? ` -> ${f.location}` : (f.line ? `:${f.line}` : '');
    console.error(`${idx + 1}. ${f.file}${location}`);
    console.error(`   Origin: ${f.origin}`);
    console.error(`   Match: ${String(f.text).slice(0, 150)}`);
    console.error('');
  });
  
  console.error('─'.repeat(70));
  console.error(`Total: ${findings.length} finding(s)`);
  console.error('');
  console.error('💡 To fix these issues:');
  console.error('   1. Review the findings in the report');
  console.error('   2. Run: pnpm run repair:dev-urls (automated fix attempt)');
  console.error('   3. Or manually remove dev URLs from source files');
  console.error('   4. Rebuild and re-run this check');
  console.error('');
  
  process.exit(1);
} else {
  console.log('✅ No development URLs found in built artifacts.');
  console.log('   Build is clean and ready for deployment.');
  process.exit(0);
}
