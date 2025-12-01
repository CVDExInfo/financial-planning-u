# Finanzas SD AWS Operations Runbook

## Overview

This runbook provides step-by-step operational procedures for diagnosing and maintaining the Finanzas SD (Service Delivery) module infrastructure on AWS.

---

## Table of Contents

1. [Running AWS Diagnostics](#running-aws-diagnostics)
2. [Using Health Endpoints](#using-health-endpoints)
3. [DynamoDB Tables Reference](#dynamodb-tables-reference)
4. [CI Test User Setup](#ci-test-user-setup)
5. [Troubleshooting Common Issues](#troubleshooting-common-issues)
6. [Operator Checklist](#operator-checklist)

---

## Running AWS Diagnostics

### How to Run the Diagnostic Workflow

The diagnostic workflow collects comprehensive information about the AWS infrastructure state.

**Option 1: Via GitHub UI**
1. Go to https://github.com/CVDExInfo/financial-planning-u/actions
2. Click "Finanzas AWS Diagnostic" workflow
3. Click "Run workflow"
4. Select the branch (usually `main` or current feature branch)
5. Click "Run workflow" button

**Option 2: Via GitHub CLI**
```bash
gh workflow run finanzas-aws-diagnostic.yml --ref main
```

**Option 3: Via GitHub API**
```bash
curl -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/CVDExInfo/financial-planning-u/actions/workflows/finanzas-aws-diagnostic.yml/dispatches \
  -d '{"ref":"main"}'
```

### What the Diagnostic Workflow Checks

The workflow validates:

1. **CloudFront Distribution** - Validates `/finanzas/*` behavior exists
2. **CloudFront Function** - Retrieves and compares `finanzas-path-rewrite` function code
3. **S3 Bucket Contents** - Lists files in `s3://ukusi-ui-finanzas-prod/finanzas/`
4. **API Gateway Configuration** - Validates routes, CORS, and authorizers
5. **Lambda Functions** - Inspects function configurations and environment variables
6. **DynamoDB Tables** - Checks existence and schema of all required tables
7. **CloudWatch Logs** - Searches for recent errors in Lambda logs
8. **API Endpoints** - Tests `/health`, `/catalog/rubros`, and `/projects`

### Interpreting Diagnostic Output

Look for these markers in the workflow output:

- `✅` - Component is configured correctly
- `⚠️` - Warning: component exists but may have issues
- `❌` - Error: component is missing or misconfigured

**Note**: The diagnostic workflow is non-fatal. Steps marked with `continue-on-error: true` will log findings but won't stop the workflow. Always review the full output, especially the "Summary Report" step.

---

## Using Health Endpoints

### Overview

Finanzas SD API provides two health check endpoints:

- **Basic Health Check**: `GET /health` - Fast check, no dependencies
- **Deep Health Check**: `GET /health?deep=true` - Validates all DynamoDB tables

### How to Call the Endpoints

```bash
# Set the API base URL
API_BASE="https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev"

# Basic health check (fast, no infrastructure dependencies)
curl "$API_BASE/health"

# Deep health check (validates all DynamoDB tables)
curl "$API_BASE/health?deep=true"
```

### Interpreting Health Check Responses

#### Healthy Infrastructure (HTTP 200)

```json
{
  "ok": true,
  "status": "ok",
  "env": "dev",
  "version": "1.0.0",
  "timestamp": "2025-11-30T10:00:00.000Z",
  "infrastructure": {
    "tables_checked": 12,
    "all_tables_exist": true
  }
}
```

**Action**: No action needed. Infrastructure is healthy.

#### Missing Tables (HTTP 503)

```json
{
  "status": "unhealthy",
  "message": "Required DynamoDB tables not found",
  "missing_tables": [
    "finz_docs",
    "finz_prefacturas"
  ],
  "existing_tables": [
    "finz_projects",
    "finz_changes",
    "finz_rubros",
    "finz_allocations"
  ],
  "env": "dev",
  "version": "1.0.0",
  "timestamp": "2025-11-30T10:00:00.000Z"
}
```

**Action**: Create missing DynamoDB tables. See [DynamoDB Tables Reference](#dynamodb-tables-reference) below.

#### Infrastructure Error (HTTP 503)

```json
{
  "status": "error",
  "message": "Health check failed",
  "error": "AccessDeniedException: User is not authorized...",
  "env": "dev",
  "timestamp": "2025-11-30T10:00:00.000Z"
}
```

**Action**: Check IAM permissions for Lambda execution role. Review CloudWatch logs from diagnostic workflow.

---

## DynamoDB Tables Reference

### Required Tables

All Finanzas SD Lambda functions require these DynamoDB tables to exist:

| Table Name | Purpose | Key Schema |
|------------|---------|------------|
| `finz_projects` | Project master data | PK: `project_id` |
| `finz_changes` | Project change requests | PK: `project_id`, SK: `change_id` |
| `finz_rubros` | Budget line item catalog | PK: `rubro_id` |
| `finz_rubros_taxonomia` | Rubros taxonomy/hierarchy | PK: `rubro_id` |
| `finz_allocations` | Resource allocations | PK: `project_id`, SK: `allocation_id` |
| `finz_payroll_actuals` | Payroll actual costs | PK: `project_id`, SK: `period` |
| `finz_adjustments` | Budget adjustments | PK: `project_id`, SK: `adjustment_id` |
| `finz_alerts` | System alerts/notifications | PK: `alert_id` |
| `finz_providers` | Vendor/provider master | PK: `provider_id` |
| `finz_audit_log` | Audit trail | PK: `log_id`, SK: `timestamp` |
| `finz_docs` | Document metadata | PK: `doc_id` |
| `finz_prefacturas` | Pre-invoice records | PK: `prefactura_id` |

### How to Create Missing Tables

Missing tables indicate that SAM deployment didn't complete successfully.

**Option 1: Redeploy via SAM**
```bash
cd services/finanzas-api
sam build
sam deploy --guided
```

**Option 2: Check Step 6 of Diagnostic Workflow**

The diagnostic workflow's "6. Check DynamoDB Tables" step will list which tables are missing with `❌` markers. Use this output to identify exactly which tables need creation.

### Validating Table Existence

```bash
# Check a specific table
aws dynamodb describe-table --table-name finz_projects --region us-east-2

# List all Finanzas tables
aws dynamodb list-tables --region us-east-2 | jq -r '.TableNames[] | select(startswith("finz_"))'
```

---

## CI Test User Setup

### Background

Finanzas SD API uses Cognito JWT authorizers with **group-based authorization**. API endpoints check that the authenticated user belongs to at least one authorized group.

### Authorized Groups

Valid Cognito groups for Finanzas SD:
- `SDT` - Service Delivery Team (full access)
- `PM` - Project Manager (project management access)
- `FIN` - Finance (financial data access)
- `AUD` - Audit (read-only audit access)

### Symptom: 403 Forbidden with Valid Token

If CI tests or the diagnostic workflow fail with:

```
HTTP 403
{"error":"forbidden: valid group required"}
```

This indicates the test user is **not in any authorized group**, even though the JWT token is valid.

### How to Fix

1. **Go to AWS Console → Cognito**
   - Navigate to Amazon Cognito service in `us-east-2` region
   
2. **Find the User Pool**
   - Use the User Pool ID from GitHub Variables: `COGNITO_USER_POOL_ID`
   - Or search for user pools with name containing "finanzas" or "financial-planning"

3. **Navigate to Users and Groups**
   - Click "Users and groups" in the left sidebar
   - Click "Groups" tab

4. **Verify Authorized Groups Exist**
   - Ensure groups `SDT`, `PM`, `FIN`, and/or `AUD` exist
   - If they don't exist, create them first

5. **Add CI User to a Group**
   - Click on one of the authorized groups (e.g., `SDT`)
   - Click "Add users to group"
   - Find the CI test user (username from `USERNAME` secret)
   - Add the user to the group

6. **Verify**
   - Re-run the API contract test workflow or diagnostic workflow
   - `/projects` endpoint should now return 200 instead of 403

### Creating Groups (If Missing)

If the authorized groups don't exist in Cognito:

```bash
# Create groups via AWS CLI
aws cognito-idp create-group \
  --group-name SDT \
  --user-pool-id <COGNITO_USER_POOL_ID> \
  --description "Service Delivery Team - Full access" \
  --region us-east-2

aws cognito-idp create-group \
  --group-name PM \
  --user-pool-id <COGNITO_USER_POOL_ID> \
  --description "Project Manager - Project management access" \
  --region us-east-2

aws cognito-idp create-group \
  --group-name FIN \
  --user-pool-id <COGNITO_USER_POOL_ID> \
  --description "Finance - Financial data access" \
  --region us-east-2

aws cognito-idp create-group \
  --group-name AUD \
  --user-pool-id <COGNITO_USER_POOL_ID> \
  --description "Audit - Read-only audit access" \
  --region us-east-2
```

### Adding User to Group via CLI

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <COGNITO_USER_POOL_ID> \
  --username <USERNAME_FROM_SECRET> \
  --group-name SDT \
  --region us-east-2
```

---

## Troubleshooting Common Issues

### Issue: `/projects` Returns 500 or 503

**Symptom**: API returns `{"error": "Required table not found: finz_projects. Check infrastructure deployment."}`

**Root Cause**: DynamoDB table `finz_projects` doesn't exist or Lambda doesn't have access.

**Resolution**:
1. Run diagnostic workflow to confirm missing tables
2. Check `/health?deep=true` to see which tables are missing
3. Redeploy via SAM to create tables
4. If tables exist, check Lambda IAM role has `dynamodb:Query`, `dynamodb:GetItem`, `dynamodb:PutItem` permissions

### Issue: CloudFront Function Not Working

**Symptom**: Accessing `https://d7t9x3j66yd8k.cloudfront.net/finanzas/` returns 404

**Root Cause**: CloudFront function `finanzas-path-rewrite` not associated with `/finanzas/*` behavior

**Resolution**:
1. Run diagnostic workflow step "2. Retrieve CloudFront Function Code"
2. Check if function code matches expected code
3. Verify function is published to LIVE stage
4. Check step "1. Validate CloudFront Distribution" shows function association

### Issue: CORS Errors in Browser

**Symptom**: Browser console shows CORS errors when calling API from CloudFront domain

**Root Cause**: API Gateway CORS configuration doesn't include CloudFront domain

**Expected CORS Configuration**:
```yaml
AllowOrigins:
  - https://d7t9x3j66yd8k.cloudfront.net
AllowHeaders:
  - Authorization
  - Content-Type
AllowMethods:
  - GET
  - POST
  - PUT
  - PATCH
  - DELETE
  - OPTIONS
AllowCredentials: true
```

**Resolution**:
1. Check diagnostic workflow step "4. Validate API Gateway Configuration"
2. Verify CORS configuration matches expected
3. Redeploy API Gateway if configuration is wrong

### Issue: Lambda Environment Variables Wrong

**Symptom**: Lambda logs show errors about undefined environment variables or wrong table names

**Root Cause**: Lambda function environment variables not set correctly during deployment

**Required Environment Variables**:
- `TABLE_PROJECTS=finz_projects`
- `TABLE_CHANGES=finz_changes`
- `TABLE_RUBROS=finz_rubros`
- `TABLE_RUBROS_TAXONOMIA=finz_rubros_taxonomia`
- `TABLE_ALLOCATIONS=finz_allocations`
- `TABLE_PAYROLL_ACTUALS=finz_payroll_actuals`
- `TABLE_ADJUSTMENTS=finz_adjustments`
- `TABLE_ALERTS=finz_alerts`
- `TABLE_PROVIDERS=finz_providers`
- `TABLE_AUDIT=finz_audit_log`
- `TABLE_AUDIT_LOG=finz_audit_log`
- `TABLE_DOCS=finz_docs`
- `TABLE_PREFACTURAS=finz_prefacturas`
- `STAGE_NAME=dev`
- `DOCS_BUCKET=ukusi-ui-finanzas-prod`
- `ALLOWED_ORIGIN=https://d7t9x3j66yd8k.cloudfront.net`
- `COGNITO_USER_POOL_ID=<from vars>`
- `COGNITO_CLIENT_ID=<from vars>`
- `COGNITO_ISSUER=https://cognito-idp.us-east-2.amazonaws.com/<pool_id>`

**Resolution**:
1. Check diagnostic workflow step "5. Inspect Lambda Functions"
2. Compare actual environment variables with expected
3. Redeploy SAM template to fix configuration

---

## Operator Checklist

Use this checklist when diagnosing Finanzas SD infrastructure issues:

### Pre-Deployment Checks

- [ ] Run diagnostic workflow on current branch
- [ ] Review diagnostic output for any `❌` errors
- [ ] Check `/health?deep=true` returns 200 with `all_tables_exist: true`
- [ ] Verify CloudFront function code matches expected
- [ ] Confirm API Gateway routes exist for all required endpoints
- [ ] Validate Lambda environment variables are correct

### Post-Deployment Checks

- [ ] Re-run diagnostic workflow after deployment
- [ ] Test `/health` endpoint returns 200
- [ ] Test `/health?deep=true` shows all tables exist
- [ ] Test `/catalog/rubros` returns data (check for `X-Fallback: true` header)
- [ ] Test authenticated endpoints with valid JWT token
- [ ] Check CloudWatch logs for any errors during deployment
- [ ] Verify UI loads at `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`

### When Tests Fail

- [ ] Check if failure is 401/403 (authentication/authorization issue)
- [ ] Check if failure is 503 (infrastructure/table issue)
- [ ] Check if failure is 500 (application error)
- [ ] Review CloudWatch logs from step "7. Inspect CloudWatch Logs"
- [ ] Check if CI test user is in an authorized Cognito group
- [ ] Verify API Gateway authorizer is configured correctly

### Escalation Criteria

Escalate to engineering team if:

- [ ] Diagnostic workflow shows all `✅` but UI still doesn't work
- [ ] `/health?deep=true` returns 200 but endpoints return 500
- [ ] CloudFront function matches expected but routing doesn't work
- [ ] All tables exist but queries return 0 results consistently
- [ ] CORS configuration is correct but browser shows CORS errors

---

## Running E2E API Tests

### Overview

The Finanzas E2E API test suite provides comprehensive end-to-end validation of all key API endpoints with real Cognito authentication. This test is more thorough than the diagnostic workflow as it validates actual functionality rather than just infrastructure state.

### How to Run E2E Tests

**Option 1: Via GitHub Actions (Recommended)**

1. Go to https://github.com/CVDExInfo/financial-planning-u/actions
2. Click "Finanzas E2E API Tests" workflow
3. Click "Run workflow"
4. (Optional) Override API base URL or CloudFront domain
5. Click "Run workflow" button

**Option 2: Via GitHub CLI**

```bash
gh workflow run finanzas-e2e-api.yml --ref main
```

**Option 3: Locally (requires AWS credentials and environment variables)**

```bash
# Set required environment variables
export AWS_REGION=us-east-2
export COGNITO_USER_POOL_ID=<your-pool-id>
export COGNITO_WEB_CLIENT=<your-client-id>
export USERNAME=<test-user-email>
export PASSWORD=<test-user-password>
export FINZ_API_BASE=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
export CF_DOMAIN=https://d7t9x3j66yd8k.cloudfront.net

# Run the test script
tsx scripts/finanzas-e2e-api.ts
```

### What the E2E Tests Validate

The E2E test suite performs the following checks:

1. **Cognito Authentication**
   - Obtains a valid JWT token using USER_PASSWORD_AUTH flow
   - Validates token can be used for API calls

2. **Projects Endpoints**
   - `GET /projects` - Retrieves projects list
   - Validates response format and structure

3. **Line Items Endpoints**
   - `GET /line-items?project_id={id}` - Retrieves line items for a project
   - Validates data structure and count

4. **Changes Endpoints**
   - `GET /projects/{id}/changes` - Retrieves change requests
   - `POST /projects/{id}/changes` - Creates a test change request
   - Validates full CRUD cycle

5. **Catalog Endpoints**
   - `GET /catalog/rubros` - Retrieves rubros catalog
   - **Validates non-fallback data** (checks for absence of `X-Fallback: true` header)
   - Ensures DynamoDB table is properly populated

6. **Upload Endpoints**
   - Notes: Currently skipped (requires multipart/form-data)
   - Documents that `POST /uploads/docs` should be tested manually

7. **Other Key Endpoints**
   - `GET /health` - Health check
   - `GET /allocation-rules` - Allocation rules
   - `GET /providers` - Providers list

8. **CloudFront UI**
   - `GET /finanzas/` - Main UI page
   - Validates HTML content is returned

### Interpreting E2E Test Results

The test output uses clear indicators:

- `✅` - Test passed, endpoint is functional
- `❌` - Test failed, requires investigation
- `⚠️` - Warning or skipped test

**Example successful output:**

```
✅ Get Projects List (200) - Found 7 projects
✅ Get Line Items for Project (200) - Found 42 line items
✅ Get Changes for Project (200) - Found 3 changes
✅ Create Change Request (201) - Created change with ID: CHG-123
✅ Get Rubros Catalog (200) - Found 156 rubros (non-fallback)
✅ Health Check (200) - Health check passed
✅ CloudFront UI Main Page (200) - UI accessible

Total: 8 tests | ✅ 8 passed | ❌ 0 failed
```

**Common Failure Patterns:**

1. **Authentication Failure**
   ```
   ❌ Authentication failed
   Error: Failed to obtain ID token from Cognito
   ```
   - Check test user credentials in GitHub Secrets
   - Verify Cognito User Pool ID and Client ID

2. **DynamoDB Table Not Found**
   ```
   ❌ Get Projects List (500)
   Response: {"message": "Changes table not found for this environment"}
   ```
   - Run diagnostic workflow to check table existence
   - Verify Lambda environment variables

3. **Fallback Data Detected**
   ```
   ❌ Get Rubros Catalog (200)
   WARNING: Fallback data detected (X-Fallback: true)
   ```
   - DynamoDB table exists but is empty or inaccessible
   - Check IAM permissions for Lambda
   - Verify table has data seeded

4. **Authorization Failure**
   ```
   ❌ Get Projects List (403)
   Response: Forbidden
   ```
   - Verify test user is in correct Cognito group
   - Check API Gateway authorizer configuration

### Comparison with Diagnostic Workflow

| Aspect | E2E Tests | Diagnostic Workflow |
|--------|-----------|---------------------|
| **Purpose** | Validate functionality | Validate infrastructure |
| **Auth** | Real Cognito flow | Optional |
| **API Calls** | Full request/response cycle | Basic connectivity |
| **Data Validation** | Response structure & content | Existence checks |
| **Changes Tested** | Creates test data | Read-only |
| **Run Time** | ~30-60 seconds | ~2-5 minutes |
| **Best For** | Pre-deployment validation | Infrastructure debugging |

### When to Run E2E Tests

- **Always:**
  - Before merging PRs that affect API handlers
  - After deploying infrastructure changes
  - Before production releases

- **Consider Running:**
  - After Cognito configuration changes
  - After DynamoDB schema updates
  - When investigating reported bugs

- **Not Needed:**
  - For UI-only changes (unless they affect API calls)
  - For documentation-only changes
  - For infrastructure-only changes (use diagnostic workflow instead)

---

## Quick Reference Commands

```bash
# Run E2E tests locally
export AWS_REGION=us-east-2
export COGNITO_USER_POOL_ID=<pool-id>
export COGNITO_WEB_CLIENT=<client-id>
export USERNAME=<test-user>
export PASSWORD=<test-password>
export FINZ_API_BASE=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
tsx scripts/finanzas-e2e-api.ts

# Health checks
curl https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev/health
curl https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev/health?deep=true

# List DynamoDB tables
aws dynamodb list-tables --region us-east-2 | jq -r '.TableNames[] | select(startswith("finz_"))'

# Check specific table
aws dynamodb describe-table --table-name finz_projects --region us-east-2

# List Lambda functions
aws lambda list-functions --region us-east-2 | jq -r '.Functions[] | select(.FunctionName | contains("Finz")) | .FunctionName'

# Get Lambda environment variables
aws lambda get-function-configuration --function-name ProjectsFn --region us-east-2 | jq .Environment.Variables

# Check CloudWatch logs
aws logs tail /aws/lambda/ProjectsFn --region us-east-2 --follow

# Run diagnostic workflow
gh workflow run finanzas-aws-diagnostic.yml --ref main

# View recent workflow runs
gh run list --workflow=finanzas-aws-diagnostic.yml --limit 5
```

---

## Related Documentation

- **AWS Diagnostic Findings**: See `AWS_DIAGNOSTIC_FINDINGS.md` for detailed code review findings
- **Investigation Summary**: See `FINANZAS_AWS_INVESTIGATION_SUMMARY.md` for implementation history
- **SAM Template**: See `services/finanzas-api/template.yaml` for infrastructure as code
- **API Endpoints**: See `openapi/finanzas-api.yaml` for API specification

---

## Support Contacts

For issues not covered in this runbook:

1. Check GitHub Issues: https://github.com/CVDExInfo/financial-planning-u/issues
2. Review recent PRs for similar issues
3. Check CloudWatch logs for detailed error messages
4. Contact the Service Delivery team via Slack or email

---

**Last Updated**: 2025-11-30  
**Version**: 1.0  
**Maintainer**: Service Delivery Team
