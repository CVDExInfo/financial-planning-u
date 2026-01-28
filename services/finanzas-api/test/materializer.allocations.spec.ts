import { jest } from "@jest/globals";
import { materializeAllocationsForBaseline } from "../src/lib/materializers";
import { ddb } from "../src/lib/dynamo";
import { batchGetExistingItems } from "../src/lib/dynamodbHelpers";

jest.mock("../src/lib/dynamo", () => {
  return {
    ddb: { send: jest.fn() },
    tableName: (key: string) => `mock_${key}`,
    QueryCommand: class QueryCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
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

jest.mock("../src/lib/rubros-taxonomy", () => ({
  getCanonicalRubroId: jest.fn((id) => id),
  mapModRoleToRubroId: jest.fn(() => undefined),
  mapNonLaborCategoryToRubroId: jest.fn(() => undefined),
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
const extractAllocationsFromBatchCalls = (ddbSendMock: jest.Mock): any[] => {
  const batchCalls = ddbSendMock.mock.calls.filter((call) => {
    const command = call[0];
    return command?.input?.RequestItems?.mock_allocations;
  });

  return batchCalls.flatMap((call) => {
    const command = call[0] as { input?: any };
    return command?.input?.RequestItems?.mock_allocations || [];
  });
};

describe("Allocations Materializer - Rubros-based (Option A)", () => {
  beforeEach(() => {
    (ddb.send as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockReset();

    // Default: no existing items
    (batchGetExistingItems as jest.Mock).mockResolvedValue([]);

    // Mock DynamoDB send
    (ddb.send as jest.Mock).mockImplementation((command: any) => {
      // Mock QueryCommand for rubros
      if (command.constructor.name === "QueryCommand") {
        // Return empty rubros by default (tests will override this)
        return Promise.resolve({ Items: [] });
      }
      // Mock BatchWriteCommand
      return Promise.resolve({});
    });
  });

  describe("Single labor rubro with unit_cost", () => {
    it("creates allocations from a seeded labor rubro with unit_cost", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_labor_test",
        project_id: "P-LABOR-001",
        start_date: "2025-01-01",
        duration_months: 12,
      };

      // Mock rubros query to return a single labor rubro
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-LABOR-001",
                sk: "RUBRO#MOD-LEAD#base_labor_test#1",
                rubroId: "MOD-LEAD#base_labor_test#1",
                linea_codigo: "MOD-LEAD",
                nombre: "Tech Lead",
                category: "Labor",
                unit_cost: 1145.83, // monthly cost
                total_cost: 13750, // 12 months
                start_month: 1,
                end_month: 12,
                metadata: {
                  baseline_id: "base_labor_test",
                  project_id: "P-LABOR-001",
                  role: "Tech Lead",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      // Verify 12 allocations were created (M1-M12)
      expect(result.allocationsAttempted).toBe(12);
      expect(result.allocationsWritten).toBe(12);
      expect(result.allocationsSkipped).toBe(0);

      const allocations = extractAllocationsFromBatchCalls(
        ddb.send as jest.Mock
      );
      expect(allocations).toHaveLength(12);

      // Verify first allocation structure
      const firstAllocation = allocations[0].PutRequest.Item;
      expect(firstAllocation.pk).toBe("PROJECT#P-LABOR-001");
      expect(firstAllocation.sk).toMatch(
        /^ALLOCATION#base_labor_test#2025-01#MOD-LEAD$/
      );
      expect(firstAllocation.amount).toBe(1145.83);
      expect(firstAllocation.planned).toBe(1145.83);
      expect(firstAllocation.forecast).toBe(1145.83);
      expect(firstAllocation.actual).toBe(0);
      expect(firstAllocation.source).toBe("baseline_materializer");
      expect(firstAllocation.month_index).toBe(1);
      expect(firstAllocation.calendar_month).toBe("2025-01");
    });

    it("derives unit_cost from total_cost when unit_cost is not provided", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_derived",
        project_id: "P-DERIVED-001",
        start_date: "2025-06-01",
        duration_months: 6,
      };

      // Mock rubros query - rubro without unit_cost but with total_cost
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-DERIVED-001",
                sk: "RUBRO#MOD-ING#base_derived#1",
                rubroId: "MOD-ING#base_derived#1",
                linea_codigo: "MOD-ING",
                total_cost: 6000, // $1000/month for 6 months
                start_month: 1,
                end_month: 6,
                metadata: {
                  baseline_id: "base_derived",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      expect(result.allocationsAttempted).toBe(6);
      expect(result.allocationsWritten).toBe(6);

      const allocations = extractAllocationsFromBatchCalls(
        ddb.send as jest.Mock
      );

      // Verify derived monthly cost: 6000 / 6 = 1000
      allocations.forEach((entry: any) => {
        expect(entry.PutRequest.Item.amount).toBe(1000);
      });
    });
  });

  describe("Non-labor rubros", () => {
    it("creates allocations from non-labor rubros using unit_cost", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_nonlabor",
        project_id: "P-NONLABOR-001",
        start_date: "2025-03-01",
        duration_months: 12,
      };

      // Mock rubros query to return a non-labor rubro
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-NONLABOR-001",
                sk: "RUBRO#INF-CLOUD#base_nonlabor#1",
                rubroId: "INF-CLOUD#base_nonlabor#1",
                linea_codigo: "INF-CLOUD",
                nombre: "AWS Services",
                category: "Non-labor",
                unit_cost: 500,
                total_cost: 6000,
                start_month: 1,
                end_month: 12,
                metadata: {
                  baseline_id: "base_nonlabor",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      expect(result.allocationsAttempted).toBe(12);
      expect(result.allocationsWritten).toBe(12);

      const allocations = extractAllocationsFromBatchCalls(
        ddb.send as jest.Mock
      );

      allocations.forEach((entry: any) => {
        const item = entry.PutRequest.Item;
        expect(item.amount).toBe(500);
        expect(item.rubroId).toBe("INF-CLOUD");
      });
    });
  });

  describe("Idempotency - skip existing non-zero allocations", () => {
    it("skips overwriting existing allocations with non-zero amount", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_idempotent",
        project_id: "P-IDEM-001",
        start_date: "2025-01-01",
        duration_months: 3,
      };

      // Mock rubros query
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-IDEM-001",
                sk: "RUBRO#MOD-LEAD#base_idempotent#1",
                rubroId: "MOD-LEAD#base_idempotent#1",
                linea_codigo: "MOD-LEAD",
                unit_cost: 1000,
                start_month: 1,
                end_month: 3,
                metadata: {
                  baseline_id: "base_idempotent",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Mock existing allocations with non-zero amounts
      (batchGetExistingItems as jest.Mock).mockResolvedValue([
        {
          pk: "PROJECT#P-IDEM-001",
          sk: "ALLOCATION#base_idempotent#2025-01#MOD-LEAD",
          amount: 999, // existing non-zero amount
        },
        {
          pk: "PROJECT#P-IDEM-001",
          sk: "ALLOCATION#base_idempotent#2025-02#MOD-LEAD",
          amount: 1500, // existing non-zero amount
        },
      ]);

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      // Should attempt 3, but skip 2 (non-zero), write 1 (new)
      expect(result.allocationsAttempted).toBe(3);
      expect(result.allocationsSkipped).toBe(2);
      expect(result.allocationsWritten).toBe(1);
    });
  });

  describe("forceRewriteZeros flag", () => {
    it("overwrites existing allocations with zero amount when forceRewriteZeros=true", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_force_rewrite",
        project_id: "P-FORCE-001",
        start_date: "2025-01-01",
        duration_months: 3,
      };

      // Mock rubros query
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-FORCE-001",
                sk: "RUBRO#MOD-ING#base_force_rewrite#1",
                rubroId: "MOD-ING#base_force_rewrite#1",
                linea_codigo: "MOD-ING",
                unit_cost: 800,
                start_month: 1,
                end_month: 3,
                metadata: {
                  baseline_id: "base_force_rewrite",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Mock existing allocations with ZERO amounts
      (batchGetExistingItems as jest.Mock).mockResolvedValue([
        {
          pk: "PROJECT#P-FORCE-001",
          sk: "ALLOCATION#base_force_rewrite#2025-01#MOD-ING",
          amount: 0, // zero amount - should be overwritten
        },
        {
          pk: "PROJECT#P-FORCE-001",
          sk: "ALLOCATION#base_force_rewrite#2025-02#MOD-ING",
          amount: 0, // zero amount - should be overwritten
        },
      ]);

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
        forceRewriteZeros: true,
      });

      // Should attempt 3, overwrite 2 (zeros), write 1 (new)
      expect(result.allocationsAttempted).toBe(3);
      expect(result.allocationsWritten).toBe(3);
      expect(result.allocationsSkipped).toBe(0);
      expect(result.allocationsOverwritten).toBe(2);

      const allocations = extractAllocationsFromBatchCalls(
        ddb.send as jest.Mock
      );

      // Verify all 3 allocations were written with correct amount
      expect(allocations).toHaveLength(3);
      allocations.forEach((entry: any) => {
        expect(entry.PutRequest.Item.amount).toBe(800);
      });
    });

    it("does NOT overwrite zero amounts when forceRewriteZeros=false", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_no_force",
        project_id: "P-NOFORCE-001",
        start_date: "2025-01-01",
        duration_months: 2,
      };

      // Mock rubros query
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-NOFORCE-001",
                sk: "RUBRO#MOD-ING#base_no_force#1",
                rubroId: "MOD-ING#base_no_force#1",
                linea_codigo: "MOD-ING",
                unit_cost: 900,
                start_month: 1,
                end_month: 2,
                metadata: {
                  baseline_id: "base_no_force",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Mock existing allocation with ZERO amount
      (batchGetExistingItems as jest.Mock).mockResolvedValue([
        {
          pk: "PROJECT#P-NOFORCE-001",
          sk: "ALLOCATION#base_no_force#2025-01#MOD-ING",
          amount: 0,
        },
      ]);

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
        forceRewriteZeros: false, // explicitly false
      });

      // Should attempt 2, skip 1 (existing zero), write 1 (new)
      expect(result.allocationsAttempted).toBe(2);
      expect(result.allocationsWritten).toBe(1);
      expect(result.allocationsSkipped).toBe(1);
    });
  });

  describe("Multi-year baseline with contract month alignment", () => {
    it("correctly maps contract months to calendar months for multi-year baseline", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_multiyear",
        project_id: "P-MULTI-001",
        start_date: "2025-05-15", // Start in May
        duration_months: 24, // 2 years
      };

      // Mock rubros query
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-MULTI-001",
                sk: "RUBRO#MOD-LEAD#base_multiyear#1",
                rubroId: "MOD-LEAD#base_multiyear#1",
                linea_codigo: "MOD-LEAD",
                unit_cost: 2000,
                start_month: 1, // M1 = May 2025
                end_month: 24, // M24 = April 2027
                metadata: {
                  baseline_id: "base_multiyear",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      expect(result.allocationsAttempted).toBe(24);
      expect(result.allocationsWritten).toBe(24);

      const allocations = extractAllocationsFromBatchCalls(
        ddb.send as jest.Mock
      );

      // Verify first allocation is May 2025 (M1)
      const firstAllocation = allocations[0].PutRequest.Item;
      expect(firstAllocation.calendar_month).toBe("2025-05");
      expect(firstAllocation.month_index).toBe(1);

      // Verify 12th allocation is April 2026 (M12)
      const twelfthAllocation = allocations[11].PutRequest.Item;
      expect(twelfthAllocation.calendar_month).toBe("2026-04");
      expect(twelfthAllocation.month_index).toBe(12);

      // Verify 24th allocation is April 2027 (M24)
      const lastAllocation = allocations[23].PutRequest.Item;
      expect(lastAllocation.calendar_month).toBe("2027-04");
      expect(lastAllocation.month_index).toBe(24);
    });
  });

  describe("Fallback to labor_estimates when no rubros found", () => {
    it("uses labor_estimates as fallback when rubros query returns empty", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_fallback",
        project_id: "P-FALLBACK-001",
        start_date: "2025-01-01",
        duration_months: 3,
        labor_estimates: [
          {
            id: "labor-1",
            rubroId: "MOD-ING",
            total_cost: 3000, // $1000/month for 3 months
          },
        ],
      };

      // Mock rubros query to return empty (no rubros seeded)
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({ Items: [] }); // No rubros
        }
        return Promise.resolve({});
      });

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      // Should fall back to labor_estimates
      expect(result.allocationsAttempted).toBe(3);
      expect(result.allocationsWritten).toBe(3);

      const allocations = extractAllocationsFromBatchCalls(
        ddb.send as jest.Mock
      );

      expect(allocations).toHaveLength(3);

      // Verify allocations were created from labor_estimates
      allocations.forEach((entry: any) => {
        const item = entry.PutRequest.Item;
        expect(item.rubro_id).toBe("MOD-ING");
        expect(item.amount).toBe(1000); // 3000 / 3 months
      });
    });
  });

  describe("Partial month range for rubros", () => {
    it("creates allocations only for months in rubro start_month to end_month range", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_partial",
        project_id: "P-PARTIAL-001",
        start_date: "2025-01-01",
        duration_months: 12,
      };

      // Mock rubros query - rubro active only for months 3-8
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-PARTIAL-001",
                sk: "RUBRO#MOD-ING#base_partial#1",
                rubroId: "MOD-ING#base_partial#1",
                linea_codigo: "MOD-ING",
                unit_cost: 1200,
                start_month: 3, // M3
                end_month: 8, // M8
                metadata: {
                  baseline_id: "base_partial",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: false,
      });

      // Should create allocations only for months 3-8 (6 months)
      expect(result.allocationsAttempted).toBe(6);
      expect(result.allocationsWritten).toBe(6);

      const allocations = extractAllocationsFromBatchCalls(
        ddb.send as jest.Mock
      );

      expect(allocations).toHaveLength(6);

      // Verify month range: M3 = March 2025, M8 = August 2025
      const firstItem = allocations[0].PutRequest.Item;
      expect(firstItem.calendar_month).toBe("2025-03");
      expect(firstItem.month_index).toBe(3);

      const lastItem = allocations[5].PutRequest.Item;
      expect(lastItem.calendar_month).toBe("2025-08");
      expect(lastItem.month_index).toBe(8);
    });
  });

  describe("Dry run mode", () => {
    it("returns planned counts without writing to database when dryRun=true", async () => {
      const baseline: BaselineStub = {
        baseline_id: "base_dryrun",
        project_id: "P-DRYRUN-001",
        start_date: "2025-01-01",
        duration_months: 6,
      };

      // Mock rubros query
      (ddb.send as jest.Mock).mockImplementation((command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return Promise.resolve({
            Items: [
              {
                pk: "PROJECT#P-DRYRUN-001",
                sk: "RUBRO#MOD-LEAD#base_dryrun#1",
                rubroId: "MOD-LEAD#base_dryrun#1",
                linea_codigo: "MOD-LEAD",
                unit_cost: 1500,
                start_month: 1,
                end_month: 6,
                metadata: {
                  baseline_id: "base_dryrun",
                },
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      const result = await materializeAllocationsForBaseline(baseline, {
        dryRun: true,
      });

      // Verify dry run result
      expect(result.allocationsPlanned).toBe(6);
      expect(result.allocationsAttempted).toBe(6);

      // Verify NO batch writes were made
      const allocations = extractAllocationsFromBatchCalls(
        ddb.send as jest.Mock
      );
      expect(allocations).toHaveLength(0);
    });
  });
});
