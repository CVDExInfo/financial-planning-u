import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeLaborTotal,
  computeNonLaborTotal,
  computeMonthlyBreakdown,
  getCostTypeBadgeVariant,
  getCostTypeLabel,
  isIndirectCost,
  isMODCategory,
} from "@/lib/cost-utils";

describe("cost-utils", () => {
  it("computeLaborTotal single role monthly math", () => {
    const labor = [
      {
        rubroId: "MOD-DEV",
        role: "Developer",
        country: "CO",
        level: "mid" as const,
        fte_count: 1,
        hourly_rate: 50,
        hours_per_month: 160,
        on_cost_percentage: 10,
        start_month: 1,
        end_month: 12,
      },
    ];
    const total = computeLaborTotal(labor as any);
    assert.equal(total, 8800 * 12);
  });

  it("computeNonLaborTotal one-time and recurring", () => {
    const nonlab = [
      {
        rubroId: "NL-1",
        category: "Lic",
        description: "Licencia",
        amount: 1000,
        currency: "USD" as const,
        one_time: true,
        capex_flag: false,
      },
      {
        rubroId: "NL-2",
        category: "Infra",
        description: "Infra",
        amount: 500,
        currency: "USD" as const,
        one_time: false,
        start_month: 1,
        end_month: 3,
        capex_flag: false,
      },
    ];
    const total = computeNonLaborTotal(nonlab as any);
    assert.equal(total, 2500);
  });

  it("computeMonthlyBreakdown sums correctly", () => {
    const labor = [
      {
        rubroId: "MOD-DEV",
        role: "Dev",
        country: "CO",
        level: "mid" as const,
        fte_count: 1,
        hourly_rate: 50,
        hours_per_month: 160,
        on_cost_percentage: 10,
        start_month: 1,
        end_month: 2,
      },
    ];
    const nonlab = [
      {
        rubroId: "NL-1",
        category: "Infra",
        description: "Infra",
        amount: 1000,
        currency: "USD" as const,
        one_time: false,
        start_month: 2,
        end_month: 2,
        capex_flag: false,
      },
    ];

    const months = computeMonthlyBreakdown(3, labor as any, nonlab as any);
    assert.equal(months[0].Labor, 8800);
    assert.equal(months[1].Labor + months[1]["Non-Labor"], 9800);
    assert.equal(months[2].Labor + months[2]["Non-Labor"], 0);
  });

  it("provides cost type helpers for MOD/indirect categories", () => {
    assert.equal(isMODCategory("MOD"), true);
    assert.equal(isIndirectCost("CAPEX"), true);
    assert.equal(getCostTypeLabel("MOD"), "MOD");
    assert.equal(getCostTypeLabel("OTROS"), "Indirecto");
    assert.equal(getCostTypeBadgeVariant("MOD"), "default");
    assert.equal(getCostTypeBadgeVariant("OTROS"), "secondary");
  });
});
