# Debugging Invoice Upload 400 Errors - Quick Reference

## Problem
Console shows: `[Finanzas] ❌ HTTP error: HTTP 400` from `/projects/{id}/invoices`

## Root Causes Checklist

### ✅ Fixed by This PR:
- [x] **Client-side validation** - Now validates all fields before API call
- [x] **Error messaging** - Surfaces specific server validation errors
- [x] **Debug logging** - Logs request payload in development mode
- [x] **Month values** - Ensures integers (already was working correctly)
- [x] **File handling** - Validates file is present (already was working)

### 🔍 Additional Server-Side Issues to Check:

1. **Backend Validation**
   - Check server logs for validation error details
   - Verify backend accepts all fields we're sending
   - Confirm expected field names match (lineItemId vs line_item_id)

2. **Authorization**
   - Verify Bearer token is valid and not expired
   - Check user has permission to upload to this project
   - Confirm project ID exists and is accessible

3. **S3 Presigned URL**
   - Check presigned URL generation succeeds
   - Verify S3 bucket permissions
   - Confirm file upload to S3 completes

4. **File Constraints**
   - Check if server has file size limits
   - Verify accepted file types (PDF, JPG, PNG, Excel, CSV)
   - Confirm file content-type is allowed

## Debugging with New Tools

### 1. Enable Debug Logging (Development)
Set environment to development mode to see detailed logs:

```javascript
// Browser console will show:
[Invoice] Payload for submission: {
  line_item_id: "R-12345",
  month: 1,
  amount: 1000,
  vendor: "***",  // masked
  invoice_number: "***",  // masked
  invoice_date: "2025-01-15",
  has_description: true,
  file_info: { name: "factura.pdf", size: 12345, type: "application/pdf" }
}

// On error:
[Finanzas] ❌ Invoice upload error: {
  projectId: "P-abc123",
  line_item_id: "R-12345",
  amount: 1000,
  vendor: "***",
  invoice_date: "2025-01-15",
  file: { name: "factura.pdf", size: 12345, type: "application/pdf" },
  error: <full error object>,
  errorMessage: "Specific server validation error"
}
```

### 2. Test Client-Side Validation

Try submitting with invalid data to verify validation works:

```typescript
// Missing rubro
- Leave "Rubro" dropdown empty
- Click "Subir Factura"
- Should see: "Selecciona un rubro antes de continuar"

// Invalid month range
- Set "Mes Inicio" to 5
- Set "Mes Fin" to 3
- Should see: "Mes de inicio no puede ser mayor que mes de fin"

// Negative amount
- Set amount to -100
- Should see: "Monto de factura debe ser mayor a cero"
```

### 3. Check Network Tab

Chrome DevTools → Network → Filter "invoices":

```
Request Headers:
  Authorization: Bearer eyJ...
  Content-Type: application/json
  
Request Payload:
  {
    "projectId": "P-abc123",
    "lineItemId": "R-12345",  ← Check: is it lineItemId or line_item_id?
    "month": 1,  ← Check: is it integer not string?
    "amount": 1000,  ← Check: is it number not string?
    "vendor": "Test Vendor",
    "invoiceNumber": "INV-001",
    "invoiceDate": "2025-01-15",
    "documentKey": "invoices/test.pdf",
    "originalName": "test.pdf",
    "contentType": "application/pdf"
  }

Response:
  Status: 400 Bad Request
  {
    "error": "Validation failed",
    "errors": [
      { "field": "lineItemId", "message": "required" }
    ]
  }
```

### 4. Test with curl

```bash
# Get auth token
TOKEN=$(scripts/cognito/get-jwt.sh)

# Test invoice creation endpoint
curl -v -X POST \
  "https://api.yourdomain.com/projects/P-abc123/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "P-abc123",
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

## Common 400 Error Scenarios

### Scenario 1: Field Name Mismatch
**Symptom:** 400 with "field is required" error
**Cause:** Backend expects `line_item_id` but frontend sends `lineItemId`
**Fix:** Check backend API schema and match field names exactly

### Scenario 2: Type Mismatch
**Symptom:** 400 with "invalid type" error
**Cause:** Backend expects number but receives string
**Fix:** Ensure numeric fields are sent as numbers not strings

### Scenario 3: Missing Required Field
**Symptom:** 400 with "field is required" error
**Cause:** Backend requires field that frontend doesn't send
**Fix:** Add field to payload or make it optional on backend

### Scenario 4: Authorization
**Symptom:** 400 or 403 error
**Cause:** Invalid/expired token or insufficient permissions
**Fix:** Refresh token, check user permissions

### Scenario 5: File Upload Failed
**Symptom:** 400 with "document not found" error
**Cause:** S3 upload didn't complete before invoice record created
**Fix:** Verify presigned URL flow completes successfully

## Expected API Flow

```
1. Client calls uploadInvoice()
   ↓
2. Validate payload (NEW - client-side)
   ↓
3. Request presigned S3 URL
   POST /uploads/docs
   {
     projectId, module, lineItemId, contentType, originalName, checksumSha256
   }
   ↓
4. Upload file to S3
   PUT <presigned-url>
   Body: file binary
   ↓
5. Create invoice record
   POST /projects/{id}/invoices
   {
     projectId, lineItemId, month, amount, vendor,
     invoiceNumber, invoiceDate, documentKey, originalName, contentType
   }
   ↓
6. Return invoice document
   {
     id, line_item_id, month, amount, status, documentKey, uploaded_at, ...
   }
```

## Validation Rules (NEW)

Client-side validation now enforces:
- ✅ Line item ID (rubro) is required
- ✅ Month start/end are integers 1-12
- ✅ Month start ≤ month end  
- ✅ Amount is positive number
- ✅ Vendor is required
- ✅ Invoice date is valid date
- ✅ File is required

These match the backend requirements and prevent invalid API calls.

## Testing Checklist

- [ ] Valid invoice uploads successfully
- [ ] Invalid invoices show validation errors
- [ ] Server errors are displayed to users
- [ ] Debug logs appear in console (dev mode)
- [ ] No sensitive data in logs
- [ ] Multi-month uploads work correctly
- [ ] MOD rubro uploads work
- [ ] Non-MOD rubro uploads work
- [ ] File types accepted (PDF, JPG, PNG, Excel, CSV)
- [ ] Large files handled (check size limits)

## Rollback Plan

If issues persist after deployment:
1. Check server logs for detailed error messages
2. Verify backend API accepts all fields we're sending
3. Test with curl to isolate frontend vs backend issues
4. Revert PR if validation causes false negatives
5. Adjust validation rules based on actual backend requirements

## Next Steps

1. Deploy to staging environment
2. Test with real invoices and users
3. Monitor error rates and types
4. Adjust validation based on backend behavior
5. Consider adding field-level inline errors
6. Add retry logic for transient errors
