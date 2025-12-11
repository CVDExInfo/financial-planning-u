# UI Component Validation Matrix

**Date:** December 1, 2025  
**Purpose:** Quick reference for component status, known issues, and validation steps  
**Status:** ACTIVE – Source of truth for Finanzas SD UI validation

---

## Component Status Summary

| Component               | Build | Functionality      | UI/UX       | Testing | Notes                                                                 |
| ----------------------- | ----- | ------------------ | ----------- | ------- | --------------------------------------------------------------------- |
| **ProjectContextBar**   | ✅    | ✅                 | ✅ Improved | ⏳      | Stable redesign; used in daily flows, still needs formal test record |
| **ServiceTierSelector** | ✅    | ⏳ Verify          | ⚠️          | ⏳      | Component exists; callbacks & pricing logic still unvalidated        |
| **SDMTCatalog**         | ✅    | ⏳ Verify          | ✅          | ⏳      | Line items load; cost fields & totals need validation vs rubro data  |
| **SDMTChanges**         | ✅    | ⏳ UI ✅ / E2E ⏳  | ✅          | ⏳      | Multi-select & workflow wiring added; backend persistence untested   |
| **ApprovalWorkflow**    | ✅    | ⏳                 | ✅          | ⏳      | Integrated into SDMTChanges; approval API behaviour still pending    |
| **SDMTReconciliation**  | ✅    | ⚠️                 | ✅          | ⏳      | UI fixed for rubros; invoice upload still returns 5xx from backend   |
| **SDMTForecast**        | ✅    | ✅ (current data)  | ✅          | ⏳      | Appears stable; must re-validate once Catalog cost mapping is final  |

> Legend:  
> - ✅ = validated and stable  
> - ⏳ = implemented but not fully validated end-to-end  
> - ⚠️ = known functional risk / partial breakage  

---

## Detailed Component Analysis

### 1. ProjectContextBar ✅

**File:** `src/components/ProjectContextBar.tsx`  

**Status:** ✅ IMPLEMENTED & DEPLOYED

- Redesigned (hierarchy, width, typography) and integrated across SDMT modules.
- Used as main project selector; behaviour is stable in manual sessions.

**Validation Checklist**

- [ ] Dropdown opens/closes on click.
- [ ] All expected projects display.
- [ ] Selecting a project updates `selectedProjectId` in context.
- [ ] SDMT tabs (Catalog, Forecast, Changes, Reconciliation) reload data for new project.
- [ ] Visual styling matches current design (spacing, badge, labels).
- [ ] No console errors when switching projects quickly.

**Recommended Test Notes**

Use React DevTools or console:

```js
const { selectedProjectId, currentProject } = useProject();
console.log({ selectedProjectId, currentProject });
```

Risk Level: 🟢 LOW – stable, but keep one formal validation run on record.

### 2. ServiceTierSelector ⏳

**File:** `src/components/ServiceTierSelector.tsx`

**Status:** ⏳ NEEDS TESTING

- Renders tier cards and pricing.
- `onSelect` callback exists but not validated in live flows.
- UI hasn’t been part of recent SDMT work; medium priority.

**Validation Checklist**

- [ ] All tiers render with correct names & descriptions.
- [ ] Pricing range appears correctly for each tier.
- [ ] Clicking “Select Tier” triggers `onSelect` with correct payload.
- [ ] Parent view responds to selection (e.g., highlights chosen tier).
- [ ] Recommended tier badge shows according to spec.
- [ ] No console warnings or prop-type issues.

Risk Level: 🟡 MEDIUM – out of current critical path, but needed for full offering.

### 3. SDMTCatalog ⏳

**File:** `src/features/sdmt/cost/Catalog/SDMTCatalog.tsx`

**Status:** ⏳ WORKING BUT NEEDS COST VALIDATION

- Line items load; response format fixes applied previously.
- Table structure and filters appear to work.
- Recent sessions show all unit costs and totals as $0 for some projects; we need to confirm whether this is:
  - Real data from Dynamo (costs not yet loaded), or
  - Mapping/field issue between rubro catalog and project line items.

**Validation Checklist**

- [ ] Line items load on page open for known test project (e.g., BOA Cloud).
- [ ] Table displays: Category, Description, Type, Qty, Unit Cost, Duration, Total Cost.
- [ ] Unit Cost and Total Cost match stored values from `finz_rubros` / `finz_allocations`.
- [ ] Filters by category & search work.
- [ ] Changing project updates list and totals.
- [ ] No API format mismatch errors (e.g., filter is not a function).

Risk Level: 🟡 MEDIUM – UI is stable, but business correctness of costs must be validated after catalog/line-item mapping work.

### 4. SDMTChanges ⏳ (UI passes; full E2E pending)

**File:** `src/features/sdmt/cost/Changes/SDMTChanges.tsx`

**Status:** ⏳ STRUCTURE + UI BEHAVIOUR FIXED, FULL E2E PENDING

**Recent improvements**

- Change table loads and renders correctly.
- “View” opens detail dialog.
- New “View Workflow” button opens `ApprovalWorkflow` in a separate dialog.
- Change creation dialog now:
  - Uses currency dropdown (project default).
  - Uses `useProjectLineItems` to fetch line items for the current project.
  - Replaces free-text “affected line items” with a searchable multi-select based on canonical rubros.
  - Stores selected line item IDs and sends them as the `affected_line_items` array (same shape as before, but derived from structured selection).

**Validation Checklist (UI level)**

- [ ] With project selected, existing changes load into table.
- [ ] Status badge and amount formatting correct.
- [ ] “View” dialog shows full change details and affected line items.
- [ ] “View Workflow” opens `ApprovalWorkflow` with the right change.
- [ ] “New Change Request”:
  - [ ] Opens dialog.
  - [ ] Line-item selector shows rubros matching Catalog.
  - [ ] Multi-select allows multiple line items; badges show selected labels.
  - [ ] Submitting creates change and closes dialog.
- [ ] No console errors during these actions.

**E2E Checklist (backend)**

- [ ] `POST /projects/{id}/changes` stores `affected_line_items` as expected.
- [ ] `GET /projects/{id}/changes` returns the new change with correct fields.
- [ ] Approval actions (once wired to backend) update status and approvals array consistently.

Risk Level: 🟡 MEDIUM – UI is much stronger; approval persistence and full API round-trip still need a dedicated test cycle.

### 5. ApprovalWorkflow ⏳

**File:** `src/features/sdmt/cost/Changes/ApprovalWorkflow.tsx`

**Status:** ⏳ COMPONENT READY & WIRED, BACKEND E2E PENDING

- Receives a mapped `changeRequest` object from SDMTChanges (`mapChangeToWorkflow`).
- Displays:
  - Change summary (title, description, impact).
  - Approval steps timeline (role, status, comments).
- Exposes `onApprovalAction(id, action, comments)` callback.
- Parent (SDMTChanges) now:
  - Calls `mapChangeToWorkflow(change)` to adapt domain model.
  - Implements `handleApprovalAction` to update local state and close dialog.
- Backend call for approve/reject may still be missing or minimal; confirm before treating as fully complete.

**Validation Checklist**

- [ ] Workflow dialog shows correct change id, title, description, impact.
- [ ] Timeline entries match approvals from API.
- [ ] Icons and statuses (pending/approved/rejected) show correctly.
- [ ] Approve/Reject form appears for authorized user.
- [ ] Comment textarea validates required input.
- [ ] `onApprovalAction` is called with correct parameters.
- [ ] After action, status badge in table updates and timeline includes new step.
- [ ] Backend (if wired) persists decision; reload still shows updated status.

Risk Level: 🟡 MEDIUM – Good shape, but must be tested against real approval API.

### 6. SDMTReconciliation ⚠️

**File:** `src/features/sdmt/cost/Reconciliation/SDMTReconciliation.tsx`

**Status:** ⚠️ UI IMPROVED; BACKEND INVOICE UPLOAD STILL FAILS

**Recent improvements**

- Uses canonical rubro labels (Category / Subtype — Description) for line items, matching the catalog.
- Line-item dropdown options now derived from `useProjectLineItems`.
- When no rubros available:
  - Replaces disabled dropdown with a manual `line_item_id` input.
  - Shows contextual message (session expired, no permissions, or “no rubros configured”) instead of blocking silently.

**Current issue**

- Invoice upload (`POST /uploads/docs`) returns **500 Internal Server Error** in dev.
- Likely tied to missing/misconfigured `finz_docs` table or DOCS_BUCKET permissions.
- UI is sending sensible payload; error is backend/infra.

**Validation Checklist (UI)**

- [ ] Invoices load and display id, line_item_id, month, amount, status.
- [ ] Upload form opens and allows selecting line item and month.
- [ ] Line-item dropdown options match Catalog for same project.
- [ ] When rubros absent, manual ID input is available and clearly explained.
- [ ] No client-side errors when submitting.

**E2E Checklist (backend)**

- [ ] `POST /uploads/docs` succeeds for a small test file.
- [ ] New invoice appears in list with correct metadata.
- [ ] Status update actions (match/dispute/resolve) work and persist.
- [ ] Exports (Excel/PDF) generate correctly for reconciled invoices.

Risk Level: 🟠 MEDIUM-HIGH – Users can see UI, but core upload flow fails until backend/infra is corrected.

### 7. SDMTForecast ✅ (with caveat)

**File:** `src/features/sdmt/cost/Forecast/SDMTForecast.tsx`

**Status:** ✅ WORKING WITH CURRENT DATA; RE-VALIDATE AFTER CATALOG FIXES

- Forecast data loads from plan endpoint (e.g., `GET /projects/{id}/plan`).
- Charts/tables render without errors.
- No current bug reports; previously validated structure.

**Validation Checklist**

- [ ] Forecast page loads with selected project.
- [ ] Time scale (months) matches project duration (e.g., 12 vs 24).
- [ ] Series totals align with Catalog totals once cost mapping is correct.
- [ ] Changing project updates forecast accordingly.
- [ ] Export (if present) produces expected CSV/Excel.

Risk Level: 🟢 LOW – Functionally stable, but depends on correctness of upstream cost data.

---

## API Integration Validation (Updated)

CRITICAL: Response formats must match UI expectations.

| Endpoint | Expected Shape | Status | Notes |
| --- | --- | --- | --- |
| `GET /projects/{id}/rubros` or `/line-items` | `{ data: LineItem[], total: number }` | ⏳ | Previously fixed; verify cost fields & rubro mapping |
| `GET /projects/{id}/changes` | `ChangeRequest[]` | ⏳ | Now includes structured `affected_line_items` array |
| `GET /projects/{id}/invoices` | `InvoiceDoc[]` | ⏳ | Needed for Reconciliation tests |
| `GET /plan/forecast?projectId={id}&months={n}` | `{ data: ForecastCell[], projectId, months, generated_at }` | 🔧 | **FIXED** - Seed scripts now use correct pk format |
| `GET /payroll/dashboard` | `MODProjectionByMonth[]` | 🔧 | **FIXED** - Should return non-zero after reseeding |
| `POST /projects/{id}/changes` | Creates ChangeRequest | ⏳ | Validate multi-select mapping and persistence |
| `POST /uploads/docs` | Creates InvoiceDoc + S3 object | ❌ | Currently 500 in dev; infra/API fix required |

**Recent Fix (Dec 11, 2025)**: Fixed pk/sk mismatch in allocations & payroll seed scripts. See `docs/finanzas/testing/forecast-pipeline.md` for details.

---

## Data Flow Verification (unchanged, still critical)

**Key path:** Project selection must drive all SDMT data loads.

```
User selects project
    ↓
ProjectContextBar sets selectedProjectId
    ↓
ProjectContext context updates
    ↓
SDMTCatalog / SDMTChanges / SDMTReconciliation / SDMTForecast re-render
    ↓
useEffect([selectedProjectId]) triggers API calls
    ↓
Data loads per component
    ↓
State updates and UI re-renders with new project data
```

For each SDMT tab, verify:

- Effect dependencies include `selectedProjectId`.
- No stale data when toggling between projects.

---

## Validation Priority Matrix (Updated)

| Component | Priority | Effort | Risk | Status |
| --- | --- | --- | --- | --- |
| ProjectContextBar | High | Low | Low | ✅ |
| SDMTCatalog | High | Medium | Medium | ⏳ |
| SDMTChanges | High | Medium | Medium | ⏳ |
| ApprovalWorkflow | High | Medium | Medium | ⏳ |
| SDMTReconciliation | High | High | Medium-High ⚠️ | ⚠️ |
| ServiceTierSelector | Medium | Low | Medium | ⏳ |
| SDMTForecast | Medium | Low | Low (data-dependent) | ✅ |

---

## Validation Roadmap (Updated)

**Priority 1 – E2E Core Flows (Now)**

- Fix and validate `/uploads/docs` and docs table for Reconciliation.
- E2E test for `POST /projects/{id}/changes` and `GET /projects/{id}/changes`.
- Validate ApprovalWorkflow against backend (approve/reject persists).

**Priority 2 – Cost & Catalog Integrity**

- Confirm correct cost fields from rubro/catalog tables into SDMTCatalog.
- Re-validate SDMTForecast using corrected Catalog totals.
- Ensure Catalog and Reconciliation use same rubro/line item source.

**Priority 3 – Secondary Components & Error Paths**

- Test ServiceTierSelector callbacks in real flow.
- Validate all error states (401/403/503) present clear messages in UI.
- Cross-browser passes (Chrome, Edge, Firefox) for SDMT tabs.

---

## Governance: Using This Matrix as Baseline

- This file is the baseline for UI validation decisions.
- Before major review cycles, update it to reflect current code and infra state.
- When a feature is completed or a regression is fixed:
  - Update the relevant component row.
  - Add/remove known issues.
  - Record the date and, optionally, the commit hash in “Notes”.
- When in doubt between code and this doc, treat current code + recent diagnostics as truth and update the doc accordingly.

**Status:** Active
**Last Updated:** December 1, 2025
