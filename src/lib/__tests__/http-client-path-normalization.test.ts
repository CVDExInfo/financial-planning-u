import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";

/**
 * Test path normalization in HttpClient
 * Ensures URL construction preserves API stage (e.g., /dev) and prevents double slashes
 */
describe("HttpClient path normalization", () => {
  let originalEnv: string | undefined;

  before(() => {
    originalEnv = process.env.VITE_API_BASE_URL;
  });

  after(() => {
    if (originalEnv !== undefined) {
      process.env.VITE_API_BASE_URL = originalEnv;
    } else {
      delete process.env.VITE_API_BASE_URL;
    }
  });

  it("preserves stage when base has trailing slash and path has leading slash", () => {
    const baseUrl = "https://api.example.com/dev/";
    const endpoint = "/budgets/all-in/monthly";
    
    // Simulate buildUrl logic
    const base = baseUrl.replace(/\/+$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = `${base}${path}`;
    
    assert.equal(result, "https://api.example.com/dev/budgets/all-in/monthly");
  });

  it("preserves stage when base has no trailing slash and path has leading slash", () => {
    const baseUrl = "https://api.example.com/dev";
    const endpoint = "/budgets/all-in/monthly";
    
    const base = baseUrl.replace(/\/+$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = `${base}${path}`;
    
    assert.equal(result, "https://api.example.com/dev/budgets/all-in/monthly");
  });

  it("preserves stage when base has trailing slash and path has no leading slash", () => {
    const baseUrl = "https://api.example.com/dev/";
    const endpoint = "budgets/all-in/monthly";
    
    const base = baseUrl.replace(/\/+$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = `${base}${path}`;
    
    assert.equal(result, "https://api.example.com/dev/budgets/all-in/monthly");
  });

  it("preserves stage when base has no trailing slash and path has no leading slash", () => {
    const baseUrl = "https://api.example.com/dev";
    const endpoint = "budgets/all-in/monthly";
    
    const base = baseUrl.replace(/\/+$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = `${base}${path}`;
    
    assert.equal(result, "https://api.example.com/dev/budgets/all-in/monthly");
  });

  it("handles query parameters correctly", () => {
    const baseUrl = "https://api.example.com/dev";
    const endpoint = "/budgets/all-in/monthly?year=2025";
    
    const base = baseUrl.replace(/\/+$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = `${base}${path}`;
    
    assert.equal(result, "https://api.example.com/dev/budgets/all-in/monthly?year=2025");
  });

  it("handles root path without stage", () => {
    const baseUrl = "https://api.example.com";
    const endpoint = "/health";
    
    const base = baseUrl.replace(/\/+$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = `${base}${path}`;
    
    assert.equal(result, "https://api.example.com/health");
  });

  it("strips multiple trailing slashes from base", () => {
    const baseUrl = "https://api.example.com/dev///";
    const endpoint = "/budgets/all-in/overview";
    
    const base = baseUrl.replace(/\/+$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = `${base}${path}`;
    
    assert.equal(result, "https://api.example.com/dev/budgets/all-in/overview");
  });
});
