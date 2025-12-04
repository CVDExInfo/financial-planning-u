# Finanzas SD API (SAM) - MVP Initial Slice

- Region: us-east-2
- Auth: Cognito JWT (same pool as acta-ui), group `SDT` required.

## MVP Status

This is an **initial slice** of the Finanzas API MVP. The following endpoints are implemented:

### ✅ Fully Implemented

- `GET /health` - Health check (public)
- `GET /catalog/rubros` - Budget line items catalog (authenticated via Cognito JWT)
- `POST /projects` - Create project (authenticated)
- `GET /projects` - List projects (authenticated)
- `POST /projects/{id}/handoff` - Project handoff with audit trail (authenticated)

### 🚧 Stubbed for R1 (returns 501)

The following R1 endpoints are wired and stubbed, returning HTTP 501 (Not Implemented):

- `POST/GET /projects/{id}/rubros` - Project budget line items management
- `PUT /projects/{id}/allocations:bulk` - Bulk resource allocations update
- `GET /projects/{id}/plan?mes=YYYY-MM` - Financial plan generation for a month
- `POST /payroll/ingest` - Payroll data ingestion
- `POST /close-month?mes=YYYY-MM` - Month close process
- `POST/GET /adjustments` - Budget adjustments management
- `GET /alerts` - Active alerts retrieval
- `POST/GET /providers` - Vendor/provider management
- `POST/GET /prefacturas/webhook` - Pre-invoice webhook integration

Each stubbed handler contains TODO comments with implementation guidance.

## Deploy (dev)

```bash
sam build
sam deploy --no-confirm-changeset --stack-name finanzas-sd-api-dev --resolve-s3 --capabilities CAPABILITY_IAM \
  --parameter-overrides CognitoUserPoolArn=<your-userpool-arn> CognitoUserPoolId=<your-userpool-id> CognitoUserPoolClientId=<your-app-client-id> StageName=dev
```

## Test

```bash
npm ci
npm test
sam local start-api
```

## Architecture

- **14 Lambda functions** (5 implemented, 9 stubbed)
- **8 DynamoDB tables** (projects, rubros, allocations, payroll_actuals, adjustments, alerts, providers, audit_log)
- **1 EventBridge rule** for monthly PEP-3 alerts (TODO: implement logic)
- **HTTP API Gateway** with Cognito JWT authorizer

## Access Logs & Auth Debugging

The stack now enables **HTTP API access logs** (CloudWatch Log Group: `/aws/http-api/dev/finz-access`). Each request line includes:

```text
requestId, ip, requestTime, httpMethod, routeKey, status,
authorizerError, integrationError, jwtSub, jwtAud, jwtGroups
```

Use these fields to pinpoint JWT authorizer failures (e.g. invalid token shape vs claim mismatch). Example grep for 401s:

```bash
aws logs tail /aws/http-api/dev/finz-access --since 15m --format short | grep '"status":"401"'
```

## Protected Endpoint Smoke Test Script

Run the helper script after setting the required environment variables:

Required env vars:

- `CLIENT_ID` – Cognito App Client ID
- `USERNAME` – Cognito username
- `PASSWORD` – Cognito password
- `USER_POOL_ID` – Cognito user pool id (e.g. `us-east-2_FyHLtOhiY`)
- (Optional) `STACK_NAME` (default `finanzas-sd-api-dev`) to auto-resolve API URL

```bash
./scripts/test-protected-endpoints.sh
```

The script will:

1. Resolve `API_URL` from CloudFormation if not set
2. Obtain an ID token (`USER_PASSWORD_AUTH`)
3. Decode header/claims locally for quick inspection
4. Call `/catalog/rubros` and show HTTP status and any 401 diagnostics from access logs

If you receive a 401, immediately check the access log line for `authorizerError`.

## S3 CORS Configuration for Document Uploads

The `DocsBucket` (ukusi-ui-finanzas-prod) is configured with CORS rules to allow browser-based uploads from the Finanzas UI CloudFront distribution. The CORS configuration in `template.yaml` allows:

- **Methods**: PUT, GET, HEAD
- **Origins**: CloudFront domain(s) specified via parameters
- **Headers**: All headers (`*`)
- **Exposed Headers**: ETag, x-amz-request-id, x-amz-id-2
- **Max Age**: 300 seconds (5 minutes)

### CloudFront Domain Configuration

The `CloudFrontDomain` parameter (default: `d7t9x3j66yd8k.cloudfront.net`) must match the actual CloudFront distribution serving the Finanzas UI. If you have multiple CloudFront distributions or domains, use the `AdditionalUploadOrigin` parameter:

```bash
sam deploy ... --parameter-overrides \
  CloudFrontDomain=d7t9x3j66yd8k.cloudfront.net \
  AdditionalUploadOrigin=https://alternate.cloudfront.net
```

### Verifying CORS Configuration

After deploying the stack, verify the S3 bucket CORS configuration:

```bash
aws s3api get-bucket-cors --bucket ukusi-ui-finanzas-prod
```

### Document Upload Health Check

Use the health check script to validate the complete upload pipeline (API → presigned URL → S3 PUT):

```bash
export FINZ_API_BASE_URL=https://your-api-id.execute-api.us-east-2.amazonaws.com/dev
export AUTH_TOKEN=your-cognito-id-token
npm run check-upload-docs
```

Or run directly:

```bash
FINZ_API_BASE_URL=https://... AUTH_TOKEN=... npx ts-node scripts/check-upload-docs.ts
```

The script will:
1. Request a presigned URL from `/uploads/docs`
2. Attempt to PUT a test file to S3
3. Report success or CORS/network errors

If you see CORS errors (e.g., "Access-Control-Allow-Origin missing"), verify:
- The CloudFormation stack has been deployed with the latest template.yaml
- The `CloudFrontDomain` parameter matches your actual CloudFront domain
- The S3 bucket CORS rules match the template configuration
