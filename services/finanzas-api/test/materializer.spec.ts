import { jest } from "@jest/globals";
import { materializeAllocationsForBaseline, materializeRubrosForBaseline } from "../src/lib/materializers";
import { ddb } from "../src/lib/dynamo";

// Mock the AWS SDK commands
jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    QueryCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'QueryCommand' } })),
    BatchWriteCommand: jest.fn().mockImplementation((input) => ({ input, constructor: { name: 'BatchWriteCommand' } })),
  };
});

jest.mock("../src/lib/dynamo", () => {
  return {
    ddb: { send: jest.fn() },
    tableName: (key: string) => `mock_${key}`,
  };
});

type BaselineStub = {
  baseline_id: string;
  project_id: string;
  start_date: string;
  duration_months: number;
  currency?: string;
  labor_estimates?: any[];
  non_labor_estimates?: any[];
};

describe("materializers", () => {
  const baseline: BaselineStub = {
    baseline_id: "base_test",
    project_id: "PRJ-123",
    start_date: "2025-01-01",
    duration_months: 3,
    currency: "USD",
    labor_estimates: [
      {
        rubroId: "MOD-ING",
        periodic: "recurring",
        total_cost: 300,
      },
    ],
    non_labor_estimates: [
      {
        rubroId: "GSV-TOOL",
        periodic: "recurring",
        total_cost: 150,
      },
    ],
  };

  beforeEach(() => {
    (ddb.send as jest.Mock).mockReset();
    // Mock different responses based on the command type
    (ddb.send as jest.Mock).mockImplementation((command: any) => {
      // QueryCommand returns empty items (no existing rubros)
      if (command.constructor.name === 'QueryCommand' || command.input?.KeyConditionExpression) {
        return Promise.resolve({ Items: [] });
      }
      // BatchWriteCommand returns success
      return Promise.resolve({});
    });
  });

  it("creates allocations for each month and line item", async () => {
    await materializeAllocationsForBaseline(baseline, { dryRun: false });

    expect(ddb.send).toHaveBeenCalled();
    const command = (ddb.send as jest.Mock).mock.calls[0][0] as { input?: any };
    const requestItems = command?.input?.RequestItems?.mock_allocations;
    expect(requestItems).toHaveLength(6); // 2 line items * 3 months

    const keys = requestItems.map((entry: any) => entry.PutRequest.Item.sk);
    const monthSet = new Set(keys.filter((key: string) => key.includes("MOD-ING")));
    expect(monthSet.size).toBe(3);
  });

  it("materializes rubros with baseline key", async () => {
    await materializeRubrosForBaseline(baseline, { dryRun: false });

    expect(ddb.send).toHaveBeenCalled();
    // Find the BatchWriteCommand call (after QueryCommands)
    const batchWriteCall = (ddb.send as jest.Mock).mock.calls.find((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_rubros;
    });
    
    expect(batchWriteCall).toBeDefined();
    const command = batchWriteCall[0] as { input?: any };
    const requestItems = command?.input?.RequestItems?.mock_rubros;
    expect(requestItems).toHaveLength(2);

    const skValues = requestItems.map((entry: any) => entry.PutRequest.Item.sk);
    expect(skValues).toContain("RUBRO#base_test#labor#1");
    expect(skValues).toContain("RUBRO#base_test#nonlabor#1");
  });

  it("uses deterministic keys so reruns do not duplicate", async () => {
    await materializeAllocationsForBaseline(baseline, { dryRun: false });
    await materializeAllocationsForBaseline(baseline, { dryRun: false });

    const allRequests = (ddb.send as jest.Mock).mock.calls.flatMap((call) => {
      const command = call[0] as { input?: any };
      const items = command?.input?.RequestItems?.mock_allocations || [];
      return items.map((entry: any) => entry.PutRequest.Item.sk);
    });

    const unique = new Set(allRequests);
    expect(unique.size).toBe(6);
  });

  it("creates allocations for >12 months (M1..M36)", async () => {
    const longBaseline: BaselineStub = {
      baseline_id: "base_long",
      project_id: "PRJ-456",
      start_date: "2025-01-01",
      duration_months: 36,
      currency: "USD",
      labor_estimates: [
        {
          rubroId: "MOD-DEV",
          periodic: "recurring",
          total_cost: 36000,
        },
      ],
    };

    await materializeAllocationsForBaseline(longBaseline, { dryRun: false });

    expect(ddb.send).toHaveBeenCalled();
    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    expect(allAllocations).toHaveLength(36); // 1 line item * 36 months

    // Verify structure (flattened, no nested metadata)
    const firstAllocation = allAllocations[0].PutRequest.Item;
    expect(firstAllocation.source).toBe("baseline_materializer");
    expect(firstAllocation.baselineId).toBe("base_long");
    expect(firstAllocation.projectId).toBe("PRJ-456");
    expect(firstAllocation.rubro_id).toBe("MOD-DEV");
    expect(firstAllocation.month_index).toBeDefined();
    expect(firstAllocation.line_item_id).toBeDefined();

    // Verify SK format: ALLOCATION#baselineId#month#rubroId (month comes before rubroId)
    const skPattern = /^ALLOCATION#base_long#\d{4}-\d{2}#MOD-DEV$/;
    expect(firstAllocation.sk).toMatch(skPattern);
  });

  it("normalizeMonth accepts M13+ and computes correct calendar month", async () => {
    // Test with M13 which should map to month 13 from project start
    const baseline13Months: BaselineStub = {
      baseline_id: "base_13m",
      project_id: "PRJ-789",
      start_date: "2025-01-01", // Start Jan 2025
      duration_months: 13,
      currency: "USD",
      labor_estimates: [
        {
          rubroId: "MOD-TEST",
          periodic: "recurring",
          total_cost: 13000,
        },
      ],
    };

    await materializeAllocationsForBaseline(baseline13Months, { dryRun: false });

    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    expect(allAllocations).toHaveLength(13);

    // Verify that month 13 is correctly computed as Jan 2026 (Jan 2025 + 12 months)
    const month13Allocation = allAllocations[12].PutRequest.Item;
    expect(month13Allocation.month).toBe("2026-01"); // Jan 2025 + 12 months = Jan 2026
  });
});
