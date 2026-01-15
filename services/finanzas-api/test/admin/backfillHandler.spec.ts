import { jest } from "@jest/globals";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

// Mock modules BEFORE importing the handler
jest.mock("../../src/lib/dynamo", () => ({
  ddb: { send: jest.fn() },
  tableName: (key: string) => `mock_${key}`,
  GetCommand: jest.requireActual("@aws-sdk/lib-dynamodb").GetCommand,
}));

jest.mock("../../src/lib/auth", () => ({
  ensureCanWrite: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/lib/materializers", () => ({
  materializeRubrosFromBaseline: jest.fn().mockResolvedValue({
    rubrosAttempted: 10,
    rubrosWritten: 10,
    rubrosSkipped: 0,
  }),
  materializeAllocationsForBaseline: jest.fn().mockResolvedValue({
    allocationsAttempted: 36,
    allocationsWritten: 36,
    allocationsSkipped: 0,
  }),
}));

// Now import after mocks are set up
import { handler as backfillHandler } from "../../src/handlers/admin/backfillHandler";
import * as materializers from "../../src/lib/materializers";

describe("admin/backfill handler", () => {
  let mockDdb: any;

  beforeEach(async () => {
    // Import the mocked module
    const dynamoModule = await import("../../src/lib/dynamo");
    mockDdb = dynamoModule.ddb;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  it("unwraps nested payload.payload and calls allocations materializer with labor estimates", async () => {
    // Arrange: make the DDB GetCommand for BASELINE METADATA return a nested payload
    const baselineItem = {
      pk: "BASELINE#base_5c62d927a71b",
      sk: "METADATA",
      payload: {
        payload: {
          start_date: "2025-01-01",
          duration_months: 60,
          labor_estimates: [
            { id: "labor-1", rubroId: "MOD-LEAD", total_cost: 161280 },
          ],
          non_labor_estimates: [
            { id: "non-1", rubroId: "INF-CLOUD", amount: 6000 },
          ],
        },
      },
    };

    // Mock DDB GetCommand to return the baseline metadata and project METADATA when needed
    (mockDdb.send as jest.Mock).mockImplementation((cmd) => {
      const TableName = cmd.input?.TableName;
      const Key = cmd.input?.Key || {};
      if (Key && Key.pk && Key.pk.startsWith("BASELINE#")) {
        return Promise.resolve({ Item: baselineItem });
      }
      if (Key && Key.pk && Key.pk.startsWith("PROJECT#")) {
        return Promise.resolve({
          Item: {
            pk: Key.pk,
            sk: "METADATA",
            baseline_id: "base_5c62d927a71b",
            project_id: "P-ABC",
          },
        });
      }
      return Promise.resolve({});
    });

    // Act: call backfill handler (simulate APIGateway event)
    const event = {
      body: JSON.stringify({ baselineId: "base_5c62d927a71b", dryRun: true }),
      headers: { Authorization: "Bearer test" },
    } as any;

    const res = await backfillHandler(event);
    expect(res.statusCode).toBe(200);

    // Assert: allocations materializer got called with payload having labor_estimates
    expect(materializers.materializeAllocationsForBaseline).toHaveBeenCalled();
    const calledWith = (materializers.materializeAllocationsForBaseline as jest.Mock)
      .mock.calls[0][0];
    expect(calledWith.payload).toBeDefined();
    expect(Array.isArray(calledWith.payload.labor_estimates)).toBe(true);
    expect(calledWith.payload.labor_estimates.length).toBeGreaterThan(0);
  });

  it("handles top-level labor estimates in baseline payload", async () => {
    // Arrange: baseline with top-level labor_estimates
    const baselineItem = {
      pk: "BASELINE#base_toplevel",
      sk: "METADATA",
      labor_estimates: [
        { id: "labor-1", rubroId: "MOD-LEAD", total_cost: 100000 },
      ],
      non_labor_estimates: [
        { id: "non-1", rubroId: "INF-CLOUD", amount: 5000 },
      ],
      start_date: "2025-02-01",
      duration_months: 12,
    };

    (mockDdb.send as jest.Mock).mockImplementation((cmd) => {
      const Key = cmd.input?.Key || {};
      if (Key && Key.pk && Key.pk.startsWith("BASELINE#")) {
        return Promise.resolve({ Item: baselineItem });
      }
      return Promise.resolve({});
    });

    const event = {
      body: JSON.stringify({
        baselineId: "base_toplevel",
        projectId: "P-TOP",
        dryRun: true,
      }),
      headers: { Authorization: "Bearer test" },
    } as any;

    const res = await backfillHandler(event);
    expect(res.statusCode).toBe(200);

    // Assert: allocations materializer got called with unwrapped payload
    expect(materializers.materializeAllocationsForBaseline).toHaveBeenCalled();
    const calledWith = (materializers.materializeAllocationsForBaseline as jest.Mock)
      .mock.calls[0][0];
    expect(calledWith.payload).toBeDefined();
    expect(Array.isArray(calledWith.payload.labor_estimates)).toBe(true);
    expect(calledWith.payload.labor_estimates.length).toBeGreaterThan(0);
  });

  it("handles single-level payload wrapper", async () => {
    // Arrange: baseline with payload.labor_estimates (single wrapper)
    const baselineItem = {
      pk: "BASELINE#base_single_wrapper",
      sk: "METADATA",
      payload: {
        start_date: "2025-03-01",
        duration_months: 24,
        labor_estimates: [
          { id: "labor-1", rubroId: "MOD-DEV", total_cost: 150000 },
        ],
        non_labor_estimates: [],
      },
    };

    (mockDdb.send as jest.Mock).mockImplementation((cmd) => {
      const Key = cmd.input?.Key || {};
      if (Key && Key.pk && Key.pk.startsWith("BASELINE#")) {
        return Promise.resolve({ Item: baselineItem });
      }
      return Promise.resolve({});
    });

    const event = {
      body: JSON.stringify({
        baselineId: "base_single_wrapper",
        projectId: "P-WRAP",
        dryRun: true,
      }),
      headers: { Authorization: "Bearer test" },
    } as any;

    const res = await backfillHandler(event);
    expect(res.statusCode).toBe(200);

    // Assert: allocations materializer got called with unwrapped payload
    expect(materializers.materializeAllocationsForBaseline).toHaveBeenCalled();
    const calledWith = (materializers.materializeAllocationsForBaseline as jest.Mock)
      .mock.calls[0][0];
    expect(calledWith.payload).toBeDefined();
    expect(Array.isArray(calledWith.payload.labor_estimates)).toBe(true);
    expect(calledWith.payload.labor_estimates.length).toBeGreaterThan(0);
  });

  it("returns error when neither projectId nor baselineId is provided", async () => {
    const event = {
      body: JSON.stringify({ dryRun: true }),
      headers: { Authorization: "Bearer test" },
    } as any;

    const res = await backfillHandler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("missing_projectId_or_baselineId");
  });
});
