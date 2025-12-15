#!/bin/bash
# Manual Validation Script for Data Lineage Fix
# This script provides step-by-step validation instructions

set -e

echo "======================================================================"
echo "Data Lineage Regression Fix - Manual Validation Script"
echo "======================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}This script provides manual validation instructions.${NC}"
echo -e "${YELLOW}Follow each step and verify the expected results.${NC}"
echo ""

# Check environment
echo "Step 1: Environment Check"
echo "========================="
echo ""

if [ -z "$API_ENDPOINT" ]; then
    echo -e "${RED}⚠️  API_ENDPOINT not set${NC}"
    echo "Please set: export API_ENDPOINT=https://your-api-endpoint"
    exit 1
fi

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}⚠️  AUTH_TOKEN not set${NC}"
    echo "Please set: export AUTH_TOKEN=your-jwt-token"
    exit 1
fi

echo -e "${GREEN}✓ Environment configured${NC}"
echo "  API_ENDPOINT: $API_ENDPOINT"
echo "  AUTH_TOKEN: [REDACTED]"
echo ""

# Test A: Create baseline and verify
echo "Test A: Create Baseline and Verify Data Lineage"
echo "================================================"
echo ""

BASELINE_ID="base_test_$(date +%s)"
PROJECT_ID="P-lineage-test-$(date +%s)"

echo "Creating baseline..."
BASELINE_RESPONSE=$(curl -s -X POST "$API_ENDPOINT/baseline" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "project_name": "Data Lineage Test Project",
    "client_name": "Test Client",
    "currency": "USD",
    "duration_months": 12,
    "labor_estimates": [{
      "rubroId": "MOD-ING",
      "role": "Engineer",
      "hours_per_month": 160,
      "fte_count": 1,
      "hourly_rate": 50,
      "on_cost_percentage": 30,
      "start_month": 1,
      "end_month": 12
    }],
    "non_labor_estimates": []
  }')

echo "$BASELINE_RESPONSE" | jq .

BASELINE_ID=$(echo "$BASELINE_RESPONSE" | jq -r '.baselineId // .baseline_id')
PROJECT_ID=$(echo "$BASELINE_RESPONSE" | jq -r '.projectId // .project_id')

echo ""
echo -e "${GREEN}✓ Baseline created${NC}"
echo "  Baseline ID: $BASELINE_ID"
echo "  Project ID: $PROJECT_ID"
echo ""

# Create handoff
echo "Creating handoff to link baseline to project..."
HANDOFF_RESPONSE=$(curl -s -X POST "$API_ENDPOINT/projects/$PROJECT_ID/handoff" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "x-idempotency-key: test-lineage-$(date +%s)" \
  -d "{
    \"baseline_id\": \"$BASELINE_ID\",
    \"project_name\": \"Data Lineage Test Project\"
  }")

echo "$HANDOFF_RESPONSE" | jq .

HANDOFF_STATUS=$(echo "$HANDOFF_RESPONSE" | jq -r '.status // "unknown"')

echo ""
if [ "$HANDOFF_STATUS" == "HandoffComplete" ]; then
    echo -e "${GREEN}✓ Handoff created successfully${NC}"
else
    echo -e "${RED}✗ Handoff failed${NC}"
    exit 1
fi
echo ""

# Test B: Attempt to overwrite with different baseline
echo "Test B: Attempt to Overwrite with Different Baseline"
echo "====================================================="
echo ""

NEW_BASELINE_ID="base_overwrite_$(date +%s)"

echo "Creating second baseline for same project (should fail)..."
OVERWRITE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_ENDPOINT/projects/$PROJECT_ID/handoff" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "x-idempotency-key: test-overwrite-$(date +%s)" \
  -d "{
    \"baseline_id\": \"$NEW_BASELINE_ID\",
    \"project_name\": \"Data Lineage Test Project\"
  }")

HTTP_STATUS=$(echo "$OVERWRITE_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$OVERWRITE_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "$RESPONSE_BODY" | jq .

echo ""
if [ "$HTTP_STATUS" == "409" ]; then
    echo -e "${GREEN}✓ Overwrite correctly prevented with 409 Conflict${NC}"
    echo "  Original baseline preserved: $BASELINE_ID"
else
    echo -e "${RED}✗ Overwrite was not prevented! Status: $HTTP_STATUS${NC}"
    exit 1
fi
echo ""

# Verification
echo "Final Verification"
echo "=================="
echo ""

echo "Fetching project metadata to verify baseline_id is unchanged..."
PROJECT_RESPONSE=$(curl -s -X GET "$API_ENDPOINT/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "$PROJECT_RESPONSE" | jq .

CURRENT_BASELINE=$(echo "$PROJECT_RESPONSE" | jq -r '.baseline_id // .baselineId')

echo ""
if [ "$CURRENT_BASELINE" == "$BASELINE_ID" ]; then
    echo -e "${GREEN}✓ Data lineage preserved! baseline_id is unchanged${NC}"
    echo "  Expected: $BASELINE_ID"
    echo "  Actual: $CURRENT_BASELINE"
else
    echo -e "${RED}✗ Data lineage corrupted! baseline_id changed${NC}"
    echo "  Expected: $BASELINE_ID"
    echo "  Actual: $CURRENT_BASELINE"
    exit 1
fi
echo ""

# Summary
echo "======================================================================"
echo -e "${GREEN}All Tests Passed! ✓${NC}"
echo "======================================================================"
echo ""
echo "Summary:"
echo "  1. ✓ Baseline created with stable IDs"
echo "  2. ✓ Handoff linked baseline to project"
echo "  3. ✓ Overwrite prevented with 409 Conflict"
echo "  4. ✓ Data lineage integrity verified"
echo ""
echo "The fix successfully prevents data lineage corruption."
echo ""
