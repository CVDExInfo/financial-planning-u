# CloudFront Operations Guide

## Distribution Overview

**Distribution ID:** EPOU7PVDLQXUA  
**Domain:** d7t9x3j66yd8k.cloudfront.net  
**Region:** Global (CloudFront Edge Locations)

This guide provides step-by-step instructions for AWS operators to configure and maintain the CloudFront distribution that serves multiple SPAs (Finanzas and Prefacturas).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Origins Configuration](#origins-configuration)
3. [CloudFront Functions Setup](#cloudfront-functions-setup)
4. [Behaviors Configuration](#behaviors-configuration)
5. [Cache Invalidation](#cache-invalidation)
6. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
7. [Emergency Rollback Procedures](#emergency-rollback-procedures)

## Prerequisites

### Required Access

- AWS Console access to CloudFront service
- AWS CLI configured with appropriate credentials
- Permissions to:
  - Modify CloudFront distributions
  - Deploy CloudFront Functions
  - Create cache invalidations
  - Access S3 buckets (for troubleshooting)

### Required Information

- **Distribution ID:** EPOU7PVDLQXUA
- **S3 Bucket Names:**
  - Finanzas: `finanzas-ui-bucket` (example - verify actual name)
  - Prefacturas: `prefactura-ui-bucket` (example - verify actual name)
- **Origin Access Control IDs:**
  - Finanzas: OAC for finanzas-ui-s3
  - Prefacturas: `prefactura-ui-oac`

## Origins Configuration

### Step 1: Configure Finanzas Origin

1. Open CloudFront console
2. Select distribution `EPOU7PVDLQXUA`
3. Navigate to **Origins** tab
4. Click **Create Origin** (or edit existing `finanzas-ui-s3`)

**Configuration:**
```
Origin domain: <finanzas-s3-bucket>.s3.us-east-2.amazonaws.com
Name: finanzas-ui-s3
Origin path: (leave blank - path handled in S3 upload)
Enable Origin Shield: No (optional, can enable for cost optimization)
```

**Origin Access:**
```
Origin access control: Create new control setting (or use existing)
  - Name: finanzas-ui-oac
  - Signing behavior: Sign requests (recommended)
  - Origin type: S3
```

**Custom headers:** None required

5. Click **Create origin**
6. Update S3 bucket policy to allow CloudFront OAC access (auto-generated policy shown in console)

### Step 2: Configure Prefacturas Origin

1. In **Origins** tab, click **Create Origin**

**Configuration:**
```
Origin domain: <prefactura-s3-bucket>.s3.us-east-2.amazonaws.com
Name: prefactura-ui-s3
Origin path: (leave blank)
Enable Origin Shield: No
```

**Origin Access:**
```
Origin access control: prefactura-ui-oac (should already exist)
  - If not, create with same settings as finanzas-ui-oac
```

2. Click **Create origin**
3. Update S3 bucket policy for Prefacturas bucket

## CloudFront Functions Setup

### Function 1: Finanzas Rewrite

1. Navigate to **Functions** in CloudFront console (left sidebar)
2. Click **Create function**

**Settings:**
```
Name: finanzas-spa-rewrite
Runtime: cloudfront-js-1.0
```

3. Click **Create function**
4. In the **Build** tab, paste the following code:

```javascript
/**
 * CloudFront Function for Finanzas SPA routing
 * Handles client-side routing for React Router
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Redirect /finanzas to /finanzas/ (preserves querystring)
  if (uri === "/finanzas") {
    var query = request.querystring;
    var queryParts = [];

    for (var key in query) {
      if (Object.prototype.hasOwnProperty.call(query, key)) {
        var queryValue = query[key];
        if (queryValue && queryValue.value !== undefined) {
          queryParts.push(key + "=" + queryValue.value);
        }
      }
    }

    var queryString = queryParts.length > 0 ? "?" + queryParts.join("&") : "";

    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "/finanzas/" + queryString },
      },
    };
  }

  // Do not rewrite the Cognito callback page
  if (
    uri === "/finanzas/auth/callback.html" ||
    uri.startsWith("/finanzas/auth/callback.html")
  ) {
    return request;
  }

  // SPA root
  if (uri === "/finanzas/") {
    request.uri = "/finanzas/index.html";
    return request;
  }

  // For any /finanzas/* path without extension, serve the SPA
  if (uri.startsWith("/finanzas/") && !uri.match(/\.\w+$/)) {
    request.uri = "/finanzas/index.html";
    return request;
  }

  // All other paths (assets, etc.) pass through to S3
  return request;
}
```

5. Click **Save changes**
6. Click **Test** tab to test with sample URIs:

**Test Cases:**
```
Input: /finanzas → Expected: 301 redirect to /finanzas/
Input: /finanzas/ → Expected: request.uri = /finanzas/index.html
Input: /finanzas/catalog/rubros → Expected: request.uri = /finanzas/index.html
Input: /finanzas/auth/callback.html → Expected: unchanged
Input: /finanzas/assets/main.js → Expected: unchanged
```

7. Click **Publish** tab → **Publish function**

### Function 2: Prefacturas Rewrite

1. Click **Create function**

**Settings:**
```
Name: prefacturas-spa-rewrite
Runtime: cloudfront-js-1.0
```

2. Click **Create function**
3. In the **Build** tab, paste the following code:

```javascript
/**
 * CloudFront Function for Prefacturas SPA routing
 * This function redirects all non-file routes to index.html under the /prefacturas path
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  if (uri === '/') {
    request.uri = '/prefacturas/index.html';
    return request;
  }

  if (uri === '/prefacturas') {
    request.uri = '/prefacturas/index.html';
    return request;
  }

  if (uri.startsWith('/prefacturas/')) {
    // Rewrite non-file routes to index.html
    if (!uri.includes('.', uri.lastIndexOf('/')) && !uri.endsWith('/')) {
      request.uri = '/prefacturas/index.html';
    }
    
    if (uri.endsWith('/')) {
      request.uri += 'index.html';
    }
  }
  
  return request;
}
```

4. Click **Save changes**
5. Test with sample URIs:

**Test Cases:**
```
Input: /prefacturas → Expected: request.uri = /prefacturas/index.html
Input: /prefacturas/ → Expected: request.uri = /prefacturas/index.html
Input: /prefacturas/login → Expected: request.uri = /prefacturas/index.html
Input: /prefacturas/assets/app.js → Expected: unchanged
```

6. Click **Publish** tab → **Publish function**

## Behaviors Configuration

### Behavior Priority Order

CloudFront evaluates behaviors from **top to bottom**, using the first match.

**Required Order:**
1. `/finanzas/*` (most specific)
2. `/finanzas/`
3. `/finanzas`
4. `/prefacturas/*`
5. `/prefacturas/`
6. `/prefacturas`
7. API/doc behaviors (if any)
8. Default `(*)` (catch-all, last)

### Step 1: Create Finanzas Behaviors

Navigate to **Behaviors** tab in distribution `EPOU7PVDLQXUA`.

#### Behavior: /finanzas/*

Click **Create behavior**

**Settings:**
```
Path pattern: /finanzas/*
Origin: finanzas-ui-s3
Viewer protocol policy: Redirect HTTP to HTTPS
Allowed HTTP methods: GET, HEAD, OPTIONS
Cache policy: Managed-CachingDisabled
Origin request policy: Managed-CORS-S3Origin
Response headers policy: (optional) SimpleCORS or custom
```

**Function associations:**
```
Viewer request:
  - Function type: CloudFront Functions
  - Function ARN: finanzas-spa-rewrite (select from dropdown)
```

Click **Create behavior**

#### Behavior: /finanzas/

Click **Create behavior**

**Settings:**
```
Path pattern: /finanzas/
Origin: finanzas-ui-s3
Viewer protocol policy: Redirect HTTP to HTTPS
Allowed HTTP methods: GET, HEAD, OPTIONS
Cache policy: Managed-CachingDisabled
Origin request policy: Managed-CORS-S3Origin
```

**Function associations:**
```
Viewer request: finanzas-spa-rewrite
```

Click **Create behavior**

#### Behavior: /finanzas

Click **Create behavior**

**Settings:**
```
Path pattern: /finanzas
Origin: finanzas-ui-s3
Viewer protocol policy: Redirect HTTP to HTTPS
Allowed HTTP methods: GET, HEAD, OPTIONS
Cache policy: Managed-CachingDisabled
Origin request policy: Managed-CORS-S3Origin
```

**Function associations:**
```
Viewer request: finanzas-spa-rewrite
```

Click **Create behavior**

### Step 2: Create Prefacturas Behaviors

#### Behavior: /prefacturas/*

Click **Create behavior**

**Settings:**
```
Path pattern: /prefacturas/*
Origin: prefactura-ui-s3
Viewer protocol policy: Redirect HTTP to HTTPS
Allowed HTTP methods: GET, HEAD, OPTIONS
Cache policy: Managed-CachingDisabled
Origin request policy: Managed-CORS-S3Origin
```

**Function associations:**
```
Viewer request: prefacturas-spa-rewrite
```

Click **Create behavior**

#### Behavior: /prefacturas/

Click **Create behavior**

**Settings:**
```
Path pattern: /prefacturas/
Origin: prefactura-ui-s3
Viewer protocol policy: Redirect HTTP to HTTPS
Allowed HTTP methods: GET, HEAD, OPTIONS
Cache policy: Managed-CachingDisabled
Origin request policy: Managed-CORS-S3Origin
```

**Function associations:**
```
Viewer request: prefacturas-spa-rewrite
```

Click **Create behavior**

#### Behavior: /prefacturas

Click **Create behavior**

**Settings:**
```
Path pattern: /prefacturas
Origin: prefactura-ui-s3
Viewer protocol policy: Redirect HTTP to HTTPS
Allowed HTTP methods: GET, HEAD, OPTIONS
Cache policy: Managed-CachingDisabled
Origin request policy: Managed-CORS-S3Origin
```

**Function associations:**
```
Viewer request: prefacturas-spa-rewrite
```

Click **Create behavior**

### Step 3: Verify Behavior Order

1. In the **Behaviors** tab, verify the order matches the priority list above
2. Use the **Reorder** button if needed to adjust priority
3. Ensure `/finanzas/*` appears above `/prefacturas/*`
4. Default `(*)` should always be last

## Cache Invalidation

### When to Invalidate

- After deploying new versions of Finanzas or Prefacturas
- After updating CloudFront Functions
- When users report stale content

### Finanzas Invalidation

**Via AWS Console:**
1. Navigate to distribution `EPOU7PVDLQXUA`
2. Go to **Invalidations** tab
3. Click **Create invalidation**
4. Enter paths:
   ```
   /finanzas/*
   /finanzas/
   /finanzas
   ```
5. Click **Create invalidation**

**Via AWS CLI:**
```bash
aws cloudfront create-invalidation \
  --distribution-id EPOU7PVDLQXUA \
  --paths "/finanzas/*" "/finanzas/" "/finanzas"
```

### Prefacturas Invalidation

**Via AWS Console:**
1. Navigate to distribution `EPOU7PVDLQXUA`
2. Go to **Invalidations** tab
3. Click **Create invalidation**
4. Enter paths:
   ```
   /prefacturas/*
   /prefacturas/
   /prefacturas
   ```
5. Click **Create invalidation**

**Via AWS CLI:**
```bash
aws cloudfront create-invalidation \
  --distribution-id EPOU7PVDLQXUA \
  --paths "/prefacturas/*" "/prefacturas/" "/prefacturas"
```

### Invalidation Best Practices

1. **Be Specific:** Only invalidate the SPA you deployed
2. **Batch Operations:** Combine multiple paths in one invalidation request
3. **Cost Awareness:** First 1,000 paths/month are free, then $0.005/path
4. **Verify Completion:** Check invalidation status before declaring deployment complete
5. **Monitor Impact:** Watch CloudFront metrics for origin request spikes

## Monitoring and Troubleshooting

### Key Metrics to Monitor

1. **Origin Request Rate:** Should be low due to caching
2. **Error Rate (4xx, 5xx):** Should remain < 1%
3. **Cache Hit Ratio:** For assets, should be > 90%
4. **Function Compute Time:** Should be < 1ms

### Viewing Logs

**Enable CloudFront Standard Logs:**
1. Distribution settings → **Logs** tab
2. Enable **Standard logging**
3. Select S3 bucket for logs
4. Log prefix: `cloudfront-logs/finanzas-prefacturas/`

**Enable Real-time Logs (Optional):**
1. Distribution settings → **Logs** tab
2. Click **Create real-time log configuration**
3. Select fields: all request/response fields
4. Send to: Kinesis Data Stream → CloudWatch Logs Insights

### Common Issues and Fixes

#### Issue: 403 Forbidden on SPA Routes

**Diagnosis:**
```bash
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/catalog/rubros
```

If returns 403:

**Fix:**
1. Verify CloudFront Function is attached to behavior
2. Check Function code: should rewrite to `/finanzas/index.html`
3. Test Function in CloudFront console
4. Create invalidation after fixing

#### Issue: Assets Return 404

**Diagnosis:**
```bash
# Check asset URL
curl -I https://d7t9x3j66yd8k.cloudfront.net/finanzas/assets/main.js
```

If returns 404:

**Fix:**
1. Verify S3 bucket structure: `finanzas/assets/main.js` should exist
2. Check S3 bucket policy allows CloudFront OAC access
3. Verify behavior origin is correct (`finanzas-ui-s3`)
4. Test direct S3 URL (with signature) to isolate CloudFront vs S3 issue

#### Issue: Stale Content Served

**Fix:**
1. Create cache invalidation for affected paths
2. Verify cache policy is set to `CachingDisabled` for HTML files
3. Check S3 object metadata: `Cache-Control` should be `no-cache` for HTML

#### Issue: Function Not Running

**Diagnosis:**
Check CloudFront logs for function errors

**Fix:**
1. Verify function is Published (not just Saved)
2. Confirm function association on behavior
3. Test function with sample URIs in console
4. Check function quotas (max 10KB code size, 1ms timeout)

## Emergency Rollback Procedures

### Scenario 1: Bad Function Deployment

If a CloudFront Function breaks routing:

1. Navigate to **Functions** in CloudFront console
2. Select the problematic function
3. Click **Publishing history** tab
4. Click **View** on previous working version
5. Click **Publish this version**
6. Verify immediately with test traffic

**ETA:** 2-3 minutes for function rollback to propagate

### Scenario 2: Wrong Behavior Configuration

If a behavior change causes issues:

1. Navigate to **Behaviors** tab
2. Select the problematic behavior
3. Click **Edit**
4. Restore previous settings (have backup documentation ready)
5. Click **Save changes**

**ETA:** 5-10 minutes for behavior change to propagate

### Scenario 3: Bad Code Deployment

If deployed SPA code is broken:

1. **Quick Fix:** Invalidate cache, redeploy previous working version
   ```bash
   aws s3 sync s3://backup-bucket/finanzas-v1.2.3/ s3://finanzas-ui-bucket/finanzas/ --delete
   aws cloudfront create-invalidation --distribution-id EPOU7PVDLQXUA --paths "/finanzas/*"
   ```

2. **Alternative:** Point behavior to a backup origin temporarily

**ETA:** 3-5 minutes for invalidation, 2-3 minutes for S3 sync

### Post-Incident Actions

1. Document the incident and root cause
2. Review change management process
3. Update this guide with lessons learned
4. Consider implementing:
   - Blue/green deployments
   - Canary releases
   - Automated smoke tests

## Checklists

### Pre-Deployment Checklist

- [ ] Code reviewed and tested locally
- [ ] S3 buckets have space for new assets
- [ ] Backup of previous version exists
- [ ] CloudFront Functions tested with sample URIs
- [ ] Invalidation plan prepared
- [ ] Rollback plan documented
- [ ] Monitoring dashboard open
- [ ] Stakeholders notified

### Post-Deployment Checklist

- [ ] Invalidation completed successfully
- [ ] Test key user flows (deep links, refresh, navigation)
- [ ] Check CloudFront metrics for errors
- [ ] Verify no increase in origin requests
- [ ] Test OAuth callback flow
- [ ] Confirm cross-SPA navigation works
- [ ] Monitor for 15 minutes post-deployment
- [ ] Update deployment log

### Monthly Maintenance Checklist

- [ ] Review CloudFront access logs for errors
- [ ] Check cache hit ratio metrics
- [ ] Verify S3 bucket sizes (cleanup old assets)
- [ ] Review CloudFront costs and optimization opportunities
- [ ] Test emergency rollback procedures
- [ ] Update documentation with any changes
- [ ] Verify all behaviors and functions still configured correctly

## Additional Resources

- [AWS CloudFront Console](https://console.aws.amazon.com/cloudfront/v3/home)
- [CloudFront Functions Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
- [CloudFront Troubleshooting Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/troubleshooting.html)
- [S3 Origin Configuration](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html)

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Maintained By:** Ikusi Digital Platform Team  
**Review Cadence:** Quarterly
