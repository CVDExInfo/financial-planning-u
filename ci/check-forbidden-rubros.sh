#!/bin/bash
##
## CI Pre-Merge Check: Forbidden Legacy Rubro Tokens
##
## PURPOSE:
## Scans repository for known legacy rubro tokens that should not appear in code.
## Prevents committing non-canonical rubro IDs like "mod-lead-ingeniero-delivery".
##
## USAGE:
##   bash ci/check-forbidden-rubros.sh
##
## EXIT CODES:
##   0 - No forbidden tokens found
##   1 - Forbidden tokens detected (fails CI)
##

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CI Check: Forbidden Legacy Rubro Tokens"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# List of forbidden legacy tokens
FORBIDDEN_TOKENS=(
  "mod-lead-ingeniero-delivery"
  "mod-sdm-service-delivery-manager"
  "mod-pm"
  "mod-pmo"
  "mod-engr"
  "rubro-mod-pm"
  "rubro-mod-pmo"
)

# Directories to exclude from search
EXCLUDE_DIRS=(
  "node_modules"
  ".git"
  "dist"
  "build"
  ".next"
  "coverage"
  ".terraform"
  "vendor"
)

# Build exclude arguments for git grep
EXCLUDE_ARGS=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS:(exclude)$dir/*"
done

FOUND_ISSUES=0
TOTAL_MATCHES=0

echo "🔍 Scanning repository for forbidden legacy rubro tokens..."
echo

for token in "${FORBIDDEN_TOKENS[@]}"; do
  echo -n "  Checking for: $token ... "
  
  # Use git grep to search (respects .gitignore and is faster)
  if git grep -i -n "$token" -- . "$EXCLUDE_ARGS" 2>/dev/null; then
    echo "❌ FOUND"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
    TOTAL_MATCHES=$((TOTAL_MATCHES + $(git grep -i -c "$token" -- . "$EXCLUDE_ARGS" 2>/dev/null | wc -l)))
  else
    echo "✅ OK"
  fi
done

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FOUND_ISSUES -gt 0 ]; then
  echo "❌ FAIL: Found $FOUND_ISSUES forbidden token(s) with $TOTAL_MATCHES total occurrence(s)"
  echo
  echo "REMEDIATION:"
  echo "  - Replace legacy tokens with canonical IDs (e.g., mod-pm → MOD-LEAD)"
  echo "  - Use getCanonicalRubroId() to handle legacy mappings at runtime"
  echo "  - Remove hardcoded legacy IDs from test fixtures"
  echo
  echo "CANONICAL MAPPINGS:"
  echo "  mod-lead-ingeniero-delivery → MOD-LEAD"
  echo "  mod-sdm-service-delivery-manager → MOD-SDM"
  echo "  mod-pm / mod-pmo → MOD-LEAD"
  echo
  exit 1
else
  echo "✅ PASS: No forbidden legacy rubro tokens found"
  echo
  exit 0
fi
