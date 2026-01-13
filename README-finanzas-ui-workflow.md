# Finanzas UI Deploy Workflow Local Reproduction

Use these steps to reproduce the Finanzas UI build locally and validate the outputs before running the CI workflow.

## Prerequisites

- Node.js >= 18.18
- `npm ci` works with the lockfile
- Known API base URL (dev/prod)

## Steps

```bash
# Checkout the branch or commit you plan to test.
git checkout <branch-or-commit>

# Ensure env values
export VITE_API_BASE_URL="https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev"
export EXPECTED_API_BASE_URL="$VITE_API_BASE_URL"
export VITE_PUBLIC_BASE="/finanzas/"

# Install dependencies
npm ci

# Build Finanzas
npm run build:finanzas

# Check outputs
ls -la dist-finanzas/assets
cat dist-finanzas/build-info.json
sha256sum dist-finanzas/assets/index-*.js dist-finanzas/assets/index-*.css > dist-finanzas-bundle-hashes.txt
cat dist-finanzas-bundle-hashes.txt

# Optionally, start a preview to sanity-check HTML references:
npm run preview:finanzas
# Use curl to fetch the previewed /finanzas/ index and validate /finanzas/assets/ references:
curl -sS http://localhost:5173/finanzas/ -o /tmp/finanzas-local.html
grep -n "/finanzas/assets/" /tmp/finanzas-local.html || true
```

## Expected results

- `dist-finanzas/build-info.json` exists and contains `buildSha` and `buildTimeUtc`.
- `dist-finanzas-bundle-hashes.txt` lists SHA256 for JS/CSS assets.
- `dist-finanzas/index.html` references `/finanzas/assets/` (not `/assets/`).
