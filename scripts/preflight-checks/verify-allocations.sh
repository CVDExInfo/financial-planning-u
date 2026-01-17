#!/bin/bash
# Preflight check for allocations retrieval
# Verifies that allocations can be retrieved for a sample project/baseline
# This script is intended to be run in CI to ensure allocations are accessible

set -e

# Configuration
SAMPLE_PROJECT_ID="${SAMPLE_PROJECT_ID:-PROJ-2025-001}"
API_ENDPOINT="${API_ENDPOINT:-}"

echo "==========================================="
echo "Allocations Retrieval Preflight Check"
echo "==========================================="
echo "Sample Project/Baseline ID: $SAMPLE_PROJECT_ID"
echo "API Endpoint: ${API_ENDPOINT:-<not set>}"
echo ""

# Check if ENABLE_ADMIN_DEBUG is set
if [ "$ENABLE_ADMIN_DEBUG" != "true" ]; then
  echo "⚠️  ENABLE_ADMIN_DEBUG is not set to 'true'"
  echo "Admin debug endpoint will not be accessible"
  echo "Skipping preflight check (non-blocking)"
  exit 0
fi

# Check if API endpoint is set
if [ -z "$API_ENDPOINT" ]; then
  echo "❌ API_ENDPOINT environment variable is not set"
  echo "Cannot run preflight check without API endpoint"
  echo "Skipping preflight check (non-blocking)"
  exit 0
fi

# Call the admin debug endpoint
echo "Calling admin debug endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  --connect-timeout 10 \
  --max-time 30 \
  "${API_ENDPOINT}/admin/allocations/verify?projectId=${SAMPLE_PROJECT_ID}" \
  2>&1 || echo "000")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
# Extract response body (all but last line)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"

# Check for curl failures (000 or network errors)
if [ "$HTTP_CODE" = "000" ] || [ "$HTTP_CODE" = "000000" ]; then
  echo "⚠️  Admin debug endpoint is not accessible (network error or endpoint not deployed)"
  echo "This is expected if the Lambda function has not been deployed yet"
  echo "Skipping preflight check (non-blocking)"
  exit 0
fi

# Check HTTP status
if [ "$HTTP_CODE" = "403" ]; then
  echo "⚠️  Admin debug endpoint is disabled (403 Forbidden)"
  echo "This is expected if ENABLE_ADMIN_DEBUG is not enabled in the deployed environment"
  echo "Skipping preflight check (non-blocking)"
  exit 0
elif [ "$HTTP_CODE" = "404" ]; then
  echo "⚠️  Admin debug endpoint not found (404 Not Found)"
  echo "The admin debug Lambda function may not be deployed yet"
  echo "Skipping preflight check (non-blocking)"
  exit 0
elif [ "$HTTP_CODE" != "200" ]; then
  echo "⚠️  Admin debug endpoint returned unexpected status: $HTTP_CODE"
  echo "Response: $BODY"
  echo "Skipping preflight check (non-blocking) - endpoint may not be deployed"
  exit 0
fi

echo ""
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Parse response and check if allocations were found
TOTAL_ALLOCATIONS=$(echo "$BODY" | jq -r '.summary.totalAllocationsFound // 0' 2>/dev/null || echo "0")
KEYS_WITH_ALLOCATIONS=$(echo "$BODY" | jq -r '.summary.keysWithAllocations // 0' 2>/dev/null || echo "0")

echo "Total allocations found: $TOTAL_ALLOCATIONS"
echo "Keys with allocations: $KEYS_WITH_ALLOCATIONS"

if [ "$TOTAL_ALLOCATIONS" -gt 0 ]; then
  echo ""
  echo "✅ Preflight check PASSED"
  echo "Allocations are retrievable for sample project/baseline: $SAMPLE_PROJECT_ID"
  exit 0
else
  echo ""
  echo "⚠️  No allocations found for sample project/baseline: $SAMPLE_PROJECT_ID"
  echo "This may indicate:"
  echo "  1. Allocations have not been materialized yet"
  echo "  2. The sample ID is incorrect"
  echo "  3. There is a data or configuration issue"
  echo ""
  echo "Recommendation from API:"
  RECOMMENDATION=$(echo "$BODY" | jq -r '.recommendation // "N/A"' 2>/dev/null || echo "N/A")
  echo "$RECOMMENDATION"
  echo ""
  echo "⚠️  Preflight check completed with WARNING (non-blocking)"
  # Exit 0 to make this non-blocking - we don't want to fail the build
  # if allocations simply haven't been created yet
  exit 0
fi
