#!/usr/bin/env bash
###############################################################################
# scripts/examples/validate-ci-only.sh
#
# Example: Run only CI checks (fast validation for pre-commit)
#
# This example shows how to run only the CI checks for quick validation
# during development or as a pre-commit hook.
#
# Usage:
#   bash scripts/examples/validate-ci-only.sh
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              CI CHECKS ONLY VALIDATION EXAMPLE                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Running fast CI validation checks..."
echo ""

cd "$ROOT_DIR"

EXIT_CODE=0

# Run canonical rubros check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Canonical Rubros Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if node ci/check-canonical-rubros.cjs; then
  echo "✅ Canonical rubros check passed"
else
  echo "❌ Canonical rubros check failed"
  EXIT_CODE=1
fi

echo ""

# Run forbidden rubros check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Forbidden Rubros Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "ci/check-forbidden-rubros.sh" ]; then
  if bash ci/check-forbidden-rubros.sh; then
    echo "✅ Forbidden rubros check passed"
  else
    echo "❌ Forbidden rubros check failed"
    EXIT_CODE=1
  fi
else
  echo "⚠️  Forbidden rubros check script not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All CI checks passed!"
else
  echo "❌ Some CI checks failed. Please fix issues before committing."
fi

exit $EXIT_CODE
