# Implementation Evidence Summary

## SAM Template (Deployment Configuration)

### Lambda Function: BudgetsFn ✅
**File:** `services/finanzas-api/template.yaml`

Added new Lambda function for budget endpoints:
- **Handler:** `budgets.handler`
- **Runtime:** Node.js 20.x
- **Build:** esbuild with minification and sourcemaps
- **Permissions:**
  - DynamoDBCrudPolicy on ProjectsTable (for budget storage)
  - DynamoDBReadPolicy on AllocationsTable (for planned/forecast totals)
  - DynamoDBReadPolicy on PayrollTable (for actual totals)
- **Events:**
  - `GET /budgets/all-in` - Get annual budget
  - `PUT /budgets/all-in` - Set annual budget (PMO/ADMIN)
  - `GET /budgets/all-in/overview` - Get budget overview with cross-project totals
- **Auth:** All routes protected with Cognito JWT authorizer

### Validation ✅
- **Command:** `sam validate --lint`
- **Result:** Template is valid ✅

### Note on Allocations Endpoint
The existing `AllocationsFn` already handles the forecast bulk update endpoint:
- **Existing Route:** `PUT /projects/{id}/allocations:bulk`
- **Handler Logic:** Now includes query parameter check for `?type=forecast` to route to forecast update logic
- **No template changes needed** - the route already exists

## Backend Implementation

### API Unit Tests ✅
- **Total Tests:** 395 tests passed
- **Test Coverage:**
  - Allocations handler: 7 tests (including forecast bulk update)
  - Budgets handler: 7 tests
  - All existing handlers: 381 tests
- **Command:** `cd services/finanzas-api && npm test`

### OpenAPI Specification ✅
- **Spectral Lint:** 0 errors, 7 warnings (unused components - expected)
- **New Endpoints Documented:**
  - `PUT /projects/{id}/allocations:bulk?type=forecast` - Forecast bulk update
  - `GET /budgets/all-in?year=YYYY` - Get annual budget
  - `PUT /budgets/all-in?year=YYYY` - Set annual budget (PMO/ADMIN only)
  - `GET /budgets/all-in/overview?year=YYYY` - Get budget overview with cross-project totals
- **New Schemas:**
  - `ForecastBulkUpdate` - Forecast bulk update payload
  - `AnnualBudget` - Annual budget response
  - `AnnualBudgetUpsert` - Annual budget request
  - `AnnualBudgetOverview` - Budget overview with totals
- **Command:** `npx @stoplight/spectral-cli lint openapi/finanzas.yaml`

### Handler Implementations ✅

#### Allocations Handler (`services/finanzas-api/src/handlers/allocations.ts`)
- **New Function:** `bulkUpdateForecast()`
- **Auth:** PMO role required via `ensurePMO()`
- **Endpoint:** `PUT /projects/{id}/allocations:bulk?type=forecast`
- **Logic:**
  - Validates request with Zod schema
  - Updates forecast values for existing allocations only
  - Returns counts: updated, skipped, total
  - Logs all operations

#### Budgets Handler (`services/finanzas-api/src/handlers/budgets.ts`)
- **New Functions:**
  - `getAllInBudget()` - GET /budgets/all-in
  - `putAllInBudget()` - PUT /budgets/all-in (PMO/ADMIN only)
  - `getAllInBudgetOverview()` - GET /budgets/all-in/overview
- **Storage Pattern:** Uses finz_projects table with pk=ORG#FINANZAS, sk=BUDGET#ALLIN#YEAR#{year}
- **Overview Logic:**
  - Queries all projects from META items
  - Aggregates allocations and payroll actuals for specified year
  - Calculates variances and consumption percentages
  - Returns per-project breakdown

#### Validation Schemas
- **File:** `services/finanzas-api/src/validation/allocations.ts`
  - `ForecastBulkItemSchema` - Single forecast item
  - `ForecastBulkUpdateSchema` - Full forecast update payload
- **File:** `services/finanzas-api/src/validation/budgets.ts`
  - `AnnualBudgetSchema` - Budget record
  - `AnnualBudgetUpsertSchema` - Budget upsert payload
  - `AnnualBudgetOverviewSchema` - Overview response

#### Auth Enhancement (`services/finanzas-api/src/lib/auth.ts`)
- **New Function:** `ensurePMO()` - Validates PMO role for forecast updates and budget management

## Frontend Implementation

### API Client Methods ✅
**File:** `src/api/finanzasClient.ts`

#### Forecast Management
```typescript
async bulkUpsertForecast(
  projectId: string,
  items: Array<{ rubroId: string; month: string; forecast: number }>
): Promise<{ success: boolean; updated: number; skipped: number; total: number }>
```

#### Budget Management
```typescript
async getAllInBudget(year: number): Promise<{
  year: number;
  amount: number | null;
  currency: string;
  updated_at?: string;
  updated_by?: string;
}>

async putAllInBudget(
  year: number,
  amount: number,
  currency: string = "USD"
): Promise<{ ... }>

async getAllInBudgetOverview(year: number): Promise<{
  year: number;
  budgetAllIn: { amount: number; currency: string } | null;
  totals: { ... };
  byProject?: Array<{ ... }>;
}>
```

## Documentation

### UI-API Action Map ✅
**File:** `docs/ui-api-action-map.md`

Documented:
- Forecast "Guardar Pronóstico" button → `bulkUpsertForecast()` → `PUT /projects/{id}/allocations:bulk?type=forecast`
- Budget year selector → `getAllInBudget()` + `getAllInBudgetOverview()` → GET endpoints
- Budget "Guardar Presupuesto" button → `putAllInBudget()` → `PUT /budgets/all-in`

Each entry includes:
- UI location
- Client method name
- HTTP endpoint
- Auth requirements
- Request/response examples
- UI effects (toast, invalidate queries, etc.)

## API Smoke Test Examples

### Forecast Bulk Update (PMO only)
```bash
# Update forecast values
curl -X PUT "https://your-api.execute-api.us-east-2.amazonaws.com/dev/finanzas/projects/P-123/allocations:bulk?type=forecast" \
  -H "Authorization: Bearer $PMO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "rubroId": "MOD-ING",
        "month": "2025-01",
        "forecast": 12000
      },
      {
        "rubroId": "MOD-ING",
        "month": "2025-02",
        "forecast": 13000
      }
    ]
  }'

# Expected Response:
# {
#   "success": true,
#   "updated": 2,
#   "skipped": 0,
#   "total": 2
# }
```

### Budget Management
```bash
# Get budget for 2026
curl -X GET "https://your-api.execute-api.us-east-2.amazonaws.com/dev/finanzas/budgets/all-in?year=2026" \
  -H "Authorization: Bearer $TOKEN"

# Set budget for 2026 (PMO/ADMIN only)
curl -X PUT "https://your-api.execute-api.us-east-2.amazonaws.com/dev/finanzas/budgets/all-in?year=2026" \
  -H "Authorization: Bearer $PMO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000000,
    "currency": "USD"
  }'

# Get budget overview for 2026
curl -X GET "https://your-api.execute-api.us-east-2.amazonaws.com/dev/finanzas/budgets/all-in/overview?year=2026" \
  -H "Authorization: Bearer $TOKEN"

# Expected Response:
# {
#   "year": 2026,
#   "budgetAllIn": {
#     "amount": 5000000,
#     "currency": "USD"
#   },
#   "totals": {
#     "planned": 3500000,
#     "forecast": 3850000,
#     "actual": 2700000,
#     "varianceBudgetVsForecast": -1150000,
#     "varianceBudgetVsActual": -2300000,
#     "percentBudgetConsumedActual": 54.0,
#     "percentBudgetConsumedForecast": 77.0
#   },
#   "byProject": [...]
# }
```

## Remaining Work

### Frontend UI Components (Not Started)
1. **Forecast PMO Editing** (`src/features/sdmt/cost/Forecast/SDMTForecast.tsx`)
   - Make forecast cells editable for PMO role
   - Add "Guardar Pronóstico" button
   - Wire to `finanzasClient.bulkUpsertForecast()`
   - Update KPI cards with correct forecast totals

2. **Annual Budget UI** (`src/modules/finanzas/HubDesempeno.tsx`)
   - Add year selector component
   - Add budget amount display and edit form (PMO only)
   - Add KPI tiles for budget metrics
   - Wire to budget client methods

### Final Validation
- [ ] Root build: `npm run build` (to be run after frontend UI is complete)
- [ ] Manual testing of UI components
- [ ] Code review

## Files Changed

### Backend
- `services/finanzas-api/src/handlers/allocations.ts` - Added forecast bulk update
- `services/finanzas-api/src/handlers/budgets.ts` - New budget handler (311 lines)
- `services/finanzas-api/src/lib/auth.ts` - Added ensurePMO function
- `services/finanzas-api/src/validation/allocations.ts` - Added forecast schemas
- `services/finanzas-api/src/validation/budgets.ts` - New budget validation (68 lines)
- `services/finanzas-api/tests/unit/allocations.handler.spec.ts` - Added forecast tests
- `services/finanzas-api/tests/unit/budgets.handler.spec.ts` - New budget tests (249 lines)

### Frontend
- `src/api/finanzasClient.ts` - Added 4 new methods (130 lines)

### Documentation
- `openapi/finanzas.yaml` - Added 4 endpoints and 4 schemas (513 lines)
- `docs/ui-api-action-map.md` - New documentation file (3332 characters)

**Total Lines Added:** ~930 lines of production code + ~360 lines of tests
