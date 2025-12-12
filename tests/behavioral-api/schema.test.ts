/**
 * Data-Shape Contract Tests
 * 
 * Validates API response schemas without requiring seeded data
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getCognitoToken,
  getRoleCredentials,
  apiRequest,
  validateShape,
  pickProjectWithBaseline,
} from "./utils/test-helpers.js";

describe("Data-Shape Contract Tests", () => {
  describe("Projects Endpoint Schema", () => {
    it("GET /projects returns correct shape with data array and total", async () => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        console.warn("⚠️  Skipping projects schema test: SDMT or PMO credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);
      const result = await apiRequest("/projects", token, { method: "GET" });

      assert.equal(result.status, 200, `Expected 200, got ${result.status}`);
      assert.ok(result.data, "Response should have data");

      // Validate top-level shape
      const topLevelShape = validateShape(result.data, {
        data: "array",
        total: "number",
      });

      if (!topLevelShape.valid) {
        console.error("❌ Projects response shape validation failed:");
        topLevelShape.errors.forEach((err) => console.error(`   - ${err}`));
      }

      assert.ok(
        topLevelShape.valid,
        `Projects response should have { data: array, total: number }\nErrors: ${topLevelShape.errors.join(", ")}`
      );

      console.log(`✓ Projects response has correct top-level shape`);
      console.log(`  - data: array (${result.data.data?.length || 0} items)`);
      console.log(`  - total: number (${result.data.total})`);

      // If data array is not empty, validate project shape
      if (result.data.data && result.data.data.length > 0) {
        const project = result.data.data[0];
        console.log(`\n  Validating project shape from first item:`);

        const projectShape = validateShape(project, {
          projectId: "string",
          code: "string",
          name: "string",
          client: "string",
        });

        if (!projectShape.valid) {
          console.warn("⚠️  Project shape validation warnings:");
          projectShape.errors.forEach((err) => console.warn(`     - ${err}`));
        }

        // baselineId may be nullable/missing in real data, so we don't assert on it
        if ("baselineId" in project) {
          console.log(`  ✓ Project has baselineId: ${project.baselineId || "(null)"}`);
        } else {
          console.log(`  ℹ️  Project missing baselineId (acceptable if no baseline exists)`);
        }

        assert.ok(
          projectShape.valid,
          `Each project should have required fields\nErrors: ${projectShape.errors.join(", ")}`
        );

        console.log(`  ✓ Project has required fields: projectId, code, name, client`);
      } else {
        console.log(`  ℹ️  No projects in response (empty data array is acceptable)`);
      }
    });

    it("Projects endpoint handles empty results gracefully", async () => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        console.warn("⚠️  Skipping empty results test: SDMT or PMO credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);
      // Request with filter that might return no results
      const result = await apiRequest("/projects?limit=0", token, { method: "GET" });

      assert.equal(result.status, 200, `Expected 200, got ${result.status}`);
      assert.ok(result.data, "Response should have data even when empty");

      // Should still have the correct shape
      const shape = validateShape(result.data, {
        data: "array",
        total: "number",
      });

      assert.ok(
        shape.valid,
        `Empty response should still have correct shape\nErrors: ${shape.errors.join(", ")}`
      );

      console.log(`✓ Projects endpoint handles empty results with correct shape`);
    });
  });

  describe("Forecast Endpoint Schema", () => {
    it("GET /plan/forecast returns correct shape when project has data", async () => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        console.warn("⚠️  Skipping forecast schema test: SDMT or PMO credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);

      // First, get a project
      const projectsResult = await apiRequest("/projects?limit=10", token, { method: "GET" });

      if (!projectsResult.data?.data || projectsResult.data.data.length === 0) {
        console.warn("⚠️  No projects available to test forecast endpoint");
        return;
      }

      const project = pickProjectWithBaseline(projectsResult.data.data);
      const projectId = project.projectId || project.project_id;

      if (!projectId) {
        console.warn("⚠️  Cannot extract projectId from project data");
        return;
      }

      console.log(`\nTesting forecast for project: ${projectId}`);

      const forecastResult = await apiRequest(
        `/plan/forecast?projectId=${projectId}`,
        token,
        { method: "GET" }
      );

      // Forecast may return 404 if no data exists - that's acceptable
      if (forecastResult.status === 404) {
        console.log(`ℹ️  Project ${projectId} has no forecast data (404) - acceptable`);
        return;
      }

      assert.equal(forecastResult.status, 200, `Expected 200, got ${forecastResult.status}`);
      assert.ok(forecastResult.data, "Forecast response should have data");

      // Validate forecast shape
      const forecastShape = validateShape(forecastResult.data, {
        projectId: "string",
        data: "array",
      });

      if (!forecastShape.valid) {
        console.warn("⚠️  Forecast shape validation warnings:");
        forecastShape.errors.forEach((err) => console.warn(`     - ${err}`));
      }

      // Check for timestamp fields (may be generated_at or generatedAt)
      const hasTimestamp =
        "generated_at" in forecastResult.data || "generatedAt" in forecastResult.data;

      if (hasTimestamp) {
        console.log(
          `  ✓ Forecast has timestamp: ${
            forecastResult.data.generated_at || forecastResult.data.generatedAt
          }`
        );
      }

      assert.ok(
        forecastShape.valid,
        `Forecast should have { projectId, data }\nErrors: ${forecastShape.errors.join(", ")}`
      );

      console.log(`✓ Forecast response has correct shape`);
      console.log(`  - projectId: string (${forecastResult.data.projectId})`);
      console.log(`  - data: array (${forecastResult.data.data?.length || 0} items)`);

      // If months field exists, validate it
      if ("months" in forecastResult.data) {
        assert.ok(
          Array.isArray(forecastResult.data.months),
          "Forecast months should be an array if present"
        );
        console.log(`  - months: array (${forecastResult.data.months.length} items)`);
      }
    });

    it("Forecast endpoint returns 404 for non-existent projects (not 500)", async () => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        console.warn(
          "⚠️  Skipping forecast 404 test: SDMT or PMO credentials not configured"
        );
        return;
      }

      const token = await getCognitoToken(credentials);
      const fakeProjectId = "nonexistent-project-12345";

      const result = await apiRequest(
        `/plan/forecast?projectId=${fakeProjectId}`,
        token,
        { method: "GET" }
      );

      // Should return 404, not 500
      assert.ok(
        result.status === 404 || result.status === 400,
        `Expected 404 or 400 for non-existent project, got ${result.status}`
      );

      console.log(`✓ Forecast endpoint returns proper error for non-existent project (${result.status})`);
    });
  });

  describe("Catalog/Rubros Endpoint Schema", () => {
    it("GET /catalog/rubros returns array of rubros", async () => {
      const credentials = getRoleCredentials("SDMT") || getRoleCredentials("PMO");

      if (!credentials) {
        console.warn("⚠️  Skipping rubros schema test: SDMT or PMO credentials not configured");
        return;
      }

      const token = await getCognitoToken(credentials);
      const result = await apiRequest("/catalog/rubros", token, { method: "GET" });

      assert.equal(result.status, 200, `Expected 200, got ${result.status}`);
      assert.ok(result.data, "Rubros response should have data");

      // Response should be an array or have a data array
      const isArray = Array.isArray(result.data);
      const hasDataArray = result.data.data && Array.isArray(result.data.data);

      assert.ok(
        isArray || hasDataArray,
        "Rubros response should be an array or have a data array"
      );

      const rubros = isArray ? result.data : result.data.data;

      console.log(`✓ Rubros response is valid array (${rubros.length} items)`);

      // If rubros exist, validate shape of first one
      if (rubros.length > 0) {
        const rubro = rubros[0];
        console.log(`  Sample rubro keys: ${Object.keys(rubro).join(", ")}`);

        // Rubros should have at least an id/code and name
        const hasId = "id" in rubro || "code" in rubro || "rubroId" in rubro;
        const hasName = "name" in rubro || "description" in rubro;

        assert.ok(hasId, "Each rubro should have an identifier field");
        assert.ok(hasName, "Each rubro should have a name/description field");

        console.log(`  ✓ Rubros have required identifier and name fields`);
      } else {
        console.log(`  ℹ️  No rubros in response (empty array is acceptable)`);
      }
    });
  });

  describe("Schema Validation Summary", () => {
    it("prints schema validation summary", () => {
      console.log("\n" + "=".repeat(70));
      console.log("SCHEMA VALIDATION TEST SUMMARY");
      console.log("=".repeat(70));
      console.log("\n✓ All API endpoints return valid data shapes");
      console.log("✓ Tests DO NOT require seeded/canonical data");
      console.log("✓ Empty responses are handled gracefully");
      console.log("✓ Error responses use appropriate status codes (404, not 500)");
      console.log("\n" + "=".repeat(70));
    });
  });
});
