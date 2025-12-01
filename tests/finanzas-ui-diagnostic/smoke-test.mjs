#!/usr/bin/env node
/**
 * Finanzas UI Component Diagnostic Smoke Test
 * 
 * Lightweight HTTP-based validation that each Finanzas UI component:
 * - Returns HTTP 200 from CloudFront
 * - Returns HTML document
 * - Contains expected fingerprints (headings, labels, component markers)
 * 
 * This is NOT a full E2E test - it validates deployment and basic rendering.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use native fetch (Node 18+) - fallback for older versions not needed since package.json specifies node >=18.18.0
if (!globalThis.fetch) {
  throw new Error('This script requires Node.js 18+ with native fetch support');
}
const fetch = globalThis.fetch;

const BASE_URL = process.env.FINZ_UI_BASE_URL || 'https://d7t9x3j66yd8k.cloudfront.net';
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function formatStatus(status) {
  if (status === 'pass') return `${colors.green}✅${colors.reset}`;
  if (status === 'fail') return `${colors.red}❌${colors.reset}`;
  if (status === 'warn') return `${colors.yellow}⚠️${colors.reset}`;
  return status;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function testComponent(component, baseUrl) {
  const url = `${baseUrl}${component.route}`;
  const results = {
    name: component.name,
    route: component.route,
    category: component.category,
    critical: component.critical,
    url,
    status: 'fail',
    httpStatus: null,
    contentType: null,
    hasHtml: false,
    fingerprintsFound: [],
    fingerprintsMissing: [],
    error: null,
  };

  let lastError = null;
  
  // Retry logic for transient failures
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Finanzas-UI-Diagnostic/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      results.httpStatus = response.status;
      results.contentType = response.headers.get('content-type') || '';

      // Check HTTP status
      if (response.status !== 200) {
        results.error = `HTTP ${response.status}`;
        lastError = results.error;
        
        // For auth-protected routes, 401/403 might be expected
        if ((response.status === 401 || response.status === 403) && !component.critical) {
          results.status = 'warn';
          results.error = `${results.error} (auth required - expected for this route)`;
          return results;
        }
        
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          continue;
        }
        return results;
      }

      // Get response body
      const body = await response.text();
      results.hasHtml = body.includes('<html') || body.includes('<!DOCTYPE html>');

      if (!results.hasHtml) {
        results.error = 'Response is not HTML';
        return results;
      }

      // Check fingerprints (convert to lowercase once for efficiency)
      const bodyLower = body.toLowerCase();
      for (const fingerprint of component.fingerprints) {
        // Case-insensitive search in HTML
        const found = bodyLower.includes(fingerprint.toLowerCase());
        if (found) {
          results.fingerprintsFound.push(fingerprint);
        } else {
          results.fingerprintsMissing.push(fingerprint);
        }
      }

      // Determine overall status
      if (results.fingerprintsFound.length === component.fingerprints.length) {
        results.status = 'pass';
      } else if (results.fingerprintsFound.length > 0) {
        results.status = 'warn';
        results.error = `Missing fingerprints: ${results.fingerprintsMissing.join(', ')}`;
      } else {
        results.status = 'fail';
        results.error = 'No expected fingerprints found in HTML';
      }

      return results;

    } catch (error) {
      lastError = error.message;
      
      if (error.name === 'AbortError') {
        lastError = `Timeout after ${TIMEOUT_MS}ms`;
      }
      
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      results.error = lastError;
      return results;
    }
  }

  results.error = lastError;
  return results;
}

function printResults(results) {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}Finanzas UI Component Diagnostic Results${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`Base URL: ${colors.blue}${BASE_URL}${colors.reset}\n`);

  // Group by category
  const byCategory = results.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  let totalPass = 0;
  let totalFail = 0;
  let totalWarn = 0;
  let criticalFail = 0;

  for (const [category, items] of Object.entries(byCategory)) {
    console.log(`${colors.blue}▶ ${category}${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    
    for (const item of items) {
      const status = formatStatus(item.status);
      const criticalMarker = item.critical ? `${colors.red}[CRITICAL]${colors.reset}` : '';
      const routeDisplay = `${colors.gray}${item.route}${colors.reset}`;
      
      console.log(`${status} ${item.name} ${criticalMarker}`);
      console.log(`   ${routeDisplay}`);
      
      if (item.status === 'pass') {
        totalPass++;
        if (item.fingerprintsFound.length > 0) {
          console.log(`   ${colors.gray}Found: ${item.fingerprintsFound.join(', ')}${colors.reset}`);
        }
      } else if (item.status === 'warn') {
        totalWarn++;
        console.log(`   ${colors.yellow}${item.error}${colors.reset}`);
      } else {
        totalFail++;
        if (item.critical) criticalFail++;
        console.log(`   ${colors.red}${item.error}${colors.reset}`);
        if (item.httpStatus) {
          console.log(`   ${colors.gray}HTTP ${item.httpStatus}${colors.reset}`);
        }
      }
      console.log();
    }
  }

  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}Summary${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✅ Passed:${colors.reset} ${totalPass}/${results.length}`);
  console.log(`${colors.yellow}⚠️  Warnings:${colors.reset} ${totalWarn}/${results.length}`);
  console.log(`${colors.red}❌ Failed:${colors.reset} ${totalFail}/${results.length}`);
  console.log(`${colors.red}🚨 Critical Failures:${colors.reset} ${criticalFail}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  return { totalPass, totalWarn, totalFail, criticalFail };
}

async function main() {
  console.log(`${colors.cyan}Starting Finanzas UI Component Diagnostics...${colors.reset}\n`);

  // Load component configuration
  const configPath = join(__dirname, 'components.json');
  let config;
  
  try {
    const configJson = await readFile(configPath, 'utf-8');
    config = JSON.parse(configJson);
  } catch (error) {
    console.error(`${colors.red}❌ Failed to load components.json: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  const components = config.components;
  console.log(`Testing ${components.length} components against ${BASE_URL}\n`);

  // Test all components in parallel for speed
  const results = await Promise.all(
    components.map(component => testComponent(component, BASE_URL))
  );

  // Print results
  const summary = printResults(results);

  // Exit with appropriate code
  if (summary.criticalFail > 0) {
    console.error(`${colors.red}CRITICAL: ${summary.criticalFail} critical component(s) failed!${colors.reset}`);
    process.exit(1);
  }
  
  if (summary.totalFail > 0) {
    console.error(`${colors.yellow}WARNING: ${summary.totalFail} component(s) failed (non-critical).${colors.reset}`);
    process.exit(0); // Don't fail workflow for non-critical failures
  }

  console.log(`${colors.green}All components are operational! ✨${colors.reset}`);
  process.exit(0);
}

// Run
main().catch(error => {
  console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});
