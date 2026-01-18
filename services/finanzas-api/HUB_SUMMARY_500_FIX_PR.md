# Hub Lambda `/summary` Endpoint - 500 Error Fix

## Overview

This PR fixes HTTP 500 errors occurring on the Hub Lambda `/summary` endpoint (`GET /dev/finanzas/hub/summary?scope=ALL`). The issue was caused by insufficient defensive error handling in the event routing logic.

## Problem Statement

UI teams reported that the Forecast UI and other views appear broken on initial load because the Hub Lambda returns HTTP 500 errors when calling `/summary`. The endpoint is critical for providing top-level financial data to the UI.

**Lambda:** `finanzas-sd-api-dev-HubFn-ucjnnCAwKMfM`  
**Endpoint:** `GET /dev/finanzas/hub/summary?scope=ALL`  
**Impact:** HIGH - UI appears broken to end users

## Root Cause

The main handler in `src/handlers/hub.ts` was accessing event properties without proper validation:

1. **Missing null checks for event properties**
   - `event.rawPath` and `event.requestContext.http.path` could be undefined
   - Calling `.includes()` on undefined throws `TypeError`

2. **Unsafe event structure access**
   - Direct access to `event.requestContext.http.method` without validation
   - Could throw if event structure is malformed

3. **Missing scope parameter validation**
   - No validation of scope parameter format
   - Potential security vulnerability (injection risk)

## Solution

### 1. Added Event Structure Validation

```typescript
// Before
const path = event.rawPath || event.requestContext.http.path;
const method = event.requestContext.http.method;

// After
if (!event || !event.requestContext || !event.requestContext.http) {
  console.error("[hub] Invalid event structure", { event });
  return serverError("Invalid event structure");
}

const method = event.requestContext.http.method?.toUpperCase() || "GET";
const path = event.requestContext.http.path || event.rawPath || '';
```

**Impact:** Prevents TypeError when event structure is incomplete

### 2. Added Scope Parameter Validation

```typescript
// Before
function parseScope(queryParams) {
  const scope = queryParams.scope || "ALL";
  return scope.trim().toUpperCase();
}

// After
function parseScope(queryParams) {
  const scope = queryParams.scope || "ALL";
  const sanitized = scope.trim().toUpperCase();
  
  if (sanitized !== "ALL" && !/^[A-Z0-9_-]+$/.test(sanitized)) {
    throw { statusCode: 400, body: "Invalid scope parameter..." };
  }
  
  return sanitized;
}
```

**Impact:** Prevents injection attacks, provides clear error messages

### 3. Added Comprehensive Unit Tests

Added 6 new test cases:
- Missing path handling
- Unknown paths (404)
- Invalid year parameter
- Year out of range
- Invalid scope with special characters
- Valid project code scopes

**Results:** All 12/12 tests passing ✅

## Files Changed

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src/handlers/hub.ts` | +28, -7 | Added defensive checks and scope validation |
| `tests/unit/hub.handler.spec.ts` | +48, -2 | Added edge case tests |
| `HUB_SUMMARY_500_FIX_RUNBOOK.md` | +409 | Deployment and troubleshooting guide |

## Testing

### Unit Tests
```bash
cd services/finanzas-api
npm test -- hub.handler.spec.ts
```

**Result:** ✅ All 12 tests passing

### Manual Testing (Post-Deployment)

1. Test with `scope=ALL`:
```bash
curl "https://<endpoint>/dev/finanzas/hub/summary?scope=ALL" \
  -H "Authorization: Bearer <TOKEN>"
```

2. Test with specific project:
```bash
curl "https://<endpoint>/dev/finanzas/hub/summary?scope=P-TEST-001" \
  -H "Authorization: Bearer <TOKEN>"
```

3. Test error cases:
```bash
# Invalid scope
curl "https://<endpoint>/dev/finanzas/hub/summary?scope=INVALID!" \
  -H "Authorization: Bearer <TOKEN>"
# Expected: HTTP 400

# Invalid year
curl "https://<endpoint>/dev/finanzas/hub/summary?scope=ALL&year=1999" \
  -H "Authorization: Bearer <TOKEN>"
# Expected: HTTP 400
```

## Deployment Steps

1. **Build and Test**
```bash
cd services/finanzas-api
npm install
npm test
```

2. **Deploy to Dev**
```bash
sam build
sam deploy --stack-name finanzas-sd-api-dev --resolve-s3 --capabilities CAPABILITY_IAM
```

3. **Verify**
```bash
# Test /summary endpoint
curl -v "https://<endpoint>/dev/finanzas/hub/summary?scope=ALL" \
  -H "Authorization: Bearer <TOKEN>"
# Expected: HTTP 200
```

4. **Monitor CloudWatch Logs**
```bash
aws logs filter-log-events \
  --log-group-name "/aws/lambda/finanzas-sd-api-dev-HubFn-ucjnnCAwKMfM" \
  --start-time $(expr $(date +%s) - 600)000
```

## Risk Assessment

**Risk Level:** LOW

- Changes are defensive and backward-compatible
- Only adds validation, doesn't change business logic
- Comprehensive unit tests added
- Clear error messages for debugging

## Rollback Plan

If issues occur:

```bash
# Rollback via CloudFormation
aws cloudformation update-stack \
  --stack-name finanzas-sd-api-dev \
  --use-previous-template \
  --capabilities CAPABILITY_IAM
```

Or revert the commit and redeploy:
```bash
git revert <this-commit-sha>
sam build && sam deploy
```

## Related Documentation

- **Runbook:** `services/finanzas-api/HUB_SUMMARY_500_FIX_RUNBOOK.md`
- **Hub Implementation:** `HUB_IMPLEMENTATION_SUMMARY.md`
- **API Examples:** `services/finanzas-api/API_EXAMPLES.md`

## Security Considerations

✅ **Scope validation prevents injection**
- Only allows alphanumeric characters, hyphens, and underscores
- Rejects special characters like `;`, `#`, `<`, `>`

✅ **No changes to authentication/authorization**
- Still requires SDMT or EXEC_RO role
- Cognito JWT validation unchanged

✅ **CodeQL scan results:** No new vulnerabilities

## Performance Impact

**Negligible**
- Adds simple regex validation (< 1ms)
- Event structure checks are O(1)
- No changes to DynamoDB queries
- In-memory caching unchanged (15-minute TTL)

## Monitoring

After deployment, monitor:

1. **Lambda Errors** (AWS/Lambda)
   - Metric: `Errors`
   - Should be 0

2. **API Gateway 5XX** (AWS/ApiGateway)
   - Metric: `5XXError`
   - Should decrease to 0

3. **Lambda Duration** (AWS/Lambda)
   - Metric: `Duration`
   - Should remain < 1000ms

## Questions?

Contact the Finanzas SD team:
- **Slack:** #finanzas-sd-dev
- **Email:** finanzas-dev@company.com

---

## Checklist

- [x] Code changes implemented
- [x] Unit tests added and passing (12/12)
- [x] Runbook created
- [x] PR description complete
- [ ] Code review completed
- [ ] Deployed to dev environment
- [ ] Manual testing completed
- [ ] CloudWatch metrics reviewed
- [ ] UI team notified

---

**PR Type:** Bug Fix  
**Priority:** HIGH  
**Affected Components:** Hub Lambda, API Gateway
