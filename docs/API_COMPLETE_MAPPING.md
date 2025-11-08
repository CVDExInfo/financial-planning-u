# Finanzas API - Complete Routes & UI Mapping

**Generated:** November 8, 2025  
**API Base:** `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`  
**Status:** 20+ routes mapped to UI components

---

## Quick Summary

| Category | Routes | Implemented | UI Component |
|----------|--------|-------------|--------------|
| **Health & Status** | 1 | ✅ | N/A |
| **Catalog (Read-Only)** | 2 | ✅ | RubrosCatalog, AllocationRulesPreview |
| **Projects (CRUD)** | 5 | ⚠️ Partial | Dashboard (planned) |
| **Providers** | 2 | ⚠️ Stub | Dashboard (planned) |
| **Adjustments** | 2 | ⚠️ Stub | Dashboard (planned) |
| **Alerts** | 1 | ⚠️ Stub | Dashboard (planned) |
| **Advanced Ops** | 5 | ⚠️ Stub | Various (post-MVP) |
| **Total** | **18** | **✅ 2 Live** | **16 planned** |

---

## Route-by-Route Detail

### 🟢 HEALTH & PUBLIC

#### GET /health
- **Auth:** ❌ No auth required
- **Description:** Service health check
- **Response:** `{ "service": "finanzas-sd-api", "version": "1.0", ... }`
- **Lambda:** `finanzas-sd-api-dev-HealthFn-aZmlh3nlvqNA`
- **DynamoDB:** None
- **UI Mapping:** Startup check (app initialization)
- **Status:** ✅ **WORKING**

---

### 🟢 CATALOG (READ-ONLY, LIVE)

#### GET /catalog/rubros
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get all 71 rubros from DynamoDB finz_rubros table
- **Response:** `{ "data": [ { "id": "...", "nombre": "...", "categoria": "...", ... } ], "total": 71 }`
- **Lambda:** `finanzas-sd-api-dev-CatalogFn-uigAsFMcg0uO`
- **DynamoDB Table:** `finz_rubros` (71 items verified ✅)
- **UI Mapping:**
  - **Component:** `src/modules/finanzas/RubrosCatalog.tsx`
  - **Route:** `/catalog/rubros`
  - **Page Title:** "Gestión presupuesto — Catálogo de Rubros"
  - **Action:** Click "Catálogo" in Finanzas home, then "Rubros" in navigation
  - **Display:** Table with rubro_id, nombre, categoria, linea_codigo, tipo_costo
- **Status:** ✅ **WORKING - 71 items loaded**

---

#### GET /allocation-rules
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get allocation rules from DynamoDB finz_allocations table
- **Response:** `{ "data": [ { "id": "...", "ruleType": "...", ... } ], "total": 2 }`
- **Lambda:** `finanzas-sd-api-dev-AllocationRulesGet-wwFS2QkQHg1Q`
- **DynamoDB Table:** `finz_allocations` (2 items verified ✅)
- **UI Mapping:**
  - **Component:** `src/modules/finanzas/AllocationRulesPreview.tsx`
  - **Route:** `/rules`
  - **Page Title:** "Allocation Rules Preview"
  - **Action:** Click "Rules" in Finanzas navigation
  - **Display:** List of allocation rules
- **Status:** ✅ **WORKING - 2 items loaded**

---

### 🟡 PROJECTS (CRUD, PARTIAL)

#### GET /projects
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get all projects
- **Response:** `{ "data": [ ... ], "total": 0 }`
- **Lambda:** `finanzas-sd-api-dev-ProjectsFn-WJzowRSnvW4Y`
- **DynamoDB Table:** `finz_projects` (status TBD)
- **UI Mapping:**
  - **Component:** Dashboard (future implementation)
  - **Route:** `/projects` or future dashboard
- **Status:** ⚠️ **STUB** (returns empty, ready for implementation)
- **Test Command:** `GET /projects`

---

#### POST /projects
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Create new project
- **Request Body:** `{ "name": "...", "description": "..." }`
- **Lambda:** `finanzas-sd-api-dev-ProjectsFn-WJzowRSnvW4Y`
- **DynamoDB Table:** `finz_projects` (will create item)
- **UI Mapping:** Project creation form (future)
- **Status:** ⚠️ **STUB** (not implemented yet)
- **Test Command:** `POST /projects` with JSON body

---

#### GET /projects/{id}/plan
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get financial plan for a project
- **Path Param:** `id` (project ID)
- **Lambda:** `finanzas-sd-api-dev-PlanFn-3J5NDi5jj2LM`
- **DynamoDB Table:** TBD
- **UI Mapping:** Project detail page → Plan tab (future)
- **Status:** ⚠️ **NOT IMPLEMENTED**
- **Test Command:** `GET /projects/test-proj-001/plan`

---

#### GET /projects/{id}/rubros
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get rubros assigned to a project
- **Path Param:** `id` (project ID)
- **Lambda:** `finanzas-sd-api-dev-RubrosFn-17CzMCYNd5bX`
- **DynamoDB Table:** `finz_rubros` (join with project)
- **UI Mapping:** Project detail page → Rubros tab (future)
- **Status:** ⚠️ **STUB** (not implemented yet)
- **Test Command:** `GET /projects/test-proj-001/rubros`

---

#### POST /projects/{id}/rubros
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Assign rubros to a project
- **Path Param:** `id` (project ID)
- **Request Body:** `{ "rubros": ["rubro_1", "rubro_2"] }`
- **Lambda:** `finanzas-sd-api-dev-RubrosFn-17CzMCYNd5bX`
- **DynamoDB Table:** `finz_rubros`
- **UI Mapping:** Project detail → Rubros assignment modal (future)
- **Status:** ⚠️ **STUB** (not implemented yet)
- **Test Command:** `POST /projects/{id}/rubros` with JSON

---

#### PUT /projects/{id}/allocations:bulk
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Bulk allocate rubros to a project
- **Path Param:** `id` (project ID)
- **Request Body:** `{ "allocations": { "rubro_id": { "amount": 1000, ... } } }`
- **Lambda:** `finanzas-sd-api-dev-AllocationsFn-QsTTVsVnmn7o`
- **DynamoDB Table:** `finz_allocations`
- **UI Mapping:** Project detail → Allocations grid (future)
- **Status:** ⚠️ **STUB** (not implemented yet)
- **Test Command:** `PUT /projects/{id}/allocations:bulk` with allocations JSON

---

#### POST /projects/{id}/handoff
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Handoff a project (state transition)
- **Path Param:** `id` (project ID)
- **Request Body:** `{ "handoff_data": {...} }`
- **Lambda:** `finanzas-sd-api-dev-HandoffFn-d4vq1mjPNpze`
- **DynamoDB Table:** `finz_projects`, `finz_audit_log`
- **UI Mapping:** Project detail → Actions → Handoff button (future)
- **Status:** ⚠️ **STUB** (not implemented yet)
- **Test Command:** `POST /projects/{id}/handoff`

---

### 🟡 PROVIDERS (CRUD, STUB)

#### GET /providers
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get all providers
- **Response:** `{ "data": [], "total": 0 }`
- **Lambda:** `finanzas-sd-api-dev-ProvidersFn-4bP995P1ZfIu`
- **DynamoDB Table:** `finz_providers` (status TBD)
- **UI Mapping:** Providers dashboard (future)
- **Status:** ⚠️ **STUB**
- **Test Command:** `GET /providers`

---

#### POST /providers
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Create new provider
- **Request Body:** `{ "name": "...", "code": "...", ... }`
- **Lambda:** `finanzas-sd-api-dev-ProvidersFn-4bP995P1ZfIu`
- **DynamoDB Table:** `finz_providers`
- **UI Mapping:** Provider creation form (future)
- **Status:** ⚠️ **STUB** (not implemented yet)
- **Test Command:** `POST /providers` with JSON

---

### 🟡 ADJUSTMENTS (CRUD, STUB)

#### GET /adjustments
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get all adjustments
- **Response:** `{ "data": [], "total": 0 }`
- **Lambda:** `finanzas-sd-api-dev-AdjustmentsFn-gbjpgzr8WSEs`
- **DynamoDB Table:** `finz_adjustments`
- **UI Mapping:** Adjustments page (future)
- **Status:** ⚠️ **STUB**
- **Test Command:** `GET /adjustments`

---

#### POST /adjustments
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Create new adjustment
- **Request Body:** `{ "adjustment_data": {...} }`
- **Lambda:** `finanzas-sd-api-dev-AdjustmentsFn-gbjpgzr8WSEs`
- **DynamoDB Table:** `finz_adjustments`
- **UI Mapping:** Adjustment creation form (future)
- **Status:** ⚠️ **STUB** (not implemented yet)
- **Test Command:** `POST /adjustments`

---

### 🟡 ALERTS (READ-ONLY, STUB)

#### GET /alerts
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get system alerts and warnings
- **Response:** `{ "alerts": [], "total": 0 }`
- **Lambda:** `finanzas-sd-api-dev-AlertsFn-CeoGnMfpbM6R`
- **DynamoDB Table:** `finz_alerts`
- **UI Mapping:** Alert banner / Dashboard widget (future)
- **Status:** ⚠️ **STUB**
- **Test Command:** `GET /alerts`

---

### 🟡 ADVANCED OPERATIONS (POST, STUB)

#### POST /close-month
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Close accounting period (month-end operations)
- **Request Body:** `{ "month": "2025-11", ... }`
- **Lambda:** `finanzas-sd-api-dev-CloseMonthFn-Z7KxJt6kU04V`
- **DynamoDB Tables:** `finz_audit_log`, `finz_projects`, `finz_adjustments`
- **UI Mapping:** Accounting → Close Month button (future)
- **Status:** ⚠️ **STUB** (complex, post-MVP)
- **Test Command:** `POST /close-month` with month JSON

---

#### POST /payroll/ingest
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Ingest payroll data (from HR system)
- **Request Body:** `{ "payroll_data": {...} }`
- **Lambda:** `finanzas-sd-api-dev-PayrollFn-jUdxSEgPHceA`
- **DynamoDB Table:** `finz_payroll_actuals`
- **UI Mapping:** HR Integration → Upload Payroll (future)
- **Status:** ⚠️ **STUB** (complex, post-MVP)
- **Test Command:** `POST /payroll/ingest`

---

#### GET /prefacturas/webhook
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Get prefactura webhook status/config
- **Lambda:** `finanzas-sd-api-dev-PrefacturasFn-gRlRkUNaYe80`
- **DynamoDB:** TBD
- **UI Mapping:** Integration settings (future)
- **Status:** ⚠️ **STUB**
- **Test Command:** `GET /prefacturas/webhook`

---

#### POST /prefacturas/webhook
- **Auth:** ✅ Requires JWT Bearer token
- **Description:** Handle prefactura webhook events
- **Request Body:** `{ "webhook_data": {...} }`
- **Lambda:** `finanzas-sd-api-dev-PrefacturasFn-gRlRkUNaYe80`
- **DynamoDB:** TBD
- **UI Mapping:** Integration callbacks (future)
- **Status:** ⚠️ **STUB** (complex, post-MVP)
- **Test Command:** `POST /prefacturas/webhook`

---

## Authentication Flow (All Protected Routes)

1. **UI obtains JWT:**
   - Via Cognito Hosted UI → `/auth/callback.html` → decodes `id_token`
   - Stores in `localStorage.cv.jwt` and `localStorage.finz_jwt`

2. **API request includes Bearer token:**
   ```bash
   curl -H "Authorization: Bearer $JWT" \
        https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros
   ```

3. **API Gateway Authorizer verifies JWT:**
   - Checks signature against Cognito public keys
   - Verifies audience: `dshos5iou44tuach7ta3ici5m`
   - Verifies issuer: `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_FyHLtOhiY`
   - If valid → invokes Lambda with request context
   - If invalid → returns 401 Unauthorized

4. **Lambda processes request:**
   - Receives event with claims (email, groups, sub)
   - Queries DynamoDB
   - Returns 200 with data or 500 on error

---

## Test Script

Run comprehensive test of all routes:

```bash
cd /workspaces/financial-planning-u
bash scripts/test-all-api-routes.sh
```

**Expected Output:**
- ✅ 2 routes: 200 OK (health, /catalog/rubros, /allocation-rules)
- ⚠️ 16 routes: 200 OK or 400/404 (stub implementations or missing data)
- ❌ 0 routes: 401/403 (auth should work for all)

---

## DynamoDB Tables (All 9 Verified)

| Table | Items | Status | API Routes |
|-------|-------|--------|-----------|
| `finz_rubros` | 71 ✅ | Live | GET /catalog/rubros |
| `finz_rubros_taxonomia` | ? | Verified | Internal (taxonomy) |
| `finz_allocations` | 2 ✅ | Live | GET /allocation-rules |
| `finz_projects` | 0 | Ready | GET/POST /projects, /projects/{id}/... |
| `finz_adjustments` | 0 | Ready | GET/POST /adjustments |
| `finz_audit_log` | ? | Ready | Logged by handoff, close-month |
| `finz_alerts` | 0 | Ready | GET /alerts |
| `finz_payroll_actuals` | 0 | Ready | POST /payroll/ingest |
| `finz_providers` | 0 | Ready | GET/POST /providers |

---

## UI Components & Routes

### Currently Live
- ✅ `RubrosCatalog.tsx` → `/catalog/rubros` → GET /catalog/rubros
- ✅ `AllocationRulesPreview.tsx` → `/rules` → GET /allocation-rules
- ✅ `FinanzasHome.tsx` → `/` → Links to Catalog/Rules

### Future Implementation (Post-MVP)
- `ProjectDashboard.tsx` → `/projects` → GET /projects
- `ProjectDetail.tsx` → `/projects/{id}` → GET /projects/{id}/plan, /rubros, etc.
- `ProviderManagement.tsx` → `/providers` → GET/POST /providers
- `AdjustmentForm.tsx` → `/adjustments` → POST /adjustments
- `AlertPanel.tsx` → Dashboard widget → GET /alerts
- `PayrollImport.tsx` → `/payroll/ingest` → POST /payroll/ingest
- `MonthClose.tsx` → `/close-month` → POST /close-month

---

## Implementation Status

### Phase 1 (MVP - COMPLETE ✅)
- ✅ Health check
- ✅ GET /catalog/rubros (71 rubros from DynamoDB)
- ✅ GET /allocation-rules (2 rules from DynamoDB)
- ✅ JWT authentication from UI to API

### Phase 2 (Post-MVP)
- ⏳ Projects CRUD
- ⏳ Providers CRUD
- ⏳ Adjustments CRUD
- ⏳ Alerts retrieval

### Phase 3 (Advanced)
- ⏳ Month close operation
- ⏳ Payroll ingestion
- ⏳ Prefactura webhook integration

---

## Verification Checklist

- [x] All 18 routes defined in OpenAPI spec
- [x] All routes have proper JWT auth (except /health)
- [x] 2 routes tested and working live (catalog, rules)
- [x] 71 rubros loaded from DynamoDB
- [x] 2 allocation rules loaded from DynamoDB
- [x] API Gateway authorizer validates JWT
- [x] Lambda functions invoked successfully
- [ ] 16 stub routes to be implemented (post-MVP)
- [ ] UI components mapped (2 live, 16 future)

---

**Next Steps:**
1. Run `test-all-api-routes.sh` to verify all routes respond
2. Implement stub handlers for Phase 2 routes
3. Wire UI components to APIs as they're implemented
4. Add error handling and logging to Lambda functions
5. Document each route's request/response schema in API client

