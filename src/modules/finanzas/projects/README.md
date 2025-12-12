# MOD Chart Data Shaping Module

## Overview

The `modSeries.ts` module provides a pure function for building monthly time series data for MOD (Mano de Obra / Labor) charts. It produces three series:
- **Allocations MOD**: Planned allocations
- **Adjusted/Projected MOD**: Baseline with adjustments applied
- **Actual Payroll MOD**: Actual payroll paid

## Usage

### Basic Example

```typescript
import { buildModPerformanceSeries } from './modSeries';

const chartData = buildModPerformanceSeries({
  selectedProjectId: 'P-001', // or null for all projects
  payrollDashboardRows: payrollData,
  allocationsRows: allocationsData,
  adjustmentsRows: adjustmentsData,
  baselineRows: baselineData,
});

// chartData is an array of:
// [
//   {
//     month: "2025-01",
//     "Allocations MOD": 10000,
//     "Adjusted/Projected MOD": 12000,
//     "Actual Payroll MOD": 11000
//   },
//   ...
// ]
```

### Integration with ProjectsManager

To integrate with `ProjectsManager.tsx`, replace the existing `modChartDataForDetailsPanel` computation:

```typescript
import { buildModPerformanceSeries } from './projects/modSeries';

// In ProjectsManager component:
const modChartDataForDetailsPanel = React.useMemo((): ModChartPoint[] => {
  // Fetch or prepare your data sources
  const allocationsRows = []; // TODO: fetch from allocations endpoint
  const adjustmentsRows = []; // TODO: fetch from adjustments endpoint
  const baselineRows = []; // TODO: fetch from baseline endpoint

  return buildModPerformanceSeries({
    selectedProjectId: viewMode === 'project' ? selectedProjectId : null,
    payrollDashboardRows: payrollDashboard,
    allocationsRows,
    adjustmentsRows,
    baselineRows,
  });
}, [viewMode, selectedProjectId, payrollDashboard /*, allocations, adjustments, baseline */]);
```

## Data Sources

### Payroll Dashboard Rows

Expected shape (supports two formats):

**Format A: Monthly aggregated**
```typescript
{
  month: "2025-01",           // or period, monthKey
  totalActualMOD: 10000,
  totalPlanMOD: 9000,
  totalForecastMOD: 9500,
  projectId: "P-001"
}
```

**Format B: Per-entry**
```typescript
{
  paymentDate: "2025-01-15",  // or paidAt, date
  amount: 5000,
  category: "MOD",             // or any MOD indicator
  projectId: "P-001"
}
```

### Allocations Rows

**Direct monthly allocation**
```typescript
{
  month: "2025-01",
  amount: 8000,
  category: "MOD",
  projectId: "P-001"
}
```

**Multi-month allocation (expanded)**
```typescript
{
  startMonth: "2025-01",
  months: 3,
  monthlyAmount: 5000,
  category: "MOD",
  projectId: "P-001"
}
```

**With unit cost and quantity**
```typescript
{
  startMonth: "2025-01",
  unit_cost: 1000,
  qty: 5,
  months: 1,
  category: "MOD",
  projectId: "P-001"
}
```

### Adjustments Rows

**Delta adjustment (adds to baseline)**
```typescript
{
  month: "2025-01",
  monto: 2000,
  tipo: "delta",
  category: "MOD",
  projectId: "P-001"
}
```

**Absolute adjustment (overrides baseline)**
```typescript
{
  month: "2025-01",
  monto: 12000,
  adjustmentType: "absolute",
  category: "MOD",
  projectId: "P-001"
}
```

**Distributed adjustment**
```typescript
{
  projectId: "P-001",
  category: "MOD",
  tipo: "delta",
  distribucion: [
    { mes: "2025-01", monto: 1000 },
    { mes: "2025-02", monto: 1500 },
  ]
}
```

### Baseline Rows

```typescript
{
  month: "2025-01",
  totalPlanMOD: 9000,
  projectId: "P-001"
}
```

## Features

### MOD Filtering

The module automatically filters rows to include only MOD-related data. Detection includes:
- Rows with `totalActualMOD`, `totalPlanMOD`, or `totalForecastMOD` fields
- Category/tipo_costo fields containing: "mod", "mano de obra", "labor", "payroll", "nómina"
- Rubro IDs containing MOD patterns

You can override this with a custom predicate:

```typescript
const customModPredicate = (row: any) => {
  return row.customCategory === "LABOR_COST";
};

buildModPerformanceSeries({
  // ...
  modRubrosPredicate: customModPredicate,
});
```

### Month Normalization

All date/period strings are normalized to `YYYY-MM` format:
- `"2025-01-15"` → `"2025-01"`
- `"2025-01"` → `"2025-01"` (unchanged)
- Date objects are converted to `YYYY-MM`

### Complete Month Domain

The output includes every month that appears in ANY of the input series:
- Months with data in one series but not others will have 0 values
- Months are sorted in ascending order
- No gaps in the timeline

### Stability Guarantees

- **No NaN values**: All numeric values default to 0
- **Exact keys**: Output always has exactly these keys: `month`, `"Allocations MOD"`, `"Adjusted/Projected MOD"`, `"Actual Payroll MOD"`
- **Deterministic**: Same inputs always produce same outputs

## Testing

Run tests with:

```bash
npx tsx --test src/modules/finanzas/__tests__/modSeries.test.ts
```

Current test coverage: 32 tests, 100% passing

## API Reference

### `buildModPerformanceSeries(args)`

Main function for building MOD chart data.

**Parameters:**
- `args.selectedProjectId` (string | null | undefined): Filter to specific project, or null for all projects
- `args.payrollDashboardRows` (any[]): Payroll data rows
- `args.allocationsRows` (any[]): Allocation data rows
- `args.adjustmentsRows` (any[]): Adjustment data rows (optional)
- `args.baselineRows` (any[]): Baseline/plan data rows (optional)
- `args.modRubrosPredicate` ((row: any) => boolean): Custom MOD filter function (optional)

**Returns:** `ModChartPoint[]`

### `toMonthKey(input)`

Normalize date/period strings to YYYY-MM format.

**Parameters:**
- `input` (string | Date | null | undefined): Input date/period

**Returns:** `string | null`

### `isModRow(row)`

Determine if a row represents MOD data.

**Parameters:**
- `row` (any): Data row to check

**Returns:** `boolean`

## Future Enhancements

When allocations, adjustments, and baseline endpoints are ready:

1. Create API service functions in `src/api/finanzas.ts`:
   ```typescript
   export async function getAllocations(projectId?: string): Promise<Allocation[]>
   export async function getAdjustments(projectId?: string): Promise<Adjustment[]>
   export async function getBaseline(projectId?: string): Promise<Baseline[]>
   ```

2. Fetch data in `ProjectsManager.tsx`:
   ```typescript
   const [allocations, setAllocations] = React.useState([]);
   const [adjustments, setAdjustments] = React.useState([]);
   const [baseline, setBaseline] = React.useState([]);

   React.useEffect(() => {
     // Load data
   }, [selectedProjectId]);
   ```

3. Pass to `buildModPerformanceSeries()`
