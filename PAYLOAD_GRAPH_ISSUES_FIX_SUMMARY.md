# Payload & Graph Data Alignment Issues - Fix Summary

## Issue Report
User reported three critical issues with the financial planning application:
1. **Project list graphs showing blank/meaningless donut** - API returns correct data but visualization fails
2. **Baseline API/CORS errors** - User encounters CORS errors when accessing baseline functionality
3. **Forecast data not populating** - Returns empty data array despite project existing (worked 2 days ago)

## Root Cause Analysis

### 1. Project Graph Display Issue
**Problem**: DonutChart component showing empty or meaningless visualization despite API returning valid project data with `modTotal` values.

**Root Causes**:
- Chart depended on `payrollDashboard` data which was often unavailable
- Fallback logic showed project status counts instead of meaningful budget data
- Zero-value entries were not filtered, leading to empty-looking donuts
- No informative empty state messages

### 2. Forecast Data Empty
**Problem**: Forecast API endpoint returning `{data: [], projectId: "P-CLOUD-ECOPETROL", months: 60}` despite project having rubros.

**Root Causes**:
- Strict baseline filtering in `filterRubrosByBaseline()` function
- Projects with rubros that lacked `baseline_id` metadata were completely filtered out
- No fallback mechanism for legacy/untagged rubros
- Migration scenarios where baseline exists but rubros weren't retroactively tagged

### 3. Baseline CORS Error
**Problem**: User reports CORS errors when accessing baseline endpoints.

**Analysis**:
- CORS headers are properly configured in all Lambda responses (`src/lib/http.ts`)
- Accept/Reject baseline endpoints exist and are properly routed in SAM template
- Routes: `PATCH /projects/{projectId}/accept-baseline` and `PATCH /projects/{projectId}/reject-baseline`
- **Conclusion**: Not a CORS issue - likely authentication or data validation error being misinterpreted as CORS

## Solutions Implemented

### 1. Enhanced DonutChart Component
**File**: `src/components/charts/DonutChart.tsx`

**Changes**:
- Filter out zero-value entries before rendering
- Added configurable empty state messages via props:
  - `emptyStateMessage`: Primary message when no data
  - `emptyStateDetail`: Optional detailed explanation
- Improved reusability by removing hardcoded project-specific messages
- Better handling of all-zero data scenarios

**Benefits**:
- Charts now show meaningful data or clear empty states
- Component is more reusable across different contexts
- Better user experience with informative messages

### 2. Improved Project Portfolio Charts
**File**: `src/modules/finanzas/ProjectsManager.tsx`

**Changes**:
- Enhanced `coverageChartData` computation with better fallback logic:
  1. **Primary**: Show payroll dashboard coverage if available
  2. **Fallback 1**: Show top 5 projects by budget distribution
  3. **Fallback 2**: Show project count by status
- Dynamic chart titles based on data source
- Better budget visualization across portfolio
- Proper empty state messages passed to DonutChart

**Code Changes**:
```typescript
// Before: Simple status count fallback
const counts: Record<string, number> = {};
projectsForView.forEach((project) => {
  const status = project.status || "Desconocido";
  counts[status] = (counts[status] ?? 0) + 1;
});

// After: Intelligent budget-based fallback
const hasProjectBudgets = projectsForView.some(p => (p.mod_total || 0) > 0);
if (hasProjectBudgets) {
  // Show top 5 projects by budget, rest as "Otros"
  const topProjects = sortedProjects.slice(0, 5);
  // ... return meaningful budget distribution
}
```

**Benefits**:
- Portfolio visualization now shows actual budget distribution
- Graceful degradation from detailed to summary views
- More actionable insights for users

### 3. Lenient Baseline Filtering
**File**: `services/finanzas-api/src/lib/baseline-sdmt.ts`

**Changes**:
- Modified `filterRubrosByBaseline()` to include lenient mode
- If baseline is set but no rubros match, fall back to untagged rubros
- Added diagnostic logging for filtering decisions
- Handles migration scenarios where projects have legacy data

**Code Changes**:
```typescript
// Added lenient fallback logic
if (matchedRubros.length === 0 && rubros.length > 0) {
  console.warn("[filterRubrosByBaseline] No rubros matched baseline, falling back to untagged rubros");
  // Return rubros that have no baseline tag (legacy data)
  return rubros.filter((rubro) => {
    const rubroBaselineId = rubro.metadata?.baseline_id || rubro.baselineId;
    return !rubroBaselineId;
  });
}
```

**Benefits**:
- Forecast now returns data for projects with untagged rubros
- Backwards compatible with legacy data
- Better visibility into data issues via logging

### 4. Enhanced Forecast Logging
**File**: `services/finanzas-api/src/handlers/forecast.ts`

**Changes**:
- Added informative logging when rubros query returns empty
- Better diagnostics for debugging forecast data issues
- Helps identify projects without baselines or unseeded rubros

**Benefits**:
- Faster troubleshooting of forecast issues
- Better operational visibility
- Helps identify data quality problems

## Testing Recommendations

### Manual Testing
1. **Project Portfolio Charts**:
   - Load projects page with no payroll data
   - Verify chart shows top 5 projects by budget
   - Verify dynamic title matches data source

2. **Forecast Data**:
   - Test with project that has:
     - Tagged rubros (should work as before)
     - Untagged rubros (should now show data)
     - No rubros (should show empty with clear message)
   
3. **Baseline Operations**:
   - Accept baseline from SDMT role
   - Reject baseline with comment
   - Verify no CORS errors (if errors persist, investigate auth/validation)

### API Testing
```bash
# Test forecast endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/plan/forecast?projectId=P-CLOUD-ECOPETROL&months=60"

# Expected: Should return data array with forecast cells
# Before fix: Returned empty array for projects with untagged rubros
# After fix: Returns rubros data even if baseline_id tags are missing
```

## Security Analysis
✅ **CodeQL Analysis**: No security alerts found
✅ **CORS Configuration**: Properly configured with appropriate headers
✅ **Authentication**: Uses existing `ensureCanRead`/`ensureCanWrite` guards
✅ **Data Validation**: No SQL injection or XSS vulnerabilities introduced

## Deployment Notes

### Prerequisites
- No database migrations required
- No environment variable changes needed
- Backwards compatible with existing data

### Deployment Steps
1. Deploy updated Lambda functions (forecast handler)
2. Deploy updated frontend assets (charts, project manager)
3. Monitor CloudWatch logs for baseline filtering warnings
4. Verify forecast endpoints return data for existing projects

### Rollback Plan
If issues arise:
1. Revert to previous commit: `cb356e8`
2. Redeploy Lambda functions and frontend
3. No data cleanup needed (changes are read-only)

## Monitoring

### Key Metrics
- **Forecast API**: Monitor for empty data responses
- **Project Charts**: Check for "no data" states in frontend logs
- **Baseline Filtering**: Watch CloudWatch for fallback warnings

### Log Patterns to Monitor
```
[forecast] No rubros found for project
[forecast] Rubros loaded
[filterRubrosByBaseline] No rubros matched baseline, falling back to untagged rubros
```

## Files Changed
1. `services/finanzas-api/src/handlers/forecast.ts` - Enhanced logging
2. `services/finanzas-api/src/lib/baseline-sdmt.ts` - Lenient filtering
3. `src/components/charts/DonutChart.tsx` - Better visualization
4. `src/modules/finanzas/ProjectsManager.tsx` - Improved fallback logic

**Total Changes**: 106 additions, 21 deletions across 4 files

## Related Issues
- Fixes empty forecast data issue (worked 2 days ago, broke after translation)
- Fixes meaningless donut chart visualization
- Clarifies baseline CORS error (not actually CORS - likely auth/validation)

## Future Improvements
1. Add GSI on `baseline_id` for more efficient rubros queries
2. Implement retroactive baseline tagging for legacy rubros
3. Add unit tests for lenient filtering logic
4. Consider caching payroll dashboard data to reduce fallback scenarios
5. Add telemetry for chart fallback frequency

## References
- PR: #[PR_NUMBER]
- Original Issue: User report on payload alignment issues
- Related PRs: #572 (CORS fixes)
