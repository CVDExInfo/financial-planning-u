#!/usr/bin/env bash
# CI script to enforce that frontend code does not import from canonical-taxonomy directly
# This prevents coupling to internal implementation details

set -e

echo "🔍 Checking for direct canonical-taxonomy imports in frontend code..."

# Search for imports from canonical-taxonomy in src/ directory
# We'll filter out allowed paths manually
VIOLATIONS=$(git grep -n "from ['\"']@/lib/rubros/canonical-taxonomy['\"]" -- 'src/' || true)

# Filter out allowed paths:
# - src/lib/rubros/ (the module itself)
# - src/**/__tests__/ (tests can import internal modules)
VIOLATIONS=$(echo "$VIOLATIONS" | grep -v "^src/lib/rubros/" | grep -v "/__tests__/" || true)

if [ -n "$VIOLATIONS" ]; then
  echo "❌ ERROR: Found frontend files importing canonical-taxonomy directly:"
  echo ""
  echo "$VIOLATIONS"
  echo ""
  echo "Frontend code must use the public API from '@/lib/rubros' instead."
  echo "Available functions: canonicalizeRubroId, getTaxonomyEntry, allRubros, etc."
  echo "See src/lib/rubros/index.ts for the complete public API."
  exit 1
fi

echo "✅ OK: No direct canonical-taxonomy imports found in frontend code."
exit 0
