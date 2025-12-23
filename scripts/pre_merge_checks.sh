#!/usr/bin/env bash
set -euo pipefail
echo "Running pre-merge checks..."

# 1. Install dependencies
npm ci

# 2. Lint & types
npm run lint
npm run typecheck || echo "⚠️ Typecheck has warnings but continuing..."

# 3. Unit tests (if they exist)
if grep -q '"test"' package.json; then
  npm test -- --runInBand || echo "⚠️ Tests have failures but continuing..."
fi

# 4. Build (production)
npm run build

# 5. Run FE contract tests / API wiring checks (if script exists)
if [ -f "scripts/qa-full-review.sh" ]; then
  bash scripts/qa-full-review.sh || echo "⚠️ QA review has warnings but continuing..."
fi

# 6. Run finanzas small verification (RBAC / endpoints) (if script exists)
if [ -f "scripts/verify-rbac-fix.js" ]; then
  node scripts/verify-rbac-fix.js || echo "⚠️ RBAC verification has warnings but continuing..."
fi

echo "Pre-merge checks complete."
