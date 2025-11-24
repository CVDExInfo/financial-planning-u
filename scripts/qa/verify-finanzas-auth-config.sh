#!/usr/bin/env bash
#
# QA Guardrails for Finanzas authentication callback assets
# - Ensures the canonical callback page ships from public/auth/callback.html
# - Prevents nested /finanzas/finanzas/auth/callback.html artifacts in dist-finanzas
# - Verifies the callback writes the tokens AuthProvider expects and redirects to /finanzas/

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

header() {
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║   Finanzas Auth Callback Guardrails                            ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
}

pass() { echo -e "${GREEN}✅ $1${NC}"; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { echo -e "${RED}❌ $1${NC}"; FAIL_COUNT=$((FAIL_COUNT+1)); }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

header

# Guard 1: Canonical callback file location
if [ -f "public/auth/callback.html" ]; then
  pass "public/auth/callback.html present (deploys to /finanzas/auth/callback.html)"
else
  fail "Missing canonical callback file at public/auth/callback.html"
fi

# Guard 2: No nested /finanzas/auth copy in public/
if [ -f "public/finanzas/auth/callback.html" ]; then
  fail "Unexpected callback at public/finanzas/auth/callback.html (would deploy to /finanzas/finanzas/auth/callback.html)"
else
  pass "No nested callback under public/finanzas/auth (avoids /finanzas/finanzas/* keys)"
fi

target="public/auth/callback.html"
if [ -f "$target" ]; then
  # Guard 3: Token storage keys
  if grep -q 'localStorage.setItem("cv.jwt"' "$target" && grep -q 'localStorage.setItem("finz_jwt"' "$target"; then
    pass "Callback writes cv.jwt and finz_jwt token keys"
  else
    fail "Callback is missing token storage for cv.jwt/finz_jwt"
  fi

  # Guard 4: Redirect destination
  if grep -q 'window.location.replace("/finanzas/")' "$target"; then
    pass "Callback redirects to /finanzas/ after processing"
  else
    fail "Callback does not redirect to /finanzas/"
  fi
fi

echo ""
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "${GREEN}All auth callback guardrails satisfied (${PASS_COUNT} checks).${NC}"
  exit 0
else
  echo -e "${RED}Auth callback guardrails failed: $FAIL_COUNT issue(s) detected.${NC}"
  exit 1
fi
