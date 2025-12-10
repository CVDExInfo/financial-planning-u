# Example API Request/Response Payloads for Frontend Integration

## 1. Creating Plan Payroll Entry

### Request
```http
POST /payroll
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "projectId": "P-GOLDEN-1",
  "period": "2025-01",
  "kind": "plan",
  "amount": 255000,
  "currency": "USD",
  "source": "excel",
  "rubroId": "RB0001",
  "resourceCount": 3,
  "notes": "Initial MOD budget for engineers - Q1 2025"
}
```

### Response (201 Created)
```json
{
  "id": "payroll_plan_a1b2c3d4e5",
  "projectId": "P-GOLDEN-1",
  "period": "2025-01",
  "kind": "plan",
  "amount": 255000,
  "currency": "USD",
  "source": "excel",
  "rubroId": "RB0001",
  "resourceCount": 3,
  "notes": "Initial MOD budget for engineers - Q1 2025",
  "pk": "PROJECT#P-GOLDEN-1#MONTH#2025-01",
  "sk": "PAYROLL#PLAN#payroll_plan_a1b2c3d4e5",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "createdBy": "pm@ikusi.com",
  "updatedAt": "2025-01-15T10:30:00.000Z",
  "updatedBy": "pm@ikusi.com"
}
```

---

## 2. Query All Payroll for a Project

### Request
```http
GET /payroll?projectId=P-GOLDEN-1
Authorization: Bearer {jwt_token}
```

### Response (200 OK)
```json
[
  {
    "id": "payroll_plan_a1b2c3d4e5",
    "projectId": "P-GOLDEN-1",
    "period": "2025-01",
    "kind": "plan",
    "amount": 255000,
    "currency": "USD",
    "rubroId": "RB0001",
    "resourceCount": 3,
    "pk": "PROJECT#P-GOLDEN-1#MONTH#2025-01",
    "sk": "PAYROLL#PLAN#payroll_plan_a1b2c3d4e5"
  },
  {
    "id": "payroll_forecast_f6g7h8i9j0",
    "projectId": "P-GOLDEN-1",
    "period": "2025-01",
    "kind": "forecast",
    "amount": 265000,
    "currency": "USD",
    "rubroId": "RB0001",
    "resourceCount": 3,
    "source": "hr_system",
    "pk": "PROJECT#P-GOLDEN-1#MONTH#2025-01",
    "sk": "PAYROLL#FORECAST#payroll_forecast_f6g7h8i9j0"
  },
  {
    "id": "payroll_actual_k1l2m3n4o5",
    "projectId": "P-GOLDEN-1",
    "period": "2025-01",
    "kind": "actual",
    "amount": 247500,
    "currency": "USD",
    "rubroId": "RB0001",
    "resourceCount": 3,
    "source": "SAP_HR",
    "uploadedBy": "finance@ikusi.com",
    "uploadedAt": "2025-02-05T08:00:00.000Z",
    "pk": "PROJECT#P-GOLDEN-1#MONTH#2025-01",
    "sk": "PAYROLL#ACTUAL#payroll_actual_k1l2m3n4o5"
  },
  {
    "id": "payroll_forecast_p6q7r8s9t0",
    "projectId": "P-GOLDEN-1",
    "period": "2025-02",
    "kind": "forecast",
    "amount": 265000,
    "currency": "USD",
    "rubroId": "RB0001",
    "resourceCount": 3,
    "pk": "PROJECT#P-GOLDEN-1#MONTH#2025-02",
    "sk": "PAYROLL#FORECAST#payroll_forecast_p6q7r8s9t0"
  }
]
```

---

## 3. Query Specific Period and Kind

### Request
```http
GET /payroll?projectId=P-GOLDEN-1&period=2025-01&kind=plan
Authorization: Bearer {jwt_token}
```

### Response (200 OK)
```json
[
  {
    "id": "payroll_plan_a1b2c3d4e5",
    "projectId": "P-GOLDEN-1",
    "period": "2025-01",
    "kind": "plan",
    "amount": 255000,
    "currency": "USD",
    "rubroId": "RB0001",
    "resourceCount": 3,
    "pk": "PROJECT#P-GOLDEN-1#MONTH#2025-01",
    "sk": "PAYROLL#PLAN#payroll_plan_a1b2c3d4e5"
  }
]
```

---

## 4. Get Project Time Series with Metrics

### Request
```http
GET /payroll/summary?projectId=P-GOLDEN-1
Authorization: Bearer {jwt_token}
```

### Response (200 OK)
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
    "laborShareForecast": 0.6883116883116883,
    "laborShareActual": 0.6773972602739726,
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
    "laborShareForecast": 0.6883116883116883,
    "laborShareActual": 0.68,
    "totalPlan": 375000,
    "totalForecast": 385000,
    "totalActual": 375000
  },
  {
    "period": "2025-03",
    "planMOD": 255000,
    "forecastMOD": 265000,
    "indirectCostsPlan": 120000,
    "laborSharePlan": 0.68,
    "laborShareForecast": 0.6883116883116883,
    "totalPlan": 375000,
    "totalForecast": 385000
  }
]
```

**Usage Notes:**
- Missing fields indicate no data for that dimension (e.g., no actual data for March yet)
- Labor share is always between 0 and 1 (0% to 100%)
- If only MOD exists (no indirect costs), labor share = 1.0
- Total includes both MOD and indirect costs

---

## 5. Dashboard MOD Aggregation

### Request
```http
GET /payroll/dashboard
Authorization: Bearer {jwt_token}
```

### Response (200 OK)
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
    "totalPlanMOD": 2125000,
    "totalForecastMOD": 2190000,
    "totalActualMOD": 1850000,
    "projectCount": 8
  },
  {
    "month": "2025-03",
    "totalPlanMOD": 850000,
    "totalForecastMOD": 900000,
    "totalActualMOD": 0,
    "projectCount": 3
  }
]
```

**Usage for Chart:**
```javascript
const chartData = {
  labels: data.map(d => d.month),
  datasets: [
    {
      label: 'Plan MOD',
      data: data.map(d => d.totalPlanMOD),
      borderColor: 'rgb(59, 130, 246)', // blue
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
    },
    {
      label: 'Forecast MOD',
      data: data.map(d => d.totalForecastMOD),
      borderColor: 'rgb(251, 146, 60)', // orange
      backgroundColor: 'rgba(251, 146, 60, 0.5)',
    },
    {
      label: 'Actual MOD',
      data: data.map(d => d.totalActualMOD),
      borderColor: 'rgb(34, 197, 94)', // green
      backgroundColor: 'rgba(34, 197, 94, 0.5)',
    },
  ],
};
```

---

## Error Responses

### 400 Bad Request - Missing Required Field
```json
{
  "error": "Validation failed: period: Required"
}
```

### 400 Bad Request - Invalid Period Format
```json
{
  "error": "Validation failed: period must be in YYYY-MM format with valid month (01-12)"
}
```

### 400 Bad Request - Negative Amount
```json
{
  "error": "Validation failed: amount must be non-negative"
}
```

### 400 Bad Request - Invalid Kind
```json
{
  "error": "Invalid kind parameter. Must be one of: plan, forecast, actual",
  "statusCode": 400
}
```

### 400 Bad Request - Missing Query Parameter
```json
{
  "error": "Missing required query parameter: projectId",
  "statusCode": 400
}
```

### 405 Method Not Allowed
```json
{
  "error": "Method PUT not allowed",
  "statusCode": 405
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "DynamoDB operation failed: {detailed error message}"
}
```

---

## Frontend React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface PayrollTimeSeries {
  period: string;
  planMOD?: number;
  forecastMOD?: number;
  actualMOD?: number;
  indirectCostsPlan?: number;
  indirectCostsActual?: number;
  laborSharePlan?: number;
  laborShareForecast?: number;
  laborShareActual?: number;
  totalPlan?: number;
  totalForecast?: number;
  totalActual?: number;
}

export function usePayrollSummary(projectId: string) {
  const [data, setData] = useState<PayrollTimeSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/payroll/summary?projectId=${projectId}`,
          {
            headers: {
              'Authorization': `Bearer ${getAuthToken()}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  return { data, loading, error };
}

// Usage in component:
function ProjectMODChart({ projectId }: { projectId: string }) {
  const { data, loading, error } = usePayrollSummary(projectId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <LineChart
      data={{
        labels: data.map(d => d.period),
        datasets: [
          {
            label: 'Plan',
            data: data.map(d => d.planMOD || 0),
          },
          {
            label: 'Forecast',
            data: data.map(d => d.forecastMOD || 0),
          },
          {
            label: 'Actual',
            data: data.map(d => d.actualMOD || 0),
          },
        ],
      }}
    />
  );
}
```

---

## Testing the API

### Using curl

```bash
# Create plan payroll entry
curl -X POST http://localhost:3000/payroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "projectId": "P-GOLDEN-1",
    "period": "2025-01",
    "kind": "plan",
    "amount": 255000,
    "currency": "USD"
  }'

# Query payroll
curl "http://localhost:3000/payroll?projectId=P-GOLDEN-1" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get summary with metrics
curl "http://localhost:3000/payroll/summary?projectId=P-GOLDEN-1" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get dashboard data
curl "http://localhost:3000/payroll/dashboard" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Using Postman

1. Set up environment variable for JWT token
2. Import requests from examples above
3. Set Authorization header: `Bearer {{jwt_token}}`
4. Send requests and inspect responses

---

## Data Flow

```
┌─────────────────┐
│  Frontend UI    │
│ (Create/Edit    │
│  MOD Entry)     │
└────────┬────────┘
         │
         │ POST /payroll
         │ {projectId, period, kind, amount, ...}
         ▼
┌─────────────────┐
│  Payroll        │
│  Handler        │
│  (Validation)   │
└────────┬────────┘
         │
         │ putPayrollEntry()
         ▼
┌─────────────────┐
│  DynamoDB       │
│  payroll_actuals│
│  table          │
└────────┬────────┘
         │
         │ GET /payroll/summary?projectId=X
         ▼
┌─────────────────┐
│  Payroll        │
│  Handler        │
│  (Aggregation)  │
└────────┬────────┘
         │
         │ queryPayrollByProject()
         │ + calculateLaborVsIndirect()
         ▼
┌─────────────────┐
│  Frontend UI    │
│  (Time Series   │
│   Chart)        │
└─────────────────┘
```
