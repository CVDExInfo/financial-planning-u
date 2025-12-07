# Multi-SPA CloudFront Architecture

## Overview

The Finanzas SD platform uses a **single CloudFront distribution** to serve **multiple independent Single Page Applications (SPAs)**:

- **Finanzas SPA** (this repository): Served under `/finanzas/*`
- **Prefacturas SPA** (acta-ui-pre-factura repository): Served under `/prefacturas/*`

This architecture allows both applications to:
- Share a single domain and CloudFront distribution
- Maintain independent codebases and deployment pipelines
- Navigate between each other via full page redirects
- Use separate S3 origins and CloudFront Functions for routing

## Architecture Diagram

```
CloudFront Distribution (d7t9x3j66yd8k.cloudfront.net)
│
├── /finanzas/*
│   ├── Origin: finanzas-ui-s3 (S3 bucket via OAC)
│   ├── CloudFront Function: finanzas-rewrite
│   │   └── Rewrites /finanzas/* → /finanzas/index.html (SPA routing)
│   └── Behaviors:
│       ├── /finanzas
│       ├── /finanzas/
│       └── /finanzas/*
│
├── /prefacturas/*
│   ├── Origin: prefactura-ui-s3 (S3 bucket via OAC: prefactura-ui-oac)
│   ├── CloudFront Function: prefactura-rewrite
│   │   └── Rewrites /prefacturas/* → /prefacturas/index.html (SPA routing)
│   └── Behaviors:
│       ├── /prefacturas
│       ├── /prefacturas/
│       └── /prefacturas/*
│
└── Default (*)
    └── Origin: acta-ui-frontend-prod.s3-website.us-east-2.amazonaws.com
```

## Finanzas SPA Configuration

### 1. Build Configuration

**File:** `vite.config.ts`

```typescript
const buildTarget = process.env.BUILD_TARGET || "finanzas";
const isPmo = buildTarget === "pmo";

export default defineConfig(() => ({
  base: isPmo ? "/" : "/finanzas/",
  build: {
    outDir: isPmo ? "dist-pmo" : "dist-finanzas",
  },
}));
```

**Key Points:**
- When `BUILD_TARGET=finanzas`, the build outputs to `dist-finanzas/` with `base: "/finanzas/"`
- All asset URLs (JS, CSS, images) are prefixed with `/finanzas/`
- Deploy `dist-finanzas/` contents to S3 bucket under the `finanzas/` prefix

### 2. Router Configuration

**File:** `src/App.tsx`

```typescript
const BASENAME =
  import.meta.env.VITE_PUBLIC_BASE ||
  import.meta.env.VITE_APP_BASENAME ||
  "/finanzas";

function App() {
  const basename = normalizeBase(BASENAME);
  
  return (
    <BrowserRouter basename={basename.replace(/\/$/, "")}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

**Key Points:**
- `basename="/finanzas"` tells React Router all routes are under this prefix
- Internal routes are defined WITHOUT the `/finanzas` prefix:
  - `<Route path="/" />` → resolves to `/finanzas/`
  - `<Route path="/catalog/rubros" />` → resolves to `/finanzas/catalog/rubros`
- Use `<Link to="/catalog/rubros">` for internal navigation

### 3. CloudFront Function

**File:** `infra/cloudfront-function-finanzas-rewrite.js`

```javascript
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Redirect /finanzas to /finanzas/ (preserves querystring)
  if (uri === "/finanzas") {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "/finanzas/" + queryString },
      },
    };
  }

  // Never rewrite the Cognito callback page
  if (uri === "/finanzas/auth/callback.html") {
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

  // All other paths (assets) pass through to S3
  return request;
}
```

**Purpose:**
- Enables client-side routing by serving `index.html` for all non-file routes
- Preserves direct file access for assets (`.js`, `.css`, `.png`, etc.)
- Protects the OAuth callback page from rewriting

## Prefacturas SPA Configuration

### 1. Expected Build Configuration

**Repository:** `CVDExInfo/acta-ui-pre-factura`

```typescript
// vite.config.ts
export default defineConfig(() => ({
  base: "/prefacturas/",
  build: {
    outDir: "dist",
  },
}));
```

### 2. Expected Router Configuration

```typescript
// src/App.tsx
<BrowserRouter basename="/prefacturas">
  {/* Routes defined without /prefacturas prefix */}
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={<Dashboard />} />
</BrowserRouter>
```

### 3. CloudFront Function

**Repository:** `CVDExInfo/acta-ui-pre-factura`  
**File:** `cloudfront-function.js`

```javascript
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

## Navigation Between SPAs

### From Finanzas to Prefacturas

**Use full page navigation** (NOT React Router):

```typescript
// ✅ CORRECT: Full page navigation
const PREFACTURAS_LOGIN = "/prefacturas/login";
const navigateToPrefacturas = () => window.location.assign(PREFACTURAS_LOGIN);

// ❌ WRONG: Would try to handle route in Finanzas Router
<Link to="/prefacturas/login">Go to Prefacturas</Link>
```

**Current Implementation:**

1. **HomePage.tsx** (Line 16):
   ```typescript
   const prefacturasEntryPath = "/prefacturas/login";
   const navigateToPrefacturas = () => window.location.assign(prefacturasEntryPath);
   ```

2. **LoginPage.tsx** (Lines 63-67):
   ```typescript
   const rawPrefacturasUrl = import.meta.env.VITE_PREFACTURAS_URL?.trim();
   const PREFACTURAS_PORTAL_LOGIN =
     rawPrefacturasUrl && rawPrefacturasUrl.length > 0
       ? rawPrefacturasUrl
       : "https://d7t9x3j66yd8k.cloudfront.net/prefacturas/login";
   ```

### From Prefacturas to Finanzas

**Use full page navigation:**

```typescript
// In Prefacturas SPA
const FINANZAS_HOME = "/finanzas/";
const navigateToFinanzas = () => window.location.assign(FINANZAS_HOME);
```

### Why Full Page Navigation?

1. **Independent Routing:** Each SPA has its own React Router instance
2. **Clean State:** Full page load ensures no state bleeding between apps
3. **Separate Auth Flows:** Each app can have different authentication requirements
4. **Simplified Debugging:** Easier to trace issues when apps are isolated

## CloudFront Behaviors Configuration

### Required Behaviors for Finanzas

| Path Pattern | Origin | Cache Policy | Origin Request Policy | Function Association |
|--------------|--------|--------------|----------------------|---------------------|
| `/finanzas` | finanzas-ui-s3 | CachingDisabled | CORS-S3Origin | finanzas-rewrite (Viewer Request) |
| `/finanzas/` | finanzas-ui-s3 | CachingDisabled | CORS-S3Origin | finanzas-rewrite (Viewer Request) |
| `/finanzas/*` | finanzas-ui-s3 | CachingDisabled | CORS-S3Origin | finanzas-rewrite (Viewer Request) |

### Required Behaviors for Prefacturas

| Path Pattern | Origin | Cache Policy | Origin Request Policy | Function Association |
|--------------|--------|--------------|----------------------|---------------------|
| `/prefacturas` | prefactura-ui-s3 | CachingDisabled | CORS-S3Origin | prefactura-rewrite (Viewer Request) |
| `/prefacturas/` | prefactura-ui-s3 | CachingDisabled | CORS-S3Origin | prefactura-rewrite (Viewer Request) |
| `/prefacturas/*` | prefactura-ui-s3 | CachingDisabled | CORS-S3Origin | prefactura-rewrite (Viewer Request) |

**Behavior Order (Most Specific First):**
1. `/finanzas/*` (0)
2. `/finanzas/` (1)
3. `/finanzas` (2)
4. `/prefacturas/*` (3)
5. `/prefacturas/` (4)
6. `/prefacturas` (5)
7. API/doc behaviors (if any)
8. Default `(*)` (last)

### CloudFront Origin Configuration

**Finanzas Origin:**
- Name: `finanzas-ui-s3`
- Domain: S3 bucket hosting Finanzas build
- Origin Access: Origin Access Control (OAC)

**Prefacturas Origin:**
- Name: `prefactura-ui-s3`
- Domain: S3 bucket hosting Prefacturas build
- Origin Access: OAC `prefactura-ui-oac`

## Environment Variables

### Finanzas SPA (.env.production)

```bash
# Vite build configuration
VITE_PUBLIC_BASE=/finanzas/
BUILD_TARGET=finanzas

# CloudFront URL
VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net

# Cognito OAuth redirects
VITE_COGNITO_REDIRECT_SIGNIN=https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html
VITE_COGNITO_REDIRECT_SIGNOUT=https://d7t9x3j66yd8k.cloudfront.net/finanzas/

# Prefacturas portal entry point (optional override)
VITE_PREFACTURAS_URL=https://d7t9x3j66yd8k.cloudfront.net/prefacturas/login

# API configuration
VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev
```

### Prefacturas SPA (.env.production)

```bash
# Vite build configuration
VITE_PUBLIC_BASE=/prefacturas/
BUILD_TARGET=prefacturas  # If using similar build system

# CloudFront URL
VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net

# Cognito OAuth redirects
VITE_COGNITO_REDIRECT_SIGNIN=https://d7t9x3j66yd8k.cloudfront.net/prefacturas/auth/callback.html
VITE_COGNITO_REDIRECT_SIGNOUT=https://d7t9x3j66yd8k.cloudfront.net/prefacturas/

# Finanzas entry point (if needed)
VITE_FINANZAS_URL=https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

## Cognito Configuration

### Allowed Callback URLs

Both SPAs need their callback URLs registered:

```
https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html
https://d7t9x3j66yd8k.cloudfront.net/finanzas/
https://d7t9x3j66yd8k.cloudfront.net/prefacturas/auth/callback.html
https://d7t9x3j66yd8k.cloudfront.net/prefacturas/
```

### Allowed Sign-out URLs

```
https://d7t9x3j66yd8k.cloudfront.net/finanzas/
https://d7t9x3j66yd8k.cloudfront.net/prefacturas/
```

## Deployment Workflow

### Finanzas Deployment

1. **Build:**
   ```bash
   npm run build:finanzas
   # Outputs to: dist-finanzas/
   ```

2. **Deploy to S3:**
   ```bash
   aws s3 sync dist-finanzas/ s3://finanzas-ui-bucket/finanzas/ \
     --delete \
     --cache-control "max-age=31536000,public,immutable" \
     --exclude "*.html" \
     --exclude "auth/callback.html"
   
   # HTML files: short cache
   aws s3 sync dist-finanzas/ s3://finanzas-ui-bucket/finanzas/ \
     --cache-control "max-age=0,no-cache,no-store,must-revalidate" \
     --content-type "text/html" \
     --include "*.html"
   ```

3. **Invalidate CloudFront:**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id EPOU7PVDLQXUA \
     --paths "/finanzas/*" "/finanzas" "/finanzas/"
   ```

### Prefacturas Deployment

1. **Build:**
   ```bash
   npm run build
   # Outputs to: dist/
   ```

2. **Deploy to S3:**
   ```bash
   aws s3 sync dist/ s3://prefactura-ui-bucket/prefacturas/ \
     --delete \
     --cache-control "max-age=31536000,public,immutable" \
     --exclude "*.html"
   
   aws s3 sync dist/ s3://prefactura-ui-bucket/prefacturas/ \
     --cache-control "max-age=0,no-cache,no-store,must-revalidate" \
     --content-type "text/html" \
     --include "*.html"
   ```

3. **Invalidate CloudFront:**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id EPOU7PVDLQXUA \
     --paths "/prefacturas/*" "/prefacturas" "/prefacturas/"
   ```

## Testing Checklist

### Finanzas SPA Tests

- [ ] Direct access to `/finanzas/` loads the app
- [ ] Deep links work: `/finanzas/catalog/rubros`, `/finanzas/projects`
- [ ] Refresh on any route stays on that route
- [ ] Assets load correctly (check Network tab for 200s)
- [ ] OAuth callback works: `/finanzas/auth/callback.html`
- [ ] Navigation to Prefacturas via button performs full page navigation
- [ ] No console errors related to routing

### Prefacturas SPA Tests

- [ ] Direct access to `/prefacturas/` loads the app
- [ ] Deep links work: `/prefacturas/login`, `/prefacturas/dashboard`
- [ ] Refresh on any route stays on that route
- [ ] Assets load correctly
- [ ] OAuth callback works: `/prefacturas/auth/callback.html`
- [ ] Navigation to Finanzas via button performs full page navigation
- [ ] No console errors related to routing

### Cross-SPA Navigation Tests

- [ ] Navigate from Finanzas → Prefacturas: Full page load occurs
- [ ] Navigate from Prefacturas → Finanzas: Full page load occurs
- [ ] Browser back button works correctly after cross-SPA navigation
- [ ] Auth tokens persist across navigation (same Cognito pool)

## Troubleshooting

### Issue: 403 Forbidden on SPA routes

**Cause:** CloudFront Function not attached or not rewriting correctly

**Fix:**
1. Verify CloudFront Function is deployed
2. Confirm Function is attached to Viewer Request on behaviors
3. Test Function in CloudFront console with sample URIs

### Issue: Assets return 404

**Cause:** Incorrect S3 upload path or asset URL prefix

**Fix:**
1. Verify `base: "/finanzas/"` in vite.config.ts
2. Check S3 bucket structure: files should be under `finanzas/` prefix
3. Inspect Network tab to see actual requested URLs

### Issue: React Router shows 404 on refresh

**Cause:** CloudFront not rewriting to index.html

**Fix:**
1. Update CloudFront Function to handle routes without extensions
2. Verify Function association on all three behaviors
3. Create CloudFront invalidation after Function update

### Issue: OAuth callback fails

**Cause:** Callback URL not whitelisted in Cognito

**Fix:**
1. Add exact callback URL to Cognito App Client settings
2. Ensure CloudFront Function does NOT rewrite callback.html
3. Verify callback.html exists in S3 at correct path

### Issue: Cross-SPA navigation uses React Router

**Cause:** Using `<Link to="/prefacturas/...">` instead of `window.location.assign()`

**Fix:**
1. Replace `<Link>` with button that calls `window.location.assign()`
2. Never use React Router for cross-SPA navigation
3. Keep navigation external to current SPA's routing context

## Best Practices

1. **Keep SPAs Completely Independent:**
   - No shared state or context between apps
   - Each app manages its own authentication
   - Use full page navigation for cross-app links

2. **Use Environment Variables:**
   - Store cross-app URLs in env vars (VITE_PREFACTURAS_URL)
   - Allows different values for dev/staging/prod
   - Easier to update without code changes

3. **CloudFront Function Isolation:**
   - One function per SPA path prefix
   - Don't mix logic for multiple SPAs in one function
   - Easier to maintain and debug

4. **Deployment Isolation:**
   - Each SPA has its own S3 prefix
   - Invalidate only the paths for the SPA being deployed
   - Deploy independently without affecting other SPAs

5. **Testing:**
   - Test deep links and refreshes thoroughly
   - Verify cross-SPA navigation performs full page load
   - Check both apps after CloudFront invalidations

## References

- [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md) - Cognito integration details
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [CloudFront Functions Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
- [React Router Basename Documentation](https://reactrouter.com/en/main/routers/create-browser-router#opts.basename)
- [Vite base Option](https://vitejs.dev/config/shared-options.html#base)

---

**Last Updated:** December 2024  
**Distribution ID:** EPOU7PVDLQXUA  
**Maintainers:** Ikusi Digital Platform Team
