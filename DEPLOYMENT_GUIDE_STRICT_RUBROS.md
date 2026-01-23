# Strict Canonical Rubros Taxonomy - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the strict canonical rubros taxonomy system across the financial planning application.

## Prerequisites

- Access to AWS Console (for environment variable configuration)
- Admin access to GitHub repository
- Understanding of the canonical taxonomy structure

## Deployment Phases

### Phase 1: Audit Mode Deployment (Recommended First Step)

Deploy with validation in **audit mode** to identify and fix non-canonical data without breaking existing functionality.

#### 1.1 Deploy Backend API

```bash
# Set environment variable in AWS Lambda/ECS
STRICT_RUBRO_VALIDATION=false

# Or in SAM template.yaml / CloudFormation
Environment:
  Variables:
    STRICT_RUBRO_VALIDATION: "false"
```

**Expected Behavior:**
- API accepts both canonical and legacy rubro IDs
- Non-canonical IDs are automatically mapped to canonical equivalents
- Warnings logged for non-canonical inputs
- No 400 errors for legitimate legacy IDs

#### 1.2 Deploy Frontend UI

```bash
# Build and deploy UI with updated SelectRubro component
npm run build:finanzas
# Deploy to S3/CloudFront
```

**Expected Behavior:**
- New forms use SelectRubro dropdown component
- Only canonical IDs can be selected
- Existing forms continue to work
- Users cannot input free-text rubros

#### 1.3 Monitor Audit Logs

```bash
# Check CloudWatch logs for warnings
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-api \
  --filter-pattern "[validateRubro] AUDIT"

# Or use CloudWatch Insights query:
fields @timestamp, @message
| filter @message like /AUDIT.*rubro/
| sort @timestamp desc
```

**Look for:**
- Frequency of legacy ID usage
- Which clients/users are using legacy IDs
- Patterns in non-canonical data

#### 1.4 Review Nightly Audit Reports

The nightly audit job runs at 2 AM UTC and scans DynamoDB for non-canonical rubros.

```bash
# Check audit reports in S3
aws s3 ls s3://YOUR-AUDIT-BUCKET/audit-reports/rubros/

# Download latest report
aws s3 cp s3://YOUR-AUDIT-BUCKET/audit-reports/rubros/audit-report-LATEST.txt ./
```

**Action Items:**
- If non-canonical rubros found, identify the source
- Update data import/migration scripts
- Fix API endpoints that persist non-canonical IDs
- Educate users on using canonical taxonomy

### Phase 2: Strict Mode Deployment (After Audit Period)

After running in audit mode for a suitable period (recommended: 1-2 weeks), enable strict validation.

#### 2.1 Pre-Deployment Checklist

- [ ] No non-canonical rubros in DynamoDB (verified by nightly audit)
- [ ] All audit warnings resolved or legacy mappings added
- [ ] All client applications updated to use SelectRubro component
- [ ] Integration tests pass with strict validation enabled
- [ ] Stakeholders notified of upcoming change

#### 2.2 Enable Strict Mode

```bash
# Update environment variable in AWS
STRICT_RUBRO_VALIDATION=true

# Or in SAM template.yaml / CloudFormation
Environment:
  Variables:
    STRICT_RUBRO_VALIDATION: "true"
```

**Expected Behavior:**
- API rejects non-canonical rubro IDs with 400 error
- Error messages guide users to use canonical IDs
- Only canonical IDs from /data/rubros.taxonomy.json accepted
- Legacy ID mapping still works (but only as intermediate step)

#### 2.3 Monitor for Issues

```bash
# Check for 400 errors related to rubros
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-api \
  --filter-pattern "400.*rubro"

# Or use CloudWatch Insights:
fields @timestamp, @message
| filter @message like /400/ and @message like /rubro/
| sort @timestamp desc
```

**Action Items:**
- If legitimate 400 errors occur, investigate the source
- May need to add missing legacy mappings to LEGACY_RUBRO_ID_MAP
- May need to update client application

### Phase 3: Ongoing Maintenance

#### 3.1 Updating the Taxonomy

When adding or modifying rubros:

1. Update `/data/rubros.taxonomy.json`
2. Commit and push to main branch
3. GitHub Actions automatically:
   - Validates JSON structure
   - Checks for duplicate IDs
   - Uploads to S3 (versioned)
   - Triggers UI and API deployments

```bash
# Example: Add new rubro
jq '.items += [{
  "pk": "LINEA#NEW-CAT-ITEM",
  "sk": "CATEGORIA#NEW",
  "categoria": "New Category",
  "categoria_codigo": "NEW",
  "descripcion": "Description of new item",
  "fuente_referencia": "Source",
  "linea_codigo": "NEW-CAT-ITEM",
  "linea_gasto": "New Category Item",
  "tipo_costo": "OPEX",
  "tipo_ejecucion": "mensual"
}]' data/rubros.taxonomy.json > data/rubros.taxonomy.json.new

mv data/rubros.taxonomy.json.new data/rubros.taxonomy.json

git add data/rubros.taxonomy.json
git commit -m "Add NEW-CAT-ITEM to taxonomy"
git push
```

#### 3.2 Adding Legacy ID Mappings

If a legacy ID needs to be supported:

1. Add to LEGACY_RUBRO_ID_MAP in both canonical-taxonomy files
2. Do NOT add to forbidden-rubros.txt (unless should be blocked)
3. Test the mapping

```typescript
// In src/lib/rubros/canonical-taxonomy.ts
// And services/finanzas-api/src/lib/canonical-taxonomy.ts

export const LEGACY_RUBRO_ID_MAP: Record<string, string> = {
  // ... existing mappings
  'LEGACY-ID': 'CANONICAL-ID',
};
```

#### 3.3 Monitoring CI Guards

The CI pipeline checks for forbidden literals on every pull request.

**If check fails:**
1. Review the flagged code
2. Replace forbidden literal with canonical ID
3. Or add to LEGACY_RUBRO_ID_MAP if legitimate mapping needed
4. Or exclude from check pattern if false positive

## Rollback Procedures

### Rolling Back Strict Mode

```bash
# Revert to audit mode
STRICT_RUBRO_VALIDATION=false

# Redeploy API
```

This immediately allows legacy IDs again (with mapping).

### Rolling Back Taxonomy Changes

```bash
# Revert taxonomy file to previous version
git revert <commit-sha>
git push

# Or manually restore from S3
aws s3 cp s3://YOUR-BUCKET/taxonomy/rubros.taxonomy.TIMESTAMP.json data/rubros.taxonomy.json
git add data/rubros.taxonomy.json
git commit -m "Rollback taxonomy to TIMESTAMP"
git push
```

GitHub Actions will automatically deploy the reverted version.

## Troubleshooting

### Issue: API returns 400 "Unknown rubro"

**Cause:** Client submitted a rubro ID not in canonical taxonomy or legacy mapping.

**Solution:**
1. Check if ID should be in taxonomy → add to rubros.taxonomy.json
2. Check if ID is legacy → add to LEGACY_RUBRO_ID_MAP
3. Check if client is using wrong ID → update client code

### Issue: Nightly audit reports non-canonical rubros

**Cause:** Data in DynamoDB contains non-canonical IDs.

**Solution:**
1. Identify the source (check recent imports/API calls)
2. Fix the source to use canonical IDs
3. Run data migration script to clean existing data
4. Enable STRICT_RUBRO_VALIDATION to prevent recurrence

### Issue: CI fails with forbidden literal

**Cause:** Code contains a literal that matches forbidden-rubros.txt

**Solution:**
1. Replace with canonical ID
2. Or use LEGACY_RUBRO_ID_MAP for mapping
3. Or update exclusion pattern in finanzas-ci.yml if false positive

## Environment Variables Reference

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `STRICT_RUBRO_VALIDATION` | `true`/`false` | `false` | Enable strict validation mode |

## Secrets Reference

| Secret | Required | Description |
|--------|----------|-------------|
| `AWS_ROLE_ARN` | Yes | AWS IAM role for deployments |
| `TAXONOMY_S3_BUCKET` | No | S3 bucket for taxonomy versioning |
| `AUDIT_S3_BUCKET` | No | S3 bucket for audit reports |
| `SLACK_WEBHOOK_URL` | No | Slack webhook for notifications |

## Testing Checklist

Before deploying to production:

- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Integration tests pass
- [ ] E2E tests pass (Forecast single-load, form validation)
- [ ] Taxonomy JSON validates
- [ ] SelectRubro component works in dev environment
- [ ] API accepts canonical IDs in dev/staging
- [ ] API rejects non-canonical IDs when strict mode enabled
- [ ] CI forbidden literals check passes
- [ ] Nightly audit job runs successfully

## Support and Contact

For issues or questions:
- Check CloudWatch logs
- Review GitHub Actions workflow runs
- Check audit reports in S3
- Contact DevOps team

## References

- Canonical Taxonomy: `/data/rubros.taxonomy.json`
- Validation Module: `services/finanzas-api/src/lib/validateRubro.ts`
- UI Component: `src/components/SelectRubro.tsx`
- CI Workflows: `.github/workflows/taxonomy-sync.yml`, `.github/workflows/finanzas-ci.yml`
- Nightly Audit: `.github/workflows/nightly-audit-rubros.yml`
