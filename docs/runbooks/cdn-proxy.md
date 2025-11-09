# CloudFront CDN Proxy for Finanzas API

## Overview

This runbook documents the CloudFront distribution configuration that proxies the Finanzas API through the existing shared CloudFront distribution (`EPQU7PVDLQXUA`). This setup provides a unified origin for both UI and API traffic, improving security, performance, and simplifying CORS management.

## Architecture

### Routing Configuration

The CloudFront distribution handles two distinct traffic patterns:

1. **UI Traffic**: `/finanzas/*` → S3 Origin (static assets)
   - Main path pattern for serving the Single Page Application
   - Includes SPA fallback for deep linking (403/404 → `/finanzas/index.html`)

2. **API Traffic**: `/finanzas/api/*` → API Gateway Origin (backend API)
   - Path pattern: `finanzas/api/*`
   - Target: `m3g6am67aj.execute-api.us-east-2.amazonaws.com`
   - Origin Path: `/dev` (stage is applied at origin level)
   - Viewer protocol: HTTPS redirect
   - Cache Policy: Managed-CachingDisabled (`413f1601-64f1-4fe4-b6e4-48c1c1b29f7e`)
   - Origin Request Policy: Managed-AllViewerExceptHostHeader (`b689b0a8-53d0-40ab-baf2-68738e2966ac`)

### Path Rewrite Function

The CloudFront Function `finanzas-sd-{env}-api-path-rewrite` transforms incoming requests:

**Function Logic:**
```javascript
function handler(event) {
  var r = event.request;
  if (r.uri.startsWith('/finanzas/api/')) r.uri = r.uri.replace(/^\/finanzas\/api/, '');
  else if (r.uri === '/finanzas/api') r.uri = '/';
  return r;
}
```

**Examples:**
- Incoming: `/finanzas/api/health` → Origin receives: `/health`
- Incoming: `/finanzas/api/projects` → Origin receives: `/projects`
- Incoming: `/finanzas/api/` → Origin receives: `/`

The API Gateway stage (`/dev`) is handled via the OriginPath configuration, so it's automatically prepended by CloudFront before reaching the API Gateway.

**Complete Flow:**
1. Browser: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/health`
2. CloudFront Function rewrites to: `/health`
3. CloudFront routes to origin: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health`
4. API Gateway processes the request with Cognito JWT auth

### CORS Configuration

**Tight CORS Policy:**
- API CORS is restricted to CloudFront domain only: `https://d7t9x3j66yd8k.cloudfront.net`
- Configured in `services/finanzas-api/template.yaml` via the `AllowedCorsOrigin` parameter
- Allowed methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- Allowed headers: `Authorization`, `Content-Type`
- Max age: 600 seconds

**Security Benefits:**
- Prevents direct API access from arbitrary origins
- All browser-based API calls must originate from the CloudFront domain
- JWT tokens are still validated by API Gateway (defense in depth)

### Authorization

The CloudFront configuration forwards the `Authorization` header to the origin using the Managed-AllViewerExceptHostHeader policy. This ensures JWT tokens reach the API Gateway Cognito JWT authorizer.

**Auth Flow:**
1. Browser includes JWT in `Authorization: Bearer <token>` header
2. CloudFront forwards header to API Gateway (via origin request policy)
3. API Gateway validates JWT against Cognito User Pool
4. Protected endpoints require valid JWT with appropriate claims

## Deployment

### Initial Setup

Run the `update-cloudfront` workflow to configure the distribution:

```bash
gh workflow run update-cloudfront.yml -f environment=dev
```

This workflow performs the following operations:
1. Resolves Finanzas API ID and stage from repository variables
2. Creates/updates the CloudFront Function for path rewriting
3. Fetches the current distribution configuration with ETag
4. Merges the API origin (`ApiGwOrigin`) if not present
5. Adds cache behavior for `finanzas/api/*` path pattern
6. Ensures SPA fallback error responses (403/404 redirects)
7. Updates the distribution with If-Match ETag for safe concurrent updates

### Updating CORS

To update the allowed CORS origin (e.g., for a different CloudFront domain):

```bash
cd services/finanzas-api
sam build
sam deploy --parameter-overrides AllowedCorsOrigin=https://NEW_CLOUDFRONT_DOMAIN.cloudfront.net
```

### Frontend Configuration

The frontend must be configured to use the CloudFront proxy path:

**`.env.production`:**
```bash
VITE_API_BASE_URL=/finanzas/api
```

The API client (`src/api/finanzasClient.ts`) automatically handles path concatenation.

## Verification & Smoke Tests

### 1. UI Smoke Test

Verify the SPA loads correctly:

```bash
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/
# Expected: HTTP/2 200
```

### 2. API Health Check

Test the API health endpoint (public, no auth required):

```bash
curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/health
# Expected: {"ok":true,"stage":"dev","time":"..."}
```

### 3. CORS Preflight

Test CORS with OPTIONS preflight:

```bash
curl -X OPTIONS https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/projects \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization,Content-Type" \
  -v
# Expected: HTTP/2 200 with CORS headers
```

### 4. Protected Endpoint

Test a protected endpoint with JWT:

```bash
# First, obtain a JWT token (use your auth flow or test user)
JWT_TOKEN="<your-jwt-token>"

curl https://d7t9x3j66yd8k.cloudfront.net/finanzas/api/projects \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
# Expected: HTTP/2 200 with project list
```

### 5. Deep Link / SPA Fallback

Test that deep links redirect to the SPA:

```bash
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/some/deep/route
# Expected: HTTP/2 200 (served /finanzas/index.html)
```

### 6. API via Direct URL (Should Fail CORS)

Test that direct API Gateway access fails CORS from browsers:

```bash
# This would work from curl (no CORS), but fail from browser
curl https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health \
  -H "Origin: https://example.com"
# Expected: 200 but CORS headers will reject origin in browser
```

## Rollback Procedures

### Scenario 1: API Traffic Issues

If the CloudFront API proxy is experiencing issues, you can temporarily point the frontend back to the direct API Gateway URL:

**Emergency Rollback:**

1. Update `.env.production`:
   ```bash
   VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
   ```

2. Update API CORS to allow direct access:
   ```bash
   cd services/finanzas-api
   sam deploy --parameter-overrides AllowedCorsOrigin=https://d7t9x3j66yd8k.cloudfront.net,https://m3g6am67aj.execute-api.us-east-2.amazonaws.com
   ```
   (Note: This is temporary and less secure)

3. Rebuild and redeploy the frontend

### Scenario 2: Remove API Cache Behavior

To completely remove the API proxy behavior from CloudFront:

1. Use AWS Console or CLI to manually edit the distribution
2. Remove the cache behavior for `finanzas/api/*`
3. Remove the `ApiGwOrigin` origin (or keep it for future use)
4. Create a new distribution version

**CLI Approach:**
```bash
# Get current config
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA > dist-backup.json

# Manually edit the JSON to remove the cache behavior and origin
# Then update:
aws cloudfront update-distribution --id EPQU7PVDLQXUA \
  --if-match <etag> \
  --distribution-config file://modified-config.json
```

### Scenario 3: Function Issues

If the path rewrite function is causing problems:

1. Remove the function association from the cache behavior:
   ```bash
   # Edit distribution via console, remove FunctionAssociations from finanzas/api/* behavior
   ```

2. Or delete the function entirely:
   ```bash
   aws cloudfront delete-function --name finanzas-sd-dev-api-path-rewrite --if-match <etag>
   ```

## Monitoring & Troubleshooting

### CloudWatch Logs

**API Access Logs:**
- Log Group: `/aws/http-api/dev/finz-access`
- Contains authorizer errors and request details

**Lambda Function Logs:**
- Log Group: `/aws/lambda/<function-name>`
- Check individual endpoint function logs for application errors

### Common Issues

**Issue: CORS errors in browser**
- **Symptom:** Browser console shows CORS policy errors
- **Check:** Verify `AllowedCorsOrigin` in API template matches CloudFront domain exactly
- **Fix:** Redeploy API stack with correct origin parameter

**Issue: 403 Forbidden on API calls**
- **Symptom:** All API requests return 403
- **Check:** Verify JWT token is valid and includes correct audience/issuer
- **Debug:** Check API access logs for authorizer errors
- **Fix:** Regenerate token or verify Cognito configuration

**Issue: 404 Not Found on API endpoints**
- **Symptom:** API endpoints return 404
- **Check:** Verify path rewrite function is deployed and associated with cache behavior
- **Debug:** Check CloudFront function logs
- **Fix:** Re-run update-cloudfront workflow

**Issue: Slow API responses**
- **Symptom:** API calls take longer than expected
- **Check:** CloudFront distribution status (deploying changes can take 10-15 minutes)
- **Wait:** Allow time for distribution updates to propagate
- **Monitor:** Check CloudFront metrics in CloudWatch

### CloudFront Distribution Status

Check deployment status:

```bash
aws cloudfront get-distribution --id EPQU7PVDLQXUA \
  --query 'Distribution.Status' \
  --output text
# Expected: "Deployed" (stable) or "InProgress" (updating)
```

## Evidence Pack

When deploying or troubleshooting, collect the following evidence:

1. **Distribution Configuration:**
   ```bash
   aws cloudfront get-distribution-config --id EPQU7PVDLQXUA > distribution-config.json
   ```

2. **Cache Behaviors:**
   ```bash
   aws cloudfront get-distribution --id EPQU7PVDLQXUA \
     --query 'Distribution.DistributionConfig.CacheBehaviors.Items[].PathPattern'
   ```

3. **Origins:**
   ```bash
   aws cloudfront get-distribution --id EPQU7PVDLQXUA \
     --query 'Distribution.DistributionConfig.Origins.Items[].[Id,DomainName]'
   ```

4. **Function List:**
   ```bash
   aws cloudfront list-functions \
     --query 'FunctionList.Items[?contains(Name, `finanzas`)].Name'
   ```

5. **API Logs Sample:**
   ```bash
   aws logs tail /aws/http-api/dev/finz-access --follow --since 5m
   ```

## References

- CloudFront Distribution ID: `EPQU7PVDLQXUA`
- CloudFront Domain: `d7t9x3j66yd8k.cloudfront.net`
- API Gateway ID: `m3g6am67aj`
- API Stage: `dev`
- Region: `us-east-2`
- Stack Name: `finanzas-sd-api-dev`

## Related Documentation

- [AWS CloudFront Developer Guide](https://docs.aws.amazon.com/cloudfront/index.html)
- [CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
- [API Gateway CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html)
- Project: `docs/deploy.md` - Overall deployment guide
- Project: `docs/auth-usage.md` - Authentication details
