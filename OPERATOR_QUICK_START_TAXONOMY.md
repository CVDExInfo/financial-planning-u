# Operator Quick Start Guide - Taxonomy Validation & Remediation

## Purpose
This guide provides step-by-step instructions for operators to validate and remediate taxonomy data in the DynamoDB table `finz_rubros_taxonomia`.

## Prerequisites

### Required Access
- AWS credentials with permissions for DynamoDB operations on `finz_rubros_taxonomia`
- Node 18+ environment
- Repository cloned locally

### Required DynamoDB Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-2:*:table/finz_rubros_taxonomia"
    }
  ]
}
```

## Step 1: Run Validation

```bash
# Set environment variables
export AWS_REGION=us-east-2
export TAXONOMY_TABLE=finz_rubros_taxonomia

# Run validator
node scripts/validate-taxonomy-dynamo-full.cjs
```

**Expected Output:**
```
Scanning Dynamo table finz_rubros_taxonomia
WROTE tmp/taxonomy_report_full.json
```

## Step 2: Review Report

```bash
# View report summary
cat tmp/taxonomy_report_full.json | jq '{
  meta,
  missingCount: (.missingInDynamo | length),
  extraCount: (.extraInDynamo | length),
  mismatchCount: (.attributeMismatches | keys | length)
}'

# View specific issues
cat tmp/taxonomy_report_full.json | jq '.missingInDynamo'  # IDs to create
cat tmp/taxonomy_report_full.json | jq '.attributeMismatches'  # Attributes to fix
```

## Step 3: Prioritize Fixes

Review the report and identify priorities:

### Priority 1: PK Mismatches (CRITICAL)
**Risk**: Query failures, data corruption
**Action**: MUST FIX before production deployment

Look for items in `attributeMismatches` with `"attr": "pk"` diffs.

### Priority 2: Missing Canonical IDs (HIGH)
**Risk**: Frontend errors when referencing these IDs
**Action**: MUST FIX for affected projects

Check `missingInDynamo` array.

### Priority 3: Attribute Mismatches (MEDIUM)
**Risk**: Display inconsistencies, incorrect categorization
**Action**: FIX to ensure UI displays correct information

Check `attributeMismatches` for non-PK diffs.

### Priority 4: Extra IDs (LOW)
**Risk**: Minimal - legacy data
**Action**: REVIEW but do not auto-delete

Check `extraInDynamo` array.

## Step 4: Execute Remediation (Interactive)

⚠️ **IMPORTANT**: Always test in staging first!

```bash
# For staging
export AWS_REGION=us-east-2
export TAXONOMY_TABLE=finz_rubros_taxonomia_staging
node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json

# For production (after staging validation)
export TAXONOMY_TABLE=finz_rubros_taxonomia
node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json
```

**Interactive Session:**
- Script will prompt for approval for EACH change
- Type `y` to approve, `n` to skip
- Backups are created automatically before any modification
- All actions are logged to `tmp/remediation-log.json`

## Step 5: Verify Fixes

```bash
# Re-run validator
node scripts/validate-taxonomy-dynamo-full.cjs

# Check for clean report
cat tmp/taxonomy_report_full.json | jq '{
  missing: (.missingInDynamo | length),
  mismatches: (.attributeMismatches | keys | length)
}'

# Expected: {"missing": 0, "mismatches": 0}
```

## Step 6: Backup Management

```bash
# List backups
ls -lh tmp/backups/

# Upload backups to S3 (recommended for production)
aws s3 sync tmp/backups/ s3://your-backup-bucket/taxonomy-backups/$(date +%Y%m%d)/

# Keep local backups for 30 days
find tmp/backups/ -mtime +30 -delete
```

## Rollback Procedure

If you need to undo changes:

```bash
# 1. Identify affected items from log
cat tmp/remediation-log.json | jq '.[] | select(.action == "delete")'

# 2. Restore from backup
aws dynamodb put-item \
  --table-name finz_rubros_taxonomia \
  --item file://tmp/backups/backup_LINEA-XXX_CATEGORIA-YYY.json \
  --region us-east-2

# 3. Verify restoration
node scripts/validate-taxonomy-dynamo-full.cjs
```

## Common Issues & Solutions

### Issue: "Could not load credentials"
**Solution**: Configure AWS credentials
```bash
aws configure
# OR set environment variables
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
```

### Issue: "Table not found"
**Solution**: Verify table name and region
```bash
aws dynamodb describe-table --table-name finz_rubros_taxonomia --region us-east-2
```

### Issue: "Permission denied"
**Solution**: Verify IAM permissions include all required DynamoDB actions

### Issue: Too many mismatches
**Solution**: Review with development team before mass remediation. May indicate systematic issue.

## Automation (Optional)

For automated validation in CI/CD:

```yaml
# This is already configured in .github/workflows/deploy-ui.yml
- name: Validate taxonomy sync (Dynamo SOT)
  env:
    AWS_REGION: us-east-2
    TAXONOMY_TABLE: finz_rubros_taxonomia
  run: node scripts/validate-taxonomy-dynamo-full.cjs
```

## Health Checks

After remediation, verify system health:

1. **UI Test**: Load SDMTForecast for sample project
2. **API Test**: Query `/api/rubros` endpoint
3. **Data Test**: Verify allocations display correctly
4. **Reports**: Check forecast reports render properly

## Support

For issues or questions:
- Review: `TAXONOMY_VALIDATION_IMPLEMENTATION_SUMMARY.md`
- Scripts: `scripts/validate-taxonomy-dynamo-full.cjs`, `scripts/remediate-taxonomy-dynamo.cjs`
- CI Config: `.github/workflows/deploy-ui.yml`

## Emergency Contact

If critical issues occur:
1. Stop remediation immediately
2. Preserve backups in `tmp/backups/`
3. Document issue in `tmp/remediation-log.json`
4. Contact development team
5. Do NOT delete backups until issue is resolved

---

## Example Session Output

```
$ node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json

PK mismatches to consider (priority 1):
ID MOD-IN2 has pk mismatch: pk is "LINEA#MOD-EXT" but expected LINEA#MOD-IN2
Fix PK for MOD-IN2 (copy->put->delete)? (y/N): y
✅ Backup created: tmp/backups/backup_LINEA-MOD-EXT_CATEGORIA-MOD.json
✅ Created LINEA#MOD-IN2|CATEGORIA#MOD
✅ Deleted LINEA#MOD-EXT|CATEGORIA#MOD

Missing canonical IDs to create (priority 2): 3
Create minimal item for MOD-XYZ? (y/N): y
✅ Created LINEA#MOD-XYZ|CATEGORIA#MOD

Attribute mismatches for MOD-ING sample LINEA#MOD-ING|CATEGORIA#MOD:
Update attributes for MOD-ING on LINEA#MOD-ING|CATEGORIA#MOD? (y/N): y
✅ Backup created: tmp/backups/backup_LINEA-MOD-ING_CATEGORIA-MOD.json
✅ Updated attributes for LINEA#MOD-ING CATEGORIA#MOD

Extra IDs in Dynamo not present in frontend: 5
First 50 extras: ["OLD-RUBRO-1", "DEPRECATED-2", "LEGACY-3"]

Remediation finished; log written to tmp/remediation-log.json
```

---

**Last Updated**: 2026-01-22
**Version**: 1.0
