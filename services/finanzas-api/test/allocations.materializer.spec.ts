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

    const result = await materializeAllocationsForBaseline(baseline, { dryRun: false });

    // Verify the result
    expect(result.allocationsAttempted).toBe(36);
    expect(result.allocationsWritten).toBe(36);
    expect(result.allocationsSkipped).toBe(0);

    // Verify DynamoDB was called
    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    expect(batchCalls.length).toBeGreaterThan(0);

    // Collect all allocations from batch calls
    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    expect(allAllocations).toHaveLength(36);

    // Verify structure of first allocation
    const firstAllocation = allAllocations[0].PutRequest.Item;
    expect(firstAllocation.pk).toBe("PROJECT#P-12345");
    expect(firstAllocation.sk).toMatch(/^ALLOCATION#base_cb688dbe#MOD-ING#\d{4}-\d{2}$/);
    expect(firstAllocation.projectId).toBe("P-12345");
    expect(firstAllocation.baselineId).toBe("base_cb688dbe");
    expect(firstAllocation.rubro_id).toBe("MOD-ING");
    expect(firstAllocation.month).toMatch(/^\d{4}-\d{2}$/);
    expect(firstAllocation.month_index).toBeGreaterThan(0);
    expect(firstAllocation.month_index).toBeLessThanOrEqual(36);
    expect(firstAllocation.source).toBe("baseline_materializer");
    expect(firstAllocation.line_item_id).toBeDefined();
    expect(firstAllocation.amount).toBeCloseTo(10000, 0); // ~$10k per month
    expect(firstAllocation.createdAt).toBeDefined();

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
          rubroId: "MOD-DEV",
          role: "Developer",
          periodic: "recurring",
          total_cost: 180000,
        },
      ],
    };

    // First run: no existing allocations
    (batchGetExistingItems as jest.Mock).mockResolvedValue([]);

    const firstRun = await materializeAllocationsForBaseline(baseline, { dryRun: false });
    expect(firstRun.allocationsAttempted).toBe(36);
    expect(firstRun.allocationsWritten).toBe(36);
    expect(firstRun.allocationsSkipped).toBe(0);

    // Reset mock
    (ddb.send as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockReset();

    // Second run: simulate all allocations already exist
    // Build existing items matching the SK pattern
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
        sk: `ALLOCATION#base_idempotent#MOD-DEV#${calendarMonth}`,
      });
    }

    (batchGetExistingItems as jest.Mock).mockResolvedValue(existingAllocations);

    const secondRun = await materializeAllocationsForBaseline(baseline, { dryRun: false });
    expect(secondRun.allocationsAttempted).toBe(36);
    expect(secondRun.allocationsWritten).toBe(0); // All skipped
    expect(secondRun.allocationsSkipped).toBe(36);

    // Verify BatchWriteCommand was NOT called in second run
    const batchWriteCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });
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
          rubroId: "MOD-ARCH",
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
        if (command.constructor.name === "QueryCommand" || command.input?.KeyConditionExpression) {
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

    // Verify SK format
    const skPattern = /^ALLOCATION#base_deterministic#MOD-ARCH#\d{4}-\d{2}$/;
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

    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    // Verify M13 = Jan 2026
    const month13 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 13);
    expect(month13?.PutRequest.Item.month).toBe("2026-01");

    // Verify M24 = Dec 2026
    const month24 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 24);
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
          rubroId: "MOD-LONG",
          role: "Long-term",
          periodic: "recurring",
          total_cost: 600000,
        },
      ],
    };

    const result = await materializeAllocationsForBaseline(baseline, { dryRun: false });

    expect(result.allocationsAttempted).toBe(60);
    expect(result.allocationsWritten).toBe(60);

    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    expect(allAllocations).toHaveLength(60);

    // Verify M60 = Dec 2029
    const month60 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 60);
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
              rubroId: "MOD-NEST",
              role: "EngineerNested",
              periodic: "recurring",
              total_cost: 360000
            }
          ],
          non_labor_estimates: []
        }
      }
    };

    // Reset mocks
    (ddb.send as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockResolvedValue([]);
    (ddb.send as jest.Mock).mockImplementation((command: any) => Promise.resolve({}));

    const result = await materializeAllocationsForBaseline(baseline as any, { dryRun: false });

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

  it("writes allocations with pk PROJECT#projectId", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_pk_test",
      project_id: "P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7",
      start_date: "2025-01-01",
      duration_months: 12,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-pk-test",
          rubroId: "MOD-TEST-PK",
          role: "Engineer",
          periodic: "recurring",
          total_cost: 120000,
        },
      ],
    };

    await materializeAllocationsForBaseline(baseline, { dryRun: false });

    // Get all batch write calls
    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    expect(batchCalls.length).toBeGreaterThan(0);

    // Collect all allocations written
    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    expect(allAllocations.length).toBe(12);

    // Verify EVERY allocation has correct PK format
    allAllocations.forEach((allocation: any) => {
      const item = allocation.PutRequest.Item;
      
      // Assert PK matches PROJECT#<projectId> format
      expect(item.pk).toBe("PROJECT#P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7");
      
      // Assert SK matches ALLOCATION#<baselineId>#<rubroId>#<month> format
      expect(item.sk).toMatch(/^ALLOCATION#base_pk_test#MOD-TEST-PK#\d{4}-\d{2}$/);
      
      // Verify other required fields
      expect(item.projectId).toBe("P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7");
      expect(item.baselineId).toBe("base_pk_test");
      expect(item.rubro_id).toBe("MOD-TEST-PK");
      expect(item.month).toMatch(/^\d{4}-\d{2}$/);
      expect(item.month_index).toBeGreaterThan(0);
      expect(item.month_index).toBeLessThanOrEqual(12);
      expect(item.source).toBe("baseline_materializer");
    });
  });

  it("SK format matches expected pattern for all allocations", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_sk_format",
      project_id: "P-SK-TEST",
      start_date: "2025-01-01",
      duration_months: 6,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-1",
          rubroId: "MOD-DEV",
          role: "Developer",
          periodic: "recurring",
          total_cost: 60000,
        },
      ],
      non_labor_estimates: [
        {
          id: "nonlabor-1",
          rubroId: "INFRA-CLOUD",
          category: "Infrastructure",
          description: "Cloud Services",
          amount: 1000,
          recurring: true,
        },
      ],
    };

    await materializeAllocationsForBaseline(baseline, { dryRun: false });

    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    // 6 months * 2 line items = 12 allocations
    expect(allAllocations.length).toBe(12);

    // Verify SK format regex for all allocations
    const skPattern = /^ALLOCATION#[^#]+#[^#]+#\d{4}-\d{2}$/;
    allAllocations.forEach((allocation: any) => {
      const item = allocation.PutRequest.Item;
      expect(item.sk).toMatch(skPattern);
      
      // Also verify the SK parts are consistent
      const skParts = item.sk.split('#');
      expect(skParts[0]).toBe("ALLOCATION");
      expect(skParts[1]).toBe("base_sk_format");
      expect(skParts[2]).toMatch(/^(MOD-DEV|INFRA-CLOUD)$/);
      expect(skParts[3]).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
