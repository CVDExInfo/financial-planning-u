#!/usr/bin/env bash
###############################################################################
# scripts/examples/validate-api-only.sh
#
# Example: Validate API health endpoints only
#
# This example shows how to run only API health checks without AWS
# infrastructure validation.
#
# Usage:
#   export API_URL=https://api.example.com/dev
#   bash scripts/examples/validate-api-only.sh
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║             API HEALTH VALIDATION EXAMPLE                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Verify API_URL is set
if [ -z "${API_URL:-}" ]; then
  echo "❌ ERROR: API_URL environment variable is required"
  echo ""
  echo "Set it with:"
  echo "  export API_URL=https://api.example.com/dev"
  exit 2
fi

PROJECT_ID="${PROJECT_ID:-P-d9d24218-692f-4702-b860-c205a2aa45b2}"

echo "Configuration:"
echo "  API_URL:    $API_URL"
echo "  PROJECT_ID: $PROJECT_ID"
echo ""
echo "Testing API endpoints..."
echo ""

# Run validation with only API checks enabled
cd "$ROOT_DIR"
bash scripts/validate-e2e-system.sh \
  --api-url "$API_URL" \
  --project-id "$PROJECT_ID" \
  --skip-aws \
  --skip-ui \
  --output "/tmp/api-validation-$(date +%Y%m%d-%H%M%S).txt"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ API validation passed! All endpoints returning expected responses."
else
  echo "❌ API validation failed. Check the output above for details."
fi

exit $EXIT_CODE
