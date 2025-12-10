# SDMT Forecast Fix - Deployment Guide

## 🎯 Quick Summary

**Problem**: SDMT Forecast page showing 0 data points  
**Root Cause**: Mismatch between baseline_id storage locations  
**Solution**: Backward compatible filter supporting both locations  
**Status**: ✅ Ready for deployment (257 tests passing, 0 vulnerabilities)

## 📋 Pre-Deployment Checklist

- [x] All unit tests passing (257/257)
- [x] Code review completed (0 issues)
- [x] Security scan passed (0 vulnerabilities)
- [x] Backward compatibility verified
- [x] Documentation complete
- [ ] Dev deployment
- [ ] Dev validation
- [ ] Production deployment

## 🚀 Deployment Steps

### Step 1: Deploy to Dev Environment

```bash
cd services/finanzas-api
sam build
sam deploy --stack-name finanzas-sd-api-dev --resolve-s3 --capabilities CAPABILITY_IAM
```

### Step 2: Verify API Endpoint

Test with canonical projects:

```bash
# Test NOC Claro project
curl -H "Authorization: Bearer $TOKEN" \
  "https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev/plan/forecast?projectId=P-NOC-CLARO-BOG&months=12"

# Test SOC Bancolombia project
curl -H "Authorization: Bearer $TOKEN" \
  "https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev/plan/forecast?projectId=P-SOC-BANCOL-MED&months=12"
```

**Expected Response**:
- ✅ `data` array with entries
- ✅ Non-zero `planned`, `forecast` values
- ✅ Line items matching project rubros

**Before Fix**:
```json
{
  "data": [],
  "projectId": "P-NOC-CLARO-BOG",
  "months": 12
}
```

**After Fix**:
```json
{
  "data": [
    {
      "line_item_id": "RB0001",
      "month": 1,
      "planned": 600000,
      "forecast": 600000,
      "actual": 0,
      ...
    },
    ...
  ],
  "projectId": "P-NOC-CLARO-BOG",
  "months": 12
}
```

### Step 3: Verify UI

1. **Login to Dev Environment**
   - URL: `https://d7t9x3j66yd8k.cloudfront.net/finanzas`
   - Login as SDMT role user

2. **Navigate to Forecast View**
   - Go to: `.../finanzas/sdmt/cost/forecast`
   - Select a project with baseline (e.g., NOC Claro Bogotá)

3. **Verify Display**
   - ✅ "Data points" > 0
   - ✅ "Line items" > 0
   - ✅ Forecast grid shows data
   - ✅ Totals are non-zero

### Step 4: Deploy to Production

Only after successful dev validation:

```bash
cd services/finanzas-api
sam deploy --stack-name finanzas-sd-api-prod --resolve-s3 --capabilities CAPABILITY_IAM
```

## 🔍 Validation Tests

### Unit Tests
```bash
cd services/finanzas-api
npm test
```
**Expected**: 257/257 tests passing

### Specific Module Tests
```bash
npm test -- baseline-sdmt.spec.ts  # 13 tests
npm test -- forecast.spec.ts       # 7 tests
```

### Contract Tests (Optional)
```bash
newman run postman/finanzas-sd-api-collection.json \
  --environment postman/finanzas-sd-dev.postman_environment.json
```

## 📊 Monitoring

After deployment, monitor these metrics:

### CloudWatch Logs
```bash
aws logs tail /aws/lambda/finanzas-sd-api-dev-forecast --follow
```

Look for:
- `[forecast] response stats` - Should show `rubrosCount > 0`
- `[forecast] params` - Verify projectId and months

### Key Metrics to Watch
1. **Forecast API calls** - Should complete successfully
2. **Response data size** - Should be non-zero for projects with baselines
3. **Error rate** - Should remain at 0%

### Example Log (Success)
```
[forecast] params { projectId: 'P-NOC-CLARO-BOG', months: 12 }
[forecast] response stats {
  projectId: 'P-NOC-CLARO-BOG',
  months: 12,
  allocationsCount: 0,
  payrollCount: 0,
  rubrosCount: 5,
  forecastCount: 60
}
```

## 🐛 Troubleshooting

### Issue: Still Seeing Empty Data

**Check 1**: Verify project has baseline
```sql
-- Check project metadata
SELECT * FROM finz_projects 
WHERE pk = 'PROJECT#P-NOC-CLARO-BOG' AND sk = 'METADATA';
-- Should have: baseline_id, baseline_status
```

**Check 2**: Verify rubros exist
```sql
-- Check project rubros
SELECT * FROM finz_rubros 
WHERE pk = 'PROJECT#P-NOC-CLARO-BOG' AND begins_with(sk, 'RUBRO#');
-- Should return records with baselineId or metadata.baseline_id
```

**Check 3**: Verify baseline_id match
- Project's `baseline_id` must match rubro's `baselineId` or `metadata.baseline_id`

### Issue: Filter Not Working

**Check**: Verify filter logic in CloudWatch logs
```
[baseline-sdmt] Filtering rubros by baseline: BL-NOC-CLARO-001
[baseline-sdmt] Found 5 rubros before filter
[baseline-sdmt] Found 5 rubros after filter
```

If after-filter count is 0 but before-filter > 0, check baseline_id values.

## 🔄 Rollback Plan

If issues occur in production:

```bash
# Rollback to previous version
aws cloudformation deploy \
  --stack-name finanzas-sd-api-prod \
  --template-file .aws-sam/build/template.yaml \
  --parameter-overrides Version=PREVIOUS_VERSION

# Or use AWS Console:
# CloudFormation > Stacks > finanzas-sd-api-prod > Actions > Update Stack > Use previous template
```

## 📝 Post-Deployment Verification

### Checklist
- [ ] API returns non-empty data for projects with baselines
- [ ] UI displays forecast data correctly
- [ ] No increase in error rate
- [ ] CloudWatch logs show successful forecast generation
- [ ] All SDMT views (catalog, forecast, reconciliation) working

### Test Projects
Test these canonical projects in order:
1. P-NOC-CLARO-BOG (NOC Claro Bogotá) - 60 months, 5 rubros
2. P-SOC-BANCOL-MED (SOC Bancolombia) - 36 months, 6 rubros
3. P-WIFI-UNIV-LAB (WiFi Universidad) - 48 months, 4 rubros

## 📚 Related Documentation

- **Technical Details**: `SDMT_FORECAST_FIX_SUMMARY.md`
- **API Contract**: `postman/finanzas-sd-api-collection.json`
- **Test Coverage**: `services/finanzas-api/tests/unit/`

## 👥 Support

For deployment issues, contact:
- **Dev Team**: See PR comments
- **Logs**: CloudWatch `/aws/lambda/finanzas-sd-api-{env}-forecast`
- **Metrics**: CloudWatch Dashboard "Finanzas API"

## ✅ Success Criteria

Deployment is successful when:
1. ✅ API returns non-empty forecast data
2. ✅ UI shows data points > 0
3. ✅ All unit tests pass
4. ✅ No error rate increase
5. ✅ All SDMT views functional
