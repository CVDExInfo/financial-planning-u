# SDMT Invoice Reconciliation UX & Data Integrity Improvements

## Overview

This document describes the improvements made to the SDMT Invoice Reconciliation screen (`/finanzas/sdmt/cost/reconciliation`) to enhance user experience, data integrity, and operational efficiency.

## Scope

Route: `/finanzas/sdmt/cost/reconciliation`  
Main Component: `src/features/sdmt/cost/Reconciliation/SDMTReconciliation.tsx`

## Implementation Summary

### A. Invoice Number Behavior

**Analysis:**
- Backend stores `invoiceNumber` as a user-entered business key (external reference from vendor)
- Backend auto-generates internal `invoiceId` using `INV-{uuid}` pattern
- `invoice_number` field is treated as the vendor's invoice reference

**Implementation:**
- Kept invoice number as **free-form text input** (user-entered)
- Added `.trim()` on input to remove leading/trailing whitespace
- Added validation hint: "Enter the invoice number from vendor's invoice document"
- No backend changes required - maintains existing contract

**Rationale:**
- Invoice numbers vary widely by vendor (format, length, characters)
- User needs flexibility to match vendor's exact invoice reference
- Internal ID (`invoiceId`) is system-generated for joins/links
- `invoice_number` is purely for business reference and display

---

### B. Vendor Field Behavior

**Analysis:**
- Providers catalog exists at `/providers` endpoint
- Provider entity includes: `id`, `nombre`, `tax_id`, `tipo`, `estado`, contact info
- Invoice records store vendor as free-text string (no foreign key constraint)

**Implementation:**
1. Created `useProviders` hook (`src/hooks/useProviders.ts`):
   - Fetches registered providers via `finanzasClient.getProviders()`
   - Filters to active providers by default
   - Caches results for 5 minutes
   - Handles auth errors gracefully

2. Updated vendor field in Upload Invoice modal:
   - Changed from `<Input>` to `<Select>` when providers are available
   - Populates dropdown with registered provider names
   - Added "Other (enter manually)" option for edge cases
   - Falls back to free-text input if no providers loaded
   - Shows loading state while fetching providers

3. Backwards compatibility:
   - Still stores vendor as string (no breaking backend changes)
   - Supports historical invoices with free-form vendor names
   - No foreign key constraint on `vendor` field

**Rationale:**
- Encourages use of registered vendors for consistency
- Reduces typos and duplicate vendor names
- Maintains flexibility for ad-hoc/one-time vendors
- No migration needed for existing data

**File:** `src/hooks/useProviders.ts`
```typescript
export function useProviders(options: ProvidersOptions = {}) {
  const query = useQuery({
    queryKey: ["providers", options.tipo, options.estado],
    queryFn: async () => {
      const providers = await finanzasClient.getProviders({
        tipo: options.tipo,
        estado: options.estado || "active",
        limit: 100,
      });
      return providers;
    },
    enabled: options.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  // ...
}
```

---

### C. Line Item Name Formatting

**Problem:**
Previous display showed very long concatenated strings:
```
Infraestructura / Nube / Data Center — Logística y Repuestos [INF-CLOUD] • OPEX (Month 2)
```

**Solution:**
Created structured formatter that separates:
- **Primary label**: Category hierarchy + description (main display)
- **Secondary metadata**: Code, type, period (smaller, muted text)
- **Tooltip**: Full information for reference

**Implementation:**
1. Created `lineItemFormatters.ts` module with utilities:
   - `formatLineItemDisplay()` - Structured formatter with primary/secondary/tooltip
   - `formatRubroLabel()` - Legacy format for backwards compatibility
   - `formatMatrixLabel()` - Adds period suffix
   - `extractFriendlyFilename()` - File name extraction helper

2. Applied in reconciliation table:
   ```tsx
   const formatted = formatLineItemDisplay(lineItem, inv.month);
   return (
     <div title={formatted.tooltip}>
       <div className="font-medium truncate">
         {formatted.primary}
       </div>
       {formatted.secondary && (
         <div className="text-xs text-muted-foreground truncate">
           {formatted.secondary}
         </div>
       )}
     </div>
   );
   ```

**Example Output:**
```
Primary:   Infraestructura / Nube — Data Center
Secondary: Code: INF-CLOUD · Type: OPEX · Period: Month 2
Tooltip:   Infraestructura / Nube — Data Center [INF-CLOUD] • OPEX (Month 2)
```

**Benefits:**
- Improved readability - hierarchy visible at a glance
- Metadata accessible but not overwhelming
- Consistent truncation with ellipsis
- Full details available in tooltip
- Reusable across forecast and reconciliation views

**File:** `src/features/sdmt/cost/Reconciliation/lineItemFormatters.ts`

---

### D. File Name Presentation

**Problem:**
File column displayed raw storage paths:
```
docs/P-e3f6647d-3b01-492d-8e54-2.........
```

**Solution:**
Display human-friendly filename, hide internal storage path.

**Implementation:**
1. Created `extractFriendlyFilename()` helper:
   - Returns `originalName` if available (uploaded filename)
   - Extracts leaf filename from `documentKey` path if needed
   - Graceful fallback to "Pending document"

2. Updated File column in table:
   - Primary: `originalName` in medium font weight
   - Secondary: Truncated `documentKey` in muted text (for reference)
   - Tooltip shows full storage path

**Example:**
```
Primary:   Screenshot 2025-12-04.png
Secondary: docs/P-abc123.../Screenshot... (truncated after 40 chars)
Tooltip:   Storage path: docs/P-abc123.../Screenshot 2025-12-04.png
```

**Benefits:**
- Users see meaningful filenames immediately
- Technical storage path available for power users
- Consistent with file management UX patterns
- Doesn't break existing file links/downloads

---

### E. "Submitted By" / Audit Trail

**Analysis:**
- Backend already captures `uploaded_by` via `getUserEmail()` in invoice handler
- Field populated from Cognito JWT token during invoice creation
- Historical invoices may not have submitter info (graceful fallback)

**Implementation:**
Enhanced display format in Uploaded column:
```tsx
{inv.uploaded_by && (
  <div className="text-xs text-muted-foreground">
    Submitted by {inv.uploaded_by}
  </div>
)}
```

**Display:**
```
2025-12-07
Submitted by christian.valencia@ikusi
```

**Benefits:**
- Clear attribution for audit/compliance
- Consistent with change request "Requested by" pattern
- Gracefully handles missing data (old invoices)
- No backend changes needed

---

## API Contract Analysis

### Invoice Entity (Backend)

**Storage:** DynamoDB table `{env}-finanzas-prefacturas`  
**Handler:** `services/finanzas-api/src/handlers/invoices/app.ts`

**Key Fields:**
```typescript
{
  pk: `PROJECT#${projectId}`,
  sk: `INVOICE#${invoiceId}`,
  invoiceId: string,           // Auto-generated: INV-{uuid}
  projectId: string,
  lineItemId: string,
  month: number,               // 1-12
  amount: number,
  vendor?: string,             // Free-form vendor name
  invoiceNumber?: string,      // User-entered vendor reference
  invoiceDate?: string,        // ISO date string
  documentKey?: string,        // S3 storage path
  originalName?: string,       // Original uploaded filename
  contentType?: string,
  status: InvoiceStatus,       // "Pending" | "Matched" | "Disputed"
  uploaded_by?: string,        // Email from Cognito JWT
  uploaded_at: string,
  created_at: string,
  updated_at: string,
}
```

**No Breaking Changes:**
- All new features use existing fields
- `vendor` remains string (no foreign key)
- `invoiceNumber` already optional
- `uploaded_by` already captured in backend

---

## File Structure

```
src/
├── features/sdmt/cost/Reconciliation/
│   ├── SDMTReconciliation.tsx          # Main component (modified)
│   └── lineItemFormatters.ts           # New formatter utilities
├── hooks/
│   └── useProviders.ts                 # New providers hook
└── api/
    └── finanzasClient.ts               # Existing (uses Provider types)
```

---

## Testing Checklist

### Manual Testing

1. **Invoice Upload with Providers Dropdown:**
   - [ ] Open Upload Invoice modal
   - [ ] Verify vendor dropdown shows registered providers
   - [ ] Select a provider from dropdown
   - [ ] Verify provider name appears in upload form
   - [ ] Select "Other (enter manually)"
   - [ ] Verify custom input field appears
   - [ ] Enter custom vendor name and upload
   - [ ] Verify invoice saved with correct vendor

2. **Line Item Label Formatting:**
   - [ ] View reconciliation table with invoices
   - [ ] Verify primary label shows category + description
   - [ ] Verify secondary label shows code, type, period
   - [ ] Hover over label and verify tooltip shows full info
   - [ ] Verify long labels are truncated with ellipsis

3. **File Name Display:**
   - [ ] Upload invoice with descriptive filename
   - [ ] Verify table shows friendly filename (not storage path)
   - [ ] Verify storage path appears in secondary text (truncated)
   - [ ] Hover over filename and verify tooltip shows full path
   - [ ] Click/download file and verify it works

4. **Submitted By:**
   - [ ] Upload invoice as authenticated user
   - [ ] Verify "Submitted by {email}" appears in table
   - [ ] View old invoices (without uploaded_by)
   - [ ] Verify they display gracefully (no error)

5. **Invoice Number Validation:**
   - [ ] Enter invoice number with leading/trailing spaces
   - [ ] Verify spaces are trimmed on submit
   - [ ] Verify validation hint text is visible
   - [ ] Submit invoice and verify invoice_number is clean

### Edge Cases

- [ ] No providers registered (fallback to free-text input)
- [ ] Providers endpoint returns error (fallback behavior)
- [ ] Long file names (truncation works)
- [ ] Missing originalName (uses documentKey extraction)
- [ ] Missing uploaded_by (graceful no-show)
- [ ] Line items with no category/code (fallback labels)

---

## Security & Data Integrity

### Guardrails Maintained

1. **No Backend Schema Changes:**
   - All improvements use existing fields
   - Backwards compatible with historical data
   - No migrations required

2. **Vendor Field:**
   - Kept as free-form string (no foreign key constraint)
   - Supports legacy invoices with custom vendor names
   - Providers catalog is advisory, not enforced

3. **Invoice Number:**
   - Remains user-controlled (business requirement)
   - Auto-generated internal ID for system use
   - Validation limited to whitespace trimming

4. **Audit Trail:**
   - `uploaded_by` captured via existing auth flow
   - No PII stored beyond what backend already captures
   - Graceful handling of missing audit data

### Validation

- Invoice number: Required, non-empty after trim
- Vendor: Required for reconciliation
- File upload: Required, with content type validation
- Line item: Must exist in project catalog
- Month: Integer 1-12
- Amount: Positive number

---

## Migration Guide

**None required.** All changes are additive and backwards compatible.

### For Existing Deployments

1. Deploy updated frontend code
2. Verify providers endpoint is accessible (`GET /finanzas/providers`)
3. Test invoice upload flow
4. Historical invoices display correctly (no breaking changes)

### For New Providers Feature

If providers catalog is empty:
1. Navigate to `/finanzas/providers`
2. Register vendors using "Agregar Proveedor" button
3. Vendors will appear in reconciliation upload dropdown

---

## Future Enhancements

### Potential Improvements (Out of Scope)

1. **Vendor Foreign Key:**
   - Migrate `vendor` field to `vendor_id` foreign key
   - Requires data migration for historical invoices
   - Benefits: Referential integrity, analytics

2. **Invoice Number Auto-Generation:**
   - Option to auto-generate invoice numbers
   - Would need to be opt-in (business decision)
   - Pattern: `INV-{YYYYMMDD}-{sequence}`

3. **File Preview:**
   - Inline preview for PDF/image invoices
   - Download button with S3 presigned URL

4. **Bulk Upload:**
   - Upload multiple invoices at once
   - CSV/Excel mapping to line items

5. **Advanced Filtering:**
   - Filter by vendor, status, date range
   - Search by invoice number

---

## Related Files

- `openapi/finanzas.yaml` - API specification (providers endpoints)
- `services/finanzas-api/src/handlers/invoices/app.ts` - Invoice backend handler
- `services/finanzas-api/src/handlers/providers.ts` - Providers backend handler
- `src/api/finanzas.ts` - Frontend API client (invoice upload)
- `src/api/finanzasClient.ts` - Provider types and client
- `src/modules/finanzas/ProvidersManager.tsx` - Providers management UI

---

## Conclusion

The reconciliation UX improvements enhance usability without breaking existing functionality. All changes are backwards compatible and require no database migrations. The implementation follows existing patterns in the codebase and maintains data integrity guardrails.

**Key Achievements:**
- ✅ Improved line item readability with structured formatting
- ✅ Guided vendor selection via providers catalog
- ✅ Clear file name display (hide storage internals)
- ✅ Enhanced audit trail visibility
- ✅ Added validation hints for data quality
- ✅ Zero breaking changes to backend contracts
- ✅ Backwards compatible with historical data

**Status:** Ready for testing and review.
