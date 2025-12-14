# Verification Runbook: SDMT Project Visibility Fix

## Overview

This runbook provides step-by-step instructions to verify that the RBAC project visibility fix is working correctly in all environments (dev, staging, production).

**Fix Summary**: SDM users can now see projects where they are listed as `sdm_manager_email`, `accepted_by`/`aceptado_por`, OR `created_by`. Previously, projects without these fields were invisible to SDM users.

## Pre-Deployment Checklist

- [x] All unit tests pass (306/306)
- [x] Integration tests pass
- [x] Migration script tested locally
- [ ] Deploy API changes to target environment
- [ ] Run migration script (dry-run first, then --apply)
- [ ] Complete manual verification steps below

## Prerequisites

1. Access to AWS console for target environment
2. Access to CloudWatch logs
3. Test credentials for each role:
   - Admin user
   - PMO user
   - SDMT user
   - SDM user
4. API Gateway URL for the environment

## Part 1: Pre-Migration Verification (Baseline)

### 1.1. Check Existing Project Visibility

**As SDM User:**

```bash
# Get JWT token for SDM user
export SDM_TOKEN="<your-sdm-jwt-token>"

# List projects
curl -X GET "https://<api-url>/projects" \
  -H "Authorization: Bearer $SDM_TOKEN" \
  -H "Content-Type: application/json" | jq '.data | length'

# Record the count
# Expected: Some projects visible (only those with sdm_manager_email/accepted_by matching SDM email)
```

**As Admin User:**

```bash
# Get JWT token for Admin user
export ADMIN_TOKEN="<your-admin-jwt-token>"

# List all projects
curl -X GET "https://<api-url>/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq '.data | length'

# Record the count
# Expected: All projects visible (should be more than SDM count)
```

**Record Baseline:**
- SDM visible projects: `____`
- Admin visible projects: `____`
- Missing projects: `____`

## Part 2: Deploy Changes

### 2.1. Deploy API Stack

```bash
cd services/finanzas-api

# Build
sam build

# Deploy
sam deploy --stack-name finanzas-sd-api-<env> \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=<env>

# Wait for deployment to complete
aws cloudformation wait stack-update-complete \
  --stack-name finanzas-sd-api-<env>
```

### 2.2. Verify Deployment

```bash
# Check Lambda function version
aws lambda get-function --function-name finanzas-projects-handler-<env> \
  | jq '.Configuration.LastModified'

# Check CloudWatch logs
aws logs tail /aws/lambda/finanzas-projects-handler-<env> --follow
```

## Part 3: Run Migration Script

### 3.1. Dry Run

```bash
cd services/finanzas-api

# Set environment variables
export AWS_REGION=us-east-2
export TABLE_PROJECTS=finz_projects_<env>
export TABLE_AUDIT=finz_audit_log_<env>

# Run dry-run
npx ts-node scripts/backfill-sdm-manager-email.ts

# Review output:
# - Total projects scanned
# - Projects that will be updated
# - Projects skipped (already have sdm_manager_email)
# - Projects needing manual review
```

**Review Migration Plan:**
- Total projects: `____`
- Will update: `____`
- Already set: `____`
- Needs review: `____`

**⚠️ STOP**: If "Needs review" count is high (>20% of total), investigate before proceeding.

### 3.2. Apply Migration

```bash
# Apply changes
npx ts-node scripts/backfill-sdm-manager-email.ts --apply

# Save results
npx ts-node scripts/backfill-sdm-manager-email.ts --apply \
  --output migration-results-<env>-$(date +%Y%m%d).json
```

**Verify Migration Logs:**

```bash
# Check audit log table for migration entries
aws dynamodb query \
  --table-name finz_audit_log_<env> \
  --index-name ActionIndex \
  --key-condition-expression "action = :action" \
  --expression-attribute-values '{":action":{"S":"BACKFILL_SDM_MANAGER_EMAIL"}}' \
  --limit 10
```

## Part 4: Post-Migration Verification

### 4.1. Verify SDM Project Visibility (Primary Test)

**Scenario 1: SDM sees projects they manage**

```bash
export SDM_TOKEN="<sdm-jwt-token>"

# List projects as SDM
curl -X GET "https://<api-url>/projects" \
  -H "Authorization: Bearer $SDM_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

# Verify:
# ✅ Count increased from baseline
# ✅ Projects have sdm_manager_email matching SDM user email
# ✅ Projects include those created by this SDM
# ✅ No "canonical-only" behavior
```

**Expected Results:**
- SDM visible projects: `____` (should be ≥ baseline count)
- All returned projects have one of:
  - `sdmManagerEmail` = SDM user email
  - `createdBy` = SDM user email
  - Or derived from `accepted_by`/`aceptado_por`

**Scenario 2: SDM creates a new project**

```bash
export SDM_TOKEN="<sdm-jwt-token>"

# Create project as SDM
curl -X POST "https://<api-url>/projects" \
  -H "Authorization: Bearer $SDM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - SDM Created",
    "code": "PROJ-2024-999",
    "client": "Test Client",
    "start_date": "2024-12-01",
    "end_date": "2025-11-30",
    "currency": "USD",
    "mod_total": 100000,
    "description": "Verification test project"
  }' | jq '.'

# Expected: 201 Created
# Expected: Response includes "projectId"
# Expected: sdmManagerEmail is set to SDM user email
```

**Verify Auto-Assignment:**

```bash
# List projects again
curl -X GET "https://<api-url>/projects" \
  -H "Authorization: Bearer $SDM_TOKEN" | jq '.data | map(select(.name == "Test Project - SDM Created"))'

# Expected: Project appears in list immediately
# Expected: sdmManagerEmail = SDM user email
```

### 4.2. Verify PMO Project Creation Requires SDM Assignment

**Scenario 3: PMO creates project WITH sdm_manager_email**

```bash
export PMO_TOKEN="<pmo-jwt-token>"

curl -X POST "https://<api-url>/projects" \
  -H "Authorization: Bearer $PMO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - PMO Created",
    "code": "PROJ-2024-998",
    "client": "Test Client",
    "start_date": "2024-12-01",
    "end_date": "2025-11-30",
    "currency": "USD",
    "mod_total": 150000,
    "description": "Verification test project",
    "sdm_manager_email": "assigned.sdm@example.com"
  }' | jq '.'

# Expected: 201 Created
# Expected: sdmManagerEmail is set to "assigned.sdm@example.com"
```

**Scenario 4: PMO creates project WITHOUT sdm_manager_email (should fail)**

```bash
export PMO_TOKEN="<pmo-jwt-token>"

curl -X POST "https://<api-url>/projects" \
  -H "Authorization: Bearer $PMO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - Should Fail",
    "code": "PROJ-2024-997",
    "client": "Test Client",
    "start_date": "2024-12-01",
    "end_date": "2025-11-30",
    "currency": "USD",
    "mod_total": 150000
  }' | jq '.'

# Expected: 400 Bad Request
# Expected: Error message mentions "sdm_manager_email is required"
```

### 4.3. Verify Admin/PMO/EXEC_RO See All Projects

```bash
export ADMIN_TOKEN="<admin-jwt-token>"

# List all projects
curl -X GET "https://<api-url>/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.total'

# Expected: Same count as before migration (no filtering)
# Expected: Includes projects with and without sdm_manager_email
```

### 4.4. Verify Downstream Endpoints

**Test: SDM can access allocations for their projects**

```bash
export SDM_TOKEN="<sdm-jwt-token>"

# Get projectId from SDM's project list
export PROJECT_ID=$(curl -s -X GET "https://<api-url>/projects" \
  -H "Authorization: Bearer $SDM_TOKEN" | jq -r '.data[0].projectId')

# Get allocations for that project
curl -X GET "https://<api-url>/allocations?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $SDM_TOKEN" | jq '.'

# Expected: 200 OK
# Expected: Allocations data returned (if exists)
```

**Test: SDM can access forecast for their projects**

```bash
export SDM_TOKEN="<sdm-jwt-token>"

curl -X GET "https://<api-url>/forecast/$PROJECT_ID" \
  -H "Authorization: Bearer $SDM_TOKEN" | jq '.'

# Expected: 200 OK
# Expected: Forecast data returned (if exists)
```

**Test: SDM can access rubros for their projects**

```bash
export SDM_TOKEN="<sdm-jwt-token>"

curl -X GET "https://<api-url>/rubros?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $SDM_TOKEN" | jq '.'

# Expected: 200 OK
# Expected: Rubros data returned (if exists)
```

## Part 5: UI Verification (Manual)

### 5.1. Login as SDM User

1. Navigate to: `https://<cloudfront-url>/finanzas/sdmt/cost/catalog`
2. Check project dropdown in header
3. **Verify:**
   - ✅ Projects appear in dropdown (not just canonical demos)
   - ✅ Can select different projects
   - ✅ Selected project shows correct name/code
4. Select a project and navigate to Forecast page
5. **Verify:**
   - ✅ Cost data displays
   - ✅ Budget/forecast charts render
   - ✅ No "empty state" or "no data" errors

### 5.2. Login as PMO User

1. Navigate to: `https://<cloudfront-url>/finanzas/pmo/prefactura/estimator`
2. Click "Create Project" button
3. **Verify:**
   - ✅ Form includes SDM Manager field (email input or dropdown)
   - ✅ SDM Manager field is marked required
   - ✅ Cannot submit without SDM assignment
4. Fill form and submit with SDM assignment
5. **Verify:**
   - ✅ Project created successfully
   - ✅ Redirects to project detail or list
   - ✅ New project appears in list

### 5.3. Login as Admin User

1. Navigate to: `https://<cloudfront-url>/finanzas/sdmt/cost/catalog`
2. Check project dropdown
3. **Verify:**
   - ✅ All projects visible (including orphaned ones)
   - ✅ Can access any project's detail pages

## Part 6: Monitor CloudWatch Logs

### 6.1. Check for Diagnostic Warnings

```bash
# Look for SDM users getting 0 projects with unassigned projects warning
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-projects-handler-<env> \
  --filter-pattern "[projects] SDM user sees 0 projects" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# Expected: Should see FEWER warnings after migration
# If warnings persist, check unassigned projects list
```

### 6.2. Check Error Rates

```bash
# Check for errors in projects handler
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-projects-handler-<env> \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# Expected: No new errors related to RBAC or project listing
```

## Part 7: Rollback Plan (If Needed)

### 7.1. Revert Lambda Code

```bash
# List function versions
aws lambda list-versions-by-function \
  --function-name finanzas-projects-handler-<env>

# Rollback to previous version
aws lambda update-alias \
  --function-name finanzas-projects-handler-<env> \
  --name live \
  --function-version <previous-version>
```

### 7.2. Revert Migration (Careful!)

**⚠️ WARNING**: Only revert migration if data corruption detected. The migration is additive (only adds sdm_manager_email where missing).

```bash
# Query audit log for migration records
aws dynamodb query \
  --table-name finz_audit_log_<env> \
  --index-name ActionIndex \
  --key-condition-expression "action = :action" \
  --expression-attribute-values '{":action":{"S":"BACKFILL_SDM_MANAGER_EMAIL"}}' \
  > migration-audit.json

# For each record, restore "before" state if needed
# (This should rarely be necessary)
```

## Part 8: Success Criteria Checklist

- [ ] SDM users see projects they manage (not just canonical)
- [ ] SDM users see projects they created
- [ ] SDM users can create new projects (auto-assigned as manager)
- [ ] PMO users must provide SDM assignment when creating projects
- [ ] PMO cannot create projects without SDM assignment (400 error)
- [ ] Admin/PMO/EXEC_RO see all projects (no filtering)
- [ ] Downstream endpoints (allocations, forecast, rubros) work for SDM
- [ ] UI project dropdown shows correct projects per role
- [ ] UI Create Project form includes SDM assignment field
- [ ] Migration script completed without errors
- [ ] No increase in error rates in CloudWatch
- [ ] Audit log contains migration entries
- [ ] All 306 unit tests pass

## Part 9: Post-Deployment Actions

### 9.1. Clean Up Test Projects

```bash
# Delete test projects created during verification
export ADMIN_TOKEN="<admin-jwt-token>"

curl -X DELETE "https://<api-url>/projects/PROJ-2024-999" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -X DELETE "https://<api-url>/projects/PROJ-2024-998" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 9.2. Document Manual Review Items

If migration script reported projects needing manual review:

1. Export the list from migration results JSON
2. Create a ticket for PMO to assign SDM owners
3. Provide admin script to bulk-update if needed

```bash
# Example: Update project with SDM assignment
aws dynamodb update-item \
  --table-name finz_projects_<env> \
  --key '{"pk":{"S":"PROJECT#<project-id>"},"sk":{"S":"METADATA"}}' \
  --update-expression "SET sdm_manager_email = :email, updated_at = :now" \
  --expression-attribute-values '{
    ":email":{"S":"sdm.owner@example.com"},
    ":now":{"S":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }'
```

### 9.3. Update Documentation

- [ ] Update API documentation with new POST /projects requirements
- [ ] Update user guide for PMO users (SDM assignment)
- [ ] Update architecture docs with RBAC changes
- [ ] Update runbook library with this verification runbook

## Troubleshooting

### Issue: SDM still sees 0 projects

**Diagnosis:**
```bash
# Check SDM user groups in JWT
echo $SDM_TOKEN | cut -d. -f2 | base64 -d | jq '."cognito:groups"'

# Expected: Should include "SDM" group
```

**Solution:**
- Verify user has SDM group in Cognito
- Check projects have sdm_manager_email, accepted_by, or created_by matching SDM email
- Run migration script again with --apply

### Issue: PMO can create project without SDM assignment

**Diagnosis:**
- Check deployed Lambda code version
- Verify code includes validation at line ~1075 in projects.ts

**Solution:**
- Redeploy API stack
- Verify function code in AWS console

### Issue: Migration script fails with AccessDenied

**Diagnosis:**
```bash
# Check Lambda execution role permissions
aws iam get-role-policy \
  --role-name finanzas-projects-handler-role \
  --policy-name DynamoDBAccess
```

**Solution:**
- Ensure Lambda role has `dynamodb:UpdateItem` permission on projects table
- Ensure Lambda role has `dynamodb:PutItem` permission on audit_log table

## Contact

For issues or questions:
- Slack: #finanzas-platform
- Email: platform-team@example.com
- On-call: Check PagerDuty schedule

---

**Last Updated**: 2024-12-14  
**Version**: 1.0  
**Owner**: Platform Team
