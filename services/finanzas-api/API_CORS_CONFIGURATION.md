# API Gateway CORS Configuration Guide

## Overview

This document describes the CORS (Cross-Origin Resource Sharing) configuration for the Finanzas API Gateway and Lambda handlers, ensuring the API can be accessed from web browsers regardless of the frontend domain.

## Problem Statement

Browser-based API requests to the Finanzas API Gateway were failing with CORS errors:
- **Error**: `Access-Control-Allow-Origin – Missing Header`
- **Symptom**: API calls from CloudFront-hosted UI fail with CORS errors in browser console
- **Root Cause**: API Gateway and Lambda responses needed proper CORS headers to allow cross-origin requests

## Solution Overview

The CORS configuration is implemented at two levels:
1. **API Gateway HTTP API v2** - Handles preflight OPTIONS requests automatically
2. **Lambda Response Headers** - All Lambda responses include CORS headers

## CORS Configuration Details

### 1. API Gateway CORS (template.yaml)

The HTTP API v2 CORS configuration in `template.yaml` (lines 354-371):

```yaml
CorsConfiguration:
  AllowOrigins:
  - '*'
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
  MaxAge: 86400
```

**Key Features:**
- **Wildcard Origin (`*`)**: Allows requests from any domain (CloudFront, localhost during dev, etc.)
- **No AllowCredentials**: Authentication uses JWT in `Authorization` header, not cookies
- **All HTTP Methods**: Supports GET, POST, PUT, PATCH, DELETE, OPTIONS
- **24-Hour Cache**: Preflight responses cached for 86400 seconds (24 hours)

### 2. Lambda Response Headers (src/lib/http.ts)

All Lambda handlers use centralized HTTP utilities that include CORS headers:

```typescript
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,X-Requested-With,X-Idempotency-Key,X-Amz-Date,X-Amz-Security-Token,X-Api-Key",
  "Access-Control-Max-Age": "86400",
};
```

All response functions (`ok()`, `bad()`, `serverError()`, etc.) automatically include these headers.

## Why Wildcard Origin?

### Advantages
1. **Development Flexibility**: Works with localhost during development
2. **Multi-Domain Support**: Same API can serve multiple frontend domains
3. **CloudFront Distribution Changes**: No need to update API when CloudFront domain changes
4. **Simpler Configuration**: No need to maintain a list of allowed origins

### Security Considerations
✅ **Safe for JWT Authentication**: Since we use JWT tokens in the `Authorization` header (not cookies), wildcard origin is secure
✅ **No Credentials Exposed**: We don't set `Access-Control-Allow-Credentials: true`
✅ **Proper Authorization**: Authentication and authorization are enforced by Cognito JWT validation

### When NOT to Use Wildcard
❌ Don't use `*` if your API uses cookies for authentication (we don't)
❌ Don't use `*` if you need `Access-Control-Allow-Credentials: true` (we don't)

## Browser CORS Workflow

### 1. Preflight Request (OPTIONS)
When the browser makes a cross-origin request with custom headers, it first sends a preflight:

```http
OPTIONS /projects HTTP/1.1
Host: <api-id>.execute-api.us-east-2.amazonaws.com
Origin: https://d7t9x3j66yd8k.cloudfront.net
Access-Control-Request-Method: GET
Access-Control-Request-Headers: authorization,content-type
```

API Gateway HTTP API v2 automatically responds with:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Authorization,Content-Type,X-Idempotency-Key,...
Access-Control-Max-Age: 86400
```

### 2. Actual Request (GET, POST, etc.)
After preflight succeeds, the browser sends the actual request:

```http
GET /projects HTTP/1.1
Host: <api-id>.execute-api.us-east-2.amazonaws.com
Origin: https://d7t9x3j66yd8k.cloudfront.net
Authorization: Bearer eyJhbGc...
```

Lambda handler responds with:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,...
Content-Type: application/json

{"data": [...]}
```

## Testing CORS Configuration

### Unit Tests

Run the CORS unit tests to verify headers are correctly set:

```bash
cd services/finanzas-api
npm run test:unit -- tests/unit/http.spec.ts
```

Expected output:
```
✓ should have wildcard origin
✓ should include all required HTTP methods
✓ should include all required headers
✓ should NOT include Access-Control-Allow-Credentials
✓ all response functions should return identical CORS headers
```

### Integration Tests

Run behavioral API tests to verify CORS works end-to-end:

```bash
cd ../../
npm run test:behavioral-api
```

The CORS test suite validates:
- OPTIONS preflight requests return proper headers
- Actual requests include CORS headers
- All critical endpoints support CORS

### Manual Testing with cURL

#### Test Preflight Request
```bash
curl -X OPTIONS \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v \
  https://<api-id>.execute-api.us-east-2.amazonaws.com/dev/projects
```

Look for these response headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Authorization,Content-Type,...
```

#### Test Actual Request
```bash
curl -X GET \
  -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
  -H "Authorization: Bearer <token>" \
  -v \
  https://<api-id>.execute-api.us-east-2.amazonaws.com/dev/projects
```

Verify response includes:
```
Access-Control-Allow-Origin: *
```

### Browser Testing

1. Open Chrome DevTools → Network tab
2. Navigate to Finanzas UI: `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
3. Log in
4. Observe network requests to the API
5. Check response headers for each API call:
   - ✅ `Access-Control-Allow-Origin: *`
   - ✅ `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`
   - ✅ `Access-Control-Allow-Headers: Content-Type,Authorization,...`

## Deployment

CORS configuration is applied through the CloudFormation/SAM template deployment:

```bash
cd services/finanzas-api

# Build
sam build

# Deploy
sam deploy \
  --no-confirm-changeset \
  --stack-name finanzas-sd-api-dev \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CognitoUserPoolArn=<arn> \
    CognitoUserPoolId=us-east-2_FyHLtOhiY \
    CognitoUserPoolClientId=dshos5iou44tuach7ta3ici5m \
    StageName=dev \
    CloudFrontDomain=d7t9x3j66yd8k.cloudfront.net
```

After deployment:
1. API Gateway CORS configuration is updated
2. Lambda functions include CORS headers in all responses
3. Browser requests work from any origin

## Troubleshooting

### CORS Errors Still Occur

If you still see CORS errors after deployment:

1. **Verify API Gateway CORS Configuration**:
   ```bash
   aws apigatewayv2 get-api --api-id <api-id> \
     --query 'CorsConfiguration'
   ```
   
   Should show:
   ```json
   {
     "AllowOrigins": ["*"],
     "AllowMethods": ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
     "AllowHeaders": ["Authorization","Content-Type",...],
     "MaxAge": 86400
   }
   ```

2. **Check Lambda Response Headers**:
   Use browser DevTools to inspect actual response headers from Lambda
   - Look for `Access-Control-Allow-Origin: *`
   - Verify all required headers are present

3. **Verify OPTIONS Requests Work**:
   ```bash
   curl -X OPTIONS -v https://<api-id>.execute-api.us-east-2.amazonaws.com/dev/projects
   ```
   Should return 204 No Content with CORS headers

4. **Check CloudFront Caching**:
   If using CloudFront in front of API Gateway, ensure it forwards Origin header:
   ```bash
   aws cloudfront get-distribution-config --id <distribution-id> \
     --query 'DistributionConfig.Origins[0].CustomHeaders'
   ```

### 403 Forbidden on OPTIONS

If OPTIONS requests return 403:
- Verify Cognito authorizer is NOT applied to OPTIONS method
- Check that `Auth.Authorizer: NONE` is set for OPTIONS routes (if explicit routes exist)

### Mixed Content Errors

If you see "Mixed Content" errors:
- Ensure API Gateway uses HTTPS (it does by default)
- Verify frontend makes HTTPS requests to API
- Check that `API_BASE_URL` in frontend config uses `https://`

### Credentials Warning

If browser shows warning about credentials:
```
Access to fetch at '...' has been blocked by CORS policy: 
The value of the 'Access-Control-Allow-Credentials' header in the response 
is '' which must be 'true' when the request's credentials mode is 'include'.
```

**Fix**: Remove `credentials: 'include'` from frontend fetch calls. We use JWT in Authorization header, not cookies.

## Handler Implementation

### Using HTTP Utilities (Recommended)

All handlers should use the centralized HTTP utilities:

```typescript
import { ok, bad, serverError } from '../lib/http';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    // ... handler logic ...
    return ok({ data: result });
  } catch (error) {
    return serverError('Failed to process request');
  }
};
```

### Manual Response Construction (Avoid)

If you must construct responses manually, include CORS headers:

```typescript
import { cors } from '../lib/http';

return {
  statusCode: 200,
  headers: { 
    'Content-Type': 'application/json',
    ...cors  // Always include CORS headers
  },
  body: JSON.stringify({ data: result })
};
```

## Migration Notes

### From Single Origin to Wildcard

Previous configuration restricted origin to single CloudFront domain:
```yaml
AllowOrigins:
- Fn::Sub: https://${CloudFrontDomain}
AllowCredentials: true
```

New configuration uses wildcard:
```yaml
AllowOrigins:
- '*'
# AllowCredentials removed (incompatible with wildcard)
```

**Impact**: 
- ✅ More flexible - works from any domain
- ✅ Simpler configuration
- ✅ Better for development
- ⚠️ Requires JWT authentication (we already use this)

### From Allow-Credentials to JWT-Only

**Before**: `AllowCredentials: true` allowed cookies to be sent
**After**: Removed `AllowCredentials`, use JWT in `Authorization` header only

**No Code Changes Needed**: Frontend already uses JWT in header, not cookies

## References

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [AWS API Gateway HTTP API CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html)
- [OWASP: Cross-Origin Resource Sharing](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#cross-origin-resource-sharing)

## Summary

✅ **API Gateway CORS configuration uses wildcard origin (`*`)**
✅ **Lambda responses include CORS headers automatically**
✅ **No AllowCredentials - secure JWT authentication**
✅ **26 unit tests validate CORS headers**
✅ **Behavioral tests verify end-to-end CORS functionality**
✅ **Works from any frontend domain (CloudFront, localhost, etc.)**

The CORS configuration ensures the Finanzas API can be accessed from any browser without CORS errors while maintaining security through JWT authentication.
