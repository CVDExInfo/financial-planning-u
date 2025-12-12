/**
 * MOD Chart Data Shaping Pipeline
 * 
 * Pure function module for building monthly time series data for MOD (Mano de Obra / Labor) charts.
 * Produces three series: Allocations, Adjusted/Projected, and Actual Payroll.
 * 
 * Requirements:
 * - Works for single project or all projects (aggregate)
 * - Deterministic output with stable month keys (YYYY-MM)
 * - MOD-only filtering with configurable predicate
 * - Complete month domain coverage
 * - No NaN values, defaults to 0
 */

// ============================================================================
// Types
// ============================================================================

export type ModChartPoint = {
  month: string; // YYYY-MM
  "Allocations MOD": number;
  "Adjusted/Projected MOD": number;
  "Actual Payroll MOD": number;
};

export type BuildModPerformanceSeriesArgs = {
  selectedProjectId?: string | null;
  payrollDashboardRows: any[];
  allocationsRows: any[];
  adjustmentsRows?: any[];
  baselineRows?: any[];
  modRubrosPredicate?: (row: any) => boolean;
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize date/period strings to YYYY-MM format.
 * - If input is "YYYY-MM-DD", strip to "YYYY-MM"
 * - If input is "YYYY-MM", keep as-is
 * - If invalid, return null (caller should ignore that row)
 */
export function toMonthKey(input: string | Date | null | undefined): string | null {
  if (!input) return null;

  try {
    if (input instanceof Date) {
      if (isNaN(input.getTime())) return null;
      const year = input.getFullYear();
      const month = String(input.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
    
    const dateStr = String(input).trim();
    
    // Check for YYYY-MM-DD format
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-\d{2}/);
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2]}`;
    }
    
    // Check for YYYY-MM format
    const monthMatch = dateStr.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
      return dateStr;
    }
    
    // Try parsing as date
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Determine if a row represents MOD (Mano de Obra / Labor).
 * 
 * Priority order:
 * 1. If row has totalActualMOD/totalPlanMOD/totalForecastMOD, it's already MOD-aggregated
 * 2. Check normalized string fields for MOD keywords
 * 3. Check rubro IDs if present
 * 
 * Default heuristics:
 * - Search for: "mod", "mano de obra", "labor", "labor cost", "workforce"
 * - Check rubro_type, category, linea_gasto, rubroCategory, rubro_name, tipo_costo
 */
export function isModRow(row: any): boolean {
  if (!row) return false;

  // If row has MOD totals, it's already MOD data
  if (
    typeof row.totalActualMOD !== 'undefined' ||
    typeof row.totalPlanMOD !== 'undefined' ||
    typeof row.totalForecastMOD !== 'undefined'
  ) {
    return true;
  }

  // Keywords to search for
  const modKeywords = [
    'mod',
    'mano de obra',
    'labor',
    'labor cost',
    'workforce',
    'payroll',
    'nómina',
    'nomina'
  ];

  // Fields to check for MOD indicators
  const fieldsToCheck = [
    row.rubro_type,
    row.rubroType,
    row.category,
    row.categoria,
    row.linea_gasto,
    row.lineaGasto,
    row.rubroCategory,
    row.rubro_name,
    row.rubroName,
    row.tipo_costo,
    row.tipoCosto,
    row.nombre,
    row.description,
    row.descripcion,
    row.tipo,
    row.type,
  ];

  // Normalize and search
  for (const field of fieldsToCheck) {
    if (typeof field === 'string') {
      const normalized = field.toLowerCase().trim();
      for (const keyword of modKeywords) {
        if (normalized.includes(keyword)) {
          return true;
        }
      }
    }
  }

  // Check rubro IDs for known MOD patterns
  const rubroId = row.rubroId || row.rubro_id || row.rubroid || row.id;
  if (typeof rubroId === 'string') {
    const normalized = rubroId.toLowerCase();
    if (normalized.includes('mod') || normalized.includes('labor')) {
      return true;
    }
  }

  return false;
}

/**
 * Robust project ID matcher - checks multiple field variants
 */
function matchesProject(row: any, projectId: string | null | undefined): boolean {
  if (!projectId) return true; // No filter = include all

  const rowProjectId = 
    row.projectId || 
    row.project_id || 
    row.projectCode || 
    row.project_code ||
    row.pk?.replace(/^PROJECT#/, '');

  if (!rowProjectId) return false;
  
  return String(rowProjectId) === String(projectId);
}

/**
 * Safe number conversion, defaults to 0
 */
function toNumber(value: any): number {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

// ============================================================================
// Series Builders
// ============================================================================

/**
 * Build Actual Payroll series from payroll dashboard rows.
 * 
 * Supports two shapes:
 * A) Monthly-keyed rows: row.month/period + row.totalActualMOD
 * B) Per-entry rows: row.paymentDate/paidAt + row.amount (needs grouping)
 */
function buildActualPayrollSeries(
  rows: any[],
  projectId: string | null | undefined,
  modPredicate: (row: any) => boolean
): Map<string, number> {
  const monthMap = new Map<string, number>();

  for (const row of rows) {
    // Filter by project if specified
    if (!matchesProject(row, projectId)) continue;

    // Check if row is MOD
    if (!modPredicate(row)) continue;

    // Try to extract month key
    let monthKey: string | null = null;
    let amount = 0;

    // Shape A: Monthly aggregated data
    if (row.month || row.period || row.monthKey) {
      monthKey = toMonthKey(row.month || row.period || row.monthKey);
      amount = toNumber(row.totalActualMOD || row.actual || row.amount);
    }
    // Shape B: Per-entry data
    else if (row.paymentDate || row.paidAt || row.date) {
      monthKey = toMonthKey(row.paymentDate || row.paidAt || row.date);
      amount = toNumber(row.amount || row.monto);
    }

    if (monthKey) {
      const existing = monthMap.get(monthKey) || 0;
      monthMap.set(monthKey, existing + amount);
    }
  }

  return monthMap;
}

/**
 * Build Allocations series from allocation rows.
 * 
 * Handles:
 * - Already monthly rows: month + amount
 * - Itemized rows with date range: startMonth + months + monthlyAmount
 * - Itemized rows with unit cost: unit_cost * qty
 */
function buildAllocationsSeries(
  rows: any[],
  projectId: string | null | undefined,
  modPredicate: (row: any) => boolean
): Map<string, number> {
  const monthMap = new Map<string, number>();

  for (const row of rows) {
    // Filter by project
    if (!matchesProject(row, projectId)) continue;

    // Check if MOD
    if (!modPredicate(row)) continue;

    // Try different allocation patterns
    
    // Pattern 1: Direct monthly allocation
    if (row.month || row.mes) {
      const monthKey = toMonthKey(row.month || row.mes);
      const amount = toNumber(row.amount || row.monto || row.monthlyAmount || row.monto_mensual);
      
      if (monthKey) {
        const existing = monthMap.get(monthKey) || 0;
        monthMap.set(monthKey, existing + amount);
      }
      continue;
    }

    // Pattern 2: Expanded allocation (startMonth + duration)
    const startMonth = row.startMonth || row.start_month || row.start_date || row.fecha_inicio;
    const durationMonths = toNumber(row.months || row.duration_months || row.meses || 1);
    const monthlyAmount = toNumber(
      row.monthlyAmount || 
      row.monto_mensual || 
      row.monthly_amount ||
      (row.unit_cost && row.qty ? toNumber(row.unit_cost) * toNumber(row.qty) : 0)
    );

    if (startMonth && durationMonths > 0 && monthlyAmount > 0) {
      const startKey = toMonthKey(startMonth);
      if (startKey) {
        // Expand into individual months
        const [startYear, startMonthNum] = startKey.split('-').map(Number);
        for (let i = 0; i < durationMonths; i++) {
          const targetMonth = startMonthNum + i;
          const yearOffset = Math.floor((targetMonth - 1) / 12);
          const monthInYear = ((targetMonth - 1) % 12) + 1;
          const targetYear = startYear + yearOffset;
          const targetKey = `${targetYear}-${String(monthInYear).padStart(2, '0')}`;
          
          const existing = monthMap.get(targetKey) || 0;
          monthMap.set(targetKey, existing + monthlyAmount);
        }
      }
      continue;
    }

    // Pattern 3: Single amount with total and quantity
    if (row.total && row.quantity) {
      const monthKey = toMonthKey(row.month || row.start_month || row.fecha);
      if (monthKey) {
        const amount = toNumber(row.total);
        const existing = monthMap.get(monthKey) || 0;
        monthMap.set(monthKey, existing + amount);
      }
    }
  }

  return monthMap;
}

/**
 * Build Adjusted/Projected series.
 * 
 * Rule:
 * - If adjustments exist for a month, use adjusted value
 * - Otherwise, fallback to baseline plan value
 * 
 * Adjustments can be:
 * - Delta: baseline + delta
 * - Absolute: use value directly
 */
function buildAdjustedProjectedSeries(
  adjustmentsRows: any[],
  baselineRows: any[],
  projectId: string | null | undefined,
  modPredicate: (row: any) => boolean
): Map<string, number> {
  const monthMap = new Map<string, number>();

  // First, populate baseline values
  for (const row of baselineRows) {
    if (!matchesProject(row, projectId)) continue;
    if (!modPredicate(row)) continue;

    const monthKey = toMonthKey(
      row.month || 
      row.mes || 
      row.period || 
      row.fecha || 
      row.start_month
    );
    
    if (monthKey) {
      const amount = toNumber(
        row.totalPlanMOD || 
        row.plan || 
        row.baseline || 
        row.amount || 
        row.monto ||
        row.monto_mensual
      );
      
      const existing = monthMap.get(monthKey) || 0;
      monthMap.set(monthKey, existing + amount);
    }
  }

  // Then, apply adjustments (override or add)
  for (const row of adjustmentsRows) {
    if (!matchesProject(row, projectId)) continue;
    if (!modPredicate(row)) continue;

    // Adjustments can be distributed across multiple months
    const distribucion = row.distribucion || row.distribution || [];

    // If we have distribution, use it
    if (Array.isArray(distribucion) && distribucion.length > 0) {
      for (const entry of distribucion) {
        const monthKey = toMonthKey(entry.mes || entry.month);
        const amount = toNumber(entry.monto || entry.amount);
        
        if (monthKey) {
          // Determine if this is delta or absolute
          const isDelta = row.adjustmentType === 'delta' || 
                         row.tipo === 'delta' ||
                         row.delta === true;
          
          if (isDelta) {
            const existing = monthMap.get(monthKey) || 0;
            monthMap.set(monthKey, existing + amount);
          } else {
            // Absolute: override
            monthMap.set(monthKey, amount);
          }
        }
      }
      continue;
    }

    // Simple adjustment: single month
    const monthKey = toMonthKey(
      row.month || 
      row.mes || 
      row.fecha_inicio || 
      row.period
    );
    
    if (monthKey) {
      const amount = toNumber(row.monto || row.amount || row.value);
      
      // Heuristic: check for delta vs absolute
      const isDelta = 
        row.adjustmentType === 'delta' ||
        row.tipo === 'delta' ||
        row.delta === true ||
        typeof row.delta !== 'undefined' ||
        typeof row.difference !== 'undefined';

      if (isDelta) {
        const existing = monthMap.get(monthKey) || 0;
        monthMap.set(monthKey, existing + amount);
      } else {
        // Check for absolute indicators
        const isAbsolute = 
          row.adjustmentType === 'absolute' ||
          typeof row.newValue !== 'undefined' ||
          typeof row.adjustedValue !== 'undefined';
        
        if (isAbsolute) {
          monthMap.set(monthKey, amount);
        } else {
          // Default safe behavior: add as delta
          const existing = monthMap.get(monthKey) || 0;
          monthMap.set(monthKey, existing + amount);
        }
      }
    }
  }

  return monthMap;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build MOD performance series for chart display.
 * 
 * Produces monthly time series with three values:
 * - Allocations MOD
 * - Adjusted/Projected MOD
 * - Actual Payroll MOD
 * 
 * Works for single project or all projects (aggregate).
 */
export function buildModPerformanceSeries(
  args: BuildModPerformanceSeriesArgs
): ModChartPoint[] {
  const {
    selectedProjectId = null,
    payrollDashboardRows = [],
    allocationsRows = [],
    adjustmentsRows = [],
    baselineRows = [],
    modRubrosPredicate = isModRow,
  } = args;

  // Build individual series
  const actualPayroll = buildActualPayrollSeries(
    payrollDashboardRows,
    selectedProjectId,
    modRubrosPredicate
  );

  const allocations = buildAllocationsSeries(
    allocationsRows,
    selectedProjectId,
    modRubrosPredicate
  );

  const adjustedProjected = buildAdjustedProjectedSeries(
    adjustmentsRows || [],
    baselineRows || [],
    selectedProjectId,
    modRubrosPredicate
  );

  // Collect all unique months from all series
  const allMonths = new Set<string>();
  
  Array.from(actualPayroll.keys()).forEach(month => allMonths.add(month));
  Array.from(allocations.keys()).forEach(month => allMonths.add(month));
  Array.from(adjustedProjected.keys()).forEach(month => allMonths.add(month));

  // If no months found in any series, return empty array
  if (allMonths.size === 0) {
    return [];
  }

  // Sort months ascending
  const sortedMonths = Array.from(allMonths).sort((a, b) => a.localeCompare(b));

  // Build output with exact series keys
  return sortedMonths.map((month) => ({
    month,
    "Allocations MOD": allocations.get(month) || 0,
    "Adjusted/Projected MOD": adjustedProjected.get(month) || 0,
    "Actual Payroll MOD": actualPayroll.get(month) || 0,
  }));
}
