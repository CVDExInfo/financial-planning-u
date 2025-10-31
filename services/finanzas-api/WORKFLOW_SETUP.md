# Finanzas API Workflow Setup

This document describes the GitHub Actions workflows for the Finanzas API and the required configuration.

## Workflows

### 1. Test Workflow (`test-api.yml`)
**Triggers:** Pull requests to `main`, manual dispatch

**Purpose:** Validates code quality before merging
- Runs unit tests
- Builds with SAM
- Starts SAM local and performs smoke tests on public endpoints

**No secrets/variables required** - runs entirely locally

### 2. Deploy Workflow (`deploy-api.yml`)
**Triggers:** Push to `module/finanzas-api-mvp` branch, manual dispatch

**Purpose:** Deploys the API to AWS dev environment
- Authenticates via OIDC
- Builds with SAM
- Deploys to AWS using CloudFormation
- Performs smoke test on deployed API
- Generates deployment summary

## Required Configuration

### Repository Variables
Navigate to: **Settings → Secrets and variables → Actions → Variables**

Add the following variables (example values shown for dev environment):

| Variable Name | Example Value (dev) | Description |
|---------------|---------------------|-------------|
| `AWS_REGION` | `us-east-2` | AWS region for deployment |
| `FINZ_API_STACK` | `finanzas-sd-api-dev` | CloudFormation stack name |
| `FINZ_API_STAGE` | `dev` | API Gateway stage name |
| `COGNITO_USER_POOL_ID` | `us-east-2_FyHLtOhiY` | Cognito User Pool ID for JWT auth |
| `COGNITO_USER_POOL_ARN` | `arn:aws:cognito-idp:us-east-2:703671891952:userpool/us-east-2_FyHLtOhiY` | Cognito User Pool ARN |

### Repository Secrets
Navigate to: **Settings → Secrets and variables → Actions → Secrets**

Add the following secret (example value shown for dev environment):

| Secret Name | Example Value (dev) | Description |
|-------------|---------------------|-------------|
| `OIDC_AWS_ROLE_ARN` | `arn:aws:iam::703671891952:role/ProjectplaceLambdaRole` | IAM role ARN for OIDC authentication |

## Workflow Defaults

The deploy workflow includes sensible defaults if variables are not set:
- `AWS_REGION` defaults to `us-east-2`
- `FINZ_API_STACK` defaults to `finanzas-sd-api-dev`
- `FINZ_API_STAGE` defaults to `dev`

However, the preflight check will **fail** if Cognito variables are not set, as they have no defaults.

## OIDC Authentication

We use a local OIDC composite action to comply with repo policy: only GitHub- or valencia94-owned actions.

The deploy workflow uses our local composite action:
```yaml
- name: Configure AWS (OIDC)
  uses: ./.github/actions/oidc-configure-aws
  with:
    role_arn: ${{ secrets.OIDC_AWS_ROLE_ARN }}
    aws_region: ${{ env.AWS_REGION }}
    session_name: deploy-api-${{ github.run_id }}
```

The local action handles:
- Requesting GitHub OIDC token
- Assuming AWS IAM role with web identity
- Exporting AWS credentials to environment
- Verifying identity with `aws sts get-caller-identity`

Expected output format:
```json
{
  "UserId": "AROA...:session-name",
  "Account": "703671891952",
  "Arn": "arn:aws:sts::703671891952:assumed-role/ProjectplaceLambdaRole/..."
}
```

> **Note:** Account ID and role name shown above are examples. Your actual values will differ based on your AWS environment.

## Deployment Summary

The deploy workflow generates a GitHub Actions summary that includes:
- Region, Stack, and Stage information
- API ID and URL
- Sample cURL commands for testing:
  - Health check (public)
  - Catalog rubros (public)
  - Create project (requires JWT with SDT group)

## Testing Locally

### Unit Tests
```bash
cd services/finanzas-api
npm ci
npm test
```

### SAM Local
```bash
cd services/finanzas-api
sam build
sam local start-api --warm-containers EAGER

# In another terminal:
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/catalog/rubros
```

See `tests/integration/sam-local.http` for all available endpoints (including stubs).

## API Endpoints Status

### ✅ Implemented (Returns 200/201)
- `GET /health` - Health check (public, no auth)
- `GET /catalog/rubros` - Budget categories catalog (public, no auth)
- `POST /projects` - Create project (requires JWT)
- `GET /projects` - List projects (requires JWT)
- `POST /projects/{id}/handoff` - Project handoff (requires JWT)

### 🚧 Stubbed (Returns 501 Not Implemented)
- `POST/GET /projects/{id}/rubros` - Project budget line items
- `PUT /projects/{id}/allocations:bulk` - Bulk resource allocations
- `GET /projects/{id}/plan?mes=YYYY-MM` - Financial plan generation
- `POST /payroll/ingest` - Payroll data ingestion
- `POST /close-month?mes=YYYY-MM` - Month close process
- `POST/GET /adjustments` - Budget adjustments
- `GET /alerts` - Active alerts
- `POST/GET /providers` - Vendor/provider management
- `POST/GET /prefacturas/webhook` - Pre-invoice webhook

All stubbed handlers contain TODO comments with implementation guidance.

## Troubleshooting

### Preflight Check Fails
If you see errors like `AWS_REGION empty` or `COGNITO_USER_POOL_ID empty`:
1. Verify all required variables are set in GitHub repository settings
2. Check for typos in variable names
3. Ensure you're looking at the correct repository

### OIDC Authentication Fails
If authentication fails:
1. Verify the IAM role ARN is correct
2. Ensure the role has a trust policy that allows GitHub Actions OIDC
3. Check that the role has necessary permissions for CloudFormation, SAM, DynamoDB, etc.

### SAM Deploy Fails
Common issues:
1. Stack already exists with different parameters - delete and redeploy
2. Insufficient IAM permissions - check role policies
3. DynamoDB table names conflict - ensure unique table prefix

### SAM Local Fails
Common issues:
1. Docker not running - start Docker daemon
2. Port 3000 in use - stop other services or change port
3. Build artifacts missing - run `sam build` first
