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
  start_date: string;
  duration_months: number;
  currency?: string;
  labor_estimates?: any[];
  non_labor_estimates?: any[];
};

describe("Baseline Allocations - P/F/A Model & Contract Month Alignment", () => {
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

  describe("P/F/A Schema", () => {
    it("creates allocations with planned, forecast, actual fields", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_pfa_test",
        project_id: "P-PFA-001",
        start_date: "2025-06-01",
        duration_months: 18,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-pfa-1",
            rubroId: "MOD-ING",
            role: "Engineer",
            periodic: "recurring",
            total_cost: 180000, // $10k/month for 18 months
          },
        ],
      };

      const result = await materializeAllocationsForBaseline(baseline, { dryRun: false });

      expect(result.allocationsAttempted).toBe(18);
      expect(result.allocationsWritten).toBe(18);

      // Get all allocations from batch calls
      const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
        const command = call[0];
        return command?.input?.RequestItems?.mock_allocations;
      });

      const allAllocations = batchCalls.flatMap((call) => {
        const command = call[0] as { input?: any };
        return command?.input?.RequestItems?.mock_allocations || [];
      });

      expect(allAllocations).toHaveLength(18);

      // Verify P/F/A fields on first allocation
      const firstAllocation = allAllocations[0].PutRequest.Item;
      
      // P/F/A MODEL verification
      expect(firstAllocation.planned).toBeDefined();
      expect(firstAllocation.forecast).toBeDefined();
      expect(firstAllocation.actual).toBeDefined();
      
      // Planned should equal monthly amount
      expect(firstAllocation.planned).toBeCloseTo(10000, 0);
      
      // Forecast should initially equal Planned
      expect(firstAllocation.forecast).toBe(firstAllocation.planned);
      
      // Actual should be 0 initially
      expect(firstAllocation.actual).toBe(0);
      
      // Backward compatibility: amount field should exist
      expect(firstAllocation.amount).toBe(firstAllocation.planned);
    });

    it("initializes forecast = planned for all months", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_pfa_init",
        project_id: "P-PFA-002",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        non_labor_estimates: [
          {
            id: "non-labor-1",
            rubroId: "GSV-AWS",
            category: "Cloud",
            description: "AWS Services",
            periodic: "recurring",
            total_cost: 60000, // $5k/month
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

      // Verify all 12 allocations have F == P initially
      allAllocations.forEach((alloc: any) => {
        const item = alloc.PutRequest.Item;
        expect(item.forecast).toBe(item.planned);
        expect(item.actual).toBe(0);
      });
    });
  });

  describe("Contract Month Alignment (M1..M60)", () => {
    it("aligns M1 to contract start date (June 2025)", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_m1_june",
        project_id: "P-M1-JUNE",
        start_date: "2025-06-01", // June 2025
        duration_months: 18,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-m1",
            rubroId: "MOD-LEAD",
            role: "Lead",
            periodic: "recurring",
            total_cost: 270000, // $15k/month for 18 months
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

      // M1 should be June 2025 (2025-06)
      const m1 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 1);
      expect(m1?.PutRequest.Item.month).toBe("2025-06");

      // M7 should be December 2025 (2025-12)
      const m7 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 7);
      expect(m7?.PutRequest.Item.month).toBe("2025-12");

      // M13 should be June 2026 (2026-06)
      const m13 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 13);
      expect(m13?.PutRequest.Item.month).toBe("2026-06");

      // M18 should be November 2026 (2026-11)
      const m18 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 18);
      expect(m18?.PutRequest.Item.month).toBe("2026-11");
    });

    it("handles month_index as numeric type", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_numeric_idx",
        project_id: "P-NUMERIC",
        start_date: "2025-03-15",
        duration_months: 24,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-numeric",
            rubroId: "MOD-DEV",
            role: "Developer",
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

      // Verify month_index is numeric (not string)
      allAllocations.forEach((alloc: any) => {
        const item = alloc.PutRequest.Item;
        expect(typeof item.month_index).toBe("number");
        expect(item.month_index).toBeGreaterThan(0);
        expect(item.month_index).toBeLessThanOrEqual(24);
      });
    });

    it("supports M60 with correct year rollover", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_m60_test",
        project_id: "P-M60",
        start_date: "2025-06-01", // June 2025
        duration_months: 60, // 5 years
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-m60",
            rubroId: "MOD-ING",
            role: "Long-term Engineer",
            periodic: "recurring",
            total_cost: 600000,
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

      expect(allAllocations).toHaveLength(60);

      // M1 = June 2025
      const m1 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 1);
      expect(m1?.PutRequest.Item.month).toBe("2025-06");

      // M12 = May 2026
      const m12 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 12);
      expect(m12?.PutRequest.Item.month).toBe("2026-05");

      // M24 = May 2027
      const m24 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 24);
      expect(m24?.PutRequest.Item.month).toBe("2027-05");

      // M36 = May 2028
      const m36 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 36);
      expect(m36?.PutRequest.Item.month).toBe("2028-05");

      // M48 = May 2029
      const m48 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 48);
      expect(m48?.PutRequest.Item.month).toBe("2029-05");

      // M60 = May 2030
      const m60 = allAllocations.find((a: any) => a.PutRequest.Item.month_index === 60);
      expect(m60?.PutRequest.Item.month).toBe("2030-05");
    });
  });

  describe("Baseline Metadata Integration", () => {
    it("includes baselineId in all allocation records", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_metadata_001",
        project_id: "P-META-001",
        start_date: "2025-01-01",
        duration_months: 6,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-meta",
            rubroId: "MOD-QA",
            role: "QA Engineer",
            periodic: "recurring",
            total_cost: 60000,
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

      // Verify all allocations have baselineId
      allAllocations.forEach((alloc: any) => {
        const item = alloc.PutRequest.Item;
        expect(item.baselineId).toBe("base_metadata_001");
        
        // Verify SK includes baselineId
        expect(item.sk).toMatch(/^ALLOCATION#base_metadata_001#/);
      });
    });

    it("uses deterministic SKs with baselineId for multi-baseline safety", async () => {
      // Create allocations for baseline A
      const baselineA: BaselineStub = {
        baseline_id: "base_A",
        project_id: "P-MULTI",
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-a",
            rubroId: "MOD-ING",
            role: "Role A",
            periodic: "recurring",
            total_cost: 120000,
          },
        ],
      };

      await materializeAllocationsForBaseline(baselineA, { dryRun: false });

      // Get SKs from baseline A
      let batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
        const command = call[0];
        return command?.input?.RequestItems?.mock_allocations;
      });

      const allocationsA = batchCalls.flatMap((call) => {
        const command = call[0] as { input?: any };
        return command?.input?.RequestItems?.mock_allocations || [];
      });

      const sksA = allocationsA.map((a: any) => a.PutRequest.Item.sk);

      // Reset and create allocations for baseline B (same project, different baseline)
      (ddb.send as jest.Mock).mockReset();
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        return Promise.resolve({});
      });

      const baselineB: BaselineStub = {
        baseline_id: "base_B",
        project_id: "P-MULTI", // SAME project
        start_date: "2025-01-01",
        duration_months: 12,
        currency: "USD",
        labor_estimates: [
          {
            id: "labor-b",
            rubroId: "MOD-ING", // SAME rubroId
            role: "Role A",
            periodic: "recurring",
            total_cost: 120000,
          },
        ],
      };

      await materializeAllocationsForBaseline(baselineB, { dryRun: false });

      batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
        const command = call[0];
        return command?.input?.RequestItems?.mock_allocations;
      });

      const allocationsB = batchCalls.flatMap((call) => {
        const command = call[0] as { input?: any };
        return command?.input?.RequestItems?.mock_allocations || [];
      });

      const sksB = allocationsB.map((a: any) => a.PutRequest.Item.sk);

      // Verify SKs are different (baselineId in SK prevents collision)
      expect(sksA[0]).toMatch(/^ALLOCATION#base_A#/);
      expect(sksB[0]).toMatch(/^ALLOCATION#base_B#/);
      
      // Verify no SK overlap
      const overlap = sksA.filter((sk: string) => sksB.includes(sk));
      expect(overlap).toHaveLength(0);
    });
  });
});
