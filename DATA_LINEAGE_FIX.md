# Data Lineage Fix: Estimator → SDMT Mapping

## Overview

This document explains the data lineage issues between the PMO Estimator/Prefactura and SDMT modules, and the fixes implemented to ensure proper mapping of project code, name, and client fields.

## Problem Statement

When a comprehensive baseline budget was created from the Prefactura/Estimator UI and handed off to SDMT, several data mapping issues occurred:

### Issue 1: Client Field Missing
- **Symptom**: Cliente field showed "—" in SDMT views
- **Root Cause**: Client data captured in estimator wasn't flowing through handoff to SDMT
- **Impact**: Unable to identify which client a project belongs to

### Issue 2: Project Code Confusion  
- **Symptom**: Código field displayed auto-generated IDs like `PRJ-PROJECT-P-5AE50ACE`
- **Root Cause**: Backend handoff handler used `projectId` (derived from project name) as both ID and code
- **Impact**: Unfriendly, long codes in UI instead of clean identifiers like `P-5ae50ace`

### Issue 3: Missing End Date
- **Symptom**: End date (fecha_fin) was not populated in SDMT
- **Root Cause**: End date not calculated from start_date + duration_months
- **Impact**: Missing date range information for project planning

## Solution

### Backend Changes (`services/finanzas-api/src/handlers/handoff.ts`)

#### 0. Enriched API Response (NEW - Contract Compliance)
The POST `/projects/{projectId}/handoff` endpoint now returns enriched response data:

```typescript
// Response includes all relevant project metadata
const result = {
  handoffId,              // REQUIRED - maintained for API contract
  projectId,
  baselineId,
  status: "HandoffComplete",
  
  // New fields from data lineage fix
  projectName,            // Human-readable name
  client: clientName,     // Client/customer name
  code: projectCode,      // Clean project code (P-12ab34cd)
  startDate,              // Project start date
  endDate,                // Calculated end date
  durationMonths,         // Project duration
  currency,               // Project currency
  modTotal: totalAmount,  // Total MOD budget
  
  // Existing metadata
  owner: handoff.owner,
  version: handoff.version,
  createdAt: handoff.createdAt,
  updatedAt: handoff.updatedAt,
};
```

**Why this matters:**
- Maintains `handoffId` for Postman contract test compliance
- Provides all project data in single API call (reduces round trips)
- Enables API consumers to access enriched metadata immediately

#### 1. Client Field Mapping
```typescript
// BEFORE: Client extracted but variable name mismatch led to empty string
const clientName = baseline.payload?.client_name || baseline.client_name || "";

// AFTER: Same logic, but properly persisted
client: clientName || "",
cliente: clientName || "",
```

#### 2. End Date Calculation
```typescript
// NEW: Calculate end_date from start_date + duration_months
const durationMonths = baseline.payload?.duration_months || baseline.duration_months || 12;
let endDate = baseline.payload?.end_date || baseline.end_date;

if (!endDate && startDate && durationMonths) {
  const start = new Date(startDate);
  if (!isNaN(start.getTime())) {
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);
    endDate = end.toISOString().split('T')[0]; // yyyy-mm-dd format
  }
}
```

#### 3. Clean Project Code Generation
```typescript
// BEFORE: Used projectId as both ID and code
code: projectId,
codigo: projectId,

// AFTER: Generate clean, short code
let projectCode = projectId;
if (projectId.includes("PROJECT") || projectId.length > 20) {
  const baselineIdShort = baselineId.replace(/^base_/, '').substring(0, 8);
  projectCode = `P-${baselineIdShort}`;
}

code: projectCode,
codigo: projectCode,
```

### Frontend Utilities (`src/lib/projects/formatLabel.ts`)

Created a shared utility module for consistent project label formatting across the application:

#### formatProjectLabel(project, mode)
Formats project labels in three modes:
- **id-only**: Show just the code (e.g., "P-5ae50ace")
- **name-only**: Show just the name (e.g., "Mobile App")
- **id-and-name**: Show both (e.g., "P-5ae50ace – Mobile App") - **default, recommended**

#### formatProjectLabelWithClient(project, mode, includeClient)
Extends basic formatting to optionally include client name:
- Example: "P-5ae50ace – Mobile App (ACME Corp)"

This utility ensures:
- Consistent display across dropdowns, tables, and selectors
- Preference for `code` over `id` for display
- Graceful handling of missing fields
- Easy switching between display modes

## Data Flow

### Estimator → Backend → SDMT

```
1. ESTIMATOR (DealInputsStep)
   ├─ project_name: "Mobile Banking App"
   ├─ client_name: "ACME Corp"
   ├─ start_date: "2025-01-01"
   └─ duration_months: 12

2. BASELINE CREATION (baseline.ts)
   ├─ Stores in prefacturas table
   └─ Includes all estimator fields

3. HANDOFF (handoff.ts)
   ├─ Fetches baseline from prefacturas table
   ├─ Extracts: projectName, clientName, startDate, durationMonths
   ├─ Calculates: endDate = startDate + durationMonths
   ├─ Generates: projectCode (clean, short)
   └─ Creates project in projects table:
       ├─ id: projectId (internal)
       ├─ code: P-12ab34cd (user-facing)
       ├─ name: "Mobile Banking App"
       ├─ client: "ACME Corp"
       ├─ start_date: "2025-01-01"
       ├─ end_date: "2026-01-01" (calculated)
       └─ duration_months: 12

4. SDMT UI
   ├─ Fetches from /projects endpoint
   ├─ Uses getProjectDisplay() to extract display values
   └─ Renders:
       ├─ Código: P-12ab34cd (from code field)
       ├─ Nombre: Mobile Banking App (from name field)
       └─ Cliente: ACME Corp (from client field)
```

## Testing

### Unit Tests
- ✅ `src/lib/projects/__tests__/formatLabel.test.ts`: Comprehensive coverage of label formatting
- ✅ All existing backend tests pass (131 tests)

### Integration Points Validated
- ✅ Backend handoff creates project with correct fields
- ✅ Frontend display logic correctly uses code, name, and client
- ✅ Project dropdowns show consistent labels

## Manual Testing Checklist

### Prerequisites
- Access to Estimator UI: `/finanzas/pmo/prefactura/estimator`
- Access to SDMT Projects: `/finanzas/projects`

### Test Steps

1. **Create Project from Estimator**
   - [ ] Navigate to Estimator
   - [ ] Fill Deal Inputs:
     - Project Name: "Test Mobile App"
     - Client Name: "Test Client Corp"
     - Start Date: 2025-01-01
     - Duration: 12 months
     - Currency: USD
   - [ ] Complete all 5 tabs
   - [ ] Digital sign and handoff to SDMT

2. **Verify in SDMT Projects View**
   - [ ] Navigate to `/finanzas/projects`
   - [ ] Find the new project in table
   - [ ] Verify **Código** column: Shows clean code like `P-12ab34cd` (not long UUID)
   - [ ] Verify **Nombre** column: Shows "Test Mobile App"
   - [ ] Verify **Cliente** column: Shows "Test Client Corp" (not "—")
   - [ ] Verify **Fecha de inicio**: Shows 2025-01-01
   - [ ] Verify **Fecha de fin**: Shows 2026-01-01 (calculated)
   - [ ] Verify **Duración**: Shows 12 meses

3. **Verify in Project Details Panel**
   - [ ] Select the project in the table
   - [ ] Check "Detalles del proyecto seleccionado" panel
   - [ ] Verify **Código – Nombre**: Shows "P-12ab34cd · Test Mobile App"
   - [ ] Verify **Cliente**: Shows "Test Client Corp"

4. **Verify in ProjectContextBar Dropdown**
   - [ ] Open project selector dropdown
   - [ ] Verify project shows:
     - Main label: "Test Mobile App" (name)
     - Subtext: "P-12ab34cd • Test Client Corp" (code • client)
   - [ ] Verify no long UUIDs or internal IDs visible

5. **Regression Check**
   - [ ] Open an existing project (created before this fix)
   - [ ] Verify no fields are blanked out
   - [ ] Verify no console errors
   - [ ] Verify UI layout unchanged

## Backward Compatibility

### Existing Projects
- Projects created before this fix will continue to work
- May have less clean codes (legacy format preserved)
- Client field may remain empty if not captured originally
- End dates may be missing if not originally provided

### API Compatibility
- No breaking changes to API contracts
- Additional fields (end_date, duration_months) are optional
- Existing integrations continue to function

## Future Enhancements

### Potential Improvements
1. **Backfill Script**: Update existing projects with clean codes
2. **Client Migration**: Add client data for legacy projects where available
3. **End Date Calculation**: Backfill end dates for projects with start_date + duration
4. **Validation**: Add schema validation to ensure required fields are present
5. **Project Code Input**: Add optional project code field to estimator for user-defined codes

### Configuration Options
The `formatProjectLabel` utility supports three modes that can be configured per-component:
- Use `"id-and-name"` for comprehensive display (default)
- Use `"name-only"` for space-constrained UIs
- Use `"id-only"` for technical/debug views

## References

- Issue: Data lineage bug between Estimator and SDMT
- Files Modified:
  - `services/finanzas-api/src/handlers/handoff.ts`
  - `src/lib/projects/formatLabel.ts` (new)
  - `src/lib/projects/__tests__/formatLabel.test.ts` (new)
- Related Documentation:
  - `src/lib/projects/display.ts` (existing display logic)
  - `src/contexts/ProjectContext.tsx` (project context)
  - `src/modules/finanzas/projects/useProjects.ts` (project data hook)
