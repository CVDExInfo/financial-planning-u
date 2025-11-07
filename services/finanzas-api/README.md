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
