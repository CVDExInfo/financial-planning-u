# Quick Reference - Finanzas Deployment

## 🎯 Current Status

✅ **Production-Ready** - Both PMO and Finanzas portals deployed and accessible

## 📍 URLs

| Portal | URL |
|--------|-----|
| PMO | <https://d7t9x3j66yd8k.cloudfront.net/> |
| Finanzas | <https://d7t9x3j66yd8k.cloudfront.net/finanzas/> |
| API | <https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev> |

## ✅ What Works

- ✅ Both SPAs build correctly
- ✅ Content syncs to S3
- ✅ CloudFront serves both paths
- ✅ HTTP 200 responses verified
- ✅ Dynamic routing working
- ✅ Navigation displays modules
- ✅ Public catalog endpoint

## ⚠️ What Needs Verification (AWS Console Required)

1. **CloudFront Behaviors** - Verify `/finanzas/*` behavior exists
2. **Error Routing** - 403/404 maps to `/finanzas/index.html`
3. **Cognito URLs** - Add `/finanzas/` callback URLs
4. **S3 Content** - Verify finanzas/ directory exists

## 📖 Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| DEPLOYMENT_COMPLETE.md | Full summary & status | 5 min |
| DEPLOYMENT_DIAGNOSTICS.md | Troubleshooting guide | 10 min |
| FINANZAS_NEXT_STEPS.md | Step-by-step AWS console | 15 min |
| scripts/verify-deployment.sh | Automated checks | 1 min |

## 🔧 Quick Commands

**Run verification:**

```bash
./scripts/verify-deployment.sh
```

**Invalidate CloudFront cache:**

```bash
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/*' '/finanzas/*'
```

**Check S3 content:**

```bash
aws s3 ls s3://ukusi-ui-finanzas-prod/finanzas/ --recursive
```

**Check CloudFront behaviors:**

```bash
aws cloudfront get-distribution-config --id EPQU7PVDLQXUA \
  | jq '.DistributionConfig.CacheBehaviors[]'
```

## 🧪 Testing Checklist

- [ ] Hard refresh Finanzas URL (Cmd+Shift+R)
- [ ] Click Sign In
- [ ] Verify Cognito login flow
- [ ] Check modules display (Rubros, Rules)
- [ ] Navigate to Rubros catalog
- [ ] Verify API calls work

## 📊 Infrastructure

| Component | Value |
|-----------|-------|
| CloudFront | d7t9x3j66yd8k |
| S3 Bucket | ukusi-ui-finanzas-prod |
| API Stack | finanzas-sd-api-dev |
| Region | us-east-2 |
| Cognito Pool | us-east-2_FyHLtOhiY |

## 🆘 If Issues

1. **Module not showing** → Check DEPLOYMENT_DIAGNOSTICS.md
2. **Login not working** → Verify Cognito URLs
3. **API returning 401** → Check JWT token generation
4. **Old content showing** → Clear cache with invalidation

## 📞 Contact

- **User:** <christian.valencia@ikusi.com>
- **Repository:** valencia94/financial-planning-u
- **Branch:** main

## 🚀 Recent Changes

| Commit | Change |
|--------|--------|
| a974be0 | Deployment summary report |
| acbea11 | Next steps guide |
| 5820222 | Diagnostics script |
| 65cae1e | Navigation fixes |
| f1ecc5c | Dynamic routing |
| 3d82a89 | Public catalog |

---

**Last Updated:** 2025-11-07 | **Status:** ✅ Ready for Production
