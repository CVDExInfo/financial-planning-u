#!/usr/bin/env bash
###############################################################################
# scripts/examples/validate-staging.sh
#
# Example: Validate staging environment with full AWS integration
#
# This example shows how to run comprehensive validation against a staging
# environment with AWS services (S3, Lambda, DynamoDB, etc.)
#
# Usage:
#   export AWS_PROFILE=staging
#   export API_URL=https://api-staging.example.com/dev
#   bash scripts/examples/validate-staging.sh
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            STAGING ENVIRONMENT VALIDATION EXAMPLE              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Verify required environment variables
if [ -z "${API_URL:-}" ]; then
  echo "❌ ERROR: API_URL environment variable is required"
  echo ""
  echo "Set it with:"
  echo "  export API_URL=https://api-staging.example.com/dev"
  exit 2
fi

if [ -z "${AWS_PROFILE:-}" ]; then
  echo "⚠️  WARNING: AWS_PROFILE not set, using default AWS credentials"
  echo ""
fi

# Configuration for staging
PROJECT_ID="${PROJECT_ID:-P-d9d24218-692f-4702-b860-c205a2aa45b2}"
BASELINE_ID="${BASELINE_ID:-base_staging_test}"
TAX_BUCKET="${TAX_BUCKET:-ukusi-ui-finanzas-prod}"
TAX_KEY="${TAX_KEY:-taxonomy/rubros.taxonomy.json}"

echo "Configuration:"
echo "  API_URL:     $API_URL"
echo "  PROJECT_ID:  $PROJECT_ID"
echo "  BASELINE_ID: $BASELINE_ID"
echo "  TAX_BUCKET:  $TAX_BUCKET"
echo "  TAX_KEY:     $TAX_KEY"
echo "  AWS_REGION:  ${AWS_REGION:-us-east-1}"
echo ""
echo "Starting validation..."
echo ""

# Run full validation
cd "$ROOT_DIR"
bash scripts/validate-e2e-system.sh \
  --project-id "$PROJECT_ID" \
  --baseline-id "$BASELINE_ID" \
  --tax-bucket "$TAX_BUCKET" \
  --tax-key "$TAX_KEY" \
  --api-url "$API_URL" \
  --output "/tmp/staging-validation-$(date +%Y%m%d-%H%M%S).txt"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Staging validation passed! System is ready for production."
else
  echo "❌ Staging validation failed. Review issues above before deploying to production."
fi

exit $EXIT_CODE
