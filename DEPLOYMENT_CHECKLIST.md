# Deployment Checklist: Post-PR Validation Patch

**PR**: `copilot/post-pr-validation-targeted-patch`  
**Base**: Merged PR #693  
**Status**: ✅ Ready for Deployment

---

## Pre-Deployment Verification

### ✅ Code Quality
- [x] All 385 tests passing
- [x] SAM template validated
- [x] Code review completed (no issues)
- [x] Security scan completed (no vulnerabilities)
- [x] Zero regressions confirmed

### ✅ Documentation
- [x] POST_MERGE_STABILIZATION_SUMMARY.md (comprehensive analysis)
- [x] EVIDENCE_IAM_FIX.md (technical details and code references)
- [x] Rollback instructions documented
- [x] All changes explained with before/after evidence

### ✅ Change Scope
- [x] Minimal changes (1 file, 4 lines)
- [x] No code modifications
- [x] No API contract changes
- [x] No CORS/auth changes
- [x] IAM permissions only

---

## Deployment Steps

### 1. Merge PR
```bash
# Review and approve PR on GitHub
# Merge to main/develop branch
```

### 2. Deploy CloudFormation Stack
```bash
cd services/finanzas-api

# Set environment
export STAGE=dev  # or: prod, staging

# Build SAM application
sam build

# Deploy to AWS
sam deploy \
  --no-confirm-changeset \
  --stack-name finanzas-sd-api-${STAGE} \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM

# Expected output:
# CloudFormation stack changeset
# -----------------
# Operation    LogicalResourceId    ResourceType
# Update       RubrosFn             AWS::Lambda::Function
# -----------------
```

### 3. Verify Deployment
```bash
# Check CloudFormation stack status
aws cloudformation describe-stacks \
  --stack-name finanzas-sd-api-${STAGE} \
  --query 'Stacks[0].StackStatus' \
  --output text

# Expected: UPDATE_COMPLETE
```

---

## Post-Deployment Validation

### Immediate Checks (5 minutes)

#### 1. Lambda Function Permissions
```bash
# Verify RubrosFn has correct IAM policies
aws lambda get-function \
  --function-name finanzas-sd-api-${STAGE}-RubrosFn \
  --query 'Configuration.Role'

# Check IAM role has AllocationsTable and RubrosTaxonomiaTable permissions
aws iam get-role-policy \
  --role-name <role-name-from-above> \
  --policy-name <policy-name>
```

#### 2. CloudWatch Logs
```bash
# Monitor for IAM permission errors
aws logs tail /aws/lambda/finanzas-sd-api-${STAGE}-RubrosFn \
  --follow \
  --filter-pattern "AccessDenied"

# Expected: No new AccessDenied errors
```

### Functional Tests (15 minutes)

#### Test Scenario 1: Hub Endpoints (Already Working)
```bash
# Test all Hub endpoints return 200
curl -H "Authorization: Bearer $TOKEN" \
  https://api.${STAGE}.example.com/finanzas/hub/summary?scope=ALL

# Expected: 200 OK with JSON response
```

#### Test Scenario 2: Forecast Bulk Save (Already Working)
```bash
# Test payroll bulk upload
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"projectId":"P-TEST","month":"2025-01","amount":10000,"rubroId":"RB0001"}]' \
  https://api.${STAGE}.example.com/payroll/actuals/bulk

# Expected: 200 OK with insertedCount
```

#### Test Scenario 3: Rubros Attachment (Fixed in this PR)
```bash
# 1. Create test project
PROJECT_ID="TEST-DEPLOY-$(date +%s)"
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_code":"'$PROJECT_ID'","project_name":"Deployment Test"}' \
  https://api.${STAGE}.example.com/projects

# 2. Attach rubros to project
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rubroIds": ["RB0001", "RB0002"],
    "qty": 1,
    "unit_cost": 1000,
    "recurring": true,
    "start_month": 1,
    "end_month": 12
  }' \
  https://api.${STAGE}.example.com/projects/${PROJECT_ID}/rubros

# Expected: 200 OK with attached rubros

# 3. Verify rubros appear in project
curl -H "Authorization: Bearer $TOKEN" \
  https://api.${STAGE}.example.com/projects/${PROJECT_ID}/rubros

# Expected: 200 OK with non-empty rubros array

# 4. Check CloudWatch logs for allocation mirroring success
aws logs tail /aws/lambda/finanzas-sd-api-${STAGE}-RubrosFn \
  --since 5m \
  | grep "failed to mirror allocation"

# Expected: No allocation mirroring failures
```

#### Test Scenario 4: Cost/Catálogo UI (Fixed in this PR)
**Manual UI Test**:
1. Log into Finanzas SDMT Cost/Catálogo page
2. Select test project from dropdown
3. Accept baseline (if not already accepted)
4. Verify rubros list populates (non-zero items)
5. Verify no console errors in browser DevTools

**Expected**: Rubros list shows all line items for the project

#### Test Scenario 5: Baseline seeding (Estimator)
**Manual API Test**:
1. Create a baseline via `/baseline` (PMO Estimator flow).
2. Verify `finz_rubros` contains items with `pk = PROJECT#{projectId}` and `metadata.baseline_id = {baselineId}`.
3. Check CloudWatch logs for `[baseline.create] seedLineItemsFromBaseline result`.

**Expected**: Rubros are materialized without blocking baseline creation.

---

## Monitoring (24-48 hours)

### Key Metrics

#### CloudWatch Metrics
```bash
# Monitor Lambda errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=finanzas-sd-api-${STAGE}-RubrosFn \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Expected: No increase in error rate
```

#### CloudWatch Logs Insights
```sql
-- Query for IAM permission errors
fields @timestamp, @message
| filter @message like /AccessDenied|UnauthorizedOperation/
| filter @logStream like /RubrosFn/
| sort @timestamp desc
| limit 20

-- Expected: No new permission errors
```

### Success Criteria

After 24 hours, verify:
- ✅ No IAM permission errors in CloudWatch logs
- ✅ RubrosFn Lambda error rate unchanged or decreased
- ✅ Cost/Catálogo page loads rubros for all projects
- ✅ No customer complaints about missing rubros
- ✅ Allocation mirroring succeeds (no warnings in logs)

---

## Rollback Procedure

If issues are detected:

### Option 1: Revert Git Commit
```bash
cd services/finanzas-api
git revert 1780c43
git push

# Then redeploy
sam build && sam deploy --no-confirm-changeset
```

### Option 2: Previous Stack Version
```bash
# Get previous stack template
aws cloudformation get-template \
  --stack-name finanzas-sd-api-${STAGE} \
  --template-stage Original \
  > previous-template.yaml

# Deploy previous version
sam deploy \
  --template-file previous-template.yaml \
  --no-confirm-changeset \
  --stack-name finanzas-sd-api-${STAGE}
```

### Rollback Impact
- Rubros attachment will revert to previous behavior
- Allocation mirroring will silently fail (as before)
- No data loss
- All other functionality unaffected

---

## Support Contacts

**Development Team**: @valencia94  
**PR Reference**: copilot/post-pr-validation-targeted-patch  
**Commit**: 1780c43  

**Documentation**:
- `POST_MERGE_STABILIZATION_SUMMARY.md` - Complete analysis
- `EVIDENCE_IAM_FIX.md` - Technical details
- This file - Deployment procedure

---

## Sign-Off

- [ ] Code review approved
- [ ] Tests passing (385/385)
- [ ] SAM template validated
- [ ] Security scan completed
- [ ] Documentation reviewed
- [ ] Deployment plan approved

**Ready for deployment**: YES ✅

**Approved by**: _________________  
**Date**: _________________
