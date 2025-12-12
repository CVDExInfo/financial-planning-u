# CORS Preflight Configuration and Validation

## What Broke

The behavioral API tests were failing due to CORS preflight (OPTIONS) issues:

1. **Origin Handling**: Tests were sending `Origin: d7t9x3j66yd8k.cloudfront.net` (missing `https://` protocol)
2. **Environment Variable Inconsistency**: Workflow used `CF_DOMAIN` with `https://` prefix, but tests expected domain-only format
3. **Missing Diagnostics**: Test failures didn't show request/response details
4. **Credential Naming**: EXEC role used inconsistent naming (`E2E_EXEC_EMAIL` vs `E2E_EXEC_RO_EMAIL`)

## Current CORS Configuration

### Location
**File**: `services/finanzas-api/template.yaml`  
**Lines**: 370-389

### Configuration (HTTP API)
```yaml
Api:
  Type: AWS::Serverless::HttpApi
  Properties:
    CorsConfiguration:
      AllowOrigins:
        - Fn::Sub: https://${CloudFrontDomain}
      AllowHeaders:
        - Authorization
        - Content-Type
        - X-Idempotency-Key
        - X-Amz-Date
        - X-Amz-Security-Token
        - X-Requested-With
        - X-Api-Key
      AllowMethods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      AllowCredentials: true
      MaxAge: 86400
```

**API Gateway Type**: HTTP API (AWS::Serverless::HttpApi)  
**CORS Handled By**: API Gateway natively (not Lambda)

### Default Values
- **CloudFront Domain**: `d7t9x3j66yd8k.cloudfront.net` (parameter default)
- **Allowed Origin**: `https://d7t9x3j66yd8k.cloudfront.net`
- **Stage**: `dev` (default)

## How to Validate with curl

### Basic Preflight Test
```bash
curl -i -X OPTIONS "https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev/projects" \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

### Expected Response
```
HTTP/2 200
access-control-allow-origin: https://d7t9x3j66yd8k.cloudfront.net
access-control-allow-methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
access-control-allow-headers: authorization,content-type,x-idempotency-key,x-amz-date,x-amz-security-token,x-requested-with,x-api-key
access-control-allow-credentials: true
access-control-max-age: 86400
```

### Test Multiple Endpoints
```bash
# Projects endpoint
curl -i -X OPTIONS "$API_BASE/projects" \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type"

# Forecast endpoint
curl -i -X OPTIONS "$API_BASE/plan/forecast" \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type"

# Catalog endpoint (unauthenticated)
curl -i -X OPTIONS "$API_BASE/catalog/rubros" \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

### Automated Validation Script

A ready-to-use validation script is available at `scripts/validate-cors.sh`:

```bash
# Run with default values
./scripts/validate-cors.sh

# Or specify custom API and origin
export FINZ_API_BASE="https://your-api.execute-api.region.amazonaws.com/stage"
export CF_ORIGIN="https://your-cloudfront-domain.cloudfront.net"
./scripts/validate-cors.sh
```

The script tests all critical endpoints and provides clear pass/fail results with troubleshooting guidance.

## Tiered Testing Architecture

### Tier-0 Tests (Always Run, Blocking)
**Purpose**: Critical security and infrastructure validation  
**Runs**: Always, even without credentials  
**Blocks PR**: Yes

Tests included:
- ✅ CORS preflight OPTIONS checks (all critical endpoints)
- ✅ Origin validation (ensures https:// protocol)
- ✅ Unauthenticated security checks (future: 401/403 on protected endpoints)

### Tier-1 Tests (Credential-Dependent)
**Purpose**: Authenticated API behavior, RBAC, schema validation  
**Runs**: Only when at least one E2E role credential is configured  
**Blocks PR**: No (skipped if credentials absent)

Tests included:
- ✅ Cognito authentication and token retrieval
- ✅ Role-based access control (PMO, SDM_FIN, SDMT, EXEC_RO)
- ✅ NO_GROUP security test (users without groups denied)
- ✅ API response schema validation
- ✅ Data-shape contracts

## Environment Variables

### Required (Tier-0)
```bash
FINZ_API_BASE=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
CF_ORIGIN=https://d7t9x3j66yd8k.cloudfront.net
AWS_REGION=us-east-2
COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
COGNITO_WEB_CLIENT=dshos5iou44tuach7ta3ici5m
```

### Optional (Tier-1)
```bash
# PMO Role
E2E_PMO_EMAIL=pmo-user@example.com
E2E_PMO_PASSWORD=<password>

# SDM_FIN/SDMT Role
E2E_SDMT_EMAIL=sdmt-user@example.com
E2E_SDMT_PASSWORD=<password>

# EXEC_RO Role (standardized naming)
E2E_EXEC_RO_EMAIL=exec-user@example.com
E2E_EXEC_RO_PASSWORD=<password>

# NO_GROUP User (security test)
E2E_NO_GROUP_EMAIL=nogroup-user@example.com
E2E_NO_GROUP_PASSWORD=<password>
```

## Running Tests Locally

### Tier-0 Only (No Credentials)
```bash
export FINZ_API_BASE="https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev"
export CF_ORIGIN="https://d7t9x3j66yd8k.cloudfront.net"
export COGNITO_USER_POOL_ID="us-east-2_FyHLtOhiY"
export COGNITO_WEB_CLIENT="dshos5iou44tuach7ta3ici5m"
export AWS_REGION="us-east-2"

npm run test:behavioral
```

Expected output:
- ✅ CORS preflight tests: PASS
- ⏭️ Authentication tests: SKIPPED
- ⏭️ RBAC tests: SKIPPED
- ⏭️ Schema tests: SKIPPED

### Full Test Suite (With Credentials)
```bash
# Set base config
export FINZ_API_BASE="https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev"
export CF_ORIGIN="https://d7t9x3j66yd8k.cloudfront.net"
export COGNITO_USER_POOL_ID="us-east-2_FyHLtOhiY"
export COGNITO_WEB_CLIENT="dshos5iou44tuach7ta3ici5m"
export AWS_REGION="us-east-2"

# Add role credentials
export E2E_SDMT_EMAIL="your-sdmt-user@example.com"
export E2E_SDMT_PASSWORD="your-password"

npm run test:behavioral
```

Expected output:
- ✅ CORS preflight tests: PASS
- ✅ Authentication tests: PASS
- ✅ RBAC tests: PASS (for configured roles)
- ✅ Schema tests: PASS

## Troubleshooting

### Issue: "CF_ORIGIN or CF_DOMAIN environment variable must be set"
**Solution**: Set `CF_ORIGIN` with full HTTPS URL:
```bash
export CF_ORIGIN="https://d7t9x3j66yd8k.cloudfront.net"
```

### Issue: "CloudFront origin must use HTTPS protocol"
**Solution**: Ensure CF_ORIGIN starts with `https://`:
```bash
# Wrong
export CF_ORIGIN="d7t9x3j66yd8k.cloudfront.net"

# Correct
export CF_ORIGIN="https://d7t9x3j66yd8k.cloudfront.net"
```

### Issue: "access-control-allow-origin header missing"
**Diagnosis**: Check API Gateway CORS configuration in template.yaml
**Solutions**:
1. Verify CloudFront domain matches origin sent in tests
2. Redeploy API after template changes: `sam deploy`
3. Check CloudWatch logs for API Gateway errors

### Issue: All Tier-1 tests skipped
**Expected**: This is normal when no credentials are configured
**Not a failure**: CI will pass with Tier-0 tests only
**To enable**: Configure at least one E2E role credential in GitHub Secrets

### Issue: "Failed to authenticate <role>: No ID token in response"
**Solutions**:
1. Verify Cognito credentials are correct
2. Check user exists in Cognito User Pool
3. Ensure user account is confirmed and enabled
4. Verify COGNITO_WEB_CLIENT matches app client ID

## Deployment Checklist

Before deploying CORS changes:

- [ ] Update `CloudFrontDomain` parameter in template if needed
- [ ] Verify `AllowOrigins` includes correct HTTPS origin
- [ ] Test locally with `sam local start-api` (if possible)
- [ ] Deploy to dev: `sam deploy --stack-name finanzas-sd-api-dev`
- [ ] Run curl validation script (above)
- [ ] Run behavioral tests: `npm run test:behavioral`
- [ ] Verify CloudFront+API integration from browser

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never use `*` for AllowOrigins in production** - Always specify exact CloudFront domain
2. **Always include AllowCredentials: true** for authenticated requests
3. **Test NO_GROUP user** to prevent privilege escalation (requires E2E_NO_GROUP credentials)
4. **Stage isolation** - dev CORS should only allow dev CloudFront, prod should only allow prod CloudFront

## Additional Resources

- [AWS HTTP API CORS Documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html)
- [SAM Template Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-httpapi.html)
- Browser DevTools Network tab - shows actual CORS preflight requests
