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

test("computeTotals calculates monthly variance percentages", () => {
  const rows = [
    { month: 1, planned: 100, forecast: 120, actual: 90 },
    { month: 2, planned: 200, forecast: 210, actual: 180 },
  ];

  const totals = computeTotals(rows, [1, 2]);

  // Month 1: forecast variance = 20, actual variance = -10
  assert.equal(totals.byMonth[1].varianceForecast, 20);
  assert.equal(totals.byMonth[1].varianceActual, -10);
  assert.equal(totals.byMonth[1].varianceForecastPercent, 20); // (20/100) * 100
  assert.equal(totals.byMonth[1].varianceActualPercent, -10); // (-10/100) * 100

  // Month 2: forecast variance = 10, actual variance = -20
  assert.equal(totals.byMonth[2].varianceForecast, 10);
  assert.equal(totals.byMonth[2].varianceActual, -20);
  assert.equal(totals.byMonth[2].varianceForecastPercent, 5); // (10/200) * 100
  assert.equal(totals.byMonth[2].varianceActualPercent, -10); // (-20/200) * 100
});

test("computeTotals handles zero planned values for monthly percentages", () => {
  const rows = [
    { month: 1, planned: 0, forecast: 100, actual: 50 },
  ];

  const totals = computeTotals(rows, [1]);

  // Should not divide by zero
  assert.equal(totals.byMonth[1].varianceForecastPercent, 0);
  assert.equal(totals.byMonth[1].varianceActualPercent, 0);
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

test("computeTotals calculates overall variance percentages correctly", () => {
  const rows = [
    { month: 1, planned: 100, forecast: 120, actual: 90 },
    { month: 2, planned: 200, forecast: 210, actual: 190 },
  ];

  const totals = computeTotals(rows, [1, 2]);

  // Overall: planned=300, forecast=330, actual=280
  assert.equal(totals.overall.planned, 300);
  assert.equal(totals.overall.forecast, 330);
  assert.equal(totals.overall.actual, 280);
  assert.equal(totals.overall.varianceForecast, 30);
  assert.equal(totals.overall.varianceActual, -20);
  assert.equal(totals.overall.varianceForecastPercent, 10); // (30/300) * 100
  assert.equal(totals.overall.varianceActualPercent, -6.666666666666667); // (-20/300) * 100
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
