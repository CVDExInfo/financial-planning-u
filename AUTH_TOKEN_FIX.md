# Authentication Token Fix - Root Cause Analysis

## Issue Summary

**Problem**: New projects were not being created in DynamoDB or appearing in the frontend after completing the PMO Pre-Factura Estimator wizard.

**Root Cause**: The API configuration was looking for JWT tokens in the wrong localStorage key, causing all API calls to fail silently and fall back to mock data.

## Technical Details

### The Mismatch

**AuthProvider.tsx (line 159-160)** stores tokens as:

```typescript
localStorage.setItem("cv.jwt", AuthenticationResult.IdToken);
localStorage.setItem("finz_jwt", AuthenticationResult.IdToken);
```

**api.ts (line 50)** was looking for:

```typescript
const authData = localStorage.getItem("auth"); // ❌ Wrong key!
```

### The Symptom

Browser console showed:

```
API call failed, falling back to mock data
API call failed, returning mock baseline
```

This occurred because:

1. Frontend called `getAuthToken()` which returned `null` (wrong localStorage key)
2. API requests were sent **without Authorization header**
3. API Gateway returned 401 Unauthorized
4. Frontend catch blocks gracefully fell back to mock data
5. No Lambda function was invoked
6. No DynamoDB writes occurred

### The Fix

**File**: `src/config/api.ts`

**Before**:

```typescript
export function getAuthToken(): string | null {
  try {
    const authData = localStorage.getItem("auth");
    if (!authData) return null;

    const parsed = JSON.parse(authData);
    return parsed.idToken || null;
  } catch (error) {
    console.error("Failed to get auth token:", error);
    return null;
  }
}
```

**After**:

```typescript
export function getAuthToken(): string | null {
  try {
    // Try unified key first (used by AuthProvider)
    const token =
      localStorage.getItem("cv.jwt") || localStorage.getItem("finz_jwt");
    if (token) return token;

    // Fallback to old "auth" key structure for backward compatibility
    const authData = localStorage.getItem("auth");
    if (!authData) return null;

    const parsed = JSON.parse(authData);
    return parsed.idToken || null;
  } catch (error) {
    console.error("Failed to get auth token:", error);
    return null;
  }
}
```

## Testing Instructions

### 1. Clear Browser Cache (Important!)

```javascript
// Open browser console and run:
localStorage.clear();
sessionStorage.clear();
```

Refresh the page: https://d7t9x3j66yd8k.cloudfront.net

### 2. Login with Cognito

- Click "Sign In"
- Email: `christian.valencia@ikusi.com`
- Password: [your Cognito password]
- Complete MFA if required

### 3. Verify Token Storage

```javascript
// Open browser console:
localStorage.getItem("cv.jwt");
// Should return: "eyJraWQ..."

localStorage.getItem("finz_jwt");
// Should return: "eyJraWQ..." (same token)
```

### 4. Create New Project via PMO Estimator

1. Navigate to **PMO** → **Pre-Factura Estimator**
2. Complete all wizard steps:
   - **Deal Inputs**: Enter project name, client, currency, duration
   - **Labor Costs**: Add at least 1 labor resource with hours
   - **Non-Labor Costs**: Add at least 1 infrastructure item
   - **FX/Indexation**: Configure if needed (optional)
   - **Review & Sign**: Check review box, click "Digital Sign"

### 5. Verify Console Output

**Expected console logs**:

```
✅ Baseline created via API: {baseline_id: "BL-...", signature_hash: "SHA256-..."}
✅ Projects loaded from API: [{...}]
```

**NOT expected** (indicates failure):

```
❌ API call failed, falling back to mock data
❌ API call failed, returning mock baseline
```

### 6. Verify DynamoDB Write

```bash
# Check new project created
aws dynamodb scan --table-name finz_projects \
  --region us-east-2 \
  --filter-expression "contains(created_at, :today)" \
  --expression-attribute-values '{":today":{"S":"2025-11-15"}}'

# Expected output:
{
  "Items": [
    {
      "pk": {"S": "PROJECT#P-<uuid>"},
      "sk": {"S": "METADATA"},
      "project_id": {"S": "P-<uuid>"},
      "nombre": {"S": "Your Project Name"},
      "baseline_id": {"S": "BL-<uuid>"},
      "created_by": {"S": "christian.valencia@ikusi.com"},
      "baseline_accepted_at": {"S": "2025-11-15T...Z"}
    }
  ]
}
```

### 7. Verify Audit Trail

```bash
# Check audit entry
aws dynamodb scan --table-name finz_audit_log \
  --region us-east-2 \
  --filter-expression "action = :action AND contains(#ts, :date)" \
  --expression-attribute-names '{"#ts":"timestamp"}' \
  --expression-attribute-values '{":action":{"S":"baseline_created"}, ":date":{"S":"2025-11-15"}}'

# Expected output:
{
  "Items": [
    {
      "pk": {"S": "AUDIT#2025-11-15"},
      "sk": {"S": "2025-11-15T...Z#P-<uuid>"},
      "action": {"S": "baseline_created"},
      "actor": {"S": "christian.valencia@ikusi.com"},
      "details": {"M": {...}}
    }
  ]
}
```

### 8. Verify Frontend Project List

- Navigate to **PMO** → **Projects Dashboard**
- New project should appear in the list
- Click on project to verify data integrity

## Success Criteria

✅ Console shows "Baseline created via API" (not "falling back to mock")
✅ Console shows "Projects loaded from API" (not "falling back to mock")
✅ New project appears in finz_projects DynamoDB table
✅ Audit entry appears in finz_audit_log with your email as actor
✅ Frontend shows new project in Projects Dashboard
✅ Network tab shows POST /baseline with `Authorization: Bearer eyJ...` header

## Rollback Plan

If issues occur:

```bash
git revert a40bb19
git push origin main
```

This will restore the old `getAuthToken()` function. However, API calls will continue to fail until the localStorage key mismatch is resolved.

## Related Issues

This fix resolves:

- Issue #10: "New projects not appearing in DynamoDB"
- Issue #11: "API calls silently falling back to mock data"
- Issue #12: "Authorization header not being sent to API Gateway"

## Deployment Status

- **Commit**: a40bb19
- **Deployed**: 2025-11-15
- **GitHub Actions**: https://github.com/CVDExInfo/financial-planning-u/actions
- **CloudFront**: https://d7t9x3j66yd8k.cloudfront.net (cache invalidation required)
- **Lambda Functions**: No changes required (backend unchanged)

## Next Steps

1. Wait for GitHub Actions deployment (~5 minutes)
2. **Clear CloudFront cache** (or wait 24 hours for TTL expiration):
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id d7t9x3j66yd8k \
     --paths "/assets/*" "/index.html"
   ```
3. Test baseline creation with authenticated user
4. Verify DynamoDB writes
5. Execute full UI test plan (test-plan-ui-buttons.md)

## Notes

- The fix maintains **backward compatibility** with the old `"auth"` localStorage key structure
- No database schema changes required
- No Lambda function changes required
- Frontend-only fix (single file changed)
- Graceful fallback to mock data remains in place for offline/demo scenarios
