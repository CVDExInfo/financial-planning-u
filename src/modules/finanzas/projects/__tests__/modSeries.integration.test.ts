import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildModPerformanceSeries } from "../modSeries";
import { normalizeApiRowForMod } from "../normalizeForMod";

const PROJECT_ID = "P-WIFI-ELDORADO";

describe("buildModPerformanceSeries integration with Dynamo shapes", () => {
  it("aggregates payroll, allocations, baseline, and adjustments", () => {
    const rawPayroll = [
      {
        pk: `PROJECT#${PROJECT_ID}`,
        sk: "PAYROLL#2025-01#payroll_P-WIFI-ELDORADO_m1_r1",
        amount: 207900,
        paymentDate: "2025-01-15",
      },
      {
        pk: `PROJECT#${PROJECT_ID}`,
        sk: "PAYROLL#2025-01#payroll_P-WIFI-ELDORADO_m1_r2",
        monto: 5000,
        paidAt: "2025-01-31",
      },
    ];

    const rawAllocations = [
      {
        pk: `PROJECT#${PROJECT_ID}`,
        startMonth: "2025-01",
        months: 2,
        monthlyAmount: 100000,
        rubro_type: "MOD",
      },
    ];

    const rawBaseline = [
      {
        pk: `PROJECT#${PROJECT_ID}`,
        month: "2025-01",
        totalPlanMOD: 200000,
      },
      {
        pk: `PROJECT#${PROJECT_ID}`,
        month: "2025-02",
        totalPlanMOD: 195000,
      },
    ];

    const rawAdjustments = [
      {
        pk: `PROJECT#${PROJECT_ID}`,
        month: "2025-02",
        amount: 5000,
        adjustmentType: "delta",
      },
    ];

    const payroll = rawPayroll.map(normalizeApiRowForMod);
    const allocations = rawAllocations.map(normalizeApiRowForMod);
    const baseline = rawBaseline.map(normalizeApiRowForMod);
    const adjustments = rawAdjustments.map(normalizeApiRowForMod);

    assert.equal(payroll[0].month, "2025-01");
    assert.equal(payroll[0].projectId, PROJECT_ID);

    const series = buildModPerformanceSeries({
      selectedProjectId: PROJECT_ID,
      payrollDashboardRows: payroll,
      allocationsRows: allocations,
      adjustmentsRows: adjustments,
      baselineRows: baseline,
    });

    const january = series.find((row) => row.month === "2025-01");
    const february = series.find((row) => row.month === "2025-02");

    assert.ok(january);
    assert.ok(february);

    assert.equal(january?.["Actual Payroll MOD"], 212900);
    assert.equal(january?.["Allocations MOD"], 100000);
    assert.equal(january?.["Adjusted/Projected MOD"], 200000);

    assert.equal(february?.["Allocations MOD"], 100000);
    assert.equal(february?.["Adjusted/Projected MOD"], 200000);
    assert.equal(february?.["Actual Payroll MOD"], 0);
  });
});
