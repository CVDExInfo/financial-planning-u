# Finanzas Cognito Callback Routing Validation (2025-01)

## Findings
- `npm run build:finanzas` outputs `dist-finanzas/finanzas/auth/callback.html`, confirming the callback page is bundled alongside the Finanzas SPA artifacts.
- Infra audit data shows the S3 bucket already contains `finanzas/auth/callback.html` under the deployed prefix, so the static callback file is present at the origin.
- The CloudFront viewer-request function explicitly bypasses SPA rewrites for `/finanzas/auth/callback.html`, so the request should be served from S3 rather than being redirected to `index.html`.
- Vite config builds the Finanzas app with `base: /finanzas/` and emits the bundle to `dist-finanzas/`, aligning the callback path with the deployed prefix.

## Conclusion
Because CloudFront skips rewrites for the callback path and the file exists in both the build output and the bucket, React Router cannot intercept `/finanzas/auth/callback.html`. No additional routing exception in `App.tsx` is required beyond the existing CloudFront configuration.
