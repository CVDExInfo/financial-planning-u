# Finanzas Cognito Canonical Configuration

This configuration keeps the Finanzas (SDT) UI aligned with the working acta-ui setup and removes hard-coded Cognito identifiers from the code. Values are now driven entirely by environment variables.

## Canonical Cognito values
- **User pool ID:** `us-east-2_FyHLtOhiY`
- **App client ID:** `dshos5iou44tuach7ta3ici5m` (Ikusi-acta-ui-web)
- **Domain:** `us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com`
- **OAuth flow:** Implicit (`response_type=token`), scopes: `openid email profile aws.cognito.signin.user.admin`
- **Allowed callback URLs:**
  - `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
  - `https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html`
- **Allowed logout URLs:**
  - `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
  - `https://d7t9x3j66yd8k.cloudfront.net/finanzas/login`

## Required environment variables
Set these for every Finanzas build/deployment:

```
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com
VITE_COGNITO_REDIRECT_SIGNIN=https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html
VITE_COGNITO_REDIRECT_SIGNOUT=https://d7t9x3j66yd8k.cloudfront.net/finanzas/
VITE_COGNITO_REGION=us-east-2
VITE_AWS_REGION=us-east-2
```

## Alignment checks
- `public/auth/callback.html` ships in the build, so `/finanzas/auth/callback.html` remains available in S3/CloudFront.
- The SPA CloudFront function must **not** rewrite `/finanzas/auth/callback.html`; other extension-less `/finanzas/*` paths should still route to `/finanzas/index.html`.
- Amazon Verified Permissions and any Cognito identity pools should reference the same user pool and client ID listed above.
