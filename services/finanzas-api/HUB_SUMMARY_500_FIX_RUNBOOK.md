# Hub Lambda `/summary` 500 Error - Fix and Deployment Runbook

**Date:** 2026-01-18  
**Issue:** Hub Lambda returns HTTP 500 for `/summary` endpoint  
**Lambda:** `finanzas-sd-api-dev-HubFn-ucjnnCAwKMfM`  
**Endpoint:** `GET /dev/finanzas/hub/summary?scope=ALL`

---

## Executive Summary

The Hub Lambda `/summary` endpoint was returning HTTP 500 errors due to **insufficient defensive error handling** in the event routing logic. The fix adds proper null checks, path validation, and scope parameter sanitization to prevent TypeErrors and ensure graceful error responses.

---

## Root Cause

The main handler in `src/handlers/hub.ts` was accessing event properties without defensive checks:

1. **Missing null checks**: `event.rawPath` and `event.requestContext.http.path` could be undefined, causing `path.includes()` to throw TypeError
2. **Unsafe event structure access**: Direct access to `event.requestContext.http.method` without validation
3. **No scope validation**: Scope parameter was not validated, allowing potential injection

---

## Changes Implemented

### 1. Event Structure Validation (Lines 582-588)

**Before:**
```typescript
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (event.requestContext.http.method === "OPTIONS") {
    return { ... };
  }
  const path = event.rawPath || event.requestContext.http.path;
  const method = event.requestContext.http.method;
```

**After:**
```typescript
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  // Defensive check for event structure
  if (!event || !event.requestContext || !event.requestContext.http) {
    console.error("[hub] Invalid event structure", { event });
    return serverError("Invalid event structure");
  }

  const method = event.requestContext.http.method?.toUpperCase() || "GET";
  const path = event.requestContext.http.path || event.rawPath || '';

  if (method === "OPTIONS") {
    return { ... };
  }
```

**Impact:** Prevents TypeError when event structure is malformed or incomplete

---

### 2. Scope Parameter Validation (Lines 59-70)

**Before:**
```typescript
function parseScope(queryParams: Record<string, string | undefined>): string {
  const scope = queryParams.scope || "ALL";
  return scope.trim().toUpperCase();
}
```

**After:**
```typescript
function parseScope(queryParams: Record<string, string | undefined>): string {
  const scope = queryParams.scope || "ALL";
  const sanitized = scope.trim().toUpperCase();
  
  // Validate scope format: either "ALL" or alphanumeric with hyphens/underscores
  if (sanitized !== "ALL" && !/^[A-Z0-9_-]+$/.test(sanitized)) {
    throw { statusCode: 400, body: "Invalid scope parameter. Must be 'ALL' or a valid project code." };
  }
  
  return sanitized;
}
```

**Impact:** Prevents injection attacks and provides clear error messages for invalid scopes

---

### 3. Comprehensive Unit Tests

Added 6 new test cases covering edge cases:
- Missing path handling
- Unknown paths (404)
- Invalid year parameter
- Year out of range
- Invalid scope with special characters
- Valid project code scopes

**Results:** All 12 tests passing ✅

---

## Deployment Steps

### Step 1: Build and Deploy

```bash
cd /home/runner/work/financial-planning-u/financial-planning-u/services/finanzas-api

# Install dependencies (if not already installed)
npm install

# Run tests to verify changes
npm test -- hub.handler.spec.ts

# Build SAM application
sam build

# Deploy to dev environment
sam deploy \
  --stack-name finanzas-sd-api-dev \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    StageName=dev \
    CognitoUserPoolArn=<YOUR_COGNITO_ARN> \
    CognitoUserPoolId=us-east-2_FyHLtOhiY \
    CognitoUserPoolClientId=dshos5iou44tuach7ta3ici5m
```

### Step 2: Verify Deployment

```bash
# Get the API Gateway endpoint from stack outputs
aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text

# Test the /summary endpoint (requires valid bearer token)
curl -v "https://<api-endpoint>/dev/finanzas/hub/summary?scope=ALL" \
  -H "Authorization: Bearer <VALID_TOKEN>" \
  -H "Accept: application/json"
```

**Expected Response:** HTTP 200 with JSON body containing summary data

---

## Troubleshooting Guide

### Issue: Still getting 500 errors after deployment

**Diagnostic Steps:**

1. **Check CloudWatch Logs**
```bash
# Get latest log events
aws logs filter-log-events \
  --log-group-name "/aws/lambda/finanzas-sd-api-dev-HubFn-ucjnnCAwKMfM" \
  --start-time $(expr $(date +%s) - 3600)000 \
  --limit 50
```

2. **Check Lambda Configuration**
```bash
# Verify environment variables
aws lambda get-function-configuration \
  --function-name finanzas-sd-api-dev-HubFn-ucjnnCAwKMfM \
  --query 'Environment.Variables'
```

**Required Environment Variables:**
- `TABLE_PROJECTS=finz_projects`
- `TABLE_ALLOCATIONS=finz_allocations`
- `TABLE_PAYROLL_ACTUALS=finz_payroll_actuals`
- `TABLE_ADJUSTMENTS=finz_adjustments`
- `AWS_REGION=us-east-2`
- `COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY`
- `COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m`

3. **Check IAM Permissions**
```bash
# Get Lambda execution role
aws lambda get-function-configuration \
  --function-name finanzas-sd-api-dev-HubFn-ucjnnCAwKMfM \
  --query 'Role'

# Verify role has DynamoDB read permissions
aws iam get-role-policy \
  --role-name <role-name> \
  --policy-name <policy-name>
```

**Required Permissions:**
- `dynamodb:Query` on all tables
- `dynamodb:Scan` on all tables
- `dynamodb:GetItem` on all tables

4. **Check DynamoDB Tables Exist**
```bash
# List tables with prefix
aws dynamodb list-tables \
  --query 'TableNames[?starts_with(@, `finz_`)]'
```

**Required Tables:**
- `finz_projects`
- `finz_allocations`
- `finz_payroll_actuals`
- `finz_adjustments`

---

### Issue: Getting 401 Unauthorized

**Diagnostic Steps:**

1. **Verify Cognito JWT Token**
```bash
# Decode JWT to check claims
echo "<JWT_TOKEN>" | jq -R 'split(".") | .[1] | @base64d | fromjson'
```

**Required Claims:**
- `iss`: Must match `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_FyHLtOhiY`
- `aud` or `client_id`: Must match `dshos5iou44tuach7ta3ici5m`
- `cognito:groups`: Must include `SDMT` or `EXEC_RO` or similar

2. **Check API Gateway Authorizer Configuration**
```bash
aws apigatewayv2 get-authorizer \
  --api-id <api-id> \
  --authorizer-id <authorizer-id>
```

---

### Issue: Getting 403 Forbidden

**Cause:** User doesn't have SDMT or EXEC_RO role

**Resolution:**
- Add user to appropriate Cognito group: `SDMT`, `EXEC_RO`, `FIN`, `AUD`, or `ADMIN`
- Verify `cognito:groups` claim in JWT includes one of these groups

---

### Issue: Getting 400 Bad Request with "Invalid scope"

**Cause:** Scope parameter contains invalid characters

**Valid Scope Values:**
- `ALL` (for all projects)
- Project codes: `P-TEST-001`, `PROJECT_ABC`, `TEST-123` (alphanumeric, hyphens, underscores only)

**Invalid Scope Values:**
- `PROJECT#123` (contains `#`)
- `TEST; DROP TABLE` (contains `;` and space)
- `<script>` (contains `<>`)

---

### Issue: Getting 404 Not Found

**Causes:**
1. **Wrong path**: Verify endpoint is `/finanzas/hub/summary` not `/hub/summary`
2. **Wrong stage**: Use `/dev/finanzas/hub/summary` for dev environment
3. **Wrong method**: Must be GET, not POST

---

## Testing Checklist

After deployment, verify all endpoints work:

### Summary Endpoint
```bash
# Test with scope=ALL
curl "https://<endpoint>/dev/finanzas/hub/summary?scope=ALL" \
  -H "Authorization: Bearer <TOKEN>"

# Test with specific project
curl "https://<endpoint>/dev/finanzas/hub/summary?scope=P-TEST-001" \
  -H "Authorization: Bearer <TOKEN>"

# Test with year parameter
curl "https://<endpoint>/dev/finanzas/hub/summary?scope=ALL&year=2025" \
  -H "Authorization: Bearer <TOKEN>"
```

### Other Hub Endpoints
```bash
# MOD Performance
curl "https://<endpoint>/dev/finanzas/hub/mod-performance?scope=ALL" \
  -H "Authorization: Bearer <TOKEN>"

# Cashflow
curl "https://<endpoint>/dev/finanzas/hub/cashflow?scope=ALL" \
  -H "Authorization: Bearer <TOKEN>"

# Rubros Breakdown
curl "https://<endpoint>/dev/finanzas/hub/rubros-breakdown?scope=ALL" \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected:** All endpoints return HTTP 200 with valid JSON

---

## Rollback Plan

If issues occur after deployment:

```bash
# Rollback to previous stack version
aws cloudformation update-stack \
  --stack-name finanzas-sd-api-dev \
  --use-previous-template \
  --capabilities CAPABILITY_IAM

# Or delete and redeploy from previous commit
git checkout <previous-commit-sha>
sam build && sam deploy --stack-name finanzas-sd-api-dev
```

---

## Monitoring

### CloudWatch Metrics to Watch

1. **Lambda Errors**
   - Metric: `Errors`
   - Namespace: `AWS/Lambda`
   - Dimension: `FunctionName=finanzas-sd-api-dev-HubFn-*`
   - Threshold: > 0

2. **API Gateway 5XX Errors**
   - Metric: `5XXError`
   - Namespace: `AWS/ApiGateway`
   - Dimension: `ApiId=<your-api-id>`
   - Threshold: > 10 in 5 minutes

3. **Lambda Duration**
   - Metric: `Duration`
   - Namespace: `AWS/Lambda`
   - Dimension: `FunctionName=finanzas-sd-api-dev-HubFn-*`
   - Threshold: > 10000ms (10 seconds)

### CloudWatch Logs Insights Queries

**Find all 500 errors:**
```
fields @timestamp, @message
| filter @message like /\[hub\/summary\]/
| filter @message like /500|error|Error|ERROR/
| sort @timestamp desc
| limit 20
```

**Find slow requests:**
```
fields @timestamp, @message, @duration
| filter @message like /\[hub\/summary\]/
| filter @duration > 5000
| sort @duration desc
| limit 20
```

---

## Related Issues

- **Issue #**: (TBD - link to GitHub issue)
- **PR #**: (TBD - link to pull request)
- **Related Docs**:
  - `HUB_IMPLEMENTATION_SUMMARY.md`
  - `services/finanzas-api/README.md`
  - `DEPLOYMENT_GUIDE.md`

---

## Contact

For issues or questions:
- **Team**: Finanzas SD Development Team
- **Slack**: #finanzas-sd-dev
- **Email**: finanzas-dev@company.com

---

## Appendix: Common Error Messages

| Error Message | HTTP Code | Cause | Resolution |
|---------------|-----------|-------|------------|
| "Invalid event structure" | 500 | Malformed API Gateway event | Check API Gateway integration |
| "forbidden: no role assigned" | 403 | User has no Cognito groups | Add user to group |
| "forbidden: SDMT or EXEC_RO required" | 403 | User lacks Hub access | Add to SDMT/EXEC_RO group |
| "Invalid scope parameter" | 400 | Scope contains special chars | Use alphanumeric+hyphens only |
| "Invalid year parameter" | 400 | Year not 2020-2100 | Use valid year |
| "Failed to fetch summary data" | 500 | DynamoDB error | Check tables & permissions |
| "unauthorized: missing bearer token" | 401 | No Authorization header | Add Bearer token |
| "unauthorized: invalid token" | 401 | JWT verification failed | Check token issuer/audience |

---

**Version:** 1.0  
**Last Updated:** 2026-01-18  
**Approved By:** (TBD)
