/**
 * Unit tests for baseline → SDMT alignment fixes
 * Tests the filtering and mapping functions in lib/baseline-sdmt.ts
 * 
 * Uses canonical project IDs to ensure consistency with seeded test data.
 */

import { describe, it, expect } from "@jest/globals";
import {
  filterRubrosByBaseline,
  calculateRubrosTotalCost,
  generateForecastGrid,
  type BaselineRubro,
} from "../../src/lib/baseline-sdmt";
import { CANONICAL_PROJECT_IDS, CANONICAL_BASELINE_IDS } from "../fixtures/canonical-projects";

describe("Baseline → SDMT Alignment", () => {
  // Use canonical projects for test data
  const TEST_PROJECT_ID = CANONICAL_PROJECT_IDS.NOC_CLARO;
  const TEST_BASELINE_1 = CANONICAL_BASELINE_IDS.NOC_CLARO;
  const TEST_BASELINE_2 = CANONICAL_BASELINE_IDS.SOC_BANCOL;

  describe("filterRubrosByBaseline", () => {
    it("should filter rubros by baseline_id in metadata", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "RB0001",
          nombre: "MOD Engineers - Baseline 1",
          category: "MOD",
          qty: 8,
          unit_cost: 75000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 60,
          total_cost: 36000000,
          metadata: { baseline_id: TEST_BASELINE_1, project_id: TEST_PROJECT_ID },
        },
        {
          rubroId: "RB0002",
          nombre: "MOD Tech Lead - Baseline 2",
          category: "MOD",
          qty: 1,
          unit_cost: 110000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 36,
          total_cost: 3960000,
          metadata: { baseline_id: TEST_BASELINE_2, project_id: TEST_PROJECT_ID },
        },
      ];

      const filtered = filterRubrosByBaseline(rubros, TEST_BASELINE_1);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rubroId).toBe("RB0001");
      expect(filtered[0].metadata?.baseline_id).toBe(TEST_BASELINE_1);
    });

    it("should return all rubros if baselineId is null", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "RB0001",
          nombre: "MOD Engineers",
          category: "MOD",
          qty: 8,
          unit_cost: 75000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 60,
          total_cost: 36000000,
          metadata: { baseline_id: TEST_BASELINE_1 },
        },
        {
          rubroId: "RB0002",
          nombre: "MOD Tech Lead",
          category: "MOD",
          qty: 1,
          unit_cost: 110000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 36,
          total_cost: 3960000,
          metadata: { baseline_id: TEST_BASELINE_2 },
        },
      ];

      const filtered = filterRubrosByBaseline(rubros, null);
      expect(filtered).toHaveLength(2);
    });

    it("should exclude rubros without baseline_id", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "base_123-labor-1",
          nombre: "Labor 1",
          category: "Labor",
          qty: 1,
          unit_cost: 1000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 12,
          total_cost: 12000,
          metadata: { baseline_id: "base_123" },
        },
        {
          rubroId: "legacy-labor-1",
          nombre: "Legacy Labor",
          category: "Labor",
          qty: 1,
          unit_cost: 500,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 12,
          total_cost: 6000,
          metadata: {}, // No baseline_id
        },
      ];

      const filtered = filterRubrosByBaseline(rubros, "base_123");
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rubroId).toBe("base_123-labor-1");
    });

    it("should support rubros with top-level baselineId (legacy seed data)", () => {
      const rubros = [
        {
          rubroId: "RB0001",
          nombre: "MOD Engineers",
          category: "MOD",
          qty: 8,
          unit_cost: 75000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 60,
          total_cost: 36000000,
          baselineId: TEST_BASELINE_1, // Top-level for legacy seed data
          metadata: {},
        },
        {
          rubroId: "RB0002",
          nombre: "MOD Tech Lead",
          category: "MOD",
          qty: 1,
          unit_cost: 110000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 36,
          total_cost: 3960000,
          baselineId: TEST_BASELINE_2, // Different baseline
          metadata: {},
        },
      ];

      const filtered = filterRubrosByBaseline(rubros, TEST_BASELINE_1);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rubroId).toBe("RB0001");
      expect(filtered[0].baselineId).toBe(TEST_BASELINE_1);
    });

    it("should prefer metadata.baseline_id over top-level baselineId", () => {
      const rubros = [
        {
          rubroId: "RB0001",
          nombre: "MOD Engineers",
          category: "MOD",
          qty: 8,
          unit_cost: 75000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 60,
          total_cost: 36000000,
          baselineId: "wrong-baseline", // Top-level (wrong)
          metadata: { baseline_id: TEST_BASELINE_1 }, // Metadata (correct)
        },
      ];

      const filtered = filterRubrosByBaseline(rubros, TEST_BASELINE_1);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].rubroId).toBe("RB0001");
    });

    it("should fall back to untagged rubros when no baseline match exists", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "RB001",
          nombre: "Tagged to other baseline",
          category: "Labor",
          qty: 1,
          unit_cost: 1000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 12,
          total_cost: 12000,
          metadata: { baseline_id: TEST_BASELINE_2 },
        },
        {
          rubroId: "RB002",
          nombre: "Untagged legacy",
          category: "Labor",
          qty: 1,
          unit_cost: 2000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 12,
          total_cost: 24000,
          metadata: {},
        },
      ];

      const filtered = filterRubrosByBaseline(rubros, TEST_BASELINE_1);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].rubroId).toBe("RB002");
    });
  });

  describe("calculateRubrosTotalCost", () => {
    it("should sum total_cost from all rubros", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "r1",
          nombre: "Labor 1",
          category: "Labor",
          qty: 1,
          unit_cost: 1000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 12,
          total_cost: 12000,
        },
        {
          rubroId: "r2",
          nombre: "Equipment",
          category: "Equipment",
          qty: 1,
          unit_cost: 5000,
          currency: "USD",
          recurring: false,
          one_time: true,
          start_month: 1,
          end_month: 1,
          total_cost: 5000,
        },
      ];

      const total = calculateRubrosTotalCost(rubros);
      expect(total).toBe(17000);
    });

    it("should handle zero and undefined costs", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "r1",
          nombre: "Free Item",
          category: "Other",
          qty: 1,
          unit_cost: 0,
          currency: "USD",
          recurring: false,
          one_time: true,
          start_month: 1,
          end_month: 1,
          total_cost: 0,
        },
        {
          rubroId: "r2",
          nombre: "Labor",
          category: "Labor",
          qty: 1,
          unit_cost: 1000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 12,
          total_cost: 12000,
        },
      ];

      const total = calculateRubrosTotalCost(rubros);
      expect(total).toBe(12000);
    });

    it("should return 0 for empty array", () => {
      const total = calculateRubrosTotalCost([]);
      expect(total).toBe(0);
    });
  });

  describe("generateForecastGrid", () => {
    it("should generate monthly grid for recurring items", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "labor-1",
          nombre: "Developer",
          category: "Labor",
          qty: 1,
          unit_cost: 10000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 3,
          total_cost: 30000,
        },
      ];

      const grid = generateForecastGrid(rubros, 12);
      
      // Should have 3 months (1, 2, 3)
      expect(grid).toHaveLength(3);
      
      expect(grid[0]).toMatchObject({
        line_item_id: "labor-1",
        month: 1,
        planned: 10000,
        forecast: 10000,
        actual: 0,
      });
      
      expect(grid[1].month).toBe(2);
      expect(grid[2].month).toBe(3);
    });

    it("should generate single entry for one-time items", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "equipment-1",
          nombre: "Server",
          category: "Equipment",
          qty: 1,
          unit_cost: 5000,
          currency: "USD",
          recurring: false,
          one_time: true,
          start_month: 1,
          end_month: 1,
          total_cost: 5000,
        },
      ];

      const grid = generateForecastGrid(rubros, 12);
      
      expect(grid).toHaveLength(1);
      expect(grid[0]).toMatchObject({
        line_item_id: "equipment-1",
        month: 1,
        planned: 5000,
        forecast: 5000,
        actual: 0,
      });
    });

    it("should respect month boundaries", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "labor-1",
          nombre: "Developer",
          category: "Labor",
          qty: 1,
          unit_cost: 10000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 15, // Beyond 12 months
          total_cost: 150000,
        },
      ];

      const grid = generateForecastGrid(rubros, 12);
      
      // Should cap at 12 months
      expect(grid).toHaveLength(12);
      expect(grid[grid.length - 1].month).toBe(12);
    });

    it("should handle multiple rubros", () => {
      const rubros: BaselineRubro[] = [
        {
          rubroId: "labor-1",
          nombre: "Developer",
          category: "Labor",
          qty: 1,
          unit_cost: 10000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 2,
          total_cost: 20000,
        },
        {
          rubroId: "equipment-1",
          nombre: "Server",
          category: "Equipment",
          qty: 1,
          unit_cost: 5000,
          currency: "USD",
          recurring: false,
          one_time: true,
          start_month: 1,
          end_month: 1,
          total_cost: 5000,
        },
      ];

      const grid = generateForecastGrid(rubros, 12);
      
      // 2 months for labor + 1 for equipment = 3 entries
      expect(grid).toHaveLength(3);
      
      const laborEntries = grid.filter((g) => g.line_item_id === "labor-1");
      expect(laborEntries).toHaveLength(2);
      
      const equipmentEntries = grid.filter((g) => g.line_item_id === "equipment-1");
      expect(equipmentEntries).toHaveLength(1);
    });
  });

  describe("Integration: Multiple Baselines Scenario", () => {
    it("should prevent baseline mixing in catalog totals", () => {
      // Simulate a project with 2 baselines
      const allRubros: BaselineRubro[] = [
        // Baseline 1 (accepted)
        {
          rubroId: "base_123-labor-1",
          nombre: "Developer",
          category: "Labor",
          qty: 1,
          unit_cost: 10000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 12,
          total_cost: 120000,
          metadata: { baseline_id: "base_123", project_id: "P-001" },
        },
        // Baseline 2 (old/rejected)
        {
          rubroId: "base_OLD-labor-1",
          nombre: "Senior Dev",
          category: "Labor",
          qty: 1,
          unit_cost: 15000,
          currency: "USD",
          recurring: true,
          one_time: false,
          start_month: 1,
          end_month: 12,
          total_cost: 180000,
          metadata: { baseline_id: "base_OLD", project_id: "P-001" },
        },
      ];

      // Filter by active baseline
      const activeRubros = filterRubrosByBaseline(allRubros, "base_123");
      const totalActive = calculateRubrosTotalCost(activeRubros);

      // Should only include base_123
      expect(activeRubros).toHaveLength(1);
      expect(totalActive).toBe(120000); // Not 300000!
      
      // If we didn't filter, we'd get wrong total
      const wrongTotal = calculateRubrosTotalCost(allRubros);
      expect(wrongTotal).toBe(300000); // This is the bug we're fixing!
    });
  });
});
