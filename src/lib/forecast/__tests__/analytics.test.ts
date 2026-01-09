import assert from "node:assert/strict";
import test from "node:test";
import { computeTotals, computeVariance } from "../analytics";

test("computeTotals aggregates per-month and overall totals", () => {
  const rows = [
    { month: 1, planned: 100, forecast: 120, actual: 90 },
    { month: 1, planned: 50, forecast: 40, actual: 60 },
    { month: 2, planned: 200, forecast: 210, actual: 190 },
  ];

  const totals = computeTotals(rows, [1, 2]);

  assert.equal(totals.byMonth[1].planned, 150);
  assert.equal(totals.byMonth[1].forecast, 160);
  assert.equal(totals.byMonth[1].actual, 150);
  assert.equal(totals.byMonth[1].varianceForecast, 10);
  assert.equal(totals.byMonth[2].planned, 200);
  assert.equal(totals.overall.planned, 350);
  assert.equal(totals.overall.forecast, 370);
  assert.equal(totals.overall.actual, 340);
});

test("computeTotals recomputes totals after an edit", () => {
  const originalRows = [
    { month: 1, planned: 100, forecast: 100, actual: 80 },
    { month: 2, planned: 200, forecast: 200, actual: 180 },
  ];

  const originalTotals = computeTotals(originalRows, [1, 2]);
  assert.equal(originalTotals.overall.forecast, 300);

  const editedRows = [
    { month: 1, planned: 100, forecast: 150, actual: 80 },
    { month: 2, planned: 200, forecast: 200, actual: 180 },
  ];

  const updatedTotals = computeTotals(editedRows, [1, 2]);
  assert.equal(updatedTotals.overall.forecast, 350);
  assert.notEqual(updatedTotals.overall.forecast, originalTotals.overall.forecast);
});

test("computeVariance builds variance series for charts", () => {
  const variance = computeVariance({
    plan: [100, 100],
    forecast: [120, 90],
    actual: [80, 110],
    budget: [110, 95],
  });

  assert.equal(variance.length, 2);
  assert.equal(variance[0].forecastVarianceBudget, 10);
  assert.equal(variance[1].actualVarianceBudget, 15);
});
