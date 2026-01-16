# TDZ + Build Stability Report (Finanzas)

## Environment
- Branch: `hotfix/tdz-authprovider-89c7b7d`
- Build target: `finanzas`
- Remote sync: `git fetch origin` / `git pull origin main` failed (no `origin` remote configured).

## Build artifacts and hashes
Built with:
- `VITE_API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev`
- `VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com`
- `VITE_CLOUDFRONT_URL=https://d7t9x3j66yd8k.cloudfront.net`

Hashes (post-build):
```
6a32d843f8f50742c0a5460026e13768f87e475f2b559898681c27037b52c02d  dist-finanzas/assets/ikusi-logo-DflFsUgl.png
893137e7b9d35b225cab92c8b188c6ecae99eb65d4c78490aa213c2e09d25b0f  dist-finanzas/assets/index-D5MhL5Hj.css
cdaf9260ed357f05a08547e9b0c8d27d0eb35770493bbcdd5b857b3bad987d56  dist-finanzas/assets/index-8jG8CsH6.js
```

Source maps: none detected in `dist-finanzas/assets` (no `*.map` files).

## TDZ scan
- `node scripts/find-tdz-suspects.js`
- Result: no suspects after moving `initializeAuth` above its first use.

## Circular import scan
- `npx madge --circular src`
- Result: no circular dependencies reported.

## Minified symbol mapping
- Skipped because source maps were not present in `dist-finanzas/assets`.

## Runtime repro
- Local static server repro not executed in this environment.
- No production console stacktrace available locally.
