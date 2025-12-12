/**
 * CORS Preflight Tests
 * 
 * Validates that CORS headers are correctly configured for CloudFront SPA origin
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getApiBaseUrl, getCloudFrontOrigin, corsPreflight } from "./utils/test-helpers.js";

describe("CORS Preflight Tests", () => {
  const criticalEndpoints = [
    { path: "/projects", methods: ["GET", "POST"] },
    { path: "/plan/forecast", methods: ["GET"] },
    { path: "/catalog/rubros", methods: ["GET"] },
    { path: "/line-items", methods: ["GET"] },
    { path: "/allocation-rules", methods: ["GET"] },
    { path: "/providers", methods: ["GET"] },
  ];

  it("CloudFront origin is configured", () => {
    const origin = getCloudFrontOrigin();
    assert.ok(origin, "CloudFront origin should be configured");
    assert.ok(
      origin.startsWith("https://"),
      `CloudFront origin should use HTTPS, got: ${origin}`
    );
    console.log(`✓ CloudFront Origin: ${origin}`);
  });

  describe("OPTIONS preflight for critical endpoints", () => {
    const baseUrl = getApiBaseUrl();

    for (const endpoint of criticalEndpoints) {
      for (const method of endpoint.methods) {
        it(`${method} ${endpoint.path} returns correct CORS headers`, async () => {
          const url = `${baseUrl}${endpoint.path}`;
          const result = await corsPreflight(url, method);

          console.log(`\n📍 Testing: OPTIONS ${endpoint.path} (for ${method} request)`);
          console.log(`   Status: ${result.status}`);
          console.log(`   Request Origin: ${result.diagnostics.requestOrigin}`);
          console.log(`   Request Method: ${result.diagnostics.requestMethod}`);
          console.log(`   Request Headers: ${result.diagnostics.requestHeaders}`);

          if (result.headers["access-control-allow-origin"]) {
            console.log(
              `   ✓ access-control-allow-origin: ${result.headers["access-control-allow-origin"]}`
            );
          } else {
            console.log(`   ✗ access-control-allow-origin: (missing)`);
          }

          if (result.headers["access-control-allow-methods"]) {
            console.log(
              `   ✓ access-control-allow-methods: ${result.headers["access-control-allow-methods"]}`
            );
          } else {
            console.log(`   ✗ access-control-allow-methods: (missing)`);
          }

          if (result.headers["access-control-allow-headers"]) {
            console.log(
              `   ✓ access-control-allow-headers: ${result.headers["access-control-allow-headers"]}`
            );
          } else {
            console.log(`   ✗ access-control-allow-headers: (missing)`);
          }

          // Print errors if any
          if (result.errors.length > 0) {
            console.log(`   Errors:`);
            result.errors.forEach((err) => console.log(`     - ${err}`));
            console.log(`   All Response Headers:`);
            Object.entries(result.diagnostics.allResponseHeaders).forEach(([key, value]) => {
              console.log(`     ${key}: ${value}`);
            });
          }

          // Assert CORS preflight passes
          assert.ok(
            result.passed,
            `CORS preflight failed for ${method} ${endpoint.path}:\n${result.errors.join("\n")}`
          );

          console.log(`   ✅ CORS preflight PASSED for ${method} ${endpoint.path}`);
        });
      }
    }
  });

  describe("CORS headers validation details", () => {
    it("validates access-control-allow-origin includes CloudFront domain", async () => {
      const baseUrl = getApiBaseUrl();
      const result = await corsPreflight(`${baseUrl}/projects`, "GET");

      const allowOrigin = result.headers["access-control-allow-origin"];
      const cfOrigin = getCloudFrontOrigin();

      assert.ok(
        allowOrigin === "*" || allowOrigin === cfOrigin,
        `access-control-allow-origin should be * or ${cfOrigin}, got: ${allowOrigin}`
      );
    });

    it("validates access-control-allow-headers includes authorization", async () => {
      const baseUrl = getApiBaseUrl();
      const result = await corsPreflight(`${baseUrl}/projects`, "GET");

      const allowHeaders = result.headers["access-control-allow-headers"]?.toLowerCase() || "";

      assert.ok(
        allowHeaders.includes("authorization"),
        `access-control-allow-headers should include 'authorization', got: ${allowHeaders}`
      );
    });

    it("validates access-control-allow-headers includes content-type", async () => {
      const baseUrl = getApiBaseUrl();
      const result = await corsPreflight(`${baseUrl}/projects`, "GET");

      const allowHeaders = result.headers["access-control-allow-headers"]?.toLowerCase() || "";

      assert.ok(
        allowHeaders.includes("content-type"),
        `access-control-allow-headers should include 'content-type', got: ${allowHeaders}`
      );
    });

    it("validates access-control-allow-methods includes requested methods", async () => {
      const baseUrl = getApiBaseUrl();
      const result = await corsPreflight(`${baseUrl}/projects`, "GET");

      const allowMethods = result.headers["access-control-allow-methods"]?.toUpperCase() || "";

      assert.ok(
        allowMethods.includes("GET"),
        `access-control-allow-methods should include GET, got: ${allowMethods}`
      );
    });
  });
});
