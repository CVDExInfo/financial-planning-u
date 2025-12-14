import { jest } from "@jest/globals";
import { materializeAllocationsForBaseline, materializeRubrosForBaseline } from "../src/lib/materializers";
import { ddb } from "../src/lib/dynamo";

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
    (ddb.send as jest.Mock).mockResolvedValue({});
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
    const command = (ddb.send as jest.Mock).mock.calls[0][0] as { input?: any };
    const requestItems = command?.input?.RequestItems?.mock_rubros;
    expect(requestItems).toHaveLength(2);

    const skValues = requestItems.map((entry: any) => entry.PutRequest.Item.sk);
    expect(skValues).toContain("RUBRO#MOD-ING#BASELINE#base_test");
    expect(skValues).toContain("RUBRO#GSV-TOOL#BASELINE#base_test");
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
});
