#!/usr/bin/env bash
set -euo pipefail

: "${VITE_API_BASE_URL:?VITE_API_BASE_URL is required}"
: "${VITE_COGNITO_DOMAIN:?VITE_COGNITO_DOMAIN is required}"
: "${VITE_CLOUDFRONT_URL:?VITE_CLOUDFRONT_URL is required}"

echo "🔍 Running Finanzas build verification..."

npm run build:finanzas

if [ ! -f dist-finanzas/index.html ]; then
  echo "❌ dist-finanzas/index.html not found after build"
  exit 1
fi

ASSET_PATHS=$(python - <<'PY'
from pathlib import Path
import re
data = Path("dist-finanzas/index.html").read_text(encoding="utf-8", errors="ignore")
paths = sorted(set(re.findall(r"/finanzas/assets/[^\"']+\.(?:js|css)", data)))
print("\n".join(paths))
PY
)
if [ -z "$ASSET_PATHS" ]; then
  echo "❌ No /finanzas/assets references found in dist-finanzas/index.html"
  exit 1
fi

echo "📋 Assets referenced in dist-finanzas/index.html:"
echo "$ASSET_PATHS"

MISSING=0
while IFS= read -r PATH; do
  RELATIVE_PATH="${PATH#/finanzas/}"
  if [ ! -f "dist-finanzas/${RELATIVE_PATH}" ]; then
    echo "❌ Missing local asset: dist-finanzas/${RELATIVE_PATH}"
    MISSING=1
  else
    echo "✅ Found local asset: dist-finanzas/${RELATIVE_PATH}"
  fi
done <<< "$ASSET_PATHS"

if [ "$MISSING" -ne 0 ]; then
  echo "❌ Build verification failed: missing local assets"
  exit 1
fi

echo "✅ Build verification passed"
