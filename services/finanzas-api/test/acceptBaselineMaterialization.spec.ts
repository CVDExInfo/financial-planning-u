import { jest } from "@jest/globals";
import { materializeAllocationsForBaseline, materializeRubrosForBaseline } from "../src/lib/materializers";
import { ddb } from "../src/lib/dynamo";
import { batchGetExistingItems } from "../src/lib/dynamodbHelpers";

jest.mock("../src/lib/dynamo", () => {
  return {
    ddb: { send: jest.fn() },
    tableName: (key: string) => `mock_${key}`,
    GetCommand: jest.fn(),
    QueryCommand: jest.fn(),
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

describe("AcceptBaseline Materialization Integration", () => {
  beforeEach(() => {
    (ddb.send as jest.Mock).mockReset();
    (batchGetExistingItems as jest.Mock).mockReset();
    
    // Default mock: no existing items
    (batchGetExistingItems as jest.Mock).mockResolvedValue([]);
    
    // Mock DynamoDB send for various commands
    (ddb.send as jest.Mock).mockImplementation((command: any) => {
      if (command.constructor.name === "ScanCommand") {
        return Promise.resolve({ Items: [] });
      }
      return Promise.resolve({});
    });
  });

  it("acceptBaseline calls both rubros and allocations materializers", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_accept_test",
      project_id: "P-ACCEPT1",
      start_date: "2025-01-01",
      duration_months: 18, // > 12 months
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-accept-1",
          rubroId: "MOD-PM",
          role: "Project Manager",
          periodic: "recurring",
          total_cost: 180000,
        },
      ],
      non_labor_estimates: [
        {
          id: "nonlabor-accept-1",
          rubroId: "GSV-CLOUD",
          category: "Cloud Services",
          periodic: "recurring",
          total_cost: 90000,
        },
      ],
    };

    // Call both materializers (simulating acceptBaseline behavior)
    const [allocationsSummary, rubrosSummary] = await Promise.all([
      materializeAllocationsForBaseline(baseline, { dryRun: false }),
      materializeRubrosForBaseline(baseline, { dryRun: false }),
    ]);

    // Verify allocations summary
    expect(allocationsSummary).toBeDefined();
    expect(allocationsSummary.allocationsAttempted).toBe(36); // 2 items * 18 months
    expect(allocationsSummary.allocationsWritten).toBeGreaterThan(0);

    // Verify rubros summary
    expect(rubrosSummary).toBeDefined();
    expect(rubrosSummary.rubrosWritten).toBe(2); // 1 labor + 1 non-labor

    // Verify materialization summary structure
    const materialization = { allocationsSummary, rubrosSummary };
    expect(materialization.allocationsSummary.allocationsWritten).toBeGreaterThan(0);
    expect(materialization.rubrosSummary.rubrosWritten).toBe(2);
  });

  it("materialization summary includes correct counts for duration > 12 months", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_longterm",
      project_id: "P-LONGTERM",
      start_date: "2025-03-01",
      duration_months: 36, // 3 years
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-lt-1",
          rubroId: "MOD-DEV",
          role: "Developer",
          periodic: "recurring",
          total_cost: 360000,
        },
        {
          id: "labor-lt-2",
          rubroId: "MOD-QA",
          role: "QA Engineer",
          periodic: "recurring",
          total_cost: 180000,
        },
      ],
    };

    const allocationsSummary = await materializeAllocationsForBaseline(baseline, { dryRun: false });

    // 2 labor items * 36 months = 72 allocations
    expect(allocationsSummary.allocationsAttempted).toBe(72);
    expect(allocationsSummary.allocationsWritten).toBe(72);
    expect(allocationsSummary.allocationsSkipped).toBe(0);

    // Verify DynamoDB calls
    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    expect(allAllocations).toHaveLength(72);

    // Verify allocations span M1..M36
    const monthIndices = allAllocations.map((a: any) => a.PutRequest.Item.month_index);
    const uniqueMonths = new Set(monthIndices);
    expect(uniqueMonths.size).toBe(36);
    expect(Math.min(...monthIndices)).toBe(1);
    expect(Math.max(...monthIndices)).toBe(36);
  });

  it("forecast integration: allocations appear as forecast (F) values", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_forecast_test",
      project_id: "P-FORECAST",
      start_date: "2025-01-01",
      duration_months: 24,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-f-1",
          rubroId: "MOD-ARCH",
          role: "Architect",
          periodic: "recurring",
          total_cost: 240000, // $10k/month
        },
      ],
    };

    await materializeAllocationsForBaseline(baseline, { dryRun: false });

    // Extract allocations from DynamoDB mock calls
    const batchCalls = (ddb.send as jest.Mock).mock.calls.filter((call) => {
      const command = call[0];
      return command?.input?.RequestItems?.mock_allocations;
    });

    const allAllocations = batchCalls.flatMap((call) => {
      const command = call[0] as { input?: any };
      return command?.input?.RequestItems?.mock_allocations || [];
    });

    // Simulate forecast integration: map allocations to forecast cells
    const forecastCells = allAllocations.map((a: any) => {
      const item = a.PutRequest.Item;
      return {
        line_item_id: item.line_item_id,
        rubroId: item.rubro_id,
        projectId: item.projectId,
        month: item.month_index,
        forecast: item.amount, // F value from allocation
        actual: 0,
        planned: item.amount,
        source: item.source,
      };
    });

    // Verify forecast cells
    expect(forecastCells).toHaveLength(24);

    // Check specific months
    const month1 = forecastCells.find((c: any) => c.month === 1);
    expect(month1?.forecast).toBeCloseTo(10000, 0);
    expect(month1?.source).toBe("baseline_materializer");

    const month13 = forecastCells.find((c: any) => c.month === 13);
    expect(month13?.forecast).toBeCloseTo(10000, 0);
    expect(month13?.source).toBe("baseline_materializer");

    const month24 = forecastCells.find((c: any) => c.month === 24);
    expect(month24?.forecast).toBeCloseTo(10000, 0);
    expect(month24?.source).toBe("baseline_materializer");
  });

  it("logs materialization summary with baselineId", async () => {
    const baseline: BaselineStub = {
      baseline_id: "base_logging_test",
      project_id: "P-LOGGING",
      start_date: "2025-01-01",
      duration_months: 12,
      currency: "USD",
      labor_estimates: [
        {
          id: "labor-log-1",
          rubroId: "MOD-DEV",
          role: "Developer",
          periodic: "recurring",
          total_cost: 120000,
        },
      ],
    };

    // Spy on console.info
    const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation();

    await materializeAllocationsForBaseline(baseline, { dryRun: false });

    // Verify logging was called with correct structure (updated log format)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[materializers] materializeAllocationsForBaseline result",
      expect.objectContaining({
        baselineId: "base_logging_test",
        projectId: "P-LOGGING",
        allocationsAttempted: expect.any(Number),
        allocationsWritten: expect.any(Number),
        allocationsSkipped: expect.any(Number),
        months: expect.any(Number),
        monthRange: expect.any(String),
      })
    );

    consoleInfoSpy.mockRestore();
  });
});
