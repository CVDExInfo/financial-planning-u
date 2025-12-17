# SDMT Reconciliation - Correction/Deletion Workflow

**Date:** December 17, 2025  
**Version:** 1.0  
**Status:** Implemented

## Overview

The SDMT Cost Reconciliation module now supports a governance workflow for correcting or deleting invoices that have already been reconciled. This ensures proper oversight and prevents accidental data loss.

## Key Features

### 1. Invoice Status Lifecycle

New statuses have been added to track the correction/deletion workflow:

- **Pending** - Initial upload state
- **Matched** - Invoice successfully reconciled
- **Disputed** - Invoice flagged for review
- **PendingDeletionApproval** - Deletion requested, awaiting approval
- **PendingCorrectionApproval** - Correction requested, awaiting approval (future use)

### 2. Request Correction/Deletion

Any user with appropriate permissions can request correction or deletion of a reconciled invoice:

1. Navigate to the Reconciliation page
2. Find the reconciled invoice in the table
3. Click "Solicitar Corrección" button
4. Enter an optional reason/comment
5. Submit the request

The invoice status changes to `PendingDeletionApproval`.

### 3. Second-Person Approval

**Critical Governance Rule:** A deletion request must be approved by a **different user** than the one who originally reconciled the invoice.

#### Approval Process

**If you are NOT the reconciler:**
- You will see "Aprobar" (Approve) and "Rechazar" (Reject) buttons
- Clicking "Aprobar" will mark the invoice for deletion
- Clicking "Rechazar" will revert the status back to "Matched"

**If you ARE the reconciler:**
- You will see a message: "Pendiente aprobación (requiere otro usuario)"
- The approval buttons are hidden
- You must wait for another authorized user to review

#### User Identification

The system identifies users by comparing:
- The `reconciled_by` or `matched_by` field on the invoice
- The current user's `login` or `email` from authentication context

### 4. API Integration

#### Status Update Endpoint

```typescript
PUT /projects/{projectId}/invoices/{invoiceId}/status
Content-Type: application/json

{
  "status": "PendingDeletionApproval" | "Matched" | "Disputed",
  "comment": "Optional reason or note"
}
```

#### Backend Requirements

The backend should:

1. **Accept new status values**
   - `PendingDeletionApproval`
   - `PendingCorrectionApproval`

2. **Track user information**
   - Store `reconciled_by` when an invoice is matched
   - Store `deletion_requested_by` when deletion is requested
   - Store `deletion_requested_at` timestamp

3. **Enforce approval rules**
   - Validate that approver ≠ reconciler
   - Return 403 if same user attempts to approve

4. **Audit trail**
   - Log all status changes with user, timestamp, and comment
   - Include this in comments array or separate audit table

## UI/UX Details

### Status Badge Display

- **Pending**: Gray/secondary badge
- **Matched**: Green/default badge
- **Disputed**: Red/destructive badge
- **PendingDeletionApproval**: Yellow/warning badge with text "Pendiente Eliminación"

### Action Buttons by Status

| Invoice Status | Available Actions |
|---------------|------------------|
| Pending | Conciliar, Disputar |
| Matched | Solicitar Corrección |
| Disputed | Resolver |
| PendingDeletionApproval | Aprobar*, Rechazar* |

\* Only visible if user is not the reconciler

### Correction Request Dialog

When "Solicitar Corrección" is clicked:

1. Modal opens showing invoice details (ID, amount, month)
2. Optional textarea for reason/comment
3. Warning message explaining approval requirement
4. "Cancelar" and "Solicitar" buttons

## Implementation Details

### TypeScript Types

```typescript
// src/types/domain.d.ts
export type InvoiceStatus = 
  | "Pending" 
  | "Matched" 
  | "Disputed" 
  | "PendingDeletionApproval" 
  | "PendingCorrectionApproval";

export type InvoiceDoc = {
  // ... existing fields
  reconciled_by?: string;
  deletion_requested_by?: string;
  deletion_requested_at?: string;
};
```

### Key Functions

```typescript
// Request deletion/correction
const handleRequestCorrection = (invoice: any) => {
  setSelectedInvoiceForCorrection(invoice);
  setShowCorrectionDialog(true);
};

// Check if user can approve
const canApproveDeletion = (invoice: any): boolean => {
  if (!canApprove) return false;
  const reconciledBy = invoice.reconciled_by || invoice.matched_by;
  const currentUserId = currentUser?.login || currentUser?.email;
  return reconciledBy !== currentUserId;
};

// Approve deletion
const handleApproveDeletion = async (invoiceId: string) => {
  await statusMutation.mutateAsync({
    invoiceId,
    status: "Disputed", // Temporary; backend should have "Deleted" state
    comment: "Eliminación aprobada",
  });
};

// Reject deletion
const handleRejectDeletion = async (invoiceId: string) => {
  await statusMutation.mutateAsync({
    invoiceId,
    status: "Matched",
    comment: "Solicitud de eliminación rechazada",
  });
};
```

## Testing Checklist

### Manual Testing

- [ ] User A reconciles an invoice (status → Matched)
- [ ] User A clicks "Solicitar Corrección"
- [ ] Dialog opens with invoice details
- [ ] User A submits request (status → PendingDeletionApproval)
- [ ] User A tries to approve own request (should see "requiere otro usuario" message)
- [ ] User B logs in and sees the pending deletion
- [ ] User B clicks "Aprobar" (status should change)
- [ ] User B clicks "Rechazar" (status → Matched)
- [ ] Status badges display correctly throughout
- [ ] Comments/audit trail captures all actions

### Edge Cases

- [ ] What if `reconciled_by` field is missing? (System allows approval)
- [ ] What if current user info is unavailable? (System allows approval)
- [ ] What if invoice was uploaded but never reconciled? (No "Solicitar Corrección" button)
- [ ] Multiple pending deletions for same user
- [ ] Rapid status changes (race conditions)

## Future Enhancements

1. **Separate Correction from Deletion**
   - Use `PendingCorrectionApproval` for edits vs deletions
   - Allow correction to modify fields without removing record

2. **Backend Deletion Endpoint**
   - `DELETE /projects/{projectId}/invoices/{invoiceId}`
   - Soft delete with `deleted_at` timestamp
   - Keep audit trail

3. **Approval History**
   - Show timeline of all status changes
   - Display who requested, who approved, when

4. **Notifications**
   - Email notification when approval is needed
   - Dashboard widget for pending approvals

5. **Role-Based Restrictions**
   - Configure which roles can request vs approve
   - Separate `canRequestDeletion` from `canApproveDeletion`

## Related Files

- `src/features/sdmt/cost/Reconciliation/SDMTReconciliation.tsx` - Main component
- `src/types/domain.d.ts` - Type definitions
- `src/api/finanzas.ts` - API client with status types
- `UI_COMPONENT_VALIDATION_MATRIX.md` - Validation checklist

## Support & Troubleshooting

### Common Issues

**Q: I requested deletion but can't approve it myself**  
A: This is by design. Another user must approve to ensure oversight.

**Q: The approval buttons don't show**  
A: Check that you have `canApprove` permission and are not the reconciler.

**Q: Status update fails with 400/422**  
A: Backend may not support new status values yet. Check API response.

**Q: Who reconciled this invoice?**  
A: Check the `reconciled_by`, `matched_by`, or `uploaded_by` fields in the invoice data.

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-17 | 1.0 | Initial implementation with PendingDeletionApproval status and second-person approval |
