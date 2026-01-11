# Invoice Upload Fix - Factura Reconciliation 400 Error

## Problem Statement

The Factura Reconciliation page was experiencing HTTP 400 errors when attempting to upload invoices:
- Console error: `[Finanzas] ❌ HTTP error: HTTP 400`
- Endpoint: `POST /projects/P-c28fa603-0989-4070-b4d5-88d2602ddbe2/invoices`
- Root causes identified:
  - Insufficient client-side validation before API call
  - Generic error messages that didn't surface server validation errors
  - Missing debug logging for troubleshooting

## Solution Overview

This PR implements comprehensive client-side validation, improved error handling, and debug logging to:
1. **Prevent invalid requests** - Validate all required fields before submission
2. **Surface server errors** - Extract and display specific validation messages from API
3. **Aid debugging** - Add structured logging for request payloads (development only, no sensitive data)

## Changes Made

### 1. New Validation Utility (`src/utils/invoiceValidation.ts`)

Created reusable validation functions:

```typescript
// Validates invoice payload with Spanish error messages
validateInvoicePayload(payload, options?)

// Formats validation errors for user display
formatValidationErrors(errors)

// Extracts server error messages from responses
extractServerError(error)

// Logs payload for debugging (dev only, masks sensitive data)
logInvoicePayload(payload, file)
```

**Validation Rules:**
- ✅ Line item ID (rubro) is required and non-empty
- ✅ Month start/end are integers between 1-12
- ✅ Month start ≤ month end
- ✅ Amount is a positive number
- ✅ Vendor is required and non-empty
- ✅ Invoice date is a valid date string
- ✅ File is required (configurable via options)

### 2. Updated Invoice Submission Handler

**Before:**
```typescript
// Manual validation with separate if statements
if (!uploadFormData.line_item_id) {
  toast.error("Selecciona un rubro");
  return;
}
// ... repeated for each field
```

**After:**
```typescript
// Centralized validation with all errors at once
const validationErrors = validateInvoicePayload({
  line_item_id: uploadFormData.line_item_id,
  month_start: uploadFormData.start_month,
  month_end: uploadFormData.end_month,
  amount: uploadFormData.amount,
  vendor: uploadFormData.vendor,
  invoice_date: uploadFormData.invoice_date,
  file: uploadFormData.file,
});

if (validationErrors.length > 0) {
  const errorMessage = formatValidationErrors(validationErrors);
  toast.error(errorMessage);
  return;
}
```

### 3. Enhanced Error Messages

**Server Error Extraction:**
```typescript
catch (err) {
  const serverMessage = extractServerError(err);
  toast.error(serverMessage); // Shows specific server validation errors
}
```

Supports multiple server response formats:
- `{ message: "..." }`
- `{ errors: [{ message: "..." }] }`
- `{ errors: ["...", "..."] }`
- `{ error: "..." }`
- `Error` instances

### 4. Debug Logging (Development Only)

**Request logging:**
```typescript
logInvoicePayload(payload, file);
// Outputs:
// {
//   line_item_id: "R-12345",
//   month: 1,
//   amount: 1000,
//   vendor: "***",  // Masked
//   invoice_number: "***",  // Masked
//   invoice_date: "2025-01-15",
//   has_description: true,
//   file_info: { name: "factura.pdf", size: 12345, type: "application/pdf" }
// }
```

**Error logging:**
```typescript
console.error("[Finanzas] ❌ Invoice upload error:", {
  projectId,
  line_item_id: "R-12345",
  amount: 1000,
  vendor: "***",  // Masked
  invoice_date: "2025-01-15",
  file: { name: "factura.pdf", size: 12345, type: "application/pdf" },
  error: err,
  errorMessage: serverMessage,
});
```

### 5. Comprehensive Test Suite

Created `src/utils/__tests__/invoiceValidation.test.ts` with 25+ test cases:
- Valid payload validation
- Each required field validation
- Month range validation
- Amount validation (including string parsing)
- Date validation
- File requirement (with optional override)
- Error formatting
- Server error extraction

## Reproduction Steps

### Using the UI:
1. Navigate to SDMT → Cost → Reconciliation
2. Click "Subir Factura"
3. Try submitting with missing/invalid fields
4. Observe validation errors before API call

### Using curl (Multipart FormData):
```bash
curl -v -X POST "https://api.yourdomain.com/projects/P-c28fa603-0989-4070-b4d5-88d2602ddbe2/invoices" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "P-c28fa603-0989-4070-b4d5-88d2602ddbe2",
    "lineItemId": "R-12345",
    "month": 1,
    "amount": 1000,
    "vendor": "Test Vendor",
    "invoiceNumber": "INV-001",
    "invoiceDate": "2025-01-15",
    "documentKey": "invoices/test.pdf",
    "originalName": "test.pdf",
    "contentType": "application/pdf"
  }'
```

**Note:** The actual upload process uses a 2-step flow:
1. Presign S3 URL via `POST /uploads/docs`
2. Upload file to S3 via presigned URL (PUT)
3. Create invoice record via `POST /projects/{id}/invoices`

## Testing

Run the validation tests:
```bash
npm test invoiceValidation
```

Expected output:
```
✓ validateInvoicePayload (14 tests)
✓ formatValidationErrors (3 tests)
✓ extractServerError (8 tests)
```

## Technical Details

### Data Flow:
```
User fills form
    ↓
validateInvoicePayload() ← Client-side validation
    ↓ (if valid)
logInvoicePayload() ← Debug logging (dev only)
    ↓
uploadInvoice() ← API call with presigned S3 upload
    ↓ (on error)
extractServerError() ← Parse server response
    ↓
toast.error() ← Show user-friendly message
```

### Key Improvements:
1. **Early validation** - Catch errors before API calls
2. **User-friendly messages** - Spanish error messages matching UI language
3. **Server error surfacing** - Show backend validation errors to users
4. **Debug tooling** - Structured logging for troubleshooting
5. **Type safety** - Full TypeScript types for validation
6. **Test coverage** - Comprehensive unit tests

### Backwards Compatibility:
- ✅ No breaking changes to existing API calls
- ✅ Maintains existing upload flow (presigned S3 URLs)
- ✅ Preserves multi-month upload feature
- ✅ Compatible with MOD/non-MOD rubro logic

## Files Modified

1. `src/utils/invoiceValidation.ts` - New validation utilities
2. `src/utils/__tests__/invoiceValidation.test.ts` - Test suite
3. `src/features/sdmt/cost/Reconciliation/SDMTReconciliation.tsx` - Updated submit handler
4. `INVOICE_UPLOAD_FIX_README.md` - This documentation

## Impact

### Before:
- ❌ HTTP 400 errors with no explanation
- ❌ Generic "error uploading invoice" messages
- ❌ Difficult to debug payload issues
- ❌ Multiple API calls for validation

### After:
- ✅ Client-side validation prevents invalid submissions
- ✅ Specific error messages guide users
- ✅ Debug logs show exact payload sent
- ✅ Server validation errors surfaced to users
- ✅ Single API call for valid payloads

## Future Enhancements

1. **Backend improvements:**
   - Return structured validation errors: `{ errors: [{ field: "vendor", message: "required" }] }`
   - Add request/response logging on backend
   - Implement file size/type validation

2. **Frontend enhancements:**
   - Show field-specific errors inline (not just toast)
   - Add retry mechanism for network errors
   - Implement optimistic UI updates

3. **Monitoring:**
   - Track validation error rates
   - Monitor 400 error types
   - Alert on upload failures

## Security Considerations

- ✅ Sensitive data (vendor, invoice number) masked in logs
- ✅ Logging only enabled in development mode
- ✅ No auth tokens logged
- ✅ File content not logged (only metadata)
- ✅ All validations also enforced server-side

## Deployment Checklist

- [x] Unit tests passing
- [x] TypeScript compilation successful
- [x] No breaking changes
- [x] Debug logging dev-only
- [x] Error messages user-friendly
- [ ] Manual testing in staging
- [ ] Review server logs for 400 errors
- [ ] Monitor post-deployment metrics
