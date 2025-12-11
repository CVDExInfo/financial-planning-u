/**
 * Unit tests for demo scenarios and seed builders
 */

import {
  generateMonthSeries,
  applyVariance,
  DEMO_SCENARIOS,
} from "../../src/seed/demo/finzDemoScenarios";
import {
  buildDemoProjectItems,
  buildDemoBaselineItems,
  buildDemoAllocationItems,
  buildDemoPayrollActuals,
  buildAllDemoRecords,
} from "../../src/seed/demo/finzDemoSeedBuilders";

describe("Demo Scenarios - Helper Functions", () => {
  describe("generateMonthSeries", () => {
    it("should generate correct number of months", () => {
      const months = generateMonthSeries("2025-01", 12);
      expect(months).toHaveLength(12);
    });

    it("should start with the correct month", () => {
      const months = generateMonthSeries("2025-01", 12);
      expect(months[0]).toBe("2025-01");
    });

    it("should end with the correct month for 12 months", () => {
      const months = generateMonthSeries("2025-01", 12);
      expect(months[11]).toBe("2025-12");
    });

    it("should handle year transitions", () => {
      const months = generateMonthSeries("2024-11", 4);
      expect(months).toEqual(["2024-11", "2024-12", "2025-01", "2025-02"]);
    });

    it("should generate 60 months correctly", () => {
      const months = generateMonthSeries("2025-01", 60);
      expect(months).toHaveLength(60);
      expect(months[0]).toBe("2025-01");
      expect(months[59]).toBe("2029-12");
    });

    it("should format months with leading zeros", () => {
      const months = generateMonthSeries("2025-01", 3);
      expect(months[0]).toBe("2025-01");
      expect(months[1]).toBe("2025-02");
      expect(months[2]).toBe("2025-03");
    });
  });

  describe("applyVariance", () => {
    it("should apply variance pattern correctly", () => {
      const plan = 100000;
      const pattern = [0.9, 1.0, 1.1];

      expect(applyVariance(plan, 0, pattern)).toBe(90000);
      expect(applyVariance(plan, 1, pattern)).toBe(100000);
      expect(applyVariance(plan, 2, pattern)).toBe(110000);
    });

    it("should cycle pattern when monthIndex exceeds pattern length", () => {
      const plan = 100000;
      const pattern = [0.9, 1.0, 1.1];

      // Index 3 should cycle to index 0
      expect(applyVariance(plan, 3, pattern)).toBe(90000);
      // Index 4 should cycle to index 1
      expect(applyVariance(plan, 4, pattern)).toBe(100000);
      // Index 5 should cycle to index 2
      expect(applyVariance(plan, 5, pattern)).toBe(110000);
    });

    it("should round to nearest integer", () => {
      const plan = 100001;
      const pattern = [0.97];

      const result = applyVariance(plan, 0, pattern);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBe(97001);
    });

    it("should handle zero plan", () => {
      const plan = 0;
      const pattern = [1.5];

      expect(applyVariance(plan, 0, pattern)).toBe(0);
    });
  });
});

describe("Demo Scenarios - Scenario Definitions", () => {
  it("should have 5 demo scenarios", () => {
    expect(DEMO_SCENARIOS).toHaveLength(5);
  });

  it("should have correct project IDs", () => {
    const projectIds = DEMO_SCENARIOS.map((s) => s.projectId);
    expect(projectIds).toContain("P-CLOUD-ECOPETROL");
    expect(projectIds).toContain("P-DATACENTER-ETB");
    expect(projectIds).toContain("P-SDWAN-BANCOLOMBIA");
    expect(projectIds).toContain("P-WIFI-ELDORADO");
    expect(projectIds).toContain("P-SOC-MULTICLIENT");
  });

  it("should have correct durations", () => {
    const cloudOps = DEMO_SCENARIOS.find((s) => s.projectId === "P-CLOUD-ECOPETROL");
    expect(cloudOps?.durationMonths).toBe(60);

    const datacenter = DEMO_SCENARIOS.find((s) => s.projectId === "P-DATACENTER-ETB");
    expect(datacenter?.durationMonths).toBe(48);

    const wifi = DEMO_SCENARIOS.find((s) => s.projectId === "P-WIFI-ELDORADO");
    expect(wifi?.durationMonths).toBe(24);
  });

  it("should have monthly plans matching duration", () => {
    for (const scenario of DEMO_SCENARIOS) {
      expect(scenario.baselineModMonthlyPlan).toHaveLength(scenario.durationMonths);
    }
  });

  it("should have valid rubro splits that sum to 100%", () => {
    for (const scenario of DEMO_SCENARIOS) {
      const sum = Object.values(scenario.rubroSplit).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });

  it("should have non-zero modTotal", () => {
    for (const scenario of DEMO_SCENARIOS) {
      expect(scenario.modTotal).toBeGreaterThan(0);
    }
  });

  it("should have variance patterns", () => {
    for (const scenario of DEMO_SCENARIOS) {
      expect(scenario.actualVariancePattern.length).toBeGreaterThan(0);
    }
  });

  it("should calculate correct modTotal", () => {
    const cloudOps = DEMO_SCENARIOS.find((s) => s.projectId === "P-CLOUD-ECOPETROL");
    if (cloudOps) {
      const calculatedTotal = cloudOps.baselineModMonthlyPlan.reduce(
        (sum, { amount }) => sum + amount,
        0
      );
      expect(cloudOps.modTotal).toBe(calculatedTotal);
    }
  });
});

describe("Demo Seed Builders", () => {
  const testScenario = DEMO_SCENARIOS[0]; // Use P-CLOUD-ECOPETROL

  describe("buildDemoProjectItems", () => {
    it("should build exactly one project record", () => {
      const items = buildDemoProjectItems(testScenario);
      expect(items).toHaveLength(1);
    });

    it("should have correct pk/sk format", () => {
      const items = buildDemoProjectItems(testScenario);
      expect(items[0].pk).toBe(`PROJECT#${testScenario.projectId}`);
      expect(items[0].sk).toBe("METADATA");
    });

    it("should include all required fields", () => {
      const items = buildDemoProjectItems(testScenario);
      const project = items[0];

      expect(project.projectId).toBe(testScenario.projectId);
      expect(project.name).toBe(testScenario.name);
      expect(project.client).toBe(testScenario.client);
      expect(project.currency).toBe(testScenario.currency);
      expect(project.modTotal).toBe(testScenario.modTotal);
      expect(project.sdmManagerEmail).toBe(testScenario.sdmManagerEmail);
    });

    it("should calculate correct endDate", () => {
      const items = buildDemoProjectItems(testScenario);
      const project = items[0];

      expect(project.startDate).toBe("2025-01-01");
      expect(project.endDate).toBeDefined();
      // 60 months from 2025-01-01 should end in 2029-12
      expect(project.endDate).toContain("2029-12");
    });
  });

  describe("buildDemoBaselineItems", () => {
    it("should build exactly two items (baseline + handoff)", () => {
      const items = buildDemoBaselineItems(testScenario);
      expect(items).toHaveLength(2);
    });

    it("should have correct pk/sk formats", () => {
      const items = buildDemoBaselineItems(testScenario);

      // Baseline record
      const baseline = items.find((i) => i.pk.startsWith("BASELINE#"));
      expect(baseline?.pk).toBe(`BASELINE#${testScenario.baselineId}`);
      expect(baseline?.sk).toBe("METADATA");

      // Handoff record
      const handoff = items.find((i) => i.pk.startsWith("PROJECT#"));
      expect(handoff?.pk).toBe(`PROJECT#${testScenario.projectId}`);
      expect(handoff?.sk).toBe("HANDOFF");
    });

    it("should include modTotal in handoff", () => {
      const items = buildDemoBaselineItems(testScenario);
      const handoff = items.find((i) => i.sk === "HANDOFF") as any;

      expect(handoff?.mod_total).toBe(testScenario.modTotal);
    });
  });

  describe("buildDemoAllocationItems", () => {
    it("should generate allocations for all months and rubros", () => {
      const items = buildDemoAllocationItems(testScenario);

      const expectedCount =
        testScenario.durationMonths * Object.keys(testScenario.rubroSplit).length;
      expect(items).toHaveLength(expectedCount);
    });

    it("should have correct pk/sk format", () => {
      const items = buildDemoAllocationItems(testScenario);
      const firstItem = items[0];

      expect(firstItem.pk).toBe(`PROJECT#${testScenario.projectId}`);
      expect(firstItem.sk).toMatch(/^ALLOC#\d{4}-\d{2}#alloc_/);
    });

    it("should sum to monthly plan (within rounding tolerance)", () => {
      const items = buildDemoAllocationItems(testScenario);

      // Group by month
      const byMonth: Record<string, number> = {};
      for (const item of items) {
        if (!byMonth[item.month]) {
          byMonth[item.month] = 0;
        }
        byMonth[item.month] += item.planned;
      }

      // Check first month
      const firstMonth = testScenario.baselineModMonthlyPlan[0];
      const allocatedTotal = byMonth[firstMonth.month];

      // Allow ±1 per rubro due to rounding
      const tolerance = Object.keys(testScenario.rubroSplit).length;
      expect(Math.abs(allocatedTotal - firstMonth.amount)).toBeLessThanOrEqual(tolerance);
    });

    it("should have non-zero amounts", () => {
      const items = buildDemoAllocationItems(testScenario);

      for (const item of items) {
        expect(item.planned).toBeGreaterThan(0);
      }
    });

    it("should link to baseline", () => {
      const items = buildDemoAllocationItems(testScenario);

      for (const item of items) {
        expect(item.baselineId).toBe(testScenario.baselineId);
      }
    });
  });

  describe("buildDemoPayrollActuals", () => {
    it("should generate payroll for all months and rubros", () => {
      const items = buildDemoPayrollActuals(testScenario);

      const expectedCount =
        testScenario.durationMonths * Object.keys(testScenario.rubroSplit).length;
      expect(items).toHaveLength(expectedCount);
    });

    it("should have correct pk/sk format", () => {
      const items = buildDemoPayrollActuals(testScenario);
      const firstItem = items[0];

      expect(firstItem.pk).toBe(`PROJECT#${testScenario.projectId}`);
      expect(firstItem.sk).toMatch(/^PAYROLL#\d{4}-\d{2}#payroll_/);
    });

    it("should apply variance to actuals", () => {
      const items = buildDemoPayrollActuals(testScenario);

      // Group by month
      const byMonth: Record<string, number> = {};
      for (const item of items) {
        if (!byMonth[item.month]) {
          byMonth[item.month] = 0;
        }
        byMonth[item.month] += item.amount;
      }

      // Check that actuals are different from plan (due to variance)
      const firstMonth = testScenario.baselineModMonthlyPlan[0];
      const actualTotal = byMonth[firstMonth.month];

      // With variance pattern [0.97, 1.02, 1.04, ...], first month should be ~0.97 of plan
      const expectedActual = Math.round(firstMonth.amount * 0.97);
      const tolerance = Object.keys(testScenario.rubroSplit).length;

      expect(Math.abs(actualTotal - expectedActual)).toBeLessThanOrEqual(tolerance);
    });

    it("should have non-zero amounts", () => {
      const items = buildDemoPayrollActuals(testScenario);

      for (const item of items) {
        expect(item.amount).toBeGreaterThan(0);
      }
    });

    it("should have kind=actual", () => {
      const items = buildDemoPayrollActuals(testScenario);

      for (const item of items) {
        expect(item.kind).toBe("actual");
      }
    });
  });

  describe("buildAllDemoRecords", () => {
    it("should build all record types", () => {
      const records = buildAllDemoRecords(testScenario);

      expect(records.projects).toHaveLength(1);
      expect(records.baselines).toHaveLength(2);
      expect(records.allocations.length).toBeGreaterThan(0);
      expect(records.payrolls.length).toBeGreaterThan(0);
    });

    it("should have matching counts for allocations and payrolls", () => {
      const records = buildAllDemoRecords(testScenario);

      expect(records.allocations).toHaveLength(records.payrolls.length);
    });
  });
});
