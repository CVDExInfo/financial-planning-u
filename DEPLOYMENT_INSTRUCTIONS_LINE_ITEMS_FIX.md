# Deployment Instructions: /line-items and /invoices CORS Fix

## Overview
This document provides step-by-step instructions for deploying the fixes for `/line-items` and `/invoices` endpoints with proper CORS support.

## Changes Summary
- ✅ Added `/line-items` endpoint handler
- ✅ Added `/invoices` endpoint handler  
- ✅ Updated rubros handler with CORS helpers
- ✅ Updated SAM template with new Lambda functions
- ✅ Updated validation script to fail on CORS errors
- ✅ All builds successful, no security vulnerabilities

## Pre-Deployment Checklist
- [ ] Review PR changes
- [ ] Ensure AWS credentials are configured
- [ ] Confirm target environment (dev/prod)
- [ ] Note current API Gateway URL

## Deployment Steps

### 1. Build the SAM Application
```bash
cd services/finanzas-api
sam build
```

Expected output: "Build Succeeded" with all functions including LineItemsFn and InvoicesFn.

### 2. Deploy to Development Environment
```bash
sam deploy \
  --stack-name finanzas-sd-api-dev \
  --parameter-overrides StageName=dev \
  --no-confirm-changeset \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND
```

**Note:** The deployment will:
- Create/update LineItemsFn Lambda function
- Create/update InvoicesFn Lambda function
- Update RubrosFn with CORS fixes
- Configure HTTP API routes for new endpoints
- Apply CORS configuration automatically via HTTP API

### 3. Verify Deployment

#### 3.1 Get API Base URL
```bash
aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`FinzApiUrl`].OutputValue' \
  --output text
```

Save this URL as `$API_BASE_URL` for subsequent tests.

#### 3.2 Test /line-items Endpoint
```bash
# Set variables
export API_BASE_URL="<your-api-url>"
export ORIGIN="https://d7t9x3j66yd8k.cloudfront.net"

# Test OPTIONS preflight for /line-items
curl -i -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  "$API_BASE_URL/line-items?project_id=TEST"
```

**Expected response:**
- HTTP status: 200 or 204
- Headers must include:
  - `Access-Control-Allow-Origin: https://d7t9x3j66yd8k.cloudfront.net`
  - `Access-Control-Allow-Methods` containing GET, POST, OPTIONS
  - `Access-Control-Allow-Headers` containing Authorization, Content-Type

#### 3.3 Test /invoices Endpoint
```bash
curl -i -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  "$API_BASE_URL/invoices?project_id=TEST"
```

**Expected response:** Same as /line-items (200/204 with proper CORS headers)

#### 3.4 Test Authenticated GET Request
```bash
# You'll need a valid JWT token
export JWT_TOKEN="<your-cognito-jwt-token>"

curl -i \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE_URL/line-items?project_id=TEST"
```

**Expected response:**
- HTTP status: 200
- CORS headers present
- Body: JSON with `data` array and `total` field

### 4. Run Validation Script

```bash
cd /home/runner/work/financial-planning-u/financial-planning-u
export VITE_API_BASE_URL="$API_BASE_URL"
./scripts/validate-api-config.sh
```

**Expected output:**
- ✅ All CORS preflight tests pass for /line-items
- ✅ No errors in validation
- Final message: "API configuration is valid"

**If validation fails:**
- Check CloudWatch logs for Lambda functions
- Verify HTTP API CORS configuration in AWS Console
- Ensure API Gateway deployment is complete

### 5. Frontend Integration Test

1. Open the Finanzas UI in a browser
2. Open browser DevTools Console
3. Navigate to a project page
4. Watch for API calls to /line-items and /invoices
5. Verify:
   - No CORS errors in console
   - Data loads successfully
   - Network tab shows 200 responses with CORS headers

## Troubleshooting

### Problem: OPTIONS returns 403 or 404
**Solution:** HTTP API CORS config might not be applied. Check:
```bash
aws apigatewayv2 get-api --api-id <api-id>
```
Verify `corsConfiguration` is present with correct origins.

### Problem: 401 Unauthorized on GET requests
**Solution:** JWT token issue. Verify:
- Token is valid and not expired
- Token audience matches Cognito client ID in template
- Token issuer matches Cognito user pool

### Problem: "Access-Control-Allow-Origin" header missing
**Solution:** Lambda function not returning CORS headers. Check:
- Handler uses `ok()`, `bad()`, `serverError()` from `lib/http.ts`
- Not returning raw responses with manual headers
- CloudWatch logs for handler errors

### Problem: Validation script fails on /line-items
**Solution:** 
1. Check endpoint exists: `aws apigatewayv2 get-routes --api-id <api-id>`
2. Verify Lambda function deployed: `aws lambda get-function --function-name finanzas-sd-api-dev-LineItemsFn`
3. Check Lambda execution role has DynamoDB read permissions

## Rollback Procedure

If critical issues arise after deployment:

```bash
# Revert to previous stack version
aws cloudformation describe-stack-events \
  --stack-name finanzas-sd-api-dev \
  --query 'StackEvents[?ResourceStatus==`UPDATE_COMPLETE`]|[0].PhysicalResourceId'

# Or deploy previous version of template
cd services/finanzas-api
git checkout <previous-commit>
sam build && sam deploy --stack-name finanzas-sd-api-dev
```

## Post-Deployment Verification Checklist
- [ ] /line-items OPTIONS returns 200 with CORS headers
- [ ] /invoices OPTIONS returns 200 with CORS headers
- [ ] Authenticated GET requests work for both endpoints
- [ ] validate-api-config.sh passes all tests
- [ ] Frontend loads data without CORS errors
- [ ] CloudWatch logs show no errors
- [ ] No regression in existing endpoints (/health, /projects, /prefacturas)

## Support
If issues persist after following this guide:
1. Check CloudWatch logs: `/aws/lambda/finanzas-sd-api-dev-LineItemsFn`
2. Check HTTP API access logs: `/aws/http-api/dev/finz-access`
3. Review API Gateway deployment status in AWS Console
4. Contact DevOps team for AWS permissions issues
