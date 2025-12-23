// services/finanzas-api/test/baselineMaterialization.test.ts
import { jest } from "@jest/globals";
import { materializeRubrosForBaseline } from "../src/lib/materializers";

// Mock the dynamo module
jest.mock("../src/lib/dynamo", () => {
  return {
    ddb: { send: jest.fn() },
    tableName: (key: string) => `mock_${key}`,
  };
});

// Mock logging
jest.mock("../src/utils/logging", () => ({
  logError: jest.fn(),
}));

describe('Baseline Materialization', () => {
  test('materialize dry-run returns planned rubros', async () => {
    const baseline = {
      baseline_id: "baseline-123",
      project_id: "PRJ-456",
      start_date: "2025-01-01",
      duration_months: 3,
      currency: "USD",
      labor_estimates: [
        {
          rubroId: "MOD-DEV",
          name: "Senior Developer",
          unit_cost: 1000,
          quantity: 1,
          periodic: "recurring"
        }
      ],
      non_labor_estimates: [
        {
          rubroId: "GSV-CLOUD",
          name: "Cloud Services",
          unit_cost: 500,
          quantity: 1,
          periodic: "recurring"
        }
      ]
    };

    const result = await materializeRubrosForBaseline(baseline, { dryRun: true });
    
    expect(result.dryRun).toBe(true);
    expect(result.rubrosPlanned).toBeGreaterThan(0);
    expect(result.rubrosPlanned).toBe(2); // 2 line items
  });
});
