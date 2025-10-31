# Finanzas SD API (SAM) - MVP Initial Slice

- Region: us-east-2
- Auth: Cognito JWT (same pool as acta-ui), group `SDT` required.

## MVP Status

This is an **initial slice** of the Finanzas API MVP. The following endpoints are implemented:

### ✅ Fully Implemented
- `GET /health` - Health check (public)
- `GET /catalog/rubros` - Budget line items catalog (public)
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
  --parameter-overrides CognitoUserPoolArn=<your-userpool-arn> CognitoUserPoolId=<your-userpool-id> StageName=dev
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
