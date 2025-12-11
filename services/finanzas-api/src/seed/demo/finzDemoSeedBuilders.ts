/**
 * Finanzas Demo Seed Builders
 * 
 * This module contains pure functions that transform demo scenarios into
 * DynamoDB-ready records for projects, baselines, allocations, and payroll actuals.
 * 
 * All record structures match the existing data models defined in:
 * - docs/finanzas/data-models.md
 * - Existing seed scripts (seed_canonical_projects.ts, seed_finanzas_golden_project.ts)
 */

import { DemoProjectScenario, applyVariance } from "./finzDemoScenarios";

// =============================================================================
// Type Definitions (matching existing DynamoDB schemas)
// =============================================================================

export interface DynamoProjectItem {
  pk: string;
  sk: string;
  projectId: string;
  name: string;
  client: string;
  serviceType?: string;
  status: string;
  currency: string;
  modTotal?: number;
  totalBudget?: number;
  startDate: string;
  endDate?: string;
  duration?: number;
  startMonth?: string;
  baselineId?: string;
  sdmManagerEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DynamoBaselineItem {
  pk: string;
  sk: string;
  baselineId: string;
  projectId: string;
  name: string;
  version: number;
  status: string;
  acceptedBy?: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface DynamoHandoffItem {
  pk: string;
  sk: string;
  projectId: string;
  baselineId: string;
  mod_total: number;
  pct_ingenieros: number;
  pct_sdm: number;
  aceptado_por: string;
  fecha_handoff: string;
  notas: string;
  createdAt: string;
}

export interface AllocationRecord {
  pk: string;
  sk: string;
  id: string;
  projectId: string;
  rubroId: string;
  month: string;
  period?: string;
  amount: number;
  planned: number;
  forecast: number;
  actual: number;
  resourceCount?: number;
  source: string;
  status: string;
  baselineId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollActualRecord {
  pk: string;
  sk: string;
  id: string;
  projectId: string;
  rubroId: string;
  month: string;
  period: string;
  amount: number;
  kind: string;
  resourceCount?: number;
  source: string;
  uploadedBy: string;
  uploadedAt: string;
  createdAt: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate end date from start date and duration
 */
function calculateEndDate(startDate: string, durationMonths: number): string {
  const [year, month] = startDate.split("-").slice(0, 2).map(Number);
  const date = new Date(year, month - 1 + durationMonths, 1);
  // Go back one day to get the last day of the previous month
  date.setDate(0);
  return date.toISOString().split("T")[0];
}

/**
 * Extract start month in YYYY-MM format
 */
function extractStartMonth(startDate: string): string {
  return startDate.substring(0, 7); // "2025-01-01" → "2025-01"
}

/**
 * Generate unique ID for allocation/payroll
 */
function generateId(prefix: string, projectId: string, month: string, rubroId: string): string {
  // Create a simple deterministic ID
  const monthSuffix = month.replace("-", "");
  const rubroSuffix = rubroId.replace("RB", "");
  return `${prefix}_${projectId}_${monthSuffix}_${rubroSuffix}`;
}

// =============================================================================
// Builder Functions
// =============================================================================

/**
 * Build DynamoDB project record (METADATA)
 */
export function buildDemoProjectItems(scenario: DemoProjectScenario): DynamoProjectItem[] {
  const now = new Date().toISOString();
  const startMonth = extractStartMonth(scenario.startDate);
  const endDate = calculateEndDate(scenario.startDate, scenario.durationMonths);
  
  const projectItem: DynamoProjectItem = {
    pk: `PROJECT#${scenario.projectId}`,
    sk: "METADATA",
    projectId: scenario.projectId,
    name: scenario.name,
    client: scenario.client,
    serviceType: scenario.serviceType,
    status: scenario.status.toLowerCase(),
    currency: scenario.currency,
    modTotal: scenario.modTotal,
    totalBudget: scenario.modTotal,
    startDate: scenario.startDate,
    endDate,
    duration: scenario.durationMonths,
    startMonth,
    baselineId: scenario.baselineId,
    sdmManagerEmail: scenario.sdmManagerEmail,
    createdAt: now,
    updatedAt: now,
  };
  
  return [projectItem];
}

/**
 * Build DynamoDB baseline and handoff records
 */
export function buildDemoBaselineItems(scenario: DemoProjectScenario): (DynamoBaselineItem | DynamoHandoffItem)[] {
  const now = new Date().toISOString();
  const startMonth = extractStartMonth(scenario.startDate);
  
  // Baseline record
  const baselineItem: DynamoBaselineItem = {
    pk: `BASELINE#${scenario.baselineId}`,
    sk: "METADATA",
    baselineId: scenario.baselineId,
    projectId: scenario.projectId,
    name: `Baseline ${scenario.name}`,
    version: 1,
    status: "active",
    acceptedBy: scenario.sdmManagerEmail,
    acceptedAt: `${scenario.startDate}T10:00:00Z`,
    createdAt: now,
  };
  
  // Handoff record (stored under PROJECT#xxx)
  const handoffItem: DynamoHandoffItem = {
    pk: `PROJECT#${scenario.projectId}`,
    sk: "HANDOFF",
    projectId: scenario.projectId,
    baselineId: scenario.baselineId,
    mod_total: scenario.modTotal,
    pct_ingenieros: 85,
    pct_sdm: 15,
    aceptado_por: scenario.sdmManagerEmail,
    fecha_handoff: startMonth,
    notas: `Proyecto ${scenario.name} - ${scenario.serviceType}`,
    createdAt: now,
  };
  
  return [baselineItem, handoffItem];
}

/**
 * Build DynamoDB allocation records
 * One record per month per rubro
 */
export function buildDemoAllocationItems(scenario: DemoProjectScenario): AllocationRecord[] {
  const now = new Date().toISOString();
  const allocations: AllocationRecord[] = [];
  
  // For each month in the plan
  for (const { month, amount: monthlyPlan } of scenario.baselineModMonthlyPlan) {
    // For each rubro in the split
    for (const [rubroId, percentage] of Object.entries(scenario.rubroSplit)) {
      // Calculate allocation amount (rounded to avoid floating point errors)
      const allocAmount = Math.round((monthlyPlan * percentage) / 100);
      
      const allocId = generateId("alloc", scenario.projectId, month, rubroId);
      
      const allocation: AllocationRecord = {
        pk: `PROJECT#${scenario.projectId}`,
        sk: `ALLOC#${month}#${allocId}`,
        id: allocId,
        projectId: scenario.projectId,
        rubroId,
        month,
        period: month,
        amount: allocAmount,
        planned: allocAmount,
        forecast: allocAmount,
        actual: 0, // Actuals come from payroll
        source: "demo-seed",
        status: "committed",
        baselineId: scenario.baselineId,
        createdAt: now,
        updatedAt: now,
      };
      
      allocations.push(allocation);
    }
  }
  
  return allocations;
}

/**
 * Build DynamoDB payroll actual records
 * One record per month per rubro, with variance applied
 */
export function buildDemoPayrollActuals(scenario: DemoProjectScenario): PayrollActualRecord[] {
  const now = new Date().toISOString();
  const payrolls: PayrollActualRecord[] = [];
  
  // For each month in the plan
  for (let monthIndex = 0; monthIndex < scenario.baselineModMonthlyPlan.length; monthIndex++) {
    const { month, amount: monthlyPlan } = scenario.baselineModMonthlyPlan[monthIndex];
    
    // Apply variance to the total monthly plan
    const actualMonthlyTotal = applyVariance(
      monthlyPlan,
      monthIndex,
      scenario.actualVariancePattern
    );
    
    // For each rubro in the split
    for (const [rubroId, percentage] of Object.entries(scenario.rubroSplit)) {
      // Calculate actual amount for this rubro (with variance already applied)
      const actualAmount = Math.round((actualMonthlyTotal * percentage) / 100);
      
      const payrollId = generateId("payroll", scenario.projectId, month, rubroId);
      
      const payroll: PayrollActualRecord = {
        pk: `PROJECT#${scenario.projectId}`,
        sk: `PAYROLL#${month}#${payrollId}`,
        id: payrollId,
        projectId: scenario.projectId,
        rubroId,
        month,
        period: month,
        amount: actualAmount,
        kind: "actual",
        source: "demo-seed",
        uploadedBy: "finance@ikusi.com",
        uploadedAt: now,
        createdAt: now,
      };
      
      payrolls.push(payroll);
    }
  }
  
  return payrolls;
}

/**
 * Build all demo records for a scenario
 * Convenience function that combines all builders
 */
export function buildAllDemoRecords(scenario: DemoProjectScenario) {
  return {
    projects: buildDemoProjectItems(scenario),
    baselines: buildDemoBaselineItems(scenario),
    allocations: buildDemoAllocationItems(scenario),
    payrolls: buildDemoPayrollActuals(scenario),
  };
}
