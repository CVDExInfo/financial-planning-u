/**
 * Finanzas Demo Scenarios - Canonical Project Definitions
 * 
 * This module defines 5 realistic demo projects for testing, development, and demonstrations.
 * These scenarios populate the Finanzas SD platform with end-to-end data across:
 * - Projects & Baselines
 * - Monthly MOD allocations by Rubro
 * - Payroll actuals with realistic variance patterns
 * 
 * See: docs/finanzas/demo-scenarios.md for detailed documentation
 */

// =============================================================================
// Type Definitions
// =============================================================================

export interface DemoProjectScenario {
  projectId: string;
  baselineId: string;
  name: string;
  client: string;
  serviceType: string;
  status: "Active" | "Archived";
  durationMonths: number;
  startDate: string; // YYYY-MM-DD
  currency: string;
  
  // Monthly plan amounts for the full duration
  baselineModMonthlyPlan: Array<{ month: string; amount: number }>;
  
  // Rubro split as percentages (must sum to 100%)
  rubroSplit: Record<string, number>;
  
  // Variance pattern for actuals (repeating cycle of factors)
  actualVariancePattern: number[];
  
  // SDM manager email
  sdmManagerEmail: string;
  
  // Derived totals
  modTotal: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a series of month strings from a start date
 * @param startMonth - Start month in YYYY-MM format
 * @param duration - Number of months to generate
 * @returns Array of month strings ["2025-01", "2025-02", ...]
 */
export function generateMonthSeries(startMonth: string, duration: number): string[] {
  const [year, month] = startMonth.split("-").map(Number);
  const months: string[] = [];
  
  for (let i = 0; i < duration; i++) {
    const date = new Date(year, month - 1 + i, 1);
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  
  return months;
}

/**
 * Apply variance pattern to a planned amount
 * @param plan - Planned amount
 * @param monthIndex - Zero-based month index
 * @param pattern - Variance pattern array (cycles if monthIndex > pattern.length)
 * @returns Actual amount with variance applied, rounded to nearest integer
 */
export function applyVariance(plan: number, monthIndex: number, pattern: number[]): number {
  const factor = pattern[monthIndex % pattern.length];
  return Math.round(plan * factor);
}

/**
 * Generate monthly plan with a linear ramp-up pattern
 * @param startAmount - Starting monthly amount
 * @param endAmount - Ending monthly amount (at end of ramp period)
 * @param rampMonths - Number of months to ramp up
 * @param remainingMonths - Number of months after ramp at stable rate
 * @returns Array of monthly amounts
 */
function generateRampUpPlan(
  startAmount: number,
  endAmount: number,
  rampMonths: number,
  remainingMonths: number
): number[] {
  const plan: number[] = [];
  
  // Ramp-up phase
  const increment = (endAmount - startAmount) / (rampMonths - 1);
  for (let i = 0; i < rampMonths; i++) {
    plan.push(Math.round(startAmount + increment * i));
  }
  
  // Stable phase
  for (let i = 0; i < remainingMonths; i++) {
    plan.push(Math.round(endAmount));
  }
  
  return plan;
}

/**
 * Generate monthly plan with seasonal peaks
 * @param baseAmount - Base monthly amount
 * @param peakMultiplier - Multiplier for peak months (e.g., 1.25 = +25%)
 * @param peakMonths - Array of month numbers (1-12) that are peak months
 * @param totalMonths - Total number of months
 * @returns Array of monthly amounts
 */
function generateSeasonalPlan(
  baseAmount: number,
  peakMultiplier: number,
  peakMonths: number[],
  totalMonths: number
): number[] {
  const plan: number[] = [];
  
  for (let i = 0; i < totalMonths; i++) {
    // Determine which calendar month this is (1-12)
    const monthInYear = (i % 12) + 1;
    
    // Check if this is a peak month
    const isPeak = peakMonths.includes(monthInYear);
    const amount = isPeak ? baseAmount * peakMultiplier : baseAmount;
    
    plan.push(Math.round(amount));
  }
  
  return plan;
}

/**
 * Generate monthly plan with front-loaded pattern
 * @param year1Amount - Average monthly amount in year 1
 * @param steadyStateAmount - Average monthly amount after year 1
 * @param totalMonths - Total number of months
 * @returns Array of monthly amounts
 */
function generateFrontLoadedPlan(
  year1Amount: number,
  steadyStateAmount: number,
  totalMonths: number
): number[] {
  const plan: number[] = [];
  
  for (let i = 0; i < totalMonths; i++) {
    // First 12 months: year 1 amount
    // Remaining months: steady state amount
    const amount = i < 12 ? year1Amount : steadyStateAmount;
    plan.push(Math.round(amount));
  }
  
  return plan;
}

/**
 * Generate flat monthly plan
 * @param amount - Monthly amount
 * @param totalMonths - Total number of months
 * @returns Array of monthly amounts
 */
function generateFlatPlan(amount: number, totalMonths: number): number[] {
  return Array(totalMonths).fill(Math.round(amount));
}

// =============================================================================
// Demo Scenario Definitions
// =============================================================================

/**
 * Build a complete demo scenario with monthly plan
 */
function buildScenario(
  projectId: string,
  baselineId: string,
  name: string,
  client: string,
  serviceType: string,
  durationMonths: number,
  startMonth: string,
  monthlyPlan: number[],
  rubroSplit: Record<string, number>,
  variancePattern: number[],
  sdmManagerEmail: string
): DemoProjectScenario {
  const months = generateMonthSeries(startMonth, durationMonths);
  
  // Build monthly plan array
  const baselineModMonthlyPlan = months.map((month, i) => ({
    month,
    amount: monthlyPlan[i],
  }));
  
  // Calculate total MOD
  const modTotal = monthlyPlan.reduce((sum, amt) => sum + amt, 0);
  
  return {
    projectId,
    baselineId,
    name,
    client,
    serviceType,
    status: "Active",
    durationMonths,
    startDate: `${startMonth}-01`,
    currency: "USD",
    baselineModMonthlyPlan,
    rubroSplit,
    actualVariancePattern: variancePattern,
    sdmManagerEmail,
    modTotal,
  };
}

// =============================================================================
// The 5 Canonical Demo Scenarios
// =============================================================================

export const DEMO_SCENARIOS: DemoProjectScenario[] = [
  // 1. Cloud Ops Ecopetrol - Stable, high MOD
  buildScenario(
    "P-CLOUD-ECOPETROL",
    "BL-CLOUD-ECOPETROL-001",
    "Cloud Ops Ecopetrol",
    "Ecopetrol",
    "Cloud Infrastructure Operations",
    60, // 5 years
    "2025-01",
    generateFlatPlan(375000, 60),
    {
      "RB0001": 60, // RB-ENG: Ingeniería
      "RB0010": 25, // RB-NOC: Operación NOC 24x7
      "RB0003": 10, // RB-MGMT: Gestión SDM
      "RB0045": 5,  // RB-TOOLS: Herramientas cloud
    },
    [0.97, 1.02, 1.04, 1.00, 0.99, 1.03], // Slight variance
    "sdm.cloud@ikusi.com"
  ),

  // 2. Datacenter ETB - Front-loaded spend
  buildScenario(
    "P-DATACENTER-ETB",
    "BL-DATACENTER-ETB-001",
    "Datacenter ETB",
    "ETB",
    "Datacenter Operations & Maintenance",
    48, // 4 years
    "2025-01",
    generateFrontLoadedPlan(575000, 500000, 48),
    {
      "RB0001": 55, // RB-ENG: Ingeniería
      "RB0010": 20, // RB-NOC: Operación NOC
      "RB0003": 10, // RB-MGMT: Gestión SDM
      "RB0040": 10, // RB-TOOLS: Infraestructura
      "RB0015": 5,  // RB-TRAVEL: Viajes
    },
    [1.05, 1.02, 0.98, 0.97, 1.01, 0.99], // Higher variance
    "sdm.datacenter@ikusi.com"
  ),

  // 3. SD-WAN Bancolombia - Ramp-up
  buildScenario(
    "P-SDWAN-BANCOLOMBIA",
    "BL-SDWAN-BANCO-001",
    "SD-WAN Bancolombia",
    "Bancolombia",
    "SD-WAN Network Operations",
    36, // 3 years
    "2025-01",
    generateRampUpPlan(260000, 320000, 12, 24),
    {
      "RB0001": 65, // RB-ENG: Ingeniería
      "RB0010": 15, // RB-NOC: Operación NOC
      "RB0003": 15, // RB-MGMT: Gestión SDM
      "RB0060": 5,  // RB-TOOLS: SD-WAN licenses
    },
    [0.96, 1.00, 1.03, 1.02, 1.01, 0.99], // Moderate variance
    "sdm.sdwan@ikusi.com"
  ),

  // 4. WiFi Aeropuerto El Dorado - Seasonal peaks
  buildScenario(
    "P-WIFI-ELDORADO",
    "BL-WIFI-ELDORADO-001",
    "WiFi Aeropuerto El Dorado",
    "OPAIN / El Dorado",
    "WiFi Infrastructure & Operations",
    24, // 2 years
    "2025-01",
    generateSeasonalPlan(180000, 1.25, [6, 7, 11, 12], 24),
    {
      "RB0001": 50, // RB-ENG: Ingeniería
      "RB0010": 20, // RB-NOC: Operación NOC
      "RB0003": 10, // RB-MGMT: Gestión SDM
      "RB0030": 10, // RB-TOOLS: WiFi equipment
      "RB0015": 10, // RB-TRAVEL: Viajes (airport support)
    },
    [1.00, 0.99, 0.97, 1.10, 1.12, 0.95], // Higher variance in peak months
    "sdm.wifi@ikusi.com"
  ),

  // 5. SOC Multicliente - Very stable
  buildScenario(
    "P-SOC-MULTICLIENT",
    "BL-SOC-MULTI-001",
    "SOC Multicliente",
    "Multi-Client",
    "Security Operations Center 24x7",
    36, // 3 years
    "2025-01",
    generateFlatPlan(220000, 36),
    {
      "RB0001": 40, // RB-ENG: Ingeniería
      "RB0010": 40, // RB-NOC: Operación NOC
      "RB0003": 15, // RB-MGMT: Gestión SDM
      "RB0020": 5,  // RB-TOOLS: SIEM & security tools
    },
    [0.99, 1.01, 0.99, 1.00, 1.00, 1.01], // Minimal variance
    "sdm.soc@ikusi.com"
  ),
];

// =============================================================================
// Exports
// =============================================================================

export default DEMO_SCENARIOS;
