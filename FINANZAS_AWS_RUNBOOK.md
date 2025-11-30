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

## Quick Reference Commands

```bash
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
