# Manual Verification Checklist for Forecast V2 Finalization

This checklist provides step-by-step instructions for QA to verify the Forecast V2 rollout changes.

## Prerequisites
- Access to staging/dev environment with deploy permissions
- GitHub repository variables access
- Browser developer tools access

---

## 1. Feature Flag Verification

### Test Case 1.1: New Flag Enables Forecast V2
**Environment Setup:**
```bash
VITE_FINZ_FORECAST_V2_ENABLED=true
VITE_FINZ_NEW_FORECAST_LAYOUT=false
```

**Steps:**
1. Deploy to staging with the above configuration
2. Navigate to `/finanzas/sdmt/cost/`
3. Check navigation menu

**Expected Results:**
- ✅ Navigation item "Resumen Ejecutivo (SDMT)" is visible
- ✅ Clicking the link navigates to `/finanzas/sdmt/cost/forecast-v2`
- ✅ Page loads without errors
- ✅ Console shows: `[FeatureFlags] Loaded configuration: { USE_FORECAST_V2: true }`

---

### Test Case 1.2: Legacy Flag Still Works
**Environment Setup:**
```bash
VITE_FINZ_FORECAST_V2_ENABLED=false
VITE_FINZ_NEW_FORECAST_LAYOUT=true
```

**Steps:**
1. Deploy to staging with the above configuration
2. Navigate to `/finanzas/sdmt/cost/`
3. Check navigation menu

**Expected Results:**
- ✅ Navigation item "Resumen Ejecutivo (SDMT)" is visible
- ✅ Page loads without errors
- ✅ Console shows: `[FeatureFlags] Loaded configuration: { USE_FORECAST_V2: true }`

---

### Test Case 1.3: Both Flags Disabled
**Environment Setup:**
```bash
VITE_FINZ_FORECAST_V2_ENABLED=false
VITE_FINZ_NEW_FORECAST_LAYOUT=false
```

**Steps:**
1. Deploy to staging with the above configuration
2. Navigate to `/finanzas/sdmt/cost/`
3. Check navigation menu

**Expected Results:**
- ✅ Navigation item "Resumen Ejecutivo (SDMT)" is NOT visible
- ✅ Attempting to navigate to `/finanzas/sdmt/cost/forecast-v2` shows 404 or redirects
- ✅ Console shows: `[FeatureFlags] Loaded configuration: { USE_FORECAST_V2: false }`

---

### Test Case 1.4: Either Flag Enables (Precedence Test)
**Environment Setup:**
```bash
VITE_FINZ_FORECAST_V2_ENABLED=true
VITE_FINZ_NEW_FORECAST_LAYOUT=false
```

**Steps:**
1. Deploy with preferred flag enabled, legacy disabled
2. Verify Forecast V2 is accessible

**Expected Results:**
- ✅ Forecast V2 is enabled (same as Test 1.1)

---

## 2. Navigation Label Verification

### Test Case 2.1: Spanish Label Update
**Steps:**
1. Navigate to Forecast V2 page
2. Check navigation menu text

**Expected Results:**
- ✅ Navigation item displays: "Resumen Ejecutivo (SDMT)"
- ✅ NOT the old text: "Pronóstico SDMT — Vista Ejecutiva"

---

## 3. Canonical Matrix Data Flow

### Test Case 3.1: Excel Export Verification
**Steps:**
1. Navigate to Forecast V2 page with data
2. Click "Exportar a Excel" button
3. Open the downloaded Excel file
4. Check "Forecast_Overview" sheet

**Expected Results:**
- ✅ File downloads successfully
- ✅ Contains sheets: Forecast_Overview, Variance_Analysis, Mapping_Keys
- ✅ Data shows columns: line_item_id, month, planned, forecast, actual, variance
- ✅ Data is populated correctly from the UI display

---

### Test Case 3.2: Data Consistency
**Steps:**
1. Navigate to Forecast V2 page
2. Note the total values displayed in KPI cards
3. Export to Excel
4. Sum the values in Excel

**Expected Results:**
- ✅ Excel totals match UI KPI card totals
- ✅ Month-by-month values match the grid display
- ✅ Variance calculations are correct: (forecast - planned)

---

## 4. Build & Deployment Verification

### Test Case 4.1: Production Build
**Steps:**
1. Run build command:
   ```bash
   VITE_API_BASE_URL=https://[your-api]/dev pnpm run build
   ```
2. Check build output

**Expected Results:**
- ✅ Build completes without TypeScript errors
- ✅ Build completes without warnings (except chunk size warning)
- ✅ Output directory `dist-finanzas` is created
- ✅ Assets include: index.html, JS bundle, CSS bundle

---

### Test Case 4.2: Smoke Test
**Steps:**
1. After building, run:
   ```bash
   bash scripts/smoke-checks/check-forecast-v2.sh
   ```

**Expected Results:**
- ✅ Server starts on port 4173
- ✅ Route returns HTTP 200
- ✅ HTML structure is valid
- ✅ JS/CSS assets are referenced
- ✅ Test passes with success message

---

## 5. Documentation Verification

### Test Case 5.1: Feature Flags Documentation
**Steps:**
1. Open `docs/FEATURE_FLAGS.md`
2. Search for "VITE_FINZ_FORECAST_V2_ENABLED"

**Expected Results:**
- ✅ Flag is documented under "Master Control Flags"
- ✅ Marked as "(Preferred)"
- ✅ Legacy flag is documented with "(Legacy)" marker
- ✅ Backward compatibility is explained
- ✅ Spanish translation table includes both flags
- ✅ Example scenarios use the new flag

---

### Test Case 5.2: Deploy Workflow Configuration
**Steps:**
1. Open `.github/workflows/deploy-ui.yml`
2. Check env section

**Expected Results:**
- ✅ Contains: `VITE_FINZ_FORECAST_V2_ENABLED: ${{ vars.VITE_FINZ_FORECAST_V2_ENABLED || 'false' }}`
- ✅ Placed before `VITE_FINZ_NEW_FORECAST_LAYOUT` in the file
- ✅ Default value is 'false'

---

## 6. Regression Testing

### Test Case 6.1: Legacy Forecast Still Works
**Steps:**
1. With Forecast V2 disabled, navigate to `/finanzas/sdmt/cost/forecast`
2. Verify legacy forecast page

**Expected Results:**
- ✅ Legacy forecast page loads correctly
- ✅ All existing functionality works
- ✅ No console errors

---

### Test Case 6.2: Other Feature Flags Unaffected
**Steps:**
1. Check other feature flags like:
   - `VITE_ENABLE_RUBROS_ADAPTER`
   - `VITE_FINZ_SHOW_KEYTRENDS`
2. Verify they still work as expected

**Expected Results:**
- ✅ Other flags are unaffected
- ✅ No breaking changes to existing features

---

## 7. Security & Performance

### Test Case 7.1: No Security Vulnerabilities
**Steps:**
1. Run CodeQL scan (automated in CI)
2. Check results

**Expected Results:**
- ✅ 0 security vulnerabilities found
- ✅ No sensitive data exposed in console logs
- ✅ API endpoints are properly authenticated

---

### Test Case 7.2: Performance
**Steps:**
1. Navigate to Forecast V2 page
2. Open browser DevTools → Performance tab
3. Record page load

**Expected Results:**
- ✅ Page loads in < 3 seconds (with real data)
- ✅ No memory leaks
- ✅ Bundle size is reasonable (~2.5MB minified)

---

## Sign-off

- [ ] All test cases passed
- [ ] No regressions found
- [ ] Documentation is accurate
- [ ] Ready for production deployment

**QA Engineer:** _________________
**Date:** _________________
**Environment Tested:** _________________
**Notes:**
