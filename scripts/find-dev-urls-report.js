#!/usr/bin/env node
// scripts/find-dev-urls-report.js
// Generates a detailed JSON report of dev URL findings categorized by origin

import fs from 'fs';
import path from 'path';

const FINDINGS_FILE = 'reports/dev-url-guard-findings.json';
const REPORT_FILE = 'reports/dev-url-guard-report.json';

if (!fs.existsSync(FINDINGS_FILE)) {
  console.log('ℹ️  No findings file found. Run find-dev-urls.js first.');
  process.exit(0);
}

const findings = JSON.parse(fs.readFileSync(FINDINGS_FILE, 'utf8'));

// Categorize findings by origin
const categorized = {
  summary: {
    total: findings.length,
    timestamp: new Date().toISOString(),
    scannedDirectory: 'dist-finanzas'
  },
  byOrigin: {
    literal: [],
    'inline-sourcemap-sources': [],
    'inline-sourcemap-content': [],
    dependency: []
  },
  byFile: {}
};

findings.forEach(finding => {
  const origin = finding.origin || 'unknown';
  
  // Categorize by origin
  if (categorized.byOrigin[origin]) {
    categorized.byOrigin[origin].push(finding);
  } else {
    categorized.byOrigin[origin] = [finding];
  }
  
  // Categorize by file
  const filePath = finding.file;
  if (!categorized.byFile[filePath]) {
    categorized.byFile[filePath] = [];
  }
  categorized.byFile[filePath].push(finding);
});

// Add counts by origin
categorized.summary.byOrigin = {};
Object.keys(categorized.byOrigin).forEach(origin => {
  categorized.summary.byOrigin[origin] = categorized.byOrigin[origin].length;
});

// Write report
fs.writeFileSync(REPORT_FILE, JSON.stringify(categorized, null, 2));

console.log('📊 Dev URL Guard Report Generated');
console.log('─'.repeat(70));
console.log(`Total findings: ${categorized.summary.total}`);
console.log('');
console.log('By Origin:');
Object.keys(categorized.summary.byOrigin).forEach(origin => {
  const count = categorized.summary.byOrigin[origin];
  if (count > 0) {
    console.log(`  - ${origin}: ${count}`);
  }
});
console.log('');
console.log(`Report saved to: ${REPORT_FILE}`);
console.log('');

// Exit with error code if findings exist
process.exit(findings.length > 0 ? 1 : 0);
