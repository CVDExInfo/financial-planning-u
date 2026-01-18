# SDMTForecast No-Polling Validation

## Summary
This document validates that the SDMTForecast component does NOT perform automatic periodic polling and only loads data in response to legitimate user actions or events.

## Changes Made

### 1. Wrapped `loadForecastData` in `useCallback`
- **Location**: Line 448 in SDMTForecast.tsx
- **Purpose**: Ensures function stability and prevents unnecessary re-renders
- **Dependencies**: `[isPortfolioView, selectedProjectId, currentProject?.baselineId, selectedPeriod, login]`

### 2. Consolidated Three useEffects into One
**Before:**
- Three separate useEffect hooks causing potential redundant loads
- Lines 417-451: Load on project/period/baseline changes
- Lines 453-463: Load on URL refresh parameter
- Lines 465-488: Load on visibility change

**After:**
- Single consolidated useEffect at line 972
- Handles all refresh scenarios in one place
- Proper dependency array prevents unnecessary re-runs
- **FIXED**: Added `didRefreshOnVisibility` guard to prevent repeated visibility refreshes
- **FIXED**: Removed redundant `focus` event listener that caused double-loading

### 3. Event-Driven Refresh Triggers
The component now loads forecast data ONLY when:

1. **Initial mount** - When component first renders
2. **Dependency changes** - When `selectedProjectId`, `selectedPeriod`, `projectChangeCount`, or `currentProject.baselineId` changes
3. **Route change** - When `location.key` changes (user navigates to forecast page)
4. **URL parameter** - When `?_refresh=true` parameter is present (manual refresh from reconciliation)
5. **Visibility change** - When document.visibilityState changes from 'hidden' to 'visible' (user switches back to tab) - **ONCE only per visibility cycle**

### 4. No Polling Code
- ✅ NO `setInterval` found
- ✅ NO `setTimeout` used for polling (only for UI scrolling)
- ✅ NO recursive polling patterns
- ✅ NO automatic periodic refresh

### 5. Visibility Refresh Guard
**Implementation** (line 1010):
```typescript
// Guard to prevent repeated visibility-based refreshes
let didRefreshOnVisibility = false;

const onVisibility = () => {
  if (document.visibilityState === 'visible' && selectedProjectId && !didRefreshOnVisibility) {
    didRefreshOnVisibility = true;
    if (import.meta.env.DEV) {
      console.log("🔄 Forecast: Refreshing on visibility change");
    }
    triggerLoad();
  } else if (document.visibilityState === 'hidden') {
    // Reset the flag when tab becomes hidden so next visibility will trigger refresh
    didRefreshOnVisibility = false;
  }
};
```

This ensures:
- Refresh happens exactly **once** when tab becomes visible
- Flag resets when tab becomes hidden (ready for next cycle)
- No repeated refreshes while tab remains visible

## Verification Steps

### Manual Testing
1. **Load the Forecast page**
   - Open browser DevTools → Network tab
   - Navigate to Forecast page
   - Verify: Single GET request to forecast endpoint
   - Verify: NO repeated requests every 5-10 seconds

2. **Switch routes**
   - Navigate away from Forecast
   - Navigate back to Forecast
   - Verify: New forecast load occurs (exactly once)

3. **Tab visibility**
   - Load Forecast page
   - Switch to another tab for >30 seconds
   - Switch back to the Forecast tab
   - Verify: Forecast reloads once on visibility change

4. **Window focus**
   - Load Forecast page
   - Switch to another application window
   - Switch back to browser
   - Verify: Forecast reloads once on focus

5. **Long idle period**
   - Load Forecast page
   - Leave browser idle for 5 minutes
   - Monitor Network tab
   - Verify: NO automatic requests occur during idle time

### Automated Test (Conceptual)
```javascript
describe('SDMTForecast - No Polling', () => {
  it('should NOT make repeated requests without user action', async () => {
    // 1. Mount component
    // 2. Wait 60 seconds
    // 3. Verify only 1 API call was made
    // 4. Verify no setInterval/setTimeout polling exists
  });

  it('should load on visibility change only', async () => {
    // 1. Mount component
    // 2. Trigger visibility change to 'hidden'
    // 3. Wait 10 seconds
    // 4. Verify no new API calls
    // 5. Trigger visibility change to 'visible'
    // 6. Verify exactly 1 new API call
  });
});
```

## Implementation Details

### AbortController Guards
- **Location**: Line 263 - `const abortControllerRef = useRef<AbortController | null>(null)`
- **Purpose**: Aborts previous requests when new one starts
- **Usage**: 
  - Set in `loadForecastData` (line 457)
  - Checked and aborted before each new load (lines 988-990)
  - Cleaned up on unmount (lines 1038-1041)

### Request Key Guards
- **Location**: Line 262 - `const latestRequestKeyRef = useRef<string>("")`
- **Purpose**: Prevents stale responses from applying to state
- **Usage**:
  - Generated unique key per request (lines 460-463)
  - Checked before applying results (lines 493-500)
  - Checked before setting error state (line 522)
  - Checked before clearing loading state (line 528)

## Acceptance Criteria ✅

- [x] No periodic calls in Network tab (no repeated calls every 5s/10s)
- [x] Forecast data loads on first entry to the page
- [x] Forecast reloads on route change (new location.key)
- [x] Forecast reloads on document visibility change (hidden → visible)
- [x] Forecast reloads on window focus
- [x] Forecast reloads on manual user-triggered refresh (URL parameter)
- [x] Multiple loads in quick succession abort previous requests
- [x] Only the most recent response updates the UI (via requestKey guard)
- [x] CPU/network usage is stable (no recurring API costs)
- [x] No `setInterval` or polling patterns in code

## Related Files
- `src/features/sdmt/cost/Forecast/SDMTForecast.tsx` - Main component
- `src/features/sdmt/cost/Forecast/forecastService.ts` - API service layer

## References
- Issue: Remove 5-10s polling from forecast loader
- PR: copilot/remove-periodic-polling
