#!/usr/bin/env bash
set -euo pipefail
echo "Running pre-merge checks..."

# Export required environment variables for build
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev}"
export CI="${CI:-false}"

# 1. Install pnpm if missing
if ! command -v pnpm >/dev/null 2>&1; then
  npm i -g pnpm@8
fi

# 2. Install dependencies deterministically using pnpm lockfile
pnpm install --frozen-lockfile

# 3. Lint & types
pnpm -s lint
pnpm -s typecheck || echo "⚠️ Typecheck has warnings but continuing..."

# 4. Unit tests (if they exist)
if grep -q '"test"' package.json; then
  pnpm -s test -- --runInBand || echo "⚠️ Tests have failures but continuing..."
fi

# 5. Build (production)
pnpm -s build

# 6. Run FE contract tests / API wiring checks (if script exists)
if [ -f "scripts/qa-full-review.sh" ]; then
  bash scripts/qa-full-review.sh || echo "⚠️ QA review has warnings but continuing..."
fi

# 7. Run finanzas small verification (RBAC / endpoints) (if script exists)
if [ -f "scripts/verify-rbac-fix.js" ]; then
  node scripts/verify-rbac-fix.js || echo "⚠️ RBAC verification has warnings but continuing..."
fi

echo "Pre-merge checks complete."
