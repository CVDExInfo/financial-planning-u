import { describe, expect, it, jest } from "@jest/globals";
import {
  buildSeedLineItems,
  seedLineItemsFromBaseline,
} from "../../src/lib/seed-line-items";
import { PutCommand, QueryCommand } from "../../src/lib/dynamo";

describe("seedLineItemsFromBaseline", () => {
  it("builds line items with canonical rubro IDs", () => {
    const baseline = {
      labor_estimates: [
        {
          rubroId: "MOD-ING",
          role: "Ingeniero Delivery",
          hours_per_month: 160,
          fte_count: 1,
          hourly_rate: 50,
          start_month: 1,
          end_month: 12,
        },
      ],
      non_labor_estimates: [
        {
          rubroId: "GSV-REU",
          description: "Hosting",
          amount: 1000,
          one_time: false,
          start_month: 1,
          end_month: 12,
        },
      ],
      currency: "USD",
    };

    const items = buildSeedLineItems(baseline, "P-TEST", "base_test");
    expect(items).toHaveLength(2);
    expect(items[0].rubroId).toBe("MOD-ING#base_test#1");
    expect(items[0].metadata?.baseline_id).toBe("base_test");
    expect(items[1].rubroId).toBe("GSV-REU#base_test#1");
    expect(items[1].metadata?.project_id).toBe("P-TEST");
  });

  it("seeds rubros successfully with injected deps", async () => {
    const sendMock = jest.fn().mockImplementation((command) => {
      if (command instanceof QueryCommand) {
        return Promise.resolve({ Items: [] });
      }
      return Promise.resolve({});
    });

    const deps = {
      send: sendMock,
      tableName: (name: string) => `mock_${name}`,
    };

    const baseline = {
      labor_estimates: [
        {
          role: "Ingeniero Delivery",
          hours_per_month: 160,
          fte_count: 1,
          hourly_rate: 50,
          start_month: 1,
          end_month: 12,
        },
      ],
      non_labor_estimates: [
        {
          description: "Hosting",
          amount: 1000,
          one_time: false,
          start_month: 1,
          end_month: 12,
        },
      ],
      currency: "USD",
    };

    const res = await seedLineItemsFromBaseline("P-TEST", baseline, "base_test", deps);
    expect(res.seeded).toBeGreaterThanOrEqual(1);

    const putCalls = sendMock.mock.calls.filter(
      ([command]) => command instanceof PutCommand
    );
    expect(putCalls.length).toBeGreaterThan(0);
    expect(putCalls[0][0].input.TableName).toBe("mock_rubros");
  });

  it("is idempotent for the same baseline", async () => {
    const sendMock = jest.fn().mockImplementation((command) => {
      if (command instanceof QueryCommand) {
        return Promise.resolve({
          Items: [{ metadata: { baseline_id: "base_test" } }],
        });
      }
      throw new Error("Unexpected write during idempotent check");
    });

    const deps = {
      send: sendMock,
      tableName: (name: string) => `mock_${name}`,
    };

    const baseline = {
      labor_estimates: [
        {
          role: "Ingeniero Delivery",
          hours_per_month: 160,
          fte_count: 1,
          hourly_rate: 50,
          start_month: 1,
          end_month: 12,
        },
      ],
      non_labor_estimates: [],
    };

    const result = await seedLineItemsFromBaseline(
      "P-TEST",
      baseline,
      "base_test",
      deps
    );

    expect(result.seeded).toBe(0);
    expect(result.skipped).toBe(true);
  });
});
