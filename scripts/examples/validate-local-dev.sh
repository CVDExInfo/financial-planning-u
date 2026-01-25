#!/usr/bin/env bash
###############################################################################
# scripts/examples/validate-local-dev.sh
#
# Example: Validate local development environment without AWS
#
# This example shows how to run validation for local development where AWS
# services are not available or AWS credentials are not configured.
#
# Usage:
#   bash scripts/examples/validate-local-dev.sh
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         LOCAL DEVELOPMENT VALIDATION EXAMPLE                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This example validates the system in a local development"
echo "environment without AWS services."
echo ""

# Run validation with AWS and UI checks skipped
cd "$ROOT_DIR"
bash scripts/validate-e2e-system.sh \
  --skip-aws \
  --skip-ui \
  --output "/tmp/local-dev-validation-$(date +%Y%m%d-%H%M%S).txt"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Local validation passed!"
else
  echo "⚠️  Local validation completed with issues. Review the output above."
fi

exit $EXIT_CODE
