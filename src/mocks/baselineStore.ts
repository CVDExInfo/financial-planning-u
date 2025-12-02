import type { BaselineCreateRequest, BaselineCreateResponse } from "@/types/domain";

let baselineCounter = 1;
const baselineStore: BaselineCreateResponse[] = [];

function deriveProjectId(request: BaselineCreateRequest): string {
  const cleanedName = request.project_name
    ? request.project_name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")
    : "PRJ";
  return `PRJ-${cleanedName}-${String(baselineCounter).padStart(3, "0")}`;
}

function calculateTotalAmount(request: BaselineCreateRequest): number {
  const laborTotal = request.labor_estimates.reduce((sum, item) => {
    const baseHours = item.hours_per_month * item.fte_count;
    const baseCost = baseHours * item.hourly_rate;
    const onCost = baseCost * (item.on_cost_percentage / 100);
    const duration = item.end_month - item.start_month + 1;
    return sum + (baseCost + onCost) * duration;
  }, 0);

  const nonLaborTotal = request.non_labor_estimates.reduce((sum, item) => {
    if (item.one_time) return sum + item.amount;
    const duration = (item.end_month || 1) - (item.start_month || 1) + 1;
    return sum + item.amount * duration;
  }, 0);

  return laborTotal + nonLaborTotal;
}

export function createMockBaseline(
  request: BaselineCreateRequest,
): BaselineCreateResponse {
  const createdAt = new Date().toISOString();
  const baseline: BaselineCreateResponse = {
    baseline_id: `BL-MOCK-${String(baselineCounter).padStart(4, "0")}`,
    project_id: deriveProjectId(request),
    signature_hash: `SIG-${Date.now().toString(36)}`,
    total_amount: calculateTotalAmount(request),
    created_at: createdAt,
  };

  baselineCounter += 1;
  baselineStore.push(baseline);

  return baseline;
}

export function listMockBaselines(): BaselineCreateResponse[] {
  return [...baselineStore];
}

export function resetMockBaselines() {
  baselineCounter = 1;
  baselineStore.splice(0, baselineStore.length);
}
