/**
 * Tests for cashflow transform functions
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toCashflowSeries,
  type CashflowResponse,
} from "../services/cashflow.service";

describe("toCashflowSeries", () => {
  it("should return empty arrays when response has no data", () => {
    const response: CashflowResponse = {
      inflows: [],
      outflows: [],
      margin: [],
    };

    const result = toCashflowSeries(response, 12);

    assert.strictEqual(result.months.length, 12);
    assert.strictEqual(result.ingresos.length, 12);
    assert.strictEqual(result.egresos.length, 12);
    assert.strictEqual(result.neto.length, 12);
    assert.strictEqual(result.margen.length, 12);

    // All values should be zero
    assert.ok(result.ingresos.every((v) => v === 0));
    assert.ok(result.egresos.every((v) => v === 0));
    assert.ok(result.neto.every((v) => v === 0));
    assert.ok(result.margen.every((v) => v === 0));

    // Month labels should be M1, M2, ..., M12
    assert.deepStrictEqual(result.months, [
      "M1",
      "M2",
      "M3",
      "M4",
      "M5",
      "M6",
      "M7",
      "M8",
      "M9",
      "M10",
      "M11",
      "M12",
    ]);
  });

  it("should transform response to chart-ready format", () => {
    const response: CashflowResponse = {
      inflows: [
        { month: 1, amount: 100000 },
        { month: 2, amount: 120000 },
      ],
      outflows: [
        { month: 1, amount: 80000 },
        { month: 2, amount: 90000 },
      ],
      margin: [
        { month: 1, percentage: 20 },
        { month: 2, percentage: 25 },
      ],
    };

    const result = toCashflowSeries(response, 2);

    assert.strictEqual(result.months.length, 2);
    assert.deepStrictEqual(result.months, ["M1", "M2"]);

    assert.deepStrictEqual(result.ingresos, [100000, 120000]);
    assert.deepStrictEqual(result.egresos, [80000, 90000]);
    assert.deepStrictEqual(result.neto, [20000, 30000]);
    assert.deepStrictEqual(result.margen, [20, 25]);
  });

  it("should handle partial data with zeros for missing months", () => {
    const response: CashflowResponse = {
      inflows: [{ month: 1, amount: 100000 }],
      outflows: [{ month: 1, amount: 80000 }],
      margin: [{ month: 1, percentage: 20 }],
    };

    const result = toCashflowSeries(response, 3);

    assert.strictEqual(result.months.length, 3);
    assert.deepStrictEqual(result.ingresos, [100000, 0, 0]);
    assert.deepStrictEqual(result.egresos, [80000, 0, 0]);
    assert.deepStrictEqual(result.neto, [20000, 0, 0]);
    assert.deepStrictEqual(result.margen, [20, 0, 0]);
  });

  it("should guard against NaN values", () => {
    const response: CashflowResponse = {
      inflows: [{ month: 1, amount: NaN }],
      outflows: [{ month: 1, amount: Infinity }],
      margin: [{ month: 1, percentage: -Infinity }],
    };

    const result = toCashflowSeries(response, 1);

    // All NaN/Infinity values should be converted to 0
    assert.deepStrictEqual(result.ingresos, [0]);
    assert.deepStrictEqual(result.egresos, [0]);
    assert.deepStrictEqual(result.neto, [0]);
    assert.deepStrictEqual(result.margen, [0]);
  });

  it("should coerce string-like numbers to actual numbers", () => {
    const response: CashflowResponse = {
      inflows: [{ month: 1, amount: "100000" as any }],
      outflows: [{ month: 1, amount: "80000" as any }],
      margin: [{ month: 1, percentage: "20" as any }],
    };

    const result = toCashflowSeries(response, 1);

    assert.deepStrictEqual(result.ingresos, [100000]);
    assert.deepStrictEqual(result.egresos, [80000]);
    assert.deepStrictEqual(result.neto, [20000]);
    assert.deepStrictEqual(result.margen, [20]);
  });

  it("should handle months up to 60 (5 years)", () => {
    const response: CashflowResponse = {
      inflows: [
        { month: 1, amount: 100000 },
        { month: 60, amount: 200000 },
      ],
      outflows: [
        { month: 1, amount: 80000 },
        { month: 60, amount: 150000 },
      ],
      margin: [
        { month: 1, percentage: 20 },
        { month: 60, percentage: 25 },
      ],
    };

    const result = toCashflowSeries(response, 60);

    assert.strictEqual(result.months.length, 60);
    assert.strictEqual(result.ingresos.length, 60);

    // First month should have data
    assert.strictEqual(result.ingresos[0], 100000);
    assert.strictEqual(result.egresos[0], 80000);

    // Last month should have data
    assert.strictEqual(result.ingresos[59], 200000);
    assert.strictEqual(result.egresos[59], 150000);

    // Middle months should be zero
    assert.strictEqual(result.ingresos[30], 0);
  });

  it("should correctly calculate neto (net cash flow)", () => {
    const response: CashflowResponse = {
      inflows: [
        { month: 1, amount: 100000 },
        { month: 2, amount: 50000 }, // Less than outflow
      ],
      outflows: [
        { month: 1, amount: 80000 },
        { month: 2, amount: 60000 }, // More than inflow
      ],
      margin: [
        { month: 1, percentage: 20 },
        { month: 2, percentage: -20 },
      ],
    };

    const result = toCashflowSeries(response, 2);

    // Neto = Ingresos - Egresos
    assert.strictEqual(result.neto[0], 20000); // Positive
    assert.strictEqual(result.neto[1], -10000); // Negative
  });

  it("should handle zero amounts gracefully", () => {
    const response: CashflowResponse = {
      inflows: [{ month: 1, amount: 0 }],
      outflows: [{ month: 1, amount: 0 }],
      margin: [{ month: 1, percentage: 0 }],
    };

    const result = toCashflowSeries(response, 1);

    assert.deepStrictEqual(result.ingresos, [0]);
    assert.deepStrictEqual(result.egresos, [0]);
    assert.deepStrictEqual(result.neto, [0]);
    assert.deepStrictEqual(result.margen, [0]);
  });
});
