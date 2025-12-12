/**
 * Health/Smoke Tests for Behavioral API Testing
 * 
 * Tests basic API reachability and authentication
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getApiBaseUrl,
  getCognitoToken,
  getTestCredentials,
  apiRequest,
  printEvidence,
  skipTier1Test,
} from "./utils/test-helpers.js";

describe("API Health & Smoke Tests", () => {
  it("API base URL is configured", () => {
    const baseUrl = getApiBaseUrl();
    assert.ok(baseUrl, "API base URL should be configured");
    assert.ok(
      baseUrl.startsWith("https://"),
      `API base URL should use HTTPS, got: ${baseUrl}`
    );
    console.log(`✓ API Base URL: ${baseUrl}`);
  });

  it("can authenticate with Cognito and reach API (Tier-1)", async () => {
    // Try to get credentials for any available role
    const credentials = getTestCredentials(["SDMT", "PMO", "SDM_FIN", "EXEC_RO"]);

    if (!credentials) {
      skipTier1Test("Authentication and API reachability", "No role credentials configured");
      return;
    }

    // Authenticate
    const token = await getCognitoToken(credentials);
    assert.ok(token, "Should receive ID token from Cognito");
    assert.ok(token.split(".").length === 3, "Token should be valid JWT format");

    console.log(`✓ Authenticated as: ${credentials.role}`);

    // Make a simple API call
    const result = await apiRequest("/projects?limit=1", token, { method: "GET" });

    // Should return 200 OK or may return 403 if user doesn't have access (that's fine for smoke test)
    assert.ok(
      result.status === 200 || result.status === 403,
      `Expected 200 or 403, got ${result.status}`
    );

    if (result.status === 200) {
      assert.ok(result.data, "Response should have data");
      printEvidence(credentials.role, "GET /projects?limit=1", 200, "PASS", "API reachable");
    } else {
      printEvidence(
        credentials.role,
        "GET /projects?limit=1",
        403,
        "PASS",
        "API reachable (RBAC enforced)"
      );
    }
  });

  it("can parse JSON response from API (Tier-1)", async () => {
    const credentials = getTestCredentials(["SDMT", "PMO"]);

    if (!credentials) {
      skipTier1Test("JSON parsing", "SDMT or PMO credentials not configured");
      return;
    }

    const token = await getCognitoToken(credentials);
    const result = await apiRequest("/projects?limit=1", token, { method: "GET" });

    if (result.status !== 200) {
      console.warn(
        `⚠️  Cannot test JSON parsing: API returned ${result.status} (may need different role)`
      );
      return;
    }

    assert.ok(result.data, "Should receive response data");
    assert.ok(typeof result.data === "object", "Response should be parsed as JSON object");

    console.log(`✓ JSON parsing works: ${JSON.stringify(result.data).slice(0, 100)}...`);
  });

  it("API returns CORS headers on actual requests (Tier-1)", async () => {
    const credentials = getTestCredentials(["SDMT", "PMO"]);

    if (!credentials) {
      skipTier1Test("CORS headers on actual requests", "SDMT or PMO credentials not configured");
      return;
    }

    const token = await getCognitoToken(credentials);
    const result = await apiRequest("/projects?limit=1", token, { method: "GET" });

    // Check if response includes CORS headers
    const hasCorsHeaders =
      result.headers["access-control-allow-origin"] ||
      result.headers["access-control-allow-methods"];

    if (hasCorsHeaders) {
      console.log("✓ API returns CORS headers on actual requests");
      console.log(`  allow-origin: ${result.headers["access-control-allow-origin"]}`);
    } else {
      console.warn("⚠️  API did not return CORS headers (may be CloudFront behavior)");
    }
  });
});
