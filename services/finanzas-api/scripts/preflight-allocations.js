#!/usr/bin/env node

/**
 * Preflight Allocations Smoke Test
 * 
 * This script performs end-to-end smoke tests for the allocations API:
 * 1. Authenticates via Cognito using test credentials
 * 2. Calls POST /admin/backfill with a known baseline
 * 3. Verifies allocations were written (allocationsWritten > 0)
 * 4. Calls GET /allocations for the project
 * 5. Verifies allocations are returned (length > 0)
 * 6. Writes artifacts for CI/CD verification
 * 
 * ENVIRONMENT VARIABLES (required):
 * - COGNITO_TESTER_USERNAME: Cognito test user username
 * - COGNITO_TESTER_PASSWORD: Cognito test user password
 * - COGNITO_WEB_CLIENT: Cognito app client ID
 * - AWS_REGION: AWS region for Cognito
 * - API_BASE: Base URL for the API (e.g., https://...amazonaws.com/dev)
 * - BASELINE_ID: Baseline ID to use for backfill test
 * - PROJECT_ID: Project ID to use for allocations test
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration from environment
const config = {
  cognitoUsername: process.env.COGNITO_TESTER_USERNAME || process.env.COGNITO_USER,
  cognitoPassword: process.env.COGNITO_TESTER_PASSWORD || process.env.COGNITO_PASS,
  cognitoClientId: process.env.COGNITO_WEB_CLIENT || process.env.COGNITO_CLIENT,
  awsRegion: process.env.AWS_REGION || 'us-east-2',
  apiBase: process.env.API_BASE || process.env.VITE_API_BASE_URL,
  baselineId: process.env.BASELINE_ID || 'base_5c62d927a71b',
  projectId: process.env.PROJECT_ID || 'P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7',
  artifactsDir: process.env.ARTIFACTS_DIR || path.join(__dirname, '../../../preflight-artifacts'),
};

console.log('='.repeat(80));
console.log('PREFLIGHT ALLOCATIONS SMOKE TEST');
console.log('='.repeat(80));
console.log(`API Base: ${config.apiBase || '(not set)'}`);
console.log(`Baseline ID: ${config.baselineId}`);
console.log(`Project ID: ${config.projectId}`);
console.log(`AWS Region: ${config.awsRegion}`);
console.log('='.repeat(80));

// Validate configuration
function validateConfig() {
  const required = [
    'cognitoUsername',
    'cognitoPassword',
    'cognitoClientId',
    'awsRegion',
    'apiBase',
  ];

  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => {
      console.error(`   - ${key.toUpperCase()}`);
    });
    console.error('\nPlease set the required environment variables and try again.');
    process.exit(1);
  }

  console.log('✅ Configuration validated');
}

// Get Cognito token using AWS CLI
async function getCognitoToken() {
  console.log('\n📝 Authenticating with Cognito...');

  try {
    const authCommand = `aws cognito-idp initiate-auth \
      --region ${config.awsRegion} \
      --client-id ${config.cognitoClientId} \
      --auth-flow USER_PASSWORD_AUTH \
      --auth-parameters "USERNAME=${config.cognitoUsername},PASSWORD=${config.cognitoPassword}" \
      --output json`;

    const authResult = execSync(authCommand, { encoding: 'utf-8' });
    const authData = JSON.parse(authResult);

    const token = authData?.AuthenticationResult?.AccessToken;

    if (!token) {
      throw new Error('Failed to extract AccessToken from Cognito response');
    }

    console.log('✅ Cognito authentication successful');
    return token;
  } catch (error) {
    console.error('❌ Cognito authentication failed:', error.message);
    if (error.stderr) {
      console.error('stderr:', error.stderr.toString());
    }
    throw error;
  }
}

// Helper to make HTTP requests
function makeRequest(url, options, postData = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: parsed });
          } catch {
            resolve({ statusCode: res.statusCode, data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Call POST /admin/backfill
async function testBackfill(token) {
  console.log('\n📝 Testing POST /admin/backfill...');

  const url = `${config.apiBase}/admin/backfill`;
  const payload = {
    baselineId: config.baselineId,
    dryRun: false,
  };

  try {
    const result = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }, JSON.stringify(payload));

    console.log('Response:', JSON.stringify(result.data, null, 2));

    // Verify allocationsWritten > 0
    const allocationsWritten = result.data?.allocationsWritten || 0;
    if (allocationsWritten <= 0) {
      throw new Error(`Expected allocationsWritten > 0, got ${allocationsWritten}`);
    }

    console.log(`✅ Backfill successful: ${allocationsWritten} allocations written`);
    return result.data;
  } catch (error) {
    console.error('❌ Backfill test failed:', error.message);
    throw error;
  }
}

// Call GET /allocations
async function testGetAllocations(token) {
  console.log('\n📝 Testing GET /allocations...');

  const url = `${config.apiBase}/allocations?projectId=${encodeURIComponent(config.projectId)}`;

  try {
    const result = await makeRequest(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log(`Response: ${result.data.length} allocations returned`);

    if (!Array.isArray(result.data)) {
      throw new Error('Expected array response from GET /allocations');
    }

    if (result.data.length === 0) {
      throw new Error('Expected allocations.length > 0, got 0');
    }

    console.log('Sample allocation:', JSON.stringify(result.data[0], null, 2));
    console.log(`✅ Get allocations successful: ${result.data.length} allocations found`);
    return result.data;
  } catch (error) {
    console.error('❌ Get allocations test failed:', error.message);
    throw error;
  }
}

// Write artifacts
function writeArtifacts(backfillResult, allocations) {
  console.log('\n📝 Writing artifacts...');

  // Create artifacts directory
  if (!fs.existsSync(config.artifactsDir)) {
    fs.mkdirSync(config.artifactsDir, { recursive: true });
  }

  // Write backfill result
  const backfillPath = path.join(config.artifactsDir, 'real_run_backfill.json');
  fs.writeFileSync(backfillPath, JSON.stringify(backfillResult, null, 2));
  console.log(`✅ Wrote ${backfillPath}`);

  // Write allocations result
  const allocationsPath = path.join(config.artifactsDir, 'allocations_list.json');
  fs.writeFileSync(allocationsPath, JSON.stringify(allocations, null, 2));
  console.log(`✅ Wrote ${allocationsPath}`);

  // Write summary
  const summaryPath = path.join(config.artifactsDir, 'preflight_summary.txt');
  const summary = `
PREFLIGHT ALLOCATIONS SMOKE TEST SUMMARY
========================================
Date: ${new Date().toISOString()}
API Base: ${config.apiBase}
Baseline ID: ${config.baselineId}
Project ID: ${config.projectId}

BACKFILL RESULTS:
- Allocations Written: ${backfillResult?.allocationsWritten || 0}
- Allocations Attempted: ${backfillResult?.allocationsAttempted || 0}
- Allocations Skipped: ${backfillResult?.allocationsSkipped || 0}

GET ALLOCATIONS RESULTS:
- Total Allocations: ${allocations?.length || 0}
- Sample PK: ${allocations?.[0]?.pk || 'N/A'}
- Sample SK: ${allocations?.[0]?.sk || 'N/A'}

STATUS: ✅ ALL TESTS PASSED
`;

  fs.writeFileSync(summaryPath, summary);
  console.log(`✅ Wrote ${summaryPath}`);

  console.log(`\n📁 Artifacts written to: ${config.artifactsDir}`);
}

// Main execution
async function main() {
  try {
    validateConfig();

    const token = await getCognitoToken();

    const backfillResult = await testBackfill(token);

    const allocations = await testGetAllocations(token);

    writeArtifacts(backfillResult, allocations);

    console.log('\n' + '='.repeat(80));
    console.log('✅ PREFLIGHT SMOKE TEST PASSED');
    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ PREFLIGHT SMOKE TEST FAILED');
    console.error('='.repeat(80));
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
