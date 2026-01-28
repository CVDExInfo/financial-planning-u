import { jest } from "@jest/globals";
import { materializeAllocationsForBaseline } from "../src/lib/materializers";
import { ddb } from "../src/lib/dynamo";
import { batchGetExistingItems } from "../src/lib/dynamodbHelpers";

jest.mock("../src/lib/dynamo", () => {
  return {
    ddb: { send: jest.fn() },
    tableName: (key: string) => `mock_${key}`,
  };
});

jest.mock("../src/lib/dynamodbHelpers", () => {
  return {
    batchGetExistingItems: jest.fn().mockResolvedValue([]),
  };
});

jest.mock("../src/utils/logging", () => ({
  logError: jest.fn(),
}));

type BaselineStub = {
  baseline_id: string;
  project_id: string;
  start_date?: string;
  duration_months?: number;
  currency?: string;
  labor_estimates?: any[];
  non_labor_estimates?: any[];
  payload?: any;
};

/**
 * Helper to extract allocations from DynamoDB mock batch write calls
 */
const extractAllocationsFromBatchCalls = (
  ddbSendMock: jest.Mock
): any[] => {
  const batchCalls = ddbSendMock.mock.calls.filter((call) => {
    const command = call[0];
    return command?.input?.RequestItems?.mock_allocations;
  });

  return batchCalls.flatMap((call) => {
    const command = call[0] as { input?: any };
    return command?.input?.RequestItems?.mock_allocations || [];
  });
};

describe("Allocations Materializer (M1..M60)", () => {
  beforeEach(() => {
    (ddb.send as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockReset();

    // Default: no existing items
    (batchGetExistingItems as jest.Mock).mockResolvedValue([]);

    // Mock DynamoDB send for BatchWriteCommand
    (ddb.send as jest.Mock).mockImplementation((command: any) => {
      return Promise.resolve({});
    });
  });

  it("normalizes projectId values that already include PROJECT# prefix", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_prefixed",
      project_id: "PROJECT#P-PREFIXED",
      start_date: "2025-01-01",
      duration_months: 12,
      labor_estimates: [
        {
          id: "labor-prefixed",
          rubroId: "MOD-ING",
          total_cost: 120000,
        },
      ],
    };

    await materializeAllocationsForBaseline(baseline, { dryRun: false });

    const allocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

    expect(allocations.length).toBeGreaterThan(0);
    allocations.forEach((entry: any) => {
      expect(entry.PutRequest.Item.pk).toBe("PROJECT#P-PREFIXED");
    });
  });

  it("throws when projectId is missing from baseline", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_missing_project",
      project_id: undefined as any,
      start_date: "2025-01-01",
      duration_months: 6,
      labor_estimates: [],
      non_labor_estimates: [],
    };

    await expect(
      materializeAllocationsForBaseline(baseline, { dryRun: false })
    ).rejects.toThrow(/projectId/);
  });

  it("materializes allocations for 36-month baseline", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_cb688dbe",
      project_id: "P-12345",
      start_date: "2025-01-01",
      duration_months: 36,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-1",
          rubroId: "MOD-ING",
          role: "Engineer",
          periodic: "recurring",
          total_cost: 360000, // $10k/month for 36 months
        },
      ],
    };

    const result = await materializeAllocationsForBaseline(baseline, {
      dryRun: false,
    });

    // Verify the result
    expect(result.allocationsAttempted).toBe(36);
    expect(result.allocationsWritten).toBe(36);
    expect(result.allocationsSkipped).toBe(0);

    // Verify DynamoDB was called
    const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

    expect(allAllocations).toHaveLength(36);

    // Verify structure of first allocation
    const firstAllocation = allAllocations[0].PutRequest.Item;
    expect(firstAllocation.pk).toBe("PROJECT#P-12345");
    expect(firstAllocation.sk).toMatch(
      /^ALLOCATION#base_cb688dbe#\d{4}-\d{2}#MOD-ING$/
    );
    expect(firstAllocation.projectId).toBe("P-12345");
    expect(firstAllocation.project_id).toBe("P-12345");
    expect(firstAllocation.baselineId).toBe("base_cb688dbe");
    expect(firstAllocation.baseline_id).toBe("base_cb688dbe");
    expect(firstAllocation.rubro_id).toBe("MOD-ING");
    expect(firstAllocation.month).toMatch(/^\d{4}-\d{2}$/);
    expect(firstAllocation.calendar_month).toMatch(/^\d{4}-\d{2}$/);
    expect(firstAllocation.month_index).toBeGreaterThan(0);
    expect(firstAllocation.month_index).toBeLessThanOrEqual(36);
    expect(firstAllocation.allocation_type).toBe("planned");
    expect(firstAllocation.source).toBe("baseline_materializer");
    expect(firstAllocation.line_item_id).toBeDefined();
    expect(firstAllocation.amount).toBeCloseTo(10000, 0); // ~$10k per month
    expect(firstAllocation.createdAt).toBeDefined();
    expect(firstAllocation.updatedAt).toBeDefined();

    // Verify month progression
    const months = allAllocations.map((a: any) => a.PutRequest.Item.month);
    expect(months[0]).toBe("2025-01");
    expect(months[11]).toBe("2025-12");
    expect(months[12]).toBe("2026-01"); // M13 = Jan 2026
    expect(months[35]).toBe("2027-12"); // M36 = Dec 2027
  });

  it("ensures idempotency: second run skips existing allocations", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_idempotent",
      project_id: "P-67890",
      start_date: "2025-01-01",
      duration_months: 36,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-2",
          rubroId: "MOD-ING",
          role: "Developer",
          periodic: "recurring",
          total_cost: 180000,
        },
      ],
    };

    // First run: no existing allocations
    (batchGetExistingItems as jest.Mock).mockResolvedValue([]);

    const firstRun = await materializeAllocationsForBaseline(baseline, {
      dryRun: false,
    });
    expect(firstRun.allocationsAttempted).toBe(36);
    expect(firstRun.allocationsWritten).toBe(36);
    expect(firstRun.allocationsSkipped).toBe(0);

    // Reset mock
    (ddb.send as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockReset();

    // Second run: simulate all allocations already exist
    // Build existing items matching the SK pattern: ALLOCATION#{baselineId}#{month}#{rubroId}
    const existingAllocations: any[] = [];
    const startDate = new Date("2025-01-01");
    for (let i = 0; i < 36; i++) {
      const monthDate = new Date(startDate);
      monthDate.setUTCMonth(monthDate.getUTCMonth() + i);
      const year = monthDate.getUTCFullYear();
      const month = String(monthDate.getUTCMonth() + 1).padStart(2, "0");
      const calendarMonth = `${year}-${month}`;

      existingAllocations.push({
        pk: "PROJECT#P-67890",
        sk: `ALLOCATION#base_idempotent#${calendarMonth}#MOD-ING`,
      });
    }

    (batchGetExistingItems as jest.Mock).mockResolvedValue(existingAllocations);

    const secondRun = await materializeAllocationsForBaseline(baseline, {
      dryRun: false,
    });
    expect(secondRun.allocationsAttempted).toBe(36);
    expect(secondRun.allocationsWritten).toBe(0); // All skipped
    expect(secondRun.allocationsSkipped).toBe(36);

    // Verify BatchWriteCommand was NOT called in second run
    const batchWriteCalls = (ddb.send as jest.Mock).mock.calls.filter(
      (call) => {
        const command = call[0];
        return command?.input?.RequestItems?.mock_allocations;
      }
    );
    expect(batchWriteCalls.length).toBe(0);
  });

  it("uses deterministic SKs for idempotency", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_deterministic",
      project_id: "P-ABCDE",
      start_date: "2025-06-15",
      duration_months: 12,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-3",
          rubroId: "MOD-LEAD",
          role: "Architect",
          periodic: "recurring",
          total_cost: 120000,
        },
      ],
    };

    // Run twice with fresh mocks
    for (let run = 0; run < 2; run++) {
      (ddb.send as jest.Mock).mockReset();
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (
          command.constructor.name === "QueryCommand" ||
          command.input?.KeyConditionExpression
        ) {
          return Promise.resolve({ Items: [] });
        }
        return Promise.resolve({});
      });

      await materializeAllocationsForBaseline(baseline, { dryRun: false });
    }

    // Collect all SKs from both runs
    const allCalls = (ddb.send as jest.Mock).mock.calls;
    const allSKs = allCalls
      .filter((call) => {
        const command = call[0];
        return command?.input?.RequestItems?.mock_allocations;
      })
      .flatMap((call) => {
        const command = call[0] as { input?: any };
        const items = command?.input?.RequestItems?.mock_allocations || [];
        return items.map((entry: any) => entry.PutRequest.Item.sk);
      });

    // Verify same SKs appear in both runs
    const uniqueSKs = new Set(allSKs);
    expect(uniqueSKs.size).toBe(12); // 12 months

    // Verify SK format: ALLOCATION#{baselineId}#{month}#{rubroId}
    const skPattern = /^ALLOCATION#base_deterministic#\d{4}-\d{2}#MOD-LEAD$/;
    allSKs.forEach((sk: string) => {
      expect(sk).toMatch(skPattern);
    });
  });

  it("handles M13+ calendar month computation correctly", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_m13plus",
      project_id: "P-M13TEST",
      start_date: "2025-01-01", // Jan 2025
      duration_months: 24,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-4",
          rubroId: "MOD-TEST",
          role: "Tester",
          periodic: "recurring",
          total_cost: 240000,
        },
      ],
    };

    await materializeAllocationsForBaseline(baseline, { dryRun: false });

    const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

    // Verify M13 = Jan 2026
    const month13 = allAllocations.find(
      (a: any) => a.PutRequest.Item.month_index === 13
    );
    expect(month13?.PutRequest.Item.month).toBe("2026-01");

    // Verify M24 = Dec 2026
    const month24 = allAllocations.find(
      (a: any) => a.PutRequest.Item.month_index === 24
    );
    expect(month24?.PutRequest.Item.month).toBe("2026-12");
  });

  it("supports up to M60 (5 years)", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_m60",
      project_id: "P-M60TEST",
      start_date: "2025-01-01",
      duration_months: 60,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-5",
          rubroId: "MOD-ING",
          role: "Long-term",
          periodic: "recurring",
          total_cost: 600000,
        },
      ],
    };

    const result = await materializeAllocationsForBaseline(baseline, {
      dryRun: false,
    });

    expect(result.allocationsAttempted).toBe(60);
    expect(result.allocationsWritten).toBe(60);

    const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

    expect(allAllocations).toHaveLength(60);

    // Verify M60 = Dec 2029
    const month60 = allAllocations.find(
      (a: any) => a.PutRequest.Item.month_index === 60
    );
    expect(month60?.PutRequest.Item.month).toBe("2029-12");
  });

  it("materializes allocations when estimates are nested under payload.payload", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_nested_payload",
      project_id: "P-NEST",
      // no top-level start_date/duration; included inside payload.payload
      currency: "USD",
      payload: {
        payload: {
          start_date: "2025-01-01",
          duration_months: 36,
          labor_estimates: [
            {
              id: "labor-nested-1",
              rubroId: "MOD-ING",
              role: "EngineerNested",
              periodic: "recurring",
              total_cost: 360000,
            },
          ],
          non_labor_estimates: [],
        },
      },
    };

    // Reset mocks
    (ddb.send as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockResolvedValue([]);
    (ddb.send as jest.Mock).mockImplementation((command: any) =>
      Promise.resolve({})
    );

    const result = await materializeAllocationsForBaseline(baseline as any, {
      dryRun: false,
    });

    expect(result.allocationsAttempted).toBe(36);
    expect(result.allocationsWritten).toBe(36);
    expect(result.allocationsSkipped).toBe(0);

    // Ensure BatchWrite happened
    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });
    expect(batchCalls.length).toBeGreaterThan(0);
  });

  describe("Labor allocation amount derivation", () => {
    it("derives monthly amount from hourly_rate + hoursPerMonth + fteCount", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_hourly",
        project_id: "P-HOURLY",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-hourly-1",
            rubroId: "MOD-DEV",
            role: "Developer",
            hourly_rate: 50, // $50/hour
            hoursPerMonth: 160, // 160 hours/month
            fteCount: 1, // 1 FTE
            // Expected: 50 * 160 * 1 = $8,000/month
          },
        ],
      };

      (ddb.send as jest.Mock).mockReset();
      (batchGetExistingItems as jest.Mock).mockResolvedValue([]);
      (ddb.send as jest.Mock).mockImplementation(() => Promise.resolve({}));

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      expect(result.allocationsAttempted).toBe(12);
      expect(result.allocationsWritten).toBe(12);

      const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Verify all allocations have amount = $8,000
      allAllocations.forEach((a: any) => {
        expect(a.PutRequest.Item.amount).toBe(8000);
        expect(a.PutRequest.Item.planned).toBe(8000);
        expect(a.PutRequest.Item.forecast).toBe(8000);
      });
    });

    it("derives monthly amount from alternative field names (tarifa_hora, hrs_mes, fte)", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_spanish_fields",
        project_id: "P-SPANISH",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-spanish-1",
            rubroId: "MOD-ING",
            role: "Engineer",
            tarifa_hora: 75, // $75/hour (Spanish field name)
            hrs_mes: 160, // 160 hours/month (Spanish field name)
            fte: 2, // 2 FTEs
            // Expected: 75 * 160 * 2 = $24,000/month
          },
        ],
      };

      (ddb.send as jest.Mock).mockReset();
      (batchGetExistingItems as jest.Mock).mockResolvedValue([]);
      (ddb.send as jest.Mock).mockImplementation(() => Promise.resolve({}));

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      expect(result.allocationsWritten).toBe(12);

      const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Verify all allocations have amount = $24,000
      allAllocations.forEach((a: any) => {
        expect(a.PutRequest.Item.amount).toBe(24000);
      });
    });

    it("derives monthly amount from total_cost divided by duration", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_total_cost",
        project_id: "P-TOTAL",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-total-1",
            rubroId: "MOD-LEAD",
            role: "Architect",
            total_cost: 180000, // $180,000 total for 12 months
            // Expected: 180000 / 12 = $15,000/month
          },
        ],
      };

      (ddb.send as jest.Mock).mockReset();
      (batchGetExistingItems as jest.Mock).mockResolvedValue([]);
      (ddb.send as jest.Mock).mockImplementation(() => Promise.resolve({}));

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      expect(result.allocationsWritten).toBe(12);

      const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Verify all allocations have amount = $15,000
      allAllocations.forEach((a: any) => {
        expect(a.PutRequest.Item.amount).toBe(15000);
      });
    });

    it("derives monthly amount from monthly_cost field", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_monthly_cost",
        project_id: "P-MONTHLY",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-monthly-1",
            rubroId: "MOD-PM",
            role: "Project Manager",
            monthly_cost: 12000, // $12,000/month directly
          },
        ],
      };

      (ddb.send as jest.Mock).mockReset();
      (batchGetExistingItems as jest.Mock).mockResolvedValue([]);
      (ddb.send as jest.Mock).mockImplementation(() => Promise.resolve({}));

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      expect(result.allocationsWritten).toBe(12);

      const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Verify all allocations have amount = $12,000
      allAllocations.forEach((a: any) => {
        expect(a.PutRequest.Item.amount).toBe(12000);
      });
    });

    it("defaults to 160 hours/month when hoursPerMonth is missing", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_default_hours",
        project_id: "P-DEFAULT-HOURS",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-default-hours-1",
            rubroId: "MOD-DEV",
            role: "Developer",
            hourly_rate: 50, // $50/hour
            // No hoursPerMonth specified - should default to 160
            fteCount: 1,
            // Expected: 50 * 160 * 1 = $8,000/month
          },
        ],
      };

      (ddb.send as jest.Mock).mockReset();
      (batchGetExistingItems as jest.Mock).mockResolvedValue([]);
      (ddb.send as jest.Mock).mockImplementation(() => Promise.resolve({}));

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      expect(result.allocationsWritten).toBe(12);

      const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      // Verify all allocations have amount = $8,000
      allAllocations.forEach((a: any) => {
        expect(a.PutRequest.Item.amount).toBe(8000);
      });
    });
  });

  describe("Idempotency with forceRewriteZeros", () => {
    it("overwrites existing zero amounts when forceRewriteZeros is true", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_force_rewrite",
        project_id: "P-FORCE-REWRITE",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-rewrite-1",
            rubroId: "MOD-ING",
            role: "Developer",
            hourly_rate: 50,
            hoursPerMonth: 160,
            fteCount: 1,
            // Will compute to $8,000/month
          },
        ],
      };

      // Simulate existing allocations with zero amounts
      const existingAllocations: any[] = [];
      const startDate = new Date("2025-01-01");
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(startDate);
        monthDate.setUTCMonth(monthDate.getUTCMonth() + i);
        const year = monthDate.getUTCFullYear();
        const month = String(monthDate.getUTCMonth() + 1).padStart(2, "0");
        const calendarMonth = `${year}-${month}`;

        existingAllocations.push({
          pk: "PROJECT#P-FORCE-REWRITE",
          sk: `ALLOCATION#base_force_rewrite#${calendarMonth}#MOD-ING`,
          amount: 0, // Zero amount that should be overwritten
          planned: 0,
          forecast: 0,
        });
      }

      (ddb.send as jest.Mock).mockReset();
      (batchGetExistingItems as jest.Mock).mockResolvedValue(existingAllocations);
      (ddb.send as jest.Mock).mockImplementation(() => Promise.resolve({}));

      // First run WITHOUT forceRewriteZeros - should skip all
      const firstRun = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
        forceRewriteZeros: false,
      });

      expect(firstRun.allocationsAttempted).toBe(12);
      expect(firstRun.allocationsWritten).toBe(0); // All skipped
      expect(firstRun.allocationsSkipped).toBe(12);

      // Reset mocks
      (ddb.send as jest.Mock).mockReset();
      (batchGetExistingItems as jest.Mock).mockResolvedValue(existingAllocations);
      (ddb.send as jest.Mock).mockImplementation(() => Promise.resolve({}));

      // Second run WITH forceRewriteZeros - should overwrite all
      const secondRun = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
        forceRewriteZeros: true,
      });

      expect(secondRun.allocationsAttempted).toBe(12);
      expect(secondRun.allocationsWritten).toBe(12); // All overwritten
      expect(secondRun.allocationsSkipped).toBe(0);

      // Verify the written allocations have non-zero amounts
      const allAllocations = extractAllocationsFromBatchCalls(ddb.send as jest.Mock);

      expect(allAllocations.length).toBe(12);
      allAllocations.forEach((a: any) => {
        expect(a.PutRequest.Item.amount).toBe(8000); // Overwritten with correct value
      });
    });

    it("does not overwrite existing positive amounts even with forceRewriteZeros", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_no_overwrite_positive",
        project_id: "P-NO-OVERWRITE",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-no-overwrite-1",
            rubroId: "MOD-ING",
            role: "Developer",
            hourly_rate: 50,
            hoursPerMonth: 160,
            fteCount: 1,
          },
        ],
      };

      // Simulate existing allocations with positive amounts
      const existingAllocations: any[] = [];
      const startDate = new Date("2025-01-01");
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(startDate);
        monthDate.setUTCMonth(monthDate.getUTCMonth() + i);
        const year = monthDate.getUTCFullYear();
        const month = String(monthDate.getUTCMonth() + 1).padStart(2, "0");
        const calendarMonth = `${year}-${month}`;

        existingAllocations.push({
          pk: "PROJECT#P-NO-OVERWRITE",
          sk: `ALLOCATION#base_no_overwrite_positive#${calendarMonth}#MOD-ING`,
          amount: 5000, // Existing positive amount
          planned: 5000,
          forecast: 5000,
        });
      }

      (ddb.send as jest.Mock).mockReset();
      (batchGetExistingItems as jest.Mock).mockResolvedValue(existingAllocations);
      (ddb.send as jest.Mock).mockImplementation(() => Promise.resolve({}));

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
        forceRewriteZeros: true,
      });

      expect(result.allocationsAttempted).toBe(12);
      expect(result.allocationsWritten).toBe(0); // None overwritten (already have positive amounts)
      expect(result.allocationsSkipped).toBe(12);
    });
  });
});
