# QA Test Plan: SDMT Forecast ↔ Facturas Reconciliation Navigation

## Overview
This document provides a comprehensive test plan for the bidirectional navigation feature between SDMT Forecast and Facturas Reconciliation.

## Pre-Test Setup

### Prerequisites
1. User has access to SDMT module
2. At least one project is available with:
   - Baseline configured
   - Line items (rubros) defined
   - Some months with forecasted values
3. Some line items have actuals (facturas), others don't

### Test Data Requirements
- **Project with actuals**: At least one project with existing facturas
- **Project without actuals**: At least one project with forecasted values but no facturas yet
- **User roles**: Test with both SDMT and PMO roles (permissions differ)

## Test Scenarios

### Test Group 1: Icon Visibility and Tooltip

#### TC-1.1: Icon Always Visible
**Objective**: Verify navigation icon appears for all cells with data

**Steps**:
1. Navigate to `/sdmt/cost/forecast`
2. Select a project with forecast data
3. Examine the actuals row for each line item/month combination

**Expected**:
- Icon (🔗 ExternalLink) is visible for ALL cells where planned OR forecast OR actual > 0
- Icon is NOT visible for completely empty cells (planned=0, forecast=0, actual=0)

**Priority**: HIGH

---

#### TC-1.2: Tooltip - Factura Exists
**Objective**: Verify correct tooltip when actuals exist

**Steps**:
1. Navigate to `/sdmt/cost/forecast`
2. Find a cell where actual > 0
3. Hover over the ExternalLink icon

**Expected**:
- Tooltip displays: "View/Edit Factura"

**Priority**: MEDIUM

---

#### TC-1.3: Tooltip - No Factura
**Objective**: Verify correct tooltip when no actuals

**Steps**:
1. Navigate to `/sdmt/cost/forecast`
2. Find a cell where actual = 0 but forecast or planned > 0
3. Hover over the ExternalLink icon

**Expected**:
- Tooltip displays: "Add Factura / Enter Actuals"

**Priority**: MEDIUM

---

### Test Group 2: Navigation to Reconciliation

#### TC-2.1: Navigate with Existing Factura
**Objective**: Verify navigation opens filtered view for existing factura

**Steps**:
1. Navigate to `/sdmt/cost/forecast`
2. Click icon on cell with actual > 0 (e.g., Labor, Month 2)
3. Note the current forecast URL

**Expected**:
- Navigates to `/sdmt/cost/reconciliation?line_item=XXX&month=2&returnUrl=...`
- Reconciliation page shows filtered view
- "Filtrado" badge shows the line item and month
- "Volver a Pronóstico" button is visible
- Existing factura is shown in the invoices table
- Upload dialog does NOT open automatically

**Priority**: HIGH

---

#### TC-2.2: Navigate to Create New Factura
**Objective**: Verify navigation opens upload dialog for new factura

**Steps**:
1. Navigate to `/sdmt/cost/forecast`
2. Click icon on cell with actual = 0 but forecast > 0 (e.g., Cloud Infra, Month 3)
3. Note the current forecast URL

**Expected**:
- Navigates to `/sdmt/cost/reconciliation?line_item=XXX&month=3&returnUrl=...`
- Reconciliation page shows filtered view
- Upload dialog opens AUTOMATICALLY
- Line item dropdown is pre-selected with correct rubro
- Mes Inicio is pre-selected with correct month (3)
- Mes Fin is pre-selected with correct month (3)
- Other fields (amount, vendor, etc.) are empty

**Priority**: HIGH

---

#### TC-2.3: ReturnUrl Parameter Present
**Objective**: Verify returnUrl is passed in navigation

**Steps**:
1. Navigate to `/sdmt/cost/forecast`
2. Click any navigation icon
3. Check the URL in browser address bar

**Expected**:
- URL contains `returnUrl=` parameter
- ReturnUrl value is the encoded Forecast page URL
- ReturnUrl preserves any existing query parameters from Forecast

**Priority**: MEDIUM

---

### Test Group 3: Creating New Factura

#### TC-3.1: Save New Factura - Auto Return
**Objective**: Verify successful save returns to Forecast with refresh

**Steps**:
1. From Forecast, click icon on cell with no actuals
2. Upload dialog opens automatically
3. Fill in all required fields:
   - Amount: 5000
   - Vendor: Select from dropdown or enter custom
   - Invoice Number: INV-001
   - Invoice Date: Select date
   - File: Upload a PDF
4. Click "Subir Factura"

**Expected**:
- Success toast appears: "Factura y documento subidos exitosamente"
- Upload dialog closes
- Automatically navigates back to Forecast
- URL includes `_refresh=<timestamp>` parameter
- Forecast grid reloads
- The cell that previously had actual = 0 now shows actual = 5000
- Icon tooltip changes from "Add Factura" to "View/Edit Factura"

**Priority**: HIGH

---

#### TC-3.2: Cancel New Factura - Return
**Objective**: Verify cancel returns to Forecast without changes

**Steps**:
1. From Forecast, click icon on cell with no actuals
2. Upload dialog opens
3. Fill in some fields (don't complete)
4. Click "Cancelar"

**Expected**:
- Dialog closes
- Navigates back to Forecast URL (using returnUrl)
- No changes to forecast data
- Cell still shows actual = 0

**Priority**: MEDIUM

---

#### TC-3.3: Multi-Month Factura
**Objective**: Verify creating factura for multiple months

**Steps**:
1. From Forecast, click icon on any cell
2. Upload dialog opens
3. Set Mes Inicio: 3, Mes Fin: 5
4. Fill other fields and save

**Expected**:
- Success toast mentions "3 facturas subidas exitosamente"
- Returns to Forecast
- Actuals appear for months 3, 4, and 5 for that line item

**Priority**: MEDIUM

---

### Test Group 4: Back Navigation

#### TC-4.1: Back Button - Filtered View
**Objective**: Verify "Volver a Pronóstico" button works

**Steps**:
1. From Forecast, click any icon to navigate to Reconciliation
2. Note the "Volver a Pronóstico" button in filtered view
3. Click the button

**Expected**:
- Navigates back to original Forecast URL
- Returns to same project/view context
- No data changes

**Priority**: MEDIUM

---

#### TC-4.2: Clear Filter Button
**Objective**: Verify clearing filter removes back button

**Steps**:
1. From Forecast, navigate to Reconciliation (with filters)
2. Click "Limpiar Filtro" (X button)
3. Observe the button area

**Expected**:
- Filters are cleared
- "Volver a Pronóstico" button is no longer visible
- Can still navigate using browser back or main navigation

**Priority**: LOW

---

### Test Group 5: Data Refresh

#### TC-5.1: Forecast Refresh After Save
**Objective**: Verify Forecast detects _refresh parameter and reloads

**Steps**:
1. Note the current actual value for a cell (e.g., $0)
2. Click icon, create new factura with amount $1000
3. Save and wait for automatic return
4. Check the actual value in the same cell

**Expected**:
- Cell now displays actual = $1000
- No manual page refresh required
- Data is current from API

**Priority**: HIGH

---

#### TC-5.2: Refresh Parameter Handling
**Objective**: Verify _refresh parameter is handled correctly

**Steps**:
1. Navigate to Reconciliation from Forecast
2. Save a factura
3. Check URL after return

**Expected**:
- URL contains `_refresh=<timestamp>`
- Page loads properly (no errors)
- Can continue working normally
- Refresh parameter doesn't break navigation

**Priority**: MEDIUM

---

### Test Group 6: Edge Cases

#### TC-6.1: Direct Reconciliation Access
**Objective**: Verify Reconciliation works without returnUrl

**Steps**:
1. Navigate directly to `/sdmt/cost/reconciliation` (not from Forecast)
2. Upload a factura

**Expected**:
- Page works normally
- Upload succeeds
- NO automatic navigation back (returnUrl not present)
- "Volver a Pronóstico" button not shown

**Priority**: MEDIUM

---

#### TC-6.2: Invalid ReturnUrl
**Objective**: Verify handling of malformed returnUrl

**Steps**:
1. Manually navigate to: `/sdmt/cost/reconciliation?returnUrl=invalid-url`
2. Try to interact with the page

**Expected**:
- Page loads without crash
- Back button may not work correctly, but page is functional
- Can still use main navigation

**Priority**: LOW

---

#### TC-6.3: Portfolio View
**Objective**: Verify navigation works in portfolio (all projects) view

**Steps**:
1. Select "All Projects" in project selector
2. Navigate to Forecast
3. Click icon for a specific project's line item

**Expected**:
- Navigates to Reconciliation
- Filters correctly to that project's line item
- Return navigation works
- Refresh updates portfolio view

**Priority**: MEDIUM

---

#### TC-6.4: Browser Back Button
**Objective**: Verify browser back button works as expected

**Steps**:
1. Navigate Forecast → Reconciliation → Forecast
2. Use browser back button

**Expected**:
- Browser back navigates through history properly
- No duplicate entries from auto-navigation
- Page state is correct

**Priority**: LOW

---

### Test Group 7: Permissions

#### TC-7.1: SDMT Role - All Flows
**Objective**: Verify all navigation works for SDMT role

**Steps**:
1. Login as SDMT user
2. Navigate to Forecast
3. Test all navigation scenarios

**Expected**:
- Icons are visible
- Can navigate to Reconciliation
- Can upload facturas
- Can return to Forecast

**Priority**: HIGH

---

#### TC-7.2: PMO Role - Read-Only Actuals
**Objective**: Verify PMO can view but not edit actuals

**Steps**:
1. Login as PMO user
2. Navigate to Forecast
3. Try to edit actuals
4. Try navigation to Reconciliation

**Expected**:
- Icons may be visible
- Cannot edit actuals inline
- Navigation to Reconciliation may be restricted
- Respects existing permission model

**Priority**: MEDIUM

---

### Test Group 8: Visual & UX

#### TC-8.1: Icon Consistency
**Objective**: Verify icon styling is consistent

**Steps**:
1. Navigate to Forecast
2. Examine icons across multiple cells

**Expected**:
- All icons have same size (12px as per code)
- All icons use same hover effect (bg-blue-100)
- Icons don't obscure actual values
- Tooltips appear quickly on hover

**Priority**: LOW

---

#### TC-8.2: Loading States
**Objective**: Verify loading indicators during navigation

**Steps**:
1. Navigate to Reconciliation
2. Upload a factura
3. Observe during save and return

**Expected**:
- Loading toast shows "Subiendo factura..."
- Button shows "Subiendo..." state
- Loading state during navigation (if visible)
- Success toast after completion

**Priority**: LOW

---

#### TC-8.3: Mobile Responsiveness
**Objective**: Verify navigation works on mobile viewport

**Steps**:
1. Resize browser to mobile size (or use device emulation)
2. Navigate to Forecast
3. Test icon interactions

**Expected**:
- Icons remain clickable
- Tooltips work (or are adapted for touch)
- Upload dialog is usable on mobile
- Back button is accessible

**Priority**: MEDIUM

---

## Test Execution Tracking

### Test Run Template

| TC ID | Description | Status | Notes | Tester | Date |
|-------|-------------|--------|-------|--------|------|
| TC-1.1 | Icon Always Visible | ⏳ Pending | | | |
| TC-1.2 | Tooltip - Factura Exists | ⏳ Pending | | | |
| TC-1.3 | Tooltip - No Factura | ⏳ Pending | | | |
| TC-2.1 | Navigate with Existing Factura | ⏳ Pending | | | |
| TC-2.2 | Navigate to Create New Factura | ⏳ Pending | | | |
| TC-2.3 | ReturnUrl Parameter Present | ⏳ Pending | | | |
| TC-3.1 | Save New Factura - Auto Return | ⏳ Pending | | | |
| TC-3.2 | Cancel New Factura - Return | ⏳ Pending | | | |
| TC-3.3 | Multi-Month Factura | ⏳ Pending | | | |
| TC-4.1 | Back Button - Filtered View | ⏳ Pending | | | |
| TC-4.2 | Clear Filter Button | ⏳ Pending | | | |
| TC-5.1 | Forecast Refresh After Save | ⏳ Pending | | | |
| TC-5.2 | Refresh Parameter Handling | ⏳ Pending | | | |
| TC-6.1 | Direct Reconciliation Access | ⏳ Pending | | | |
| TC-6.2 | Invalid ReturnUrl | ⏳ Pending | | | |
| TC-6.3 | Portfolio View | ⏳ Pending | | | |
| TC-6.4 | Browser Back Button | ⏳ Pending | | | |
| TC-7.1 | SDMT Role - All Flows | ⏳ Pending | | | |
| TC-7.2 | PMO Role - Read-Only Actuals | ⏳ Pending | | | |
| TC-8.1 | Icon Consistency | ⏳ Pending | | | |
| TC-8.2 | Loading States | ⏳ Pending | | | |
| TC-8.3 | Mobile Responsiveness | ⏳ Pending | | | |

### Status Legend
- ⏳ Pending - Not yet tested
- ✅ Pass - Test passed
- ❌ Fail - Test failed (see notes)
- 🚧 Blocked - Cannot test (dependency or environment issue)
- ⚠️ Warning - Test passed with minor issues

## Known Limitations

1. **Tests Skipped**: Automated tests not included (no existing test infrastructure)
2. **Backend Dependency**: Requires functional Finanzas API for full testing
3. **Data Requirements**: Needs proper test data setup
4. **Environment**: Requires DEV or QA environment with configured projects

## Regression Testing

After implementing this feature, verify these existing flows still work:

- [ ] Direct navigation to Reconciliation (without filters)
- [ ] Uploading factura via main "Subir Factura" button
- [ ] Filtering facturas manually
- [ ] Reconciliation approval workflow
- [ ] Forecast data loading without navigation
- [ ] Excel/PDF export from Forecast
- [ ] Forecast variance calculations

## Bug Report Template

If issues are found, use this template:

```markdown
### Bug Report

**TC ID**: TC-X.X
**Title**: [Brief description]
**Severity**: [Critical/High/Medium/Low]

**Environment**:
- Browser: 
- OS: 
- User Role: 
- Project: 

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:


**Actual Result**:


**Screenshots**: [Attach if applicable]

**Console Errors**: [Paste if any]

**Additional Notes**:

```

## Sign-Off

Once testing is complete, product owner and QA lead should sign off:

**QA Lead**: _____________________ Date: _____
**Product Owner**: _____________________ Date: _____
