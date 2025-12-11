# Quick Start: Fix Dev Environment Issues

This guide provides the fastest path to fix the three dev environment issues:
1. PayRoll Dashboard / Portfolio Graphs
2. Forecast Grid Returns Empty
3. Baseline Reject Mismatch

## Prerequisites

- AWS credentials configured for dev environment
- Access to DynamoDB tables with prefix `finz_` in `us-east-2`
- Node.js 20+ installed

## Option 1: Quick Fix (If Data Already Exists)

If the projects already exist but have incorrect metadata:

```bash
cd services/finanzas-api

# Install dependencies (if not already done)
npm install

# Run quick fix script
AWS_REGION=us-east-2 TABLE_PREFIX=finz_ npm run fix:dev-data

# Verify fixes
npm run verify:dev-environment
```

## Option 2: Full Seed (If Projects Don't Exist)

If the projects don't exist at all:

```bash
cd services/finanzas-api

# Install dependencies (if not already done)
npm install

# Seed all 7 canonical projects
AWS_REGION=us-east-2 TABLE_PREFIX=finz_ npm run seed:canonical-projects

# Verify seed
npm run verify:dev-environment
```

## Option 3: Manual Verification Only

To just check the current state without making changes:

```bash
cd services/finanzas-api
npm run verify:dev-environment
```

## Expected Output

When verification passes, you should see:

```
🔍 Verifying Dev Environment Configuration
════════════════════════════════════════════════════════════════════════════════
   Region: us-east-2
   Table Prefix: finz_
════════════════════════════════════════════════════════════════════════════════

✅ P-CLOUD-ECOPETROL: Project Metadata
   Project P-CLOUD-ECOPETROL exists with correct baseline_id
   Details: {
     "projectId": "P-CLOUD-ECOPETROL",
     "name": "Cloud Ops Ecopetrol",
     "baselineId": "BL-CLOUD-ECOPETROL-001"
   }

✅ P-CLOUD-ECOPETROL: Rubros
   Found 6 rubros with correct baseline_id for project P-CLOUD-ECOPETROL
   Details: {
     "totalRubros": 6,
     "rubrosWithBaseline": 6
   }

✅ P-SOC-BANCOL-MED: Project Metadata
   Project P-SOC-BANCOL-MED exists with correct baseline_id
   ...

✅ All validations passed!
```

## Testing the Fixes

### 1. Test Payroll Dashboard
```bash
# Using curl (replace JWT_TOKEN with actual token)
# Find API_URL: AWS Console > API Gateway > FinanzasAPI > Stages > dev > Invoke URL
# Or from SAM output: Look for "ApiUrl" in stack outputs
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://<api-id>.execute-api.us-east-2.amazonaws.com/dev/payroll/dashboard
```

Expected: Array of MOD projections by month

### 2. Test Forecast Grid
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "https://<api-id>.execute-api.us-east-2.amazonaws.com/dev/plan/forecast?projectId=P-CLOUD-ECOPETROL&months=12"
```

Expected: JSON with `data` array containing forecast cells

### 3. Test Baseline Reject
```bash
curl -X PATCH \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"baseline_id":"BL-SOC-BANCOL-001","comment":"Test reject"}' \
  https://<api-id>.execute-api.us-east-2.amazonaws.com/dev/projects/P-SOC-BANCOL-MED/reject-baseline
```

Expected: JSON with `baseline_status: "rejected"`

## Troubleshooting

### "Project not found"
- Run Option 2 (Full Seed)
- Verify AWS credentials have DynamoDB access
- Check TABLE_PREFIX matches your environment

### "No rubros found"
- Run Option 2 (Full Seed) - creates rubros with correct structure
- Or run Option 1 (Quick Fix) if rubros exist but have wrong metadata

### "baseline_id mismatch"
- Run Option 1 (Quick Fix) to update baseline_id fields
- Or manually update project METADATA record in DynamoDB

### CORS errors in browser
- Verify API is deployed with latest changes
- Check CloudFront domain in template.yaml matches actual domain
- Redeploy: `cd services/finanzas-api && sam deploy --config-env dev`

## What Gets Created/Fixed

### P-CLOUD-ECOPETROL
- Project metadata with `baselineId: "BL-CLOUD-ECOPETROL-001"`
- 6 rubros (RB0001, RB0002, RB0003, RB0040, RB0045, RB0050)
- Each rubro has `metadata.baseline_id: "BL-CLOUD-ECOPETROL-001"`
- 18 allocations (3 months × 6 resource types)
- 18 payroll records (3 months × 6 resource types)

### P-SOC-BANCOL-MED
- Project metadata with `baselineId: "BL-SOC-BANCOL-001"`
- 5 rubros (RB0001, RB0002, RB0003, RB0020, RB0025)
- Each rubro has `metadata.baseline_id: "BL-SOC-BANCOL-001"`
- 9 allocations (3 months × 3 resource types)
- 9 payroll records (3 months × 3 resource types)

### Plus 5 More Projects
- P-NOC-CLARO-BOG
- P-WIFI-ELDORADO
- P-SD-TIGO-CALI
- P-CONNECT-AVIANCA
- P-DATACENTER-ETB

## Next Steps

After verification passes:

1. **Test in UI**: Open https://d7t9x3j66yd8k.cloudfront.net
2. **Check Portfolio Dashboard**: Should show 7 projects with MOD data
3. **Check Forecast**: Navigate to P-CLOUD-ECOPETROL → Forecast tab
4. **Test Baseline Reject**: Try rejecting P-SOC-BANCOL-MED baseline

## Need Help?

See detailed documentation in:
- `DEV_ENVIRONMENT_FIX.md` - Comprehensive guide
- `services/finanzas-api/src/seed/README.md` - Seed data details
- `services/finanzas-api/scripts/verify-dev-environment.ts` - Verification logic
