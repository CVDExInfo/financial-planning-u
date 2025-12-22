# Testing & Validation Plan - Budget API & ESLint Fixes

**Branch:** `copilot/fix-budget-api-endpoint`  
**Status:** Ready for Testing  
**Date:** 2025-12-22

## Pre-Deployment Validation ✅

### 1. Code Review
- ✅ Automated code review completed - No issues found
- ✅ Security scan (CodeQL) completed - No vulnerabilities detected
- ✅ All changes are minimal and surgical
- ✅ No breaking changes to existing functionality

### 2. Configuration Validation

**SAM Template Syntax:**
```bash
cd services/finanzas-api
sam validate --template template.yaml
```

**Expected:** Template validation passes

**ESLint Configuration:**
```bash
node -c eslint.config.js
```

**Expected:** No syntax errors

## Post-Deployment Testing

### Phase 1: Backend API Endpoints

#### Test 1: GET Monthly Budget (First Time - 404 Expected)
```bash
# Set your environment variables
export API_BASE_URL="https://your-api-gateway.amazonaws.com/dev"
export JWT_TOKEN="your-jwt-token"

# Test GET endpoint (should return 404 if no budget set yet)
curl -X GET \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE_URL/budgets/all-in/monthly?year=2025" \
  -v
```

**Expected Response:**
- Status: `404 Not Found` (first time, no budget set)
- OR Status: `200 OK` with JSON payload if budget exists
- Headers: CORS headers present (`Access-Control-Allow-Origin`, etc.)
- Body (if 404): `{"message":"No monthly budgets found for year 2025"}`

**Validate:**
- [ ] Status code is 404 or 200 (not 500 or 502)
- [ ] CORS headers are present
- [ ] Response is valid JSON
- [ ] No "Failed to fetch" or network errors

#### Test 2: PUT Monthly Budget
```bash
# Create a sample monthly budget
curl -X PUT \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE_URL/budgets/all-in/monthly" \
  -d '{
    "year": 2025,
    "currency": "USD",
    "months": [
      {"month": "2025-01", "amount": 100000},
      {"month": "2025-02", "amount": 100000},
      {"month": "2025-03", "amount": 100000}
    ]
  }' \
  -v
```

**Expected Response:**
- Status: `200 OK`
- Body contains: `year`, `currency`, `months`, `updated_at`, `updated_by`
- `updated_by` should match your user email

**Validate:**
- [ ] Status code is 200
- [ ] Response includes all submitted months
- [ ] `updated_at` is ISO timestamp
- [ ] `updated_by` is populated

#### Test 3: GET Monthly Budget (After PUT)
```bash
# Retrieve the budget we just set
curl -X GET \
  -H "Authorization: Bearer $JWT_TOKEN" \
  "$API_BASE_URL/budgets/all-in/monthly?year=2025" \
  -v
```

**Expected Response:**
- Status: `200 OK`
- Body matches data from PUT request
- Contains all 3 months we submitted

**Validate:**
- [ ] Status code is 200
- [ ] Months array has 3 entries
- [ ] Amounts match submitted values

#### Test 4: Authorization Check (No Token)
```bash
# Try without authorization
curl -X GET \
  "$API_BASE_URL/budgets/all-in/monthly?year=2025" \
  -v
```

**Expected Response:**
- Status: `401 Unauthorized`
- OR Status: `403 Forbidden`

**Validate:**
- [ ] Endpoint is protected (not accessible without JWT)

### Phase 2: Frontend Integration

#### Test 5: Dashboard Load
1. Navigate to Finanzas dashboard: `https://your-cloudfront-url/finanzas/`
2. Log in with valid credentials
3. Select "ALL PROJECTS" view
4. Observe the monthly budget card

**Expected Behavior:**
- No "Max retries exceeded" errors in browser console
- Monthly budget card loads or shows "No data" message
- No red error toasts

**Browser Console Checks:**
```
# Should NOT see:
❌ Max retries exceeded for /budgets/all-in/monthly
TypeError: Failed to fetch

# Should see (if budget not set):
[HttpClient] 404 /budgets/all-in/monthly - Success

# OR (if budget is set):
[HttpClient] 200 /budgets/all-in/monthly - Success
```

**Validate:**
- [ ] No console errors
- [ ] Budget card renders correctly
- [ ] Loading state shows briefly then completes

#### Test 6: Monthly Budget Input & Save
1. In the monthly budget card, click "Edit" or expand the input section
2. Enter budget values for 3 months (e.g., Jan, Feb, Mar)
3. Click "Save Monthly Budget"

**Expected Behavior:**
- Success toast: "Presupuesto mensual guardado exitosamente"
- Card updates with saved values
- Last updated timestamp appears

**Validate:**
- [ ] Save completes without errors
- [ ] Success message appears
- [ ] Values persist after page refresh

#### Test 7: Budget vs Actuals KPIs
1. After setting monthly budget, observe KPI section
2. Check "Budget Consumed", "Variance", and other metrics

**Expected Behavior:**
- KPIs calculate correctly
- No NaN or Infinity values
- Percentages display properly

**Validate:**
- [ ] All KPIs show numeric values (not NaN)
- [ ] Calculations match manual verification

### Phase 3: ESLint Validation

#### Test 8: Lint JavaScript Files
```bash
# Install dependencies if not already done
npm install

# Run ESLint
npm run lint
```

**Expected Output:**
- No errors related to undefined Node.js globals
- No crashes or parsing errors
- May see warnings (those are allowed per current config)

**Validate:**
- [ ] `npm run lint` completes successfully
- [ ] No "process is not defined" errors
- [ ] No "__dirname is not defined" errors

#### Test 9: Lint Specific Config Files
```bash
# Test individual files
npx eslint eslint.config.js
npx eslint tailwind.config.js
npx eslint scripts/generate-docs-pdf.cjs
```

**Expected:**
- All files lint without errors
- Console output shows file was checked

**Validate:**
- [ ] No parsing errors
- [ ] No undefined variable errors

### Phase 4: Data Flow Validation

#### Test 10: Forecast Save → Rubros Refresh
1. Navigate to Forecast view for a specific project
2. Edit a forecast cell
3. Click "Guardar Pronóstico"
4. Observe the rubros/line items list

**Expected Behavior:**
- Forecast saves successfully
- Data reloads automatically
- Rubros list updates if affected

**Browser Console:**
```
🔄 Forecast: Loading data for project: PROJ-...
[Finz] GET /projects/{id}/rubros - Success
```

**Validate:**
- [ ] Save completes
- [ ] `loadForecastData()` is called after save
- [ ] Rubros data reflects updated forecasts

#### Test 11: ALL_PROJECTS Aggregation
1. Switch to "ALL PROJECTS" view
2. Verify portfolio summary displays

**Expected Behavior:**
- All projects aggregate correctly
- No errors for projects missing baselines
- Totals calculate properly

**Validate:**
- [ ] No console errors about undefined baselines
- [ ] All projects appear in aggregation
- [ ] Totals match sum of individual projects

### Phase 5: Regression Testing

#### Test 12: Existing Budget Endpoints
```bash
# Annual budget (should still work)
curl -X GET \
  -H "Authorization: Bearer $JWT_TOKEN" \
  "$API_BASE_URL/budgets/all-in?year=2025" \
  -v

# Budget overview (should still work)
curl -X GET \
  -H "Authorization: Bearer $JWT_TOKEN" \
  "$API_BASE_URL/budgets/all-in/overview?year=2025" \
  -v
```

**Validate:**
- [ ] Annual budget endpoint still works
- [ ] Overview endpoint still works
- [ ] No disruption to existing functionality

#### Test 13: Contract Tests
```bash
# Run full contract test suite
npm run contract-tests
```

**Expected:**
- All existing tests pass
- No new failures introduced

**Validate:**
- [ ] Contract tests complete successfully
- [ ] Budget endpoints covered (if tests exist)

## CloudWatch Monitoring

### Logs to Check
```bash
# AWS CLI commands (replace region/log-group as needed)
aws logs tail /aws/lambda/acta-budgets-function --since 10m --follow

# Look for:
✅ [budgets] GET monthly budget for 2025: {...}
✅ [budgets] SET monthly budget for 2025: {...}
❌ Any ERROR or 5xx responses
```

### Metrics to Monitor
- Lambda invocation count for `BudgetsFn`
- API Gateway 4xx/5xx error rates
- Lambda duration/memory usage

## Acceptance Criteria

### Must Pass (Blocking)
- [ ] Backend deployment succeeds without errors
- [ ] GET `/budgets/all-in/monthly` returns 200 or 404 (not 5xx)
- [ ] PUT `/budgets/all-in/monthly` accepts valid payload
- [ ] Frontend loads without "Max retries exceeded" errors
- [ ] ESLint completes without Node.js global errors
- [ ] No security vulnerabilities detected

### Should Pass (High Priority)
- [ ] Monthly budget save/load works end-to-end
- [ ] KPIs calculate correctly with budget data
- [ ] Forecast save triggers data refresh
- [ ] ALL_PROJECTS view handles missing baselines

### Nice to Have
- [ ] Contract tests updated with new endpoints
- [ ] CloudWatch dashboard shows healthy metrics
- [ ] User documentation updated

## Rollback Criteria

Rollback if any of these occur:
- ❌ SAM deployment fails
- ❌ Budget endpoints return 5xx errors consistently
- ❌ Frontend crashes or is unusable
- ❌ Data corruption detected
- ❌ Security vulnerability introduced

## Sign-Off

- [ ] Backend Developer: Deployment successful, endpoints working
- [ ] Frontend Developer: Dashboard functional, no regressions
- [ ] QA: All test scenarios passed
- [ ] Security: CodeQL scan clean, no vulnerabilities
- [ ] Product Owner: Feature works as expected

---

**Testing Window:** 1-2 hours  
**Tester:** [Name/Role]  
**Environment:** Dev/Staging/Prod  
**Results:** [Link to test run evidence]
