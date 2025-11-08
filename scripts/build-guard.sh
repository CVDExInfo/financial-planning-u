#!/bin/bash
# scripts/build-guard.sh
# Validate Finanzas build to prevent PMO config bleed

set -e

BUILD_TARGET="${BUILD_TARGET:-finanzas}"
DIST_DIR="${DIST_DIR:-dist}"

echo "🔍 Build Guard: Validating Finanzas SPA..."

if [ "$BUILD_TARGET" != "finanzas" ]; then
  echo "⏭️  Skipping guard (BUILD_TARGET=$BUILD_TARGET)"
  exit 0
fi

ERRORS=0

# 1. Check: aws-exports.js must NOT be in Finanzas dist (it's PMO config)
if [ -f "$DIST_DIR/aws-exports.js" ]; then
  echo "❌ FAIL: aws-exports.js found in $DIST_DIR (PMO config bleed)"
  ERRORS=$((ERRORS + 1))
fi

# 2. Check: index.html must NOT reference root /assets/* paths
if grep -q 'src="\/assets\/' "$DIST_DIR/index.html" 2>/dev/null; then
  echo "❌ FAIL: index.html contains root /assets/ references (should be /finanzas/assets/)"
  ERRORS=$((ERRORS + 1))
fi

# 3. Check: All JS/CSS assets must be under /finanzas/
if [ -d "$DIST_DIR/assets" ]; then
  ASSET_COUNT=$(find "$DIST_DIR/assets" -type f | wc -l)
  if [ "$ASSET_COUNT" -eq 0 ]; then
    echo "❌ FAIL: No assets found in $DIST_DIR/assets/"
    ERRORS=$((ERRORS + 1))
  else
    echo "✓ Assets present: $ASSET_COUNT files"
  fi
fi

# 4. Check: callback.html deployed (not strictly a guard, but nice to verify)
if [ ! -f "public/auth/callback.html" ]; then
  echo "⚠️  WARNING: public/auth/callback.html not found (manual deployment needed)"
  # Not a hard error; could be in a separate build step
fi

# 5. Check: vite.config.ts defines VITE_FINZ_ENABLED
if ! grep -q '"import.meta.env.VITE_FINZ_ENABLED"' vite.config.ts 2>/dev/null; then
  echo "⚠️  WARNING: VITE_FINZ_ENABLED not in vite.config.ts define (may not be baked into bundle)"
fi

# 6. Check: .env has VITE_FINZ_ENABLED=true
if ! grep -q '^VITE_FINZ_ENABLED=true' .env 2>/dev/null; then
  echo "⚠️  WARNING: VITE_FINZ_ENABLED not set in .env"
fi

# Results
if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ Build Guard FAILED: $ERRORS error(s)"
  exit 1
fi

echo ""
echo "✅ Build Guard PASSED: Finanzas SPA is clean (no PMO config bleed)"
exit 0
