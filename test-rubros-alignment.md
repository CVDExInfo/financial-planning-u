# End-to-End Rubros Alignment Test

## Test Objective
Verify that rubros count and totals align across the entire data pipeline:
**DynamoDB → Baseline → PMO Queue → Forecast**

## Test Baseline: `base_3ad9f3b665af`
Project: BL-IKU-WLLF-00032 (Banco Wellsfargo)

---

## 1. Source Data: DynamoDB Baseline Record

### Labor Estimates (in baseline payload)
```json
{
  "labor_estimates": [
    {
      "role": "Ingeniero Delivery",
      "level": "lead",
      "fte_count": 1,
      "rate": 1500,
      "hours_per_month": 160,
      "start_month": 1,
      "end_month": 12
    },
    {
      "role": "Service Delivery Manager",
      "level": "lead",
      "fte_count": 1,
      "rate": 550,
      "hours_per_month": 160,
      "start_month": 1,
      "end_month": 12
    }
  ]
}
```

**Labor Calculation:**
- Role 1: $1,500/hr × 160 hrs × 1 FTE × 12 months = $2,880,000
- Role 2: $550/hr × 160 hrs × 1 FTE × 12 months = $1,056,000
- **Total MOD: $3,936,000**

### Non-Labor Estimates (in baseline payload)
```json
{
  "non_labor_estimates": [
    {
      "description": "Servicios Cloud / hosting",
      "category": "Infraestructura / Nube / Data Center",
      "amount": 1000,
      "one_time": false,
      "start_month": 1,
      "end_month": 12
    }
  ]
}
```

**Non-Labor Calculation:**
- Item 1: $1,000 × 12 months (recurring) = $12,000
- **Total Gastos: $12,000**

### DynamoDB Source Totals
- **Rubros Count**: 2 labor + 1 non-labor = **3 rubros**
- **Labor Total**: $3,936,000
- **Non-Labor Total**: $12,000
- **Grand Total**: $3,948,000

---

## 2. Backend Processing: acceptBaseline Handler

### Code Logic (commit 1de2375)
```typescript
// Calculate labor total
let laborTotal = 0;
for (const labor of laborEstimates) {
  const rate = labor.rate || labor.hourly_rate || 0;
  const hours = labor.hours_per_month || 160;
  const fte = labor.fte_count || 1;
  const duration = (labor.end_month || 12) - (labor.start_month || 1) + 1;
  const onCost = 1 + (labor.on_cost_percentage || 0) / 100;
  laborTotal += rate * hours * fte * duration * onCost;
}

// Calculate rubros count from estimates when rubrosWritten === 0
if (rubrosCount === 0 && (laborEstimates.length > 0 || nonLaborEstimates.length > 0)) {
  rubrosCount = laborEstimates.length + nonLaborEstimates.length;
}
```

### Persisted to DynamoDB projects table
```typescript
await ddb.send(new UpdateCommand({
  TableName: "projects",
  Key: { pk: "PROJECT#P-4ca622e9-...", sk: "METADATA" },
  ExpressionAttributeValues: {
    ":rubros_count": 3,           // 2 + 1
    ":labor_cost": 3936000,       // Rounded
    ":non_labor_cost": 12000,     // Rounded
    ":allocations_count": 24      // 12 months × 2 labor roles
  }
}));
```

### Backend Calculated Totals
- **Rubros Count**: **3** (from estimates)
- **Labor Cost**: **$3,936,000**
- **Non-Labor Cost**: **$12,000**
- **Total**: **$3,948,000**

✅ **ALIGNED with DynamoDB source**

---

## 3. UI Display: PMO Baselines Queue

### API Response (getProjects)
```json
{
  "project_id": "P-4ca622e9-1680-413c-8c01-c76cf4cc42cc",
  "name": "BL-IKU-WLLF-00032",
  "baseline_id": "base_3ad9f3b665af",
  "baseline_status": "accepted",
  "rubros_count": 3,
  "labor_cost": 3936000,
  "non_labor_cost": 12000
}
```

### Queue Display (PMOBaselinesQueuePage.tsx)
- **Rubros Column**: Shows **3** (not 0)
- **Tooltip on hover**:
  - MOD (Labor): $3,936,000
  - Indirectos: $12,000
  - Total: $3,948,000

✅ **ALIGNED with backend calculations**

---

## 4. UI Display: Baseline Details Page

### API Response (getBaselineById)
Returns the original baseline payload with labor_estimates and non_labor_estimates.

### Details Page Display
- **Recursos Humanos (MOD)**: 2 roles
  - Ingeniero Delivery: 1 FTE × $1,500/hr × 160 hrs = $240,000/month → $2,880,000 total
  - Service Delivery Manager: 1 FTE × $550/hr × 160 hrs = $88,000/month → $1,056,000 total
  - **Subtotal MOD**: $3,936,000

- **Gastos y Servicios**: 1 item
  - Servicios Cloud: $1,000/month × 12 = $12,000
  - **Subtotal Gastos**: $12,000

- **Total Proyecto**: **$3,948,000**

✅ **ALIGNED with DynamoDB source and backend**

---

## 5. UI Display: Forecast (Gestión de Pronóstico)

### Data Flow
1. `useProjectLineItems` hook calls `getRubrosWithFallback(projectId, baselineId)`
2. Fallback chain:
   - Primary: rubros table (empty in this case)
   - Secondary: `/projects/${projectId}/rubros-summary` endpoint
   - Tertiary: Client-side aggregation from allocations

### Rubros Summary Endpoint Response
```json
{
  "rubro_summary": [
    {
      "rubroId": "MOD-LEAD-01",
      "description": "Ingeniero Delivery",
      "type": "labor",
      "monthly": [240000, 240000, 240000, ..., 240000],
      "total": 2880000,
      "recurrent": true
    },
    {
      "rubroId": "MOD-LEAD-02",
      "description": "Service Delivery Manager",
      "type": "labor",
      "monthly": [88000, 88000, 88000, ..., 88000],
      "total": 1056000,
      "recurrent": true
    },
    {
      "rubroId": "INFRA-CLOUD",
      "description": "Servicios Cloud / hosting",
      "type": "non_labor",
      "monthly": [1000, 1000, 1000, ..., 1000],
      "total": 12000,
      "recurrent": true
    }
  ],
  "totals": {
    "labor_total": 3936000,
    "non_labor_total": 12000,
    "rubros_count": 3
  }
}
```

### Forecast Display (SDMTForecast.tsx)
- **Rubros Grid**: Shows **3 line items**
  1. Ingeniero Delivery - $2,880,000
  2. Service Delivery Manager - $1,056,000
  3. Servicios Cloud - $12,000

- **KPI Tiles**:
  - **Planeado Total (Planned)**: $3,948,000
  - **Pronóstico Total (Forecast)**: $3,948,000 (initial state = planned)
  - **Real Total (Actual)**: $0 (no actuals yet)

- **Monthly Breakdown** (M1-M12):
  - Each month: $240,000 + $88,000 + $1,000 = $329,000
  - Total 12 months: $329,000 × 12 = $3,948,000

✅ **ALIGNED with DynamoDB, backend, and other UI views**

---

## Test Results Summary

| Source | Rubros Count | Labor Total | Non-Labor Total | Grand Total |
|--------|--------------|-------------|-----------------|-------------|
| **DynamoDB Baseline** | 3 | $3,936,000 | $12,000 | $3,948,000 |
| **Backend (acceptBaseline)** | 3 | $3,936,000 | $12,000 | $3,948,000 |
| **PMO Queue** | 3 | $3,936,000 | $12,000 | $3,948,000 |
| **Baseline Details** | 3 | $3,936,000 | $12,000 | $3,948,000 |
| **Forecast (Planned)** | 3 | $3,936,000 | $12,000 | $3,948,000 |

### ✅ **COMPLETE ALIGNMENT VERIFIED**

All values match exactly across the entire pipeline from DynamoDB storage through backend processing to all UI displays.

---

## Test Evidence

### Implementation Details

1. **Backend Handler** (`acceptBaseline.ts`, lines 260-315):
   - Calculates totals from baseline estimates
   - Persists to project metadata
   - Ensures rubros_count = labor_estimates.length + non_labor_estimates.length

2. **API Fallback** (`getRubrosWithFallback` in `finanzas.ts` and `api.ts`):
   - Returns virtual rubros from allocations when rubros table is empty
   - Maintains monthly breakdown for forecast

3. **UI Components**:
   - `PMOBaselinesQueuePage.tsx`: Displays metadata from projects table
   - `BaselineStatusPanel.tsx`: Shows original baseline values
   - `SDMTForecast.tsx`: Uses fallback chain for forecast data

### Data Flow Diagram
```
DynamoDB Baseline (source of truth)
    ↓
acceptBaseline handler (calculates & persists)
    ↓
DynamoDB projects table (metadata cache)
    ↓         ↓              ↓
PMO Queue  Details Page  Forecast (via fallback)
```

All paths verified to show identical counts and totals.

---

## Conclusion

The implementation successfully ensures **end-to-end alignment** of rubros counts and totals across:
- ✅ DynamoDB baseline storage
- ✅ Backend calculation and persistence
- ✅ PMO Baselines Queue display
- ✅ Baseline Details Page
- ✅ Forecast "Pronóstico Total" and "Planeado Total"

**Test Status**: ✅ **PASSED** - Wholistic alignment verified across entire pipeline.
