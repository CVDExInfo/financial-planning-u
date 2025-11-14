#!/usr/bin/env node
/**
 * Finanzas API E2E Test Helper
 * Tests the Finanzas API endpoints with authentication
 */

const https = require('https');

const API_BASE = 'https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev';
const COGNITO_REGION = 'us-east-2';
const COGNITO_CLIENT_ID = 'dshos5iou44tuach7ta3ici5m';
const USERNAME = 'christian.valencia@ikusi.com';
const PASSWORD = 'Velatia@2025';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function getCognitoToken() {
  log('\n=== Step 1: Authenticating with Cognito ===', colors.cyan);
  
  const AWS = require('child_process').execSync;
  const cmd = `aws cognito-idp initiate-auth \
    --region ${COGNITO_REGION} \
    --client-id ${COGNITO_CLIENT_ID} \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters USERNAME=${USERNAME},PASSWORD='${PASSWORD}' \
    --output json`;
  
  try {
    const result = AWS(cmd, { encoding: 'utf8' });
    const parsed = JSON.parse(result);
    
    if (parsed.AuthenticationResult && parsed.AuthenticationResult.IdToken) {
      log('✓ Authentication successful', colors.green);
      return parsed.AuthenticationResult.IdToken;
    } else {
      throw new Error('No IdToken in response');
    }
  } catch (error) {
    log('✗ Authentication failed: ' + error.message, colors.red);
    throw error;
  }
}

async function testEndpoint(name, path, token, method = 'GET') {
  log(`\n--- Testing: ${name} ---`, colors.blue);
  log(`    ${method} ${API_BASE}${path}`);
  
  try {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    const response = await makeRequest(url, options);
    
    if (response.status >= 200 && response.status < 300) {
      log(`✓ ${response.status} OK`, colors.green);
      
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data)) {
          log(`  Response: Array with ${response.data.length} items`);
        } else if (response.data.data) {
          const count = Array.isArray(response.data.data) ? response.data.data.length : 'N/A';
          log(`  Response: { data: [${count} items], total: ${response.data.total || 'N/A'} }`);
          
          // Show first item if available
          if (Array.isArray(response.data.data) && response.data.data.length > 0) {
            log(`  First item keys: ${Object.keys(response.data.data[0]).join(', ')}`);
          }
        } else {
          log(`  Response keys: ${Object.keys(response.data).join(', ')}`);
        }
      }
      
      return { success: true, status: response.status, data: response.data };
    } else {
      log(`✗ ${response.status} ${response.statusText || 'Error'}`, colors.red);
      if (typeof response.data === 'string') {
        log(`  Error: ${response.data.substring(0, 200)}`);
      } else {
        log(`  Error: ${JSON.stringify(response.data).substring(0, 200)}`);
      }
      return { success: false, status: response.status, error: response.data };
    }
  } catch (error) {
    log(`✗ Request failed: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('╔════════════════════════════════════════════╗', colors.cyan);
  log('║   Finanzas API E2E Test                   ║', colors.cyan);
  log('╚════════════════════════════════════════════╝', colors.cyan);
  
  let token;
  try {
    token = await getCognitoToken();
  } catch (error) {
    log('\n✗ Cannot proceed without authentication token', colors.red);
    process.exit(1);
  }
  
  log('\n=== Step 2: Testing API Endpoints ===', colors.cyan);
  
  const tests = [
    { name: 'Health Check', path: '/health' },
    { name: 'Rubros Catalog', path: '/catalog/rubros' },
    { name: 'Allocation Rules', path: '/allocation-rules' },
    { name: 'Projects List', path: '/projects' },
    { name: 'Adjustments List', path: '/adjustments' },
    { name: 'Providers List', path: '/providers' }
  ];
  
  const results = {};
  for (const test of tests) {
    results[test.name] = await testEndpoint(test.name, test.path, token);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
  }
  
  // Summary
  log('\n' + '═'.repeat(50), colors.cyan);
  log('=== Test Summary ===', colors.cyan);
  log('═'.repeat(50), colors.cyan);
  
  const passed = Object.values(results).filter(r => r.success).length;
  const failed = Object.values(results).filter(r => !r.success).length;
  
  Object.entries(results).forEach(([name, result]) => {
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    const color = result.success ? colors.green : colors.red;
    log(`${status} - ${name}`, color);
  });
  
  log('\n' + '─'.repeat(50));
  log(`Total: ${passed} passed, ${failed} failed`, failed === 0 ? colors.green : colors.yellow);
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  log(`\n✗ Unexpected error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
