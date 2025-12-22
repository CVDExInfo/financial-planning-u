# Budget Persistence & KPI/UX Fixes - Verification Guide

## Overview
This guide provides step-by-step instructions to verify the budget persistence features and KPI fixes implemented for the Gestión de Pronóstico module.

## Prerequisites
- Access to the Finanzas SD application
- User with PMO or SDMT role
- Portfolio view access (select "TODOS" project)
- Current year data available

## Test Scenarios

### 1. Annual Budget Persistence

#### Test 1.1: Save Annual Budget
**Steps:**
1. Navigate to Gestión de Pronóstico (Forecast Management)
2. Select "TODOS" in the project selector (portfolio view)
3. Expand the "Presupuesto & Simulación" panel
4. Enter a budget amount (e.g., 5000000)
5. Select currency (USD/EUR/MXN)
6. Click "Guardar Presupuesto"

**Expected Results:**
- Button shows "Guardando..." while saving
- Success toast message appears: "Presupuesto anual guardado exitosamente"
- "Última actualización" timestamp appears below the form
- Budget amount remains in the input field

#### Test 1.2: Verify Budget Persistence Across Refresh
**Steps:**
1. After saving (Test 1.1), refresh the browser page (F5)
2. Wait for page to reload
3. Expand the "Presupuesto & Simulación" panel

**Expected Results:**
- Budget amount is still shown in the input field
- "Última actualización" timestamp is displayed
- No data loss after refresh

#### Test 1.3: Verify Budget KPIs Update
**Steps:**
1. Save an annual budget (Test 1.1)
2. Scroll to the KPI tiles section (below main KPIs)

**Expected Results:**
- Four blue-bordered KPI cards appear:
  1. "Presupuesto Anual All-In" showing the saved amount
  2. "Sobre/Bajo Presupuesto" showing variance
  3. "% Consumo Pronóstico" showing forecast consumption %
  4. "% Consumo Real" showing actual consumption %
- All KPIs display numeric values (not "—")
- Percentages are correctly calculated

#### Test 1.4: Verify Permissions
**Steps:**
1. Log in as user WITHOUT PMO/SDMT role
2. Navigate to Gestión de Pronóstico
3. Expand "Presupuesto & Simulación" panel

**Expected Results:**
- Input fields are disabled
- "Guardar Presupuesto" button is disabled
- Warning message appears: "⚠️ Solo usuarios PMO/SDMT pueden editar el presupuesto anual"

---

### 2. Monthly Budget Persistence

#### Test 2.1: Enable Monthly Budget Mode
**Steps:**
1. Ensure annual budget is set (Test 1.1)
2. In "Presupuesto & Simulación" panel, find "Modo: Presupuesto Mensual" section
3. Check the "Habilitar entrada mensual" checkbox

**Expected Results:**
- Monthly budget card appears with 12 month inputs (Ene-Dic)
- Each month shows "Estimado" badge (not yet entered)
- Summary shows "0/12 meses" entered
- Auto-fill helper text is displayed

#### Test 2.2: Enter Monthly Budgets
**Steps:**
1. Enable monthly budget mode (Test 2.1)
2. Enter amounts for several months (e.g., Ene=400000, Feb=450000, Mar=500000)
3. Leave some months empty

**Expected Results:**
- Entered months show the value in the input
- "Total Ingresado" summary updates
- "Restante" shows remaining budget
- Badge changes from "Estimado" to showing the entered count (e.g., "3/12 meses")

#### Test 2.3: Save Monthly Budgets
**Steps:**
1. Enter at least one monthly budget (Test 2.2)
2. Click "Guardar Presupuesto Mensual" button

**Expected Results:**
- Button shows "Guardando..." while saving
- Success toast: "Presupuesto mensual guardado exitosamente"
- "Última actualización" timestamp appears at bottom of card
- Entered values remain in the form

#### Test 2.4: Verify Monthly Budget Persistence
**Steps:**
1. After saving monthly budgets (Test 2.3), refresh the browser page
2. Re-enable monthly budget mode if needed

**Expected Results:**
- Monthly budget checkbox is already checked
- All previously entered monthly values are restored
- "Última actualización" timestamp is shown
- Updated by user email is displayed

#### Test 2.5: Reset Monthly Budgets
**Steps:**
1. With monthly budgets entered, click "Restablecer Distribución" button

**Expected Results:**
- All monthly inputs are cleared
- Info toast: "Presupuesto mensual restablecido a distribución automática"
- Budget reverts to auto-distribution based on planned costs

---

### 3. KPI Functionality

#### Test 3.1: % Consumo Real Updates
**Steps:**
1. Set annual budget (e.g., 5000000)
2. Ensure you have actual costs recorded (via reconciliation)
3. View the "% Consumo Real" KPI tile

**Expected Results:**
- KPI shows calculated percentage (e.g., "15.5%")
- Color is green if < 90%, yellow if 90-100%, red if > 100%
- NOT stuck at 0%
- NOT showing "—" when budget and actuals exist

#### Test 3.2: % Consumo Pronóstico Updates
**Steps:**
1. Set annual budget
2. Ensure forecast data exists
3. View the "% Consumo Pronóstico" KPI tile

**Expected Results:**
- KPI shows calculated percentage
- Updates when forecast values change
- Color coding matches utilization level

#### Test 3.3: KPI Null-Safe Display
**Steps:**
1. Delete annual budget (or test with year that has no budget)
2. View KPI tiles in portfolio view

**Expected Results:**
- All four KPI tiles are visible
- Budget amount shows "—"
- Variance shows "—" with "No hay presupuesto" message
- Percentages show "—"
- No JavaScript errors in console

#### Test 3.4: Simulation vs Real Budget KPIs
**Steps:**
1. Set annual budget
2. Enable "Simulador de Presupuesto"
3. Enter a different simulation amount
4. Check which KPI tiles are visible

**Expected Results:**
- When simulation is enabled: Shows 4 purple-bordered "Simulation KPI" tiles
- When simulation is disabled: Shows 4 blue-bordered "Real Budget KPI" tiles
- KPIs switch correctly when toggling simulation
- Real KPIs use actual budget data, not simulation data

---

### 4. Spanish Localization

#### Test 4.1: UI Text Verification
**Steps:**
1. Navigate through Gestión de Pronóstico page
2. Check all visible text elements

**Expected Results:**
- Export button says "Exportar" (not "Export")
- Month labels in monthly budget card: Ene, Feb, Mar, Abr, May, Jun, Jul, Ago, Sep, Oct, Nov, Dic
- Chart title: "Tendencias Mensuales de Pronóstico"
- Variance analysis: "Análisis de Variación vs Presupuesto"
- Insights labels in Spanish
- No English strings visible

#### Test 4.2: Chart Labels
**Steps:**
1. Scroll to charts section
2. Check legend and axis labels

**Expected Results:**
- Line chart legend shows: "Plan", "Pronóstico", "Real", "Presupuesto"
- Variance chart shows: "Pronóstico Sobre Presupuesto", "Pronóstico Bajo Presupuesto", etc.
- All in Spanish

---

### 5. Integration Tests

#### Test 5.1: End-to-End Workflow
**Steps:**
1. Start fresh (clear any existing budget for test year)
2. Set annual budget: 6000000 USD
3. Enable monthly budgets
4. Enter budgets for all 12 months (totaling 6000000)
5. Save monthly budgets
6. Refresh page
7. Check KPI tiles
8. Check monthly breakdown grid

**Expected Results:**
- All data persists across refresh
- KPIs show correct calculations
- Monthly grid shows budget allocations
- No data inconsistencies

#### Test 5.2: Budget Mismatch Warning
**Steps:**
1. Set annual budget: 6000000
2. Enter monthly budgets totaling > 6000000 (e.g., 7000000)

**Expected Results:**
- Warning banner appears: "⚠️ La suma de presupuestos mensuales excede el presupuesto anual"
- Numbers shown in red
- Can still save (no hard block)

---

## API Verification

### Backend Endpoints

#### Test: Monthly Budget API
```bash
# Get monthly budget
curl -X GET "https://{API_URL}/budgets/all-in/monthly?year=2025" \
  -H "Authorization: Bearer {TOKEN}"

# Expected: 200 OK with monthly budget data or 404 if not set

# Set monthly budget
curl -X PUT "https://{API_URL}/budgets/all-in/monthly" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "currency": "USD",
    "months": [
      {"month": "2025-01", "amount": 500000},
      {"month": "2025-02", "amount": 500000}
    ]
  }'

# Expected: 200 OK with saved data and timestamps
```

---

## Known Issues & Limitations

1. **Monthly budget auto-fill**: Months without explicit budget use proportional distribution of remaining annual budget
2. **Permissions**: Only PMO/SDMT roles can edit budgets (read-only for others)
3. **Currency**: Budget currency should match project currencies for accurate calculations
4. **Year range**: Budget years limited to 2020-2100

---

## Troubleshooting

### Issue: KPIs show 0% or "—" when budget exists
**Solution:**
- Ensure you're in portfolio view (TODOS selected)
- Verify budget was saved successfully (check "Última actualización")
- Check browser console for API errors
- Reload budget overview by re-saving annual budget

### Issue: Monthly budgets don't save
**Solution:**
- Verify at least one month has a value entered
- Check user has PMO/SDMT role
- Ensure total doesn't exceed reasonable limits
- Check network tab for API errors

### Issue: Budget doesn't persist after refresh
**Solution:**
- Verify save operation completed (toast message)
- Check backend logs for DynamoDB write errors
- Ensure year is correct (not a different year)
- Clear browser cache if stale data

---

## Security Verification

### Test: Unauthorized Access
**Steps:**
1. Log in as user without PMO/SDMT role
2. Try to call PUT /budgets/all-in directly via API

**Expected Results:**
- 403 Forbidden response
- Error: "SDMT or ADMIN role required for budget updates"

---

## Performance Verification

### Test: Load Time
**Steps:**
1. Set annual budget and monthly budgets
2. Refresh page and measure load time

**Expected Results:**
- Page loads in < 3 seconds
- Budget data appears within 1 second
- No visible loading flicker for cached data

---

## Acceptance Criteria Checklist

- [ ] "% Consumo Real" KPI never stuck at 0 when budgetOverview provides a value
- [ ] Shows "—" only if no budget exists
- [ ] Annual budget persists: reload shows same amount + lastUpdated metadata
- [ ] Monthly budgets persist across refresh
- [ ] Monthly budgets drive "Presupuesto" row in breakdown table
- [ ] Simulation remains optional and doesn't override Real Budget KPIs
- [ ] 100% Spanish UI strings on page (no Project/Period/Export)
- [ ] Tests updated and passing
- [ ] Permissions work correctly (PMO/SDMT can edit, others cannot)
- [ ] Toast notifications for all save operations
- [ ] Loading states prevent double-submission
