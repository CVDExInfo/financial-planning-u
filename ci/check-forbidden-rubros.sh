#!/usr/bin/env bash
#
# ci/check-forbidden-rubros.sh
#
# Checks for forbidden legacy rubro tokens in the codebase.
# These tokens should be replaced with canonical IDs from the taxonomy.
#
# Exit codes:
#   0 - No forbidden tokens found
#   1 - Forbidden tokens found

set -euo pipefail

# List of known legacy/forbidden rubro tokens that should not appear in code
FORBIDDEN=(
  "mod-lead-ingeniero-delivery"
  "mod-sdm-service-delivery-manager"
  "mod-pm-project-manager"
  "mod-ing-ingeniero-soporte-n1"
  "ingeniero-delivery"
  "service-delivery-manager"
  "project-manager"
)

FOUND=0
echo "🔍 Checking for forbidden legacy rubro tokens..."
echo ""

for token in "${FORBIDDEN[@]}"; do
  # Search for the token in source files, excluding node_modules and other non-relevant paths
  if git grep -n --quiet -i "$token" -- \
    ':!node_modules' \
    ':!pnpm-lock.yaml' \
    ':!*.log' \
    ':!*.md' \
    ':!scripts/fix-noncanonical-rubros.js' \
    ':!ci/check-forbidden-rubros.sh' \
    ':!services/finanzas-api/src/lib/canonical-taxonomy.ts' \
    ':!src/lib/rubros/canonical-taxonomy.ts' \
    2>/dev/null; then
    
    echo "❌ ERROR: Found forbidden legacy rubro token: '$token'"
    echo ""
    echo "   Occurrences:"
    git grep -n -i "$token" -- \
      ':!node_modules' \
      ':!pnpm-lock.yaml' \
      ':!*.log' \
      ':!*.md' \
      ':!scripts/fix-noncanonical-rubros.js' \
      ':!ci/check-forbidden-rubros.sh' \
      ':!services/finanzas-api/src/lib/canonical-taxonomy.ts' \
      ':!src/lib/rubros/canonical-taxonomy.ts' || true
    echo ""
    echo "   This token should be replaced with its canonical equivalent from:"
    echo "   - data/rubros.taxonomy.json (canonical IDs like MOD-LEAD, MOD-SDM, etc.)"
    echo "   - Or added to LEGACY_RUBRO_ID_MAP in canonical-taxonomy.ts if needed for backward compatibility"
    echo ""
    FOUND=1
  fi
done

if [ $FOUND -eq 1 ]; then
  echo "❌ FAILED: Forbidden legacy rubro tokens found in codebase"
  echo ""
  echo "To fix:"
  echo "  1. Replace legacy tokens with canonical IDs from data/rubros.taxonomy.json"
  echo "  2. If the token is needed for backward compatibility, add it to LEGACY_RUBRO_ID_MAP"
  echo "     in both canonical-taxonomy.ts files (frontend and backend)"
  echo ""
  exit 1
fi

echo "✅ SUCCESS: No forbidden legacy rubro tokens found"
exit 0
