# CORS Fix - Deployment and Validation Checklist

## Summary
This deployment fixes CORS errors that were preventing the frontend from accessing API Gateway endpoints. The fix changes from a single allowed origin to wildcard origin (`*`) for maximum compatibility while maintaining security through JWT authentication.

## Pre-Deployment Checklist

### 1. Review Changes
- [ ] Review all modified files in this PR
- [ ] Confirm CORS headers match between API Gateway config and Lambda responses
- [ ] Verify unit tests pass (26 tests)
- [ ] Confirm no TypeScript compilation errors related to changes
- [ ] Verify CodeQL security scan passes

### 2. Backup Current Configuration
```bash
# Backup current API Gateway configuration
aws apigatewayv2 get-api --api-id <api-id> > /tmp/api-gateway-backup-before-cors-fix.json

# Backup current CloudFormation stack
aws cloudformation describe-stacks --stack-name finanzas-sd-api-dev > /tmp/cf-stack-backup-before-cors-fix.json
```

## Deployment Steps

### 1. Build and Test Locally
```bash
cd services/finanzas-api

# Install dependencies
npm install

# Run unit tests
npm run test:unit -- tests/unit/http.spec.ts

# Verify TypeScript compilation
npx tsc --noEmit

# Build SAM application
sam build
```

### 2. Deploy to Dev Environment
```bash
sam deploy \
  --no-confirm-changeset \
  --stack-name finanzas-sd-api-dev \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CognitoUserPoolArn=<your-arn> \
    CognitoUserPoolId=us-east-2_FyHLtOhiY \
    CognitoUserPoolClientId=dshos5iou44tuach7ta3ici5m \
    StageName=dev \
    CloudFrontDomain=d7t9x3j66yd8k.cloudfront.net
```

### 3. Wait for Deployment
```bash
# Monitor deployment progress
aws cloudformation describe-stack-events \
  --stack-name finanzas-sd-api-dev \
  --max-items 10 \
  --query 'StackEvents[*].[ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table

# Wait for completion
aws cloudformation wait stack-update-complete --stack-name finanzas-sd-api-dev
```

## Post-Deployment Validation

### 1. Verify API Gateway CORS Configuration
```bash
# Get API ID from CloudFormation outputs
API_ID=$(aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`FinzApiId`].OutputValue' \
  --output text)

# Verify CORS configuration
aws apigatewayv2 get-api --api-id $API_ID \
  --query 'CorsConfiguration' \
  --output json
```

**Expected output:**
```json
{
    "AllowOrigins": ["*"],
    "AllowMethods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "AllowHeaders": [
        "Authorization",
        "Content-Type",
        "X-Idempotency-Key",
        "X-Amz-Date",
        "X-Amz-Security-Token",
        "X-Requested-With",
        "X-Api-Key"
    ],
    "MaxAge": 86400
}
```

### 2. Test OPTIONS Preflight Request
```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Test OPTIONS request
curl -X OPTIONS \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v \
  "${API_URL}/projects"
```

**Look for these response headers:**
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
- `Access-Control-Allow-Headers: authorization,content-type,...`
- `Access-Control-Max-Age: 86400`

### 3. Test Actual API Request
```bash
# Get a test token (replace with actual token)
TOKEN="<your-jwt-token>"

# Test GET request
curl -X GET \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -v \
  "${API_URL}/projects"
```

**Verify response includes:**
- `Access-Control-Allow-Origin: *`
- Status 200 OK (if authenticated)
- JSON response body

### 4. Browser Testing Checklist

Open the Finanzas UI in Chrome with DevTools:

1. Navigate to: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
2. Log in with valid credentials
3. Open DevTools → Network tab
4. Clear network log
5. Navigate to different pages (Projects, Forecast, etc.)
6. For each API request, verify:
   - [ ] Request completes successfully (green status)
   - [ ] No CORS errors in console
   - [ ] Response headers include `Access-Control-Allow-Origin: *`
   - [ ] Data loads correctly in UI

#### Test These Critical Endpoints:
- [ ] `/projects` (GET) - Projects list page
- [ ] `/projects` (POST) - Create new project
- [ ] `/baseline` (POST) - Create baseline
- [ ] `/baseline/{id}` (GET) - View baseline
- [ ] `/plan/forecast` (GET) - Forecast page
- [ ] `/catalog/rubros` (GET) - Catalog page
- [ ] `/providers` (GET) - Providers page
- [ ] `/allocations` (GET) - Allocations
- [ ] `/adjustments` (GET) - Adjustments

### 5. Multi-Origin Testing (Optional)

Test from different origins to verify wildcard works:

```bash
# Test from localhost origin
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -v \
  "${API_URL}/projects"

# Test from different CloudFront distribution
curl -X OPTIONS \
  -H "Origin: https://other-distribution.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -v \
  "${API_URL}/projects"
```

Both should return `Access-Control-Allow-Origin: *`

## Troubleshooting

### Issue: OPTIONS returns 403 Forbidden
**Cause**: Cognito authorizer applied to OPTIONS method
**Fix**: Verify OPTIONS routes have `Auth.Authorizer: NONE` (HTTP API v2 handles this automatically)

### Issue: Response missing CORS headers
**Cause**: Handler not using HTTP utility functions
**Fix**: Check handler imports from `../lib/http` and uses `ok()`, `bad()`, etc.

### Issue: Browser still shows CORS error
**Possible Causes**:
1. **Browser cache**: Hard refresh (Ctrl+Shift+R) or clear cache
2. **CloudFront cache**: Wait for TTL or invalidate distribution
3. **API Gateway cache**: Verify stage caching settings
4. **Wrong API endpoint**: Verify frontend config uses correct API URL

**Debug Steps**:
```bash
# Check frontend API configuration
grep -r "API_BASE" .env.production

# Verify API URL in browser console
# Open browser DevTools → Console → Run:
console.log(import.meta.env.VITE_API_BASE_URL);

# Compare with deployed API URL
echo $API_URL
```

### Issue: 401 Unauthorized after deployment
**Cause**: Unrelated to CORS fix - authentication issue
**Fix**: Verify Cognito token is valid and not expired

## Rollback Plan

If issues occur, rollback to previous stack version:

```bash
# List stack history
aws cloudformation describe-stack-events \
  --stack-name finanzas-sd-api-dev \
  --max-items 50

# Rollback to previous version
# Note: This requires the previous template and parameters
# Better approach: Keep the previous git commit hash and redeploy from there

git checkout <previous-commit-hash>
cd services/finanzas-api
sam build
sam deploy --no-confirm-changeset --stack-name finanzas-sd-api-dev ...
```

## Success Criteria

Deployment is successful when:
- [ ] CloudFormation stack shows `UPDATE_COMPLETE` status
- [ ] API Gateway CORS config shows `AllowOrigins: ["*"]`
- [ ] OPTIONS requests return CORS headers
- [ ] GET/POST requests include `Access-Control-Allow-Origin: *` header
- [ ] Browser DevTools shows no CORS errors
- [ ] All critical endpoints work from CloudFront UI
- [ ] Unit tests pass (26 tests)
- [ ] CodeQL security scan passes (0 alerts)

## Security Validation

After deployment, verify:
- [ ] JWT authentication still enforced (401 without valid token)
- [ ] Authorization checks still work (403 for unauthorized actions)
- [ ] Cognito authorizer validates tokens correctly
- [ ] No credentials or sensitive data exposed in responses
- [ ] HTTPS enforced (API Gateway uses HTTPS by default)

## Communication Plan

### Notify stakeholders:
1. **Dev Team**: CORS fix deployed, wildcard origin now enabled
2. **QA Team**: Request testing from browser with different scenarios
3. **Operations**: Monitor CloudWatch logs for any errors
4. **Product**: Users should no longer see CORS-related errors

### Monitoring

Watch these CloudWatch metrics after deployment:
- API Gateway 4xx errors (should not increase)
- API Gateway 5xx errors (should remain low)
- Lambda error count (should not increase)
- API Gateway request count (normal traffic pattern)

```bash
# Check recent errors
aws logs tail /aws/http-api/dev/finz-access --follow --since 10m
```

## Documentation Updates

After successful deployment:
- [x] `API_CORS_CONFIGURATION.md` - Created with complete guide
- [ ] Update main README.md with CORS configuration notes
- [ ] Update DEPLOYMENT_GUIDE.md if needed
- [ ] Add entry to CHANGELOG.md

## Sign-Off

- [ ] Developer: Changes implemented and tested
- [ ] Code Review: PR approved
- [ ] Security Scan: CodeQL passed (0 alerts)
- [ ] QA: Browser testing completed
- [ ] Operations: Deployment verified
- [ ] Product: User-facing CORS errors resolved

---

## Quick Reference

### Key Changes
1. API Gateway: `AllowOrigins` changed from single domain to `*`
2. Lambda: CORS headers use wildcard origin
3. Removed: `AllowCredentials: true` (incompatible with wildcard)
4. Added: PATCH method to Lambda CORS headers

### Why This is Safe
- Authentication via JWT in `Authorization` header (not cookies)
- No credentials exposed (we don't use `AllowCredentials`)
- Proper authorization enforced by Cognito and AVP
- Standard pattern for public APIs with JWT authentication

### Support
For issues or questions:
- Review: `API_CORS_CONFIGURATION.md`
- CloudWatch Logs: `/aws/http-api/dev/finz-access`
- API Gateway Console: Check CORS config
- Lambda Console: Check function logs
