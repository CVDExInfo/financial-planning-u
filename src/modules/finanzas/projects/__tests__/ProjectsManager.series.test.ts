import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { buildModPerformanceSeries } from "../modSeries";
import { normalizeApiRowForMod } from "../normalizeForMod";

const API_BASE_URL = "https://example.test/dev";
const importFinanzas = () => import("@/api/finanzas");

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("ProjectsManager MOD data plumbing", () => {
  beforeEach(() => {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
    const storageStub = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as unknown as Storage;
    (globalThis as any).localStorage = storageStub;
    (globalThis as any).sessionStorage = storageStub;
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("getAllocations attaches projectId and returns parsed rows", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async (url: string) => {
      assert.equal(url, `${API_BASE_URL}/allocations?projectId=P-1`);
      return jsonResponse([{ month: "2025-01", amount: 500 }]);
    });

    const { getAllocations } = await importFinanzas();
    const rows = await getAllocations("P-1");

    assert.equal(fetchMock.mock.callCount(), 1);
    assert.deepEqual(rows, [{ month: "2025-01", amount: 500 }]);
  });

  it("buildModPerformanceSeries combines all MOD sources", () => {
    const payrollRows = [
      { month: "2025-01", totalActualMOD: 1000, projectId: "P-1" },
      { month: "2025-02", totalActualMOD: 1100, projectId: "P-1" },
    ].map(normalizeApiRowForMod);

    const allocationsRows = [
      { month: "2025-01", amount: 800, projectId: "P-1", rubro_type: "MOD" },
      { month: "2025-02", amount: 900, projectId: "P-1", rubro_type: "MOD" },
    ].map(normalizeApiRowForMod);

    const adjustmentsRows = [
      { month: "2025-01", amount: 200, projectId: "P-1", adjustmentType: "delta" },
    ].map(normalizeApiRowForMod);

    const baselineRows = [
      { month: "2025-01", totalPlanMOD: 700, projectId: "P-1" },
      { month: "2025-02", totalPlanMOD: 800, projectId: "P-1" },
    ].map(normalizeApiRowForMod);

    const series = buildModPerformanceSeries({
      selectedProjectId: "P-1",
      payrollDashboardRows: payrollRows,
      allocationsRows,
      adjustmentsRows,
      baselineRows,
    });

    const january = series.find((row) => row.month === "2025-01");
    const february = series.find((row) => row.month === "2025-02");

    assert.ok(january);
    assert.ok(february);
    assert.equal(january?.["Allocations MOD"], 800);
    assert.equal(january?.["Adjusted/Projected MOD"], 900);
    assert.equal(january?.["Actual Payroll MOD"], 1000);
    assert.equal(february?.["Allocations MOD"], 900);
    assert.equal(february?.["Adjusted/Projected MOD"], 800);
    assert.equal(february?.["Actual Payroll MOD"], 1100);
  });

  it("getBaseline surfaces permission errors", async () => {
    mock.method(globalThis, "fetch", async () => new Response("forbidden", { status: 403 }));

    const { getBaseline, FinanzasApiError } = await importFinanzas();

    await assert.rejects(getBaseline, (err: unknown) => {
      assert.ok(err instanceof FinanzasApiError);
      return (err as any).status === 403;
    });
  });
});
