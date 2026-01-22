#!/usr/bin/env node
// scripts/materialize-debug.js
// Debug script for re-running materialization on baselines
// Usage: API_BASE=https://api.example.com AUTH_TOKEN=xyz node scripts/materialize-debug.js

const https = require('https');
const http = require('http');

const API_BASE = process.env.API_BASE;
const TOKEN = process.env.AUTH_TOKEN;

if (!API_BASE || !TOKEN) {
  console.error('❌ Missing required environment variables');
  console.error('   Usage: API_BASE=https://api.example.com AUTH_TOKEN=xyz node scripts/materialize-debug.js');
  process.exit(1);
}

/**
 * Makes a fetch request using Node's built-in http/https modules
 */
async function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Re-run materialization for a baseline
 */
async function acceptBaseline(projectId, baselineId) {
  const url = `${API_BASE}/projects/${projectId}/accept-baseline`;
  
  console.log(`🔄 Triggering materialization for project ${projectId}, baseline ${baselineId}`);
  
  try {
    const response = await makeRequest(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ baseline_id: baselineId }),
    });
    
    console.log(`✅ Response (${response.status}):`, JSON.stringify(response.data, null, 2));
    return response;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

/**
 * Get baseline metadata
 */
async function getBaseline(baselineId) {
  const url = `${API_BASE}/baselines/${baselineId}`;
  
  console.log(`📋 Fetching baseline metadata for ${baselineId}`);
  
  try {
    const response = await makeRequest(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
      },
    });
    
    console.log(`✅ Response (${response.status}):`, JSON.stringify(response.data, null, 2));
    return response;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

// Export functions for programmatic use
module.exports = { acceptBaseline, getBaseline };

// CLI mode
if (require.main === module) {
  console.log('🔧 Materialization Debug Tool');
  console.log('   API Base:', API_BASE);
  console.log('   Token:', TOKEN ? '***' + TOKEN.slice(-4) : 'missing');
  console.log('\n💡 Use this script programmatically:');
  console.log('   const { acceptBaseline, getBaseline } = require("./scripts/materialize-debug.js");');
  console.log('   await acceptBaseline("project-id", "baseline-id");');
  console.log('\n');
}
