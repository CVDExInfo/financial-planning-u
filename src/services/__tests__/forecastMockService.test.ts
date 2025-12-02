import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMockForecastData, isMockModeEnabled, mockDelay } from "../forecastMockService";

describe("forecastMockService", () => {
  describe("getMockForecastData", () => {
    it("returns forecast data for known project ID", () => {
      const result = getMockForecastData("PROJ-2024-001", 12);
      
      assert.ok(result.data, "Should return data array");
      assert.ok(Array.isArray(result.data), "Data should be an array");
      assert.equal(result.projectId, "PROJ-2024-001", "Should return correct project ID");
      assert.equal(result.months, 12, "Should return correct months");
      assert.ok(result.generated_at, "Should have generated_at timestamp");
    });

    it("returns forecast data for fintech project", () => {
      const result = getMockForecastData("fintech-mvp", 12);
      
      assert.ok(result.data, "Should return data array");
      assert.equal(result.projectId, "fintech-mvp", "Should return correct project ID");
    });

    it("returns forecast data for retail project", () => {
      const result = getMockForecastData("retail-portal", 12);
      
      assert.ok(result.data, "Should return data array");
      assert.equal(result.projectId, "retail-portal", "Should return correct project ID");
    });

    it("returns default data for unknown project ID", () => {
      const result = getMockForecastData("unknown-project", 12);
      
      assert.ok(result.data, "Should return data array");
      assert.ok(result.data.length > 0, "Should have some data");
      assert.equal(result.projectId, "unknown-project", "Should return requested project ID");
    });

    it("filters data to requested period", () => {
      const result = getMockForecastData("PROJ-2024-001", 6);
      
      assert.ok(result.data, "Should return data array");
      assert.equal(result.months, 6, "Should return correct months");
      
      // All cells should be for months 1-6
      const allWithinPeriod = result.data.every(cell => cell.month <= 6);
      assert.ok(allWithinPeriod, "All cells should be within requested period");
    });

    it("returns valid forecast cell structure", () => {
      const result = getMockForecastData("PROJ-2024-001", 12);
      
      assert.ok(result.data.length > 0, "Should have data");
      
      const firstCell = result.data[0];
      assert.ok(firstCell.line_item_id, "Should have line_item_id");
      assert.ok(typeof firstCell.month === "number", "Should have numeric month");
      assert.ok(typeof firstCell.planned === "number", "Should have numeric planned");
      assert.ok(typeof firstCell.forecast === "number", "Should have numeric forecast");
      assert.ok(typeof firstCell.actual === "number", "Should have numeric actual");
      assert.ok(typeof firstCell.variance === "number", "Should have numeric variance");
      assert.ok(firstCell.last_updated, "Should have last_updated timestamp");
      assert.ok(firstCell.updated_by, "Should have updated_by");
    });
  });

  describe("mockDelay", () => {
    it("resolves after specified delay", async () => {
      const start = Date.now();
      await mockDelay(100);
      const elapsed = Date.now() - start;
      
      // Allow some tolerance for timing
      assert.ok(elapsed >= 90, `Should wait at least 90ms (waited ${elapsed}ms)`);
      assert.ok(elapsed < 200, `Should not wait more than 200ms (waited ${elapsed}ms)`);
    });

    it("uses default delay when not specified", async () => {
      const start = Date.now();
      await mockDelay();
      const elapsed = Date.now() - start;
      
      // Default is 200ms
      assert.ok(elapsed >= 180, `Should wait at least 180ms (waited ${elapsed}ms)`);
      assert.ok(elapsed < 300, `Should not wait more than 300ms (waited ${elapsed}ms)`);
    });
  });
});
