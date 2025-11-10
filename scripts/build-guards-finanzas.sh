#!/usr/bin/env bash
#
# Finanzas Build Guards - CI/CD Quality Gates
# 
# This script validates the Finanzas build output to ensure:
# 1. Base path is correctly set to /finanzas/
# 2. No hardcoded development URLs (github.dev, codespaces, githubusercontent)
# 3. Required environment variables are set
#
# Usage:
#   ./scripts/build-guards-finanzas.sh [--skip-env-check]
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUILD_DIR="dist-finanzas"
INDEX_FILE="${BUILD_DIR}/index.html"
SKIP_ENV_CHECK=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-env-check)
      SKIP_ENV_CHECK=true
      shift
      ;;
  esac
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Finanzas Build Guards - CI/CD Quality Gates                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

FAILED_CHECKS=0

# ============================================================
# Guard 1: Build Artifacts Exist
# ============================================================
echo -e "${BLUE}📦 Guard 1: Build Artifacts Existence${NC}"
echo "────────────────────────────────────────────────────────────────"

if [ ! -d "$BUILD_DIR" ]; then
  echo -e "${RED}❌ FAILED: Build directory not found: $BUILD_DIR${NC}"
  echo "   Run: BUILD_TARGET=finanzas npm run build"
  ((FAILED_CHECKS++))
else
  echo -e "${GREEN}✅ PASS: Build directory exists${NC}"
fi

if [ ! -f "$INDEX_FILE" ]; then
  echo -e "${RED}❌ FAILED: index.html not found: $INDEX_FILE${NC}"
  ((FAILED_CHECKS++))
else
  echo -e "${GREEN}✅ PASS: index.html exists${NC}"
fi

echo ""

# ============================================================
# Guard 2: Base Path Verification (/finanzas/)
# ============================================================
echo -e "${BLUE}📍 Guard 2: Base Path Verification${NC}"
echo "────────────────────────────────────────────────────────────────"

if [ -f "$INDEX_FILE" ]; then
  # Check for incorrect /assets/ paths (should be /finanzas/assets/)
  if grep -E 'src="/assets/|href="/assets/' "$INDEX_FILE" > /dev/null 2>&1; then
    echo -e "${RED}❌ FAILED: index.html uses incorrect /assets/* paths${NC}"
    echo "   Found paths without /finanzas/ prefix:"
    grep -nE 'src="/assets/|href="/assets/' "$INDEX_FILE" | sed 's/^/   /'
    echo ""
    echo "   This indicates vite.config.ts base is not set correctly."
    echo "   Expected: base: '/finanzas/'"
    echo "   Check: BUILD_TARGET=finanzas environment variable"
    ((FAILED_CHECKS++))
  else
    echo -e "${GREEN}✅ PASS: No incorrect /assets/* paths found${NC}"
  fi

  # Check for correct /finanzas/assets/ paths
  if grep -E 'src="/finanzas/assets/|href="/finanzas/assets/' "$INDEX_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS: Correct /finanzas/assets/* paths found${NC}"
    ASSET_COUNT=$(grep -oE 'src="/finanzas/assets/|href="/finanzas/assets/' "$INDEX_FILE" | wc -l)
    echo "   Asset references: $ASSET_COUNT"
  else
    echo -e "${YELLOW}⚠️  WARNING: No /finanzas/assets/* paths found${NC}"
    echo "   This might be OK if build has no assets, but verify manually."
  fi
else
  echo -e "${RED}❌ FAILED: Cannot verify base path - index.html missing${NC}"
  ((FAILED_CHECKS++))
fi

echo ""

# ============================================================
# Guard 3: Hardcoded Development URL Checks
# ============================================================
echo -e "${BLUE}🔍 Guard 3: Development URL Detection${NC}"
echo "────────────────────────────────────────────────────────────────"

DEV_URL_PATTERNS=(
  "github\.dev"
  "codespaces"
  "githubusercontent\.com"
  "localhost:3000"
  "127\.0\.0\.1"
)

FOUND_DEV_URLS=false

for pattern in "${DEV_URL_PATTERNS[@]}"; do
  if grep -r -i -E "$pattern" "$BUILD_DIR" 2>/dev/null | grep -v ".map" | grep -v "node_modules" > /dev/null 2>&1; then
    if [ "$FOUND_DEV_URLS" = false ]; then
      echo -e "${RED}❌ FAILED: Development URLs found in build${NC}"
      FOUND_DEV_URLS=true
      ((FAILED_CHECKS++))
    fi
    echo "   Pattern: $pattern"
    grep -r -i -E "$pattern" "$BUILD_DIR" 2>/dev/null | grep -v ".map" | grep -v "node_modules" | head -3 | sed 's/^/   /'
  fi
done

if [ "$FOUND_DEV_URLS" = false ]; then
  echo -e "${GREEN}✅ PASS: No development URLs found${NC}"
  echo "   Checked patterns: ${DEV_URL_PATTERNS[*]}"
fi

echo ""

# ============================================================
# Guard 4: Environment Variables Validation (Optional)
# ============================================================
if [ "$SKIP_ENV_CHECK" = false ]; then
  echo -e "${BLUE}⚙️  Guard 4: Environment Variables Validation${NC}"
  echo "────────────────────────────────────────────────────────────────"

  REQUIRED_ENV_VARS=(
    "VITE_API_BASE_URL"
    "VITE_FINZ_ENABLED"
  )

  MISSING_VARS=()

  for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
      MISSING_VARS+=("$var")
    else
      echo -e "${GREEN}✅ $var=${!var}${NC}"
    fi
  done

  if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  WARNING: Missing environment variables (non-critical):${NC}"
    for var in "${MISSING_VARS[@]}"; do
      echo "   - $var"
    done
    echo "   Note: Build may have used defaults. Verify .env or CI config."
  fi

  echo ""
else
  echo -e "${BLUE}⚙️  Guard 4: Environment Variables Validation${NC}"
  echo "────────────────────────────────────────────────────────────────"
  echo -e "${YELLOW}⚠️  SKIPPED (--skip-env-check flag provided)${NC}"
  echo ""
fi

# ============================================================
# Guard 5: Asset File Integrity
# ============================================================
echo -e "${BLUE}📄 Guard 5: Asset File Integrity${NC}"
echo "────────────────────────────────────────────────────────────────"

if [ -d "$BUILD_DIR/assets" ]; then
  JS_COUNT=$(find "$BUILD_DIR/assets" -name "*.js" 2>/dev/null | wc -l)
  CSS_COUNT=$(find "$BUILD_DIR/assets" -name "*.css" 2>/dev/null | wc -l)
  
  if [ "$JS_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ FAILED: No JavaScript files found in assets${NC}"
    ((FAILED_CHECKS++))
  else
    echo -e "${GREEN}✅ PASS: JavaScript files found: $JS_COUNT${NC}"
  fi

  if [ "$CSS_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ FAILED: No CSS files found in assets${NC}"
    ((FAILED_CHECKS++))
  else
    echo -e "${GREEN}✅ PASS: CSS files found: $CSS_COUNT${NC}"
  fi
else
  echo -e "${RED}❌ FAILED: Assets directory not found${NC}"
  ((FAILED_CHECKS++))
fi

echo ""

# ============================================================
# Summary
# ============================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        Summary                                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
  echo -e "${GREEN}✅ All build guards passed!${NC}"
  echo ""
  echo "   Build is ready for deployment:"
  echo "   - Base path: /finanzas/ ✅"
  echo "   - No dev URLs: ✅"
  echo "   - Assets present: ✅"
  echo ""
  exit 0
else
  echo -e "${RED}❌ $FAILED_CHECKS check(s) failed${NC}"
  echo ""
  echo "   Please fix the issues above before deploying."
  echo ""
  echo "   Common fixes:"
  echo "   1. Ensure BUILD_TARGET=finanzas is set"
  echo "   2. Check vite.config.ts base: '/finanzas/'"
  echo "   3. Remove any hardcoded dev URLs from source"
  echo "   4. Rebuild: BUILD_TARGET=finanzas npm run build"
  echo ""
  exit 1
fi
