#!/bin/bash
# Smoke test for allocations materializer and GET endpoint
# Validates that allocations can be materialized and retrieved via API

set -e

# Configuration
PROJECT_ID="${TEST_PROJECT_ID:-P-7e4fbaf2-dc12-4b22-a75e-1b8bed96a4c7}"
BASELINE_ID="${TEST_BASELINE_ID:-}"
API_ENDPOINT="${FINZ_API_ENDPOINT:-}"
DRY_RUN="${DRY_RUN:-true}"

echo "=== Allocations Smoke Test ==="
echo "Project ID: $PROJECT_ID"
echo "Baseline ID: $BASELINE_ID"
echo "API Endpoint: $API_ENDPOINT"
echo "Dry Run: $DRY_RUN"
echo ""

# Validate required environment variables
if [ -z "$API_ENDPOINT" ]; then
  echo "ERROR: FINZ_API_ENDPOINT environment variable not set"
  echo "Usage: FINZ_API_ENDPOINT=https://api.example.com ./smoke-allocations.sh"
  exit 1
fi

# Step 1: Call admin backfill for test project
echo "Step 1: Calling admin backfill..."
BACKFILL_PAYLOAD=$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "baselineId": "$BASELINE_ID",
  "dryRun": $DRY_RUN
}
EOF
)

BACKFILL_RESPONSE=$(curl -s -X POST \
  "$API_ENDPOINT/admin/backfill" \
  -H "Content-Type: application/json" \
  -d "$BACKFILL_PAYLOAD")

echo "Backfill response: $BACKFILL_RESPONSE"

# Parse allocationsWritten from response
ALLOCATIONS_WRITTEN=$(echo "$BACKFILL_RESPONSE" | grep -o '"allocationsWritten":[0-9]*' | grep -o '[0-9]*' || echo "0")
echo "Allocations written: $ALLOCATIONS_WRITTEN"

if [ "$DRY_RUN" == "false" ] && [ "$ALLOCATIONS_WRITTEN" -eq 0 ]; then
  echo "WARNING: Backfill reported 0 allocations written (could be idempotent)"
fi

# Step 2: Wait a few seconds for eventual consistency
if [ "$DRY_RUN" == "false" ]; then
  echo ""
  echo "Step 2: Waiting 3 seconds for eventual consistency..."
  sleep 3
fi

# Step 3: Call GET /allocations?projectId=...
echo ""
echo "Step 3: Calling GET /allocations..."
GET_RESPONSE=$(curl -s "$API_ENDPOINT/allocations?projectId=$PROJECT_ID")

echo "GET response (first 500 chars): ${GET_RESPONSE:0:500}"

# Parse allocation count from response (should be an array)
ALLOCATION_COUNT=$(echo "$GET_RESPONSE" | grep -o '"pk"' | wc -l || echo "0")
echo "Allocations retrieved: $ALLOCATION_COUNT"

# Step 4: Validate results
echo ""
echo "=== Validation ==="

if [ "$DRY_RUN" == "true" ]; then
  echo "✓ Dry run completed successfully"
  exit 0
fi

if [ "$ALLOCATIONS_WRITTEN" -gt 0 ] && [ "$ALLOCATION_COUNT" -eq 0 ]; then
  echo "✗ FAILED: Backfill wrote $ALLOCATIONS_WRITTEN allocations but GET returned 0"
  echo "This indicates a PK/SK mismatch between materializer and reader"
  exit 1
fi

if [ "$ALLOCATION_COUNT" -gt 0 ]; then
  echo "✓ SUCCESS: Found $ALLOCATION_COUNT allocations via GET endpoint"
  
  # Validate SK format in sample allocation
  SAMPLE_SK=$(echo "$GET_RESPONSE" | grep -o '"sk":"ALLOCATION#[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Sample SK: $SAMPLE_SK"
  
  # SK should be in format: ALLOCATION#{baselineId}#{month}#{rubroId}
  if [[ "$SAMPLE_SK" =~ ^ALLOCATION#[^#]+#[0-9]{4}-[0-9]{2}#.+$ ]]; then
    echo "✓ SK format is correct: ALLOCATION#{baselineId}#{month}#{rubroId}"
  else
    echo "✗ WARNING: SK format may be incorrect: $SAMPLE_SK"
  fi
  
  exit 0
else
  echo "ℹ No allocations found (may be expected if backfill was idempotent)"
  exit 0
fi
