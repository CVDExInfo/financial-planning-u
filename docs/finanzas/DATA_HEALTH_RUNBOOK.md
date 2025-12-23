# Data Health Runbook

## Overview

This runbook describes how to use the Data Health Panel and related diagnostic tools to monitor and troubleshoot data quality issues in the Finanzas application.

## Prerequisites

- Dev mode enabled (`import.meta.env.DEV === true`)
- Access to the Finanzas application
- Valid authentication credentials

## Data Health Panel

### Accessing the Panel

The Data Health Panel is only available in development mode and appears on pages that include it (typically forecast views).

**Location:** Integrated in forecast/dashboard views with a blue border and "DEV ONLY" badge.

### Running Health Checks

1. **Select a project** from the project dropdown
2. **Click "Run Check"** button in the Data Health Panel
3. **Review the results** displayed in the panel

### Health Check Components

The health check validates:

1. **Project Rubros** - Verifies rubros/line items exist for the project
2. **Line Items Count** - Shows the total number of line items
3. **Baseline Status** - Checks if project has an accepted baseline
4. **API Endpoints** - Tests critical budget endpoints:
   - `/budgets/all-in/overview?year=YYYY`
   - `/budgets/all-in/monthly?year=YYYY`

## Badge Meanings

### ✅ Healthy
- **Meaning:** All checks passed
- **Criteria:**
  - Project has an accepted baseline
  - Rubros/line items exist for the baseline
  - All API endpoints return 200 status
- **Action:** No action needed

### ⚠️ No Baseline
- **Meaning:** Project doesn't have an accepted baseline
- **Criteria:**
  - `currentProject.baselineId` is null/undefined
- **Action:** 
  1. Check if baseline was created for this project
  2. Verify baseline acceptance status in the system
  3. Use handoff/acceptance workflows to set baseline

### ❌ Missing Line Items
- **Meaning:** Project has a baseline but no materialized rubros/line items
- **Criteria:**
  - Project has `baselineId` set
  - Query returns 0 rubros for `(projectId, baselineId)`
- **Action:**
  1. Run the baseline backfill script (see below)
  2. Verify baseline payload has estimates
  3. Check materialization logs for errors

### ❌ Endpoint Errors
- **Meaning:** One or more API endpoints returned non-200 status
- **Criteria:**
  - Budget overview or monthly endpoint failed
- **Action:**
  1. Check API logs for error details
  2. Verify API gateway/Lambda configuration
  3. Confirm DynamoDB table permissions
  4. Check for path normalization issues

### ❌ Error
- **Meaning:** Health check failed with an exception
- **Criteria:**
  - Exception thrown during health check execution
- **Action:**
  1. Check browser console for error details
  2. Verify network connectivity
  3. Confirm authentication is valid

## Baseline Backfill Script

### Purpose

The backfill script materializes missing baseline line items for projects with accepted baselines.

### Location

`services/finanzas-api/scripts/backfill-baseline-lineitems.ts`

### Usage

```bash
# Dry run (default) - shows what would be done without making changes
ts-node services/finanzas-api/scripts/backfill-baseline-lineitems.ts

# Dry run for specific project
ts-node services/finanzas-api/scripts/backfill-baseline-lineitems.ts --project P-c046b5d6...

# Actually execute changes for specific project
ts-node services/finanzas-api/scripts/backfill-baseline-lineitems.ts --project P-c046b5d6... --dry-run=false

# Execute for all projects
ts-node services/finanzas-api/scripts/backfill-baseline-lineitems.ts --dry-run=false
```

### What It Does

1. **Scans** for projects with `baseline_status = "accepted"`
2. **Checks** if rubros already exist for each baseline
3. **Skips** baselines that already have materialized rubros
4. **Fetches** baseline payload from `finz_prefacturas` table
5. **Materializes** rubros using `materializeRubrosForBaseline`
6. **Logs** progress and summary

### Script Output

```
🚀 Baseline Line Items Backfill Script
======================================

Mode: DRY RUN (no changes will be made)
Target: All accepted baselines

📋 Scanning all projects for accepted baselines...
✅ Found 5 accepted baseline(s)

📦 Processing: P-c046b5d6... (baseline: base_35134ec508d2)
  ✓ Rubros already exist for this baseline. Skipping.

📦 Processing: P-abc123... (baseline: base_xyz789...)
  ⚠️  No rubros found. Fetching baseline payload...
  📊 Found 10 labor + 5 non-labor estimates
  🔍 [DRY RUN] Would materialize rubros for baseline base_xyz789...

📊 Summary
==========
Total baselines:     5
Skipped (existing):  4
Materialized:        1
Failed:              0

💡 This was a dry run. Use --dry-run=false to apply changes.
```

### When to Run

Run the backfill script when:

- Data Health Panel shows "Missing Line Items" badge
- After baseline acceptance, rubros don't appear in catalog
- After system migration or database restore
- As part of data validation after deployment

## API Endpoint Diagnostics

### Budgets Overview Endpoint

**Endpoint:** `GET /budgets/all-in/overview?year={year}`

**Expected Response:**
```json
{
  "year": 2025,
  "budgetAllIn": { "amount": 1000000, "currency": "USD" },
  "totals": {
    "planned": 850000,
    "forecast": 900000,
    "actual": 800000,
    "varianceBudgetVsForecast": 100000,
    "varianceBudgetVsActual": 200000,
    "percentBudgetConsumedActual": 80.0,
    "percentBudgetConsumedForecast": 90.0
  },
  "byProject": [...]
}
```

**Common Errors:**
- **404 Not Found** - Path normalization issue, check API base URL includes stage (`/dev`)
- **500 Server Error** - Backend error, check Lambda logs
- **403 Forbidden** - Authorization issue, verify user permissions

### Budgets Monthly Endpoint

**Endpoint:** `GET /budgets/all-in/monthly?year={year}`

**Expected Response:**
```json
{
  "year": 2025,
  "currency": "USD",
  "months": [
    { "month": "2025-01", "amount": 100000 },
    { "month": "2025-02", "amount": 100000 },
    ...
  ],
  "updated_at": "2025-01-15T10:00:00.000Z",
  "updated_by": "user@example.com"
}
```

**Common Errors:**
- **404 Not Found** - Path normalization issue, verify `/dev/budgets/all-in/monthly` preserves stage
- **400 Bad Request** - Invalid year parameter
- **500 Server Error** - Backend error, check DynamoDB permissions

## Debugging Workflow

### Scenario: "No line items found for project with baseline"

1. **Open Data Health Panel** in dev mode
2. **Run health check** for the affected project
3. **Check badge status:**
   - If "No Baseline" → Ensure baseline acceptance workflow completed
   - If "Missing Line Items" → Proceed to step 4
   - If "Healthy" → Issue might be with query filters or caching
4. **Run backfill script in dry-run mode:**
   ```bash
   ts-node services/finanzas-api/scripts/backfill-baseline-lineitems.ts --project {projectId}
   ```
5. **Review script output:**
   - If "Rubros already exist" → Check baseline ID mismatch
   - If "No rubros found" → Script will show estimate counts
   - If "Baseline payload not found" → Baseline not in `finz_prefacturas`
6. **If estimates found, run backfill with changes:**
   ```bash
   ts-node services/finanzas-api/scripts/backfill-baseline-lineitems.ts --project {projectId} --dry-run=false
   ```
7. **Verify fix:**
   - Refresh Data Health Panel
   - Run health check again
   - Badge should change to "Healthy"

### Scenario: Budget endpoints returning 404

1. **Check Data Health Panel** endpoint checks
2. **Review error message** in endpoint health section
3. **Verify API base URL** includes stage:
   - ✅ Correct: `https://api.example.com/dev/budgets/...`
   - ❌ Wrong: `https://api.example.com//budgets/...` (double slash drops `/dev`)
4. **Check finanzasClient path normalization:**
   - Open browser DevTools → Network tab
   - Trigger budget API call
   - Inspect request URL for double slashes or missing stage
5. **If path issue confirmed:**
   - Verify `http()` function in `finanzasClient.ts` strips leading slashes
   - Verify `buildUrl()` in `http-client.ts` normalizes URL joining

## Console Logging

### Dev Mode Logging

In dev mode, diagnostic logs appear in the browser console:

```
[Finanzas] 🔍 [Query Diagnostic] { queryType: 'getProjectRubros', ... }
[Finanzas] ℹ️ ✅ [Data Health][overall] healthy { rubrosCount: 45, ... }
[Finanzas] ℹ️ ✅ [Endpoint Health] { endpoint: '/budgets/...', status: 200, ... }
```

### Filtering Logs

Use browser console filters:
- `[Data Health]` - Show only data health diagnostics
- `[Endpoint Health]` - Show only endpoint checks
- `[Query Diagnostic]` - Show only query diagnostics

### Production Silence

All diagnostic logs are **silent in production** (`NODE_ENV=production`) to avoid noise.

## CI Validation (Optional)

### Automated Health Check

Add a CI job to validate endpoints in staging:

```yaml
- name: Validate Finanzas Endpoints
  run: |
    # Run backfill in dry-run mode to verify baseline integrity
    cd services/finanzas-api
    ts-node scripts/backfill-baseline-lineitems.ts
    
    # Test budget endpoints (requires valid credentials)
    curl -f https://api-staging.example.com/dev/budgets/all-in/overview?year=2025
    curl -f https://api-staging.example.com/dev/budgets/all-in/monthly?year=2025
```

## Troubleshooting Reference

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| "Missing Line Items" badge | Baseline accepted but rubros not materialized | Run backfill script |
| Catalog shows 0 rubros | Query filters by wrong baseline ID | Verify project.baseline_id matches rubros |
| Budget endpoints 404 | Path normalization dropping stage | Check URL construction, verify `/dev` preserved |
| Health check fails | Network/auth issue | Check credentials, network connectivity |
| Stale data after project switch | Race condition in data loading | Stale response guards should prevent; verify AbortController working |

## Support

For additional help:
- Review detailed error messages in browser console
- Check Lambda/API logs in AWS CloudWatch
- Consult the main FINANZAS documentation
- Contact the development team with health check results

---

**Last Updated:** December 2024
**Maintained By:** Finanzas Development Team
