# MOD Payroll Projections API Documentation

## Overview

This API enables tracking of **Mano de Obra Directa (MOD)** across three temporal dimensions:
- **Plan** - Initial budget from caso de negocio
- **Forecast** - Projected payroll costs (SD/Finanzas estimates)
- **Actual** - Real executed payroll (from HR systems)

It supports the "MOD proyectado por mes de inicio" chart and labor vs indirect cost analysis on the `/finanzas/projects` dashboard.

## Endpoints

### 1. POST /payroll - Ingest Payroll Data

Create a new payroll entry (plan, forecast, or actual).

**Request:**
```json
POST /payroll
Content-Type: application/json

{
  "projectId": "P-GOLDEN-1",
  "period": "2025-01",
  "kind": "plan",
  "amount": 255000,
  "currency": "USD",
  "source": "excel",
  "rubroId": "RB0001",
  "resourceCount": 3,
  "notes": "Initial MOD budget for Q1"
}
```

**Required Fields:**
- `projectId` (string) - Format: `proj_[a-z0-9]{10}` or `P-[A-Z0-9-]+`
- `period` (string) - Format: `YYYY-MM` (e.g., "2025-01")
- `kind` (string) - One of: "plan", "forecast", "actual"
- `amount` (number) - Must be >= 0
- `currency` (string) - 3-letter code (USD, COP, EUR, etc.)

**Optional Fields:**
- `source` (string) - Origin: "excel", "hr_system", "manual", "estimator"
- `rubroId` (string) - Link to budget line item
- `allocationId` (string) - Link to allocation
- `resourceCount` (number) - FTE count
- `notes` (string) - Max 500 characters

**Response (201 Created):**
```json
{
  "id": "payroll_plan_abc1234567",
  "projectId": "P-GOLDEN-1",
  "period": "2025-01",
  "kind": "plan",
  "amount": 255000,
  "currency": "USD",
  "source": "excel",
  "rubroId": "RB0001",
  "resourceCount": 3,
  "notes": "Initial MOD budget for Q1",
  "pk": "PROJECT#P-GOLDEN-1#MONTH#2025-01",
  "sk": "PAYROLL#PLAN#payroll_plan_abc1234567",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "createdBy": "pm@example.com",
  "updatedAt": "2025-01-15T10:30:00.000Z",
  "updatedBy": "pm@example.com"
}
```

**Error Responses:**
- `400 Bad Request` - Validation error
- `500 Internal Server Error` - DynamoDB error

---

### 2. GET /payroll - Query Payroll Entries

Retrieve payroll entries for a project, optionally filtered by period and/or kind.

**Request:**
```
GET /payroll?projectId=P-GOLDEN-1&period=2025-01&kind=plan
```

**Query Parameters:**
- `projectId` (required) - Project identifier
- `period` (optional) - Filter by specific YYYY-MM
- `kind` (optional) - Filter by kind: "plan", "forecast", or "actual"

**Examples:**

1. Get all payroll for a project:
   ```
   GET /payroll?projectId=P-GOLDEN-1
   ```

2. Get all payroll for a specific month:
   ```
   GET /payroll?projectId=P-GOLDEN-1&period=2025-01
   ```

3. Get only forecasts across all months:
   ```
   GET /payroll?projectId=P-GOLDEN-1&kind=forecast
   ```

**Response (200 OK):**
```json
[
  {
    "id": "payroll_plan_abc1234567",
    "projectId": "P-GOLDEN-1",
    "period": "2025-01",
    "kind": "plan",
    "amount": 255000,
    "currency": "USD",
    "rubroId": "RB0001",
    "resourceCount": 3
  },
  {
    "id": "payroll_forecast_def7890123",
    "projectId": "P-GOLDEN-1",
    "period": "2025-01",
    "kind": "forecast",
    "amount": 265000,
    "currency": "USD",
    "rubroId": "RB0001",
    "resourceCount": 3
  },
  {
    "id": "payroll_actual_ghi4567890",
    "projectId": "P-GOLDEN-1",
    "period": "2025-01",
    "kind": "actual",
    "amount": 247500,
    "currency": "USD",
    "rubroId": "RB0001",
    "resourceCount": 3
  }
]
```

**Error Responses:**
- `400 Bad Request` - Missing projectId or invalid parameters
- `500 Internal Server Error` - DynamoDB error

---

### 3. GET /payroll/summary - Time Series with Metrics

Get a monthly time series for a project with plan/forecast/actual breakdown and labor vs indirect cost metrics.

**Request:**
```
GET /payroll/summary?projectId=P-GOLDEN-1
```

**Query Parameters:**
- `projectId` (required) - Project identifier

**Response (200 OK):**
```json
[
  {
    "period": "2025-01",
    "planMOD": 255000,
    "forecastMOD": 265000,
    "actualMOD": 247500,
    "indirectCostsPlan": 120000,
    "indirectCostsActual": 118000,
    "laborSharePlan": 0.68,
    "laborShareForecast": 0.688,
    "laborShareActual": 0.677,
    "totalPlan": 375000,
    "totalForecast": 385000,
    "totalActual": 365500
  },
  {
    "period": "2025-02",
    "planMOD": 255000,
    "forecastMOD": 265000,
    "actualMOD": 255000,
    "indirectCostsPlan": 120000,
    "indirectCostsActual": 120000,
    "laborSharePlan": 0.68,
    "laborShareForecast": 0.688,
    "laborShareActual": 0.68,
    "totalPlan": 375000,
    "totalForecast": 385000,
    "totalActual": 375000
  }
]
```

**Field Descriptions:**
- `period` - Month in YYYY-MM format
- `planMOD` - Planned MOD cost
- `forecastMOD` - Forecasted MOD cost
- `actualMOD` - Actual MOD cost
- `indirectCostsPlan` - Planned indirect costs (from allocations)
- `indirectCostsActual` - Actual indirect costs (from allocations/providers)
- `laborSharePlan` - Ratio: planMOD / (planMOD + indirectCostsPlan), 0-1
- `laborShareForecast` - Ratio: forecastMOD / (forecastMOD + indirectCostsPlan), 0-1
- `laborShareActual` - Ratio: actualMOD / (actualMOD + indirectCostsActual), 0-1
- `totalPlan` - planMOD + indirectCostsPlan
- `totalForecast` - forecastMOD + indirectCostsPlan
- `totalActual` - actualMOD + indirectCostsActual

**Notes:**
- Labor share values are undefined if denominators are 0
- If only MOD exists (no indirect costs), labor share = 1.0 (100%)
- If only indirect costs exist, labor share = 0.0 (0%)
- Forecast uses plan indirect costs if forecast indirect costs are unavailable

**Error Responses:**
- `400 Bad Request` - Missing projectId
- `500 Internal Server Error` - DynamoDB error

---

### 4. GET /payroll/dashboard - Aggregated MOD by Start Month

Get aggregated MOD projections across all projects grouped by project start month.
Used for the "MOD proyectado por mes de inicio" chart on `/finanzas/projects`.

**Request:**
```
GET /payroll/dashboard
```

**Query Parameters:** None

**Response (200 OK):**
```json
[
  {
    "month": "2025-01",
    "totalPlanMOD": 1275000,
    "totalForecastMOD": 1325000,
    "totalActualMOD": 1237500,
    "projectCount": 5
  },
  {
    "month": "2025-02",
    "totalPlanMOD": 850000,
    "totalForecastMOD": 900000,
    "totalActualMOD": 0,
    "projectCount": 3
  }
]
```

**Field Descriptions:**
- `month` - Project start month (YYYY-MM)
- `totalPlanMOD` - Sum of all projects' plan MOD
- `totalForecastMOD` - Sum of all projects' forecast MOD
- `totalActualMOD` - Sum of all projects' actual MOD
- `projectCount` - Number of projects starting in this month

**Error Responses:**
- `500 Internal Server Error` - DynamoDB error

---

## Data Model

### DynamoDB Schema

**Table:** `payroll_actuals`

**Keys:**
- `pk` - Partition key: `PROJECT#${projectId}#MONTH#${period}`
- `sk` - Sort key: `PAYROLL#${kind}#${id}`
  - Examples:
    - `PAYROLL#PLAN#payroll_plan_abc1234567`
    - `PAYROLL#FORECAST#payroll_forecast_def7890123`
    - `PAYROLL#ACTUAL#payroll_actual_ghi4567890`

**Attributes:**
- `id` (string) - Unique ID: `payroll_{kind}_{10-char-uuid}`
- `projectId` (string) - Project identifier
- `period` (string) - YYYY-MM format
- `kind` (string) - "plan", "forecast", or "actual"
- `amount` (number) - Cost amount
- `currency` (string) - Currency code
- `allocationId` (string, optional) - Link to allocation
- `rubroId` (string, optional) - Link to budget line item
- `resourceCount` (number, optional) - FTE count
- `source` (string, optional) - Data source
- `uploadedBy` (string, optional) - Email
- `uploadedAt` (string, optional) - ISO timestamp
- `notes` (string, optional) - Max 500 chars
- `createdAt` (string) - ISO timestamp
- `createdBy` (string) - Email
- `updatedAt` (string) - ISO timestamp
- `updatedBy` (string) - Email

### Backwards Compatibility

**Legacy Records:**
- Existing records with `sk: PAYROLL#${id}` (no kind prefix) are treated as `kind="actual"`
- New queries using `begins_with(sk, 'PAYROLL#')` will return both legacy and new records
- Migration strategy: Gradually migrate legacy records by adding kind field and updating sk

---

## Frontend Integration Guide

### 1. Populating the "MOD proyectado por mes de inicio" Chart

**Endpoint:** `GET /payroll/dashboard`

**Chart Configuration:**
```javascript
// Fetch data
const response = await fetch('/payroll/dashboard');
const data = await response.json();

// Transform for chart
const chartData = {
  labels: data.map(d => d.month), // ["2025-01", "2025-02", ...]
  datasets: [
    {
      label: 'Plan MOD',
      data: data.map(d => d.totalPlanMOD),
      borderColor: 'blue',
    },
    {
      label: 'Forecast MOD',
      data: data.map(d => d.totalForecastMOD),
      borderColor: 'orange',
    },
    {
      label: 'Actual MOD',
      data: data.map(d => d.totalActualMOD),
      borderColor: 'green',
    },
  ],
};
```

### 2. Displaying Per-Project MOD Time Series

**Endpoint:** `GET /payroll/summary?projectId={id}`

**Component Example:**
```jsx
function ProjectMODTimeSeries({ projectId }) {
  const [timeSeries, setTimeSeries] = useState([]);

  useEffect(() => {
    fetch(`/payroll/summary?projectId=${projectId}`)
      .then(res => res.json())
      .then(data => setTimeSeries(data));
  }, [projectId]);

  return (
    <table>
      <thead>
        <tr>
          <th>Period</th>
          <th>Plan MOD</th>
          <th>Forecast MOD</th>
          <th>Actual MOD</th>
          <th>Labor Share</th>
        </tr>
      </thead>
      <tbody>
        {timeSeries.map(row => (
          <tr key={row.period}>
            <td>{row.period}</td>
            <td>{formatCurrency(row.planMOD)}</td>
            <td>{formatCurrency(row.forecastMOD)}</td>
            <td>{formatCurrency(row.actualMOD)}</td>
            <td>{formatPercent(row.laborShareActual)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 3. Creating Payroll Entries (Form)

**Endpoint:** `POST /payroll`

**Form Example:**
```jsx
function PayrollEntryForm({ projectId }) {
  const [formData, setFormData] = useState({
    projectId,
    period: '2025-01',
    kind: 'forecast',
    amount: 0,
    currency: 'USD',
    source: 'manual',
    notes: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      const created = await response.json();
      console.log('Created:', created);
      // Refresh UI
    } else {
      const error = await response.json();
      alert(`Error: ${error.error}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select value={formData.kind} onChange={e => setFormData({...formData, kind: e.target.value})}>
        <option value="plan">Plan</option>
        <option value="forecast">Forecast</option>
        <option value="actual">Actual</option>
      </select>
      
      <input type="month" value={formData.period} onChange={e => setFormData({...formData, period: e.target.value})} />
      
      <input type="number" min="0" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} />
      
      <button type="submit">Create Payroll Entry</button>
    </form>
  );
}
```

### 4. Labor vs Indirect Cost Analysis

**Endpoint:** `GET /payroll/summary?projectId={id}`

**Display Example:**
```jsx
function LaborVsIndirectChart({ projectId }) {
  const [timeSeries, setTimeSeries] = useState([]);

  useEffect(() => {
    fetch(`/payroll/summary?projectId=${projectId}`)
      .then(res => res.json())
      .then(data => setTimeSeries(data));
  }, [projectId]);

  // Calculate average labor share
  const avgLaborSharePlan = timeSeries.reduce((sum, row) => sum + (row.laborSharePlan || 0), 0) / timeSeries.length;
  const avgLaborShareActual = timeSeries.reduce((sum, row) => sum + (row.laborShareActual || 0), 0) / timeSeries.length;

  return (
    <div>
      <h3>Labor Cost % of Total</h3>
      <p>Plan: {formatPercent(avgLaborSharePlan)}</p>
      <p>Actual: {formatPercent(avgLaborShareActual)}</p>
      
      <StackedBarChart
        data={timeSeries.map(row => ({
          period: row.period,
          labor: row.actualMOD || 0,
          indirect: row.indirectCostsActual || 0,
        }))}
      />
    </div>
  );
}
```

---

## Testing

All endpoints have been tested with:
- **52 unit tests** covering validation, metrics, and handler logic
- **200 total tests** in the test suite (all passing)
- **TypeScript compilation** with no errors

### Running Tests

```bash
cd services/finanzas-api
npm test
```

### Test Coverage

- Validation: 28 tests
- Metrics calculations: 11 tests
- Handler endpoints: 13 tests
- Existing tests: 148 tests (no regressions)

---

## Security & Authorization

- **Authentication Required:** All endpoints require valid JWT token via `ensureSDT` middleware
- **Authorization:** User must be in SDT/SDMT/FIN/PMO groups
- **Audit Trail:** All create/update operations record `createdBy`/`updatedBy` from JWT claims
- **Input Validation:** Strict Zod schemas prevent invalid data
- **XSS Protection:** No user input is rendered without sanitization

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

**Common Status Codes:**
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid JWT
- `403 Forbidden` - Insufficient permissions
- `405 Method Not Allowed` - Wrong HTTP method
- `500 Internal Server Error` - Server/database error
