/**
 * Shared types for Finanzas API
 * Provides type-safe interfaces for payroll, plan, and forecast entities
 */

/**
 * PayrollKind discriminator for plan/forecast/actual
 */
export type PayrollKind = "plan" | "forecast" | "actual";

/**
 * PayrollEntry - unified interface for payroll data across plan/forecast/actual
 * 
 * This model extends the existing payroll_actuals table to support:
 * - Plan: MOD from caso de negocio / initial budget
 * - Forecast: Projected payroll costs (SD/Finanzas estimates)
 * - Actual: Real payroll executed (from HR systems)
 * 
 * Backwards compatibility: Legacy records without 'kind' default to "actual"
 */
export interface PayrollEntry {
  id: string;                    // payroll_[kind]_[random] e.g., payroll_plan_abc123
  projectId: string;             // proj_xxx or P-XXXX format
  period: string;                // YYYY-MM format (e.g., "2025-01")
  kind: PayrollKind;             // Discriminator: plan | forecast | actual
  amount: number;                // MOD cost for this period (must be >= 0)
  currency: string;              // USD, COP, EUR, etc.
  
  // Optional metadata
  allocationId?: string;         // Link to allocation if applicable
  rubroId?: string;              // Link to rubro/line item if applicable
  resourceCount?: number;        // Number of FTEs/resources
  source?: string;               // e.g., "excel", "hr_system", "manual", "estimator"
  uploadedBy?: string;           // Email of uploader
  uploadedAt?: string;           // ISO timestamp
  notes?: string;                // Additional context
  
  // DynamoDB keys (computed at write time)
  pk?: string;                   // PROJECT#${projectId}#MONTH#${period}
  sk?: string;                   // PAYROLL#${kind}#${id}
  
  // Audit fields
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Time series data point for a project's MOD tracking
 */
export interface PayrollTimeSeries {
  period: string;                // YYYY-MM
  planMOD?: number;              // Planned MOD from caso de negocio
  forecastMOD?: number;          // Forecasted MOD
  actualMOD?: number;            // Actual MOD from payroll execution
  indirectCostsPlan?: number;    // Indirect costs (non-labor) - plan
  indirectCostsActual?: number;  // Indirect costs - actual
  
  // Derived metrics
  laborSharePlan?: number;       // planMOD / (planMOD + indirectCostsPlan), range 0-1
  laborShareForecast?: number;   // forecastMOD / (forecastMOD + indirectCostsPlan), range 0-1
  laborShareActual?: number;     // actualMOD / (actualMOD + indirectCostsActual), range 0-1
  
  totalPlan?: number;            // planMOD + indirectCostsPlan
  totalForecast?: number;        // forecastMOD + indirectCostsPlan (or forecast indirect if available)
  totalActual?: number;          // actualMOD + indirectCostsActual
}

/**
 * Aggregated MOD projection by start month (for dashboard)
 */
export interface MODProjectionByMonth {
  month: string;                 // YYYY-MM or YYYY-MM-DD (project start month)
  totalPlanMOD: number;          // Sum of all projects' plan MOD
  totalForecastMOD: number;      // Sum of all projects' forecast MOD
  totalActualMOD: number;        // Sum of all projects' actual MOD
  projectCount: number;          // Number of projects starting in this month
}

/**
 * Labor vs Indirect Cost calculation result
 */
export interface LaborVsIndirectMetrics {
  laborSharePlan?: number;       // 0-1 float, undefined if no data
  laborShareForecast?: number;   // 0-1 float, undefined if no data
  laborShareActual?: number;     // 0-1 float, undefined if no data
  totalPlan?: number;
  totalForecast?: number;
  totalActual?: number;
  planMOD?: number;
  forecastMOD?: number;
  actualMOD?: number;
  planIndirect?: number;
  forecastIndirect?: number;
  actualIndirect?: number;
}
