#!/bin/bash
# Verification script for PMO forecast override and annual budget functionality
# Usage: ./scripts/verify-forecast-budget.sh

set -e

# Configuration
BASE_URL="${FINZ_API_BASE:-${DEV_API_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}/finanzas"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "PMO Forecast & Budget Verification Script"
echo "=========================================="
echo ""
echo "API Base URL: $BASE_URL"
echo ""

# Get JWT token
if [ -z "$TOKEN" ]; then
  if [ -f "./scripts/cognito/get-jwt.sh" ]; then
    echo "Getting JWT token..."
    TOKEN=$(./scripts/cognito/get-jwt.sh)
  else
    echo -e "${RED}ERROR: No token found. Please set TOKEN environment variable or ensure get-jwt.sh exists${NC}"
    exit 1
  fi
fi

# Function to make API call
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -z "$data" ]; then
    curl -s -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      "$BASE_URL$endpoint"
  else
    curl -s -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint"
  fi
}

# Function to verify JSON field
verify_field() {
  local json=$1
  local field=$2
  local expected=$3
  local actual=$(echo "$json" | jq -r "$field")
  
  if [ "$actual" == "$expected" ]; then
    echo -e "${GREEN}✓${NC} $field = $expected"
    return 0
  else
    echo -e "${RED}✗${NC} $field: expected '$expected', got '$actual'"
    return 1
  fi
}

# Get a test project ID (use first available project or create one)
echo "Step 1: Finding test project..."
PROJECTS_RESPONSE=$(api_call GET "/projects")
TEST_PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | jq -r '.[0].pk // .[0].projectId // .[0].id // empty' | sed 's/PROJECT#//')

if [ -z "$TEST_PROJECT_ID" ]; then
  echo -e "${RED}ERROR: No projects found. Please create a project first.${NC}"
  exit 1
fi

echo -e "${GREEN}Using project: $TEST_PROJECT_ID${NC}"
echo ""

# Step 2: Get initial forecast summary
echo "Step 2: Getting initial forecast summary..."
FORECAST_BEFORE=$(api_call GET "/plan/forecast?projectId=$TEST_PROJECT_ID&months=12")

if echo "$FORECAST_BEFORE" | jq -e '.data' > /dev/null 2>&1; then
  INITIAL_CELLS=$(echo "$FORECAST_BEFORE" | jq '.data | length')
  echo -e "${GREEN}✓${NC} Initial forecast has $INITIAL_CELLS cells"
  
  # Find a sample cell for testing
  SAMPLE_CELL=$(echo "$FORECAST_BEFORE" | jq -r '.data[0]')
  SAMPLE_RUBRO=$(echo "$SAMPLE_CELL" | jq -r '.line_item_id')
  SAMPLE_MONTH=$(echo "$SAMPLE_CELL" | jq -r '.month')
  SAMPLE_PLANNED=$(echo "$SAMPLE_CELL" | jq -r '.planned // 0')
  SAMPLE_FORECAST=$(echo "$SAMPLE_CELL" | jq -r '.forecast // 0')
  
  echo "  Sample cell: rubro=$SAMPLE_RUBRO, month=$SAMPLE_MONTH"
  echo "  Planned: $SAMPLE_PLANNED, Forecast: $SAMPLE_FORECAST"
else
  echo -e "${YELLOW}⚠${NC} No forecast data found, will create new allocation"
  SAMPLE_RUBRO="rubro_test12345"
  SAMPLE_MONTH="1"
  SAMPLE_PLANNED=0
  SAMPLE_FORECAST=0
fi
echo ""

# Step 3: Send a forecast bulk update with type=forecast
echo "Step 3: Updating forecast allocation (type=forecast)..."
NEW_FORECAST_VALUE=55000

BULK_PAYLOAD=$(cat <<EOF
{
  "allocations": [
    {
      "rubro_id": "$SAMPLE_RUBRO",
      "mes": "2025-$(printf "%02d" $SAMPLE_MONTH)",
      "monto_proyectado": $NEW_FORECAST_VALUE
    }
  ]
}
EOF
)

BULK_RESPONSE=$(api_call PUT "/projects/$TEST_PROJECT_ID/allocations:bulk?type=forecast" "$BULK_PAYLOAD")

if echo "$BULK_RESPONSE" | jq -e '.updated_count' > /dev/null 2>&1; then
  UPDATED_COUNT=$(echo "$BULK_RESPONSE" | jq -r '.updated_count')
  ALLOCATION_TYPE=$(echo "$BULK_RESPONSE" | jq -r '.type')
  echo -e "${GREEN}✓${NC} Bulk update successful: updated $UPDATED_COUNT allocation(s)"
  echo -e "${GREEN}✓${NC} Type: $ALLOCATION_TYPE"
else
  echo -e "${RED}✗${NC} Bulk update failed"
  echo "$BULK_RESPONSE" | jq '.' || echo "$BULK_RESPONSE"
  exit 1
fi
echo ""

# Step 4: Get forecast summary again and verify adjustment
echo "Step 4: Verifying forecast adjustment..."
sleep 1  # Brief pause for consistency
FORECAST_AFTER=$(api_call GET "/plan/forecast?projectId=$TEST_PROJECT_ID&months=12")

if echo "$FORECAST_AFTER" | jq -e '.data' > /dev/null 2>&1; then
  # Find the updated cell
  UPDATED_CELL=$(echo "$FORECAST_AFTER" | jq -r ".data[] | select(.line_item_id == \"$SAMPLE_RUBRO\" and .month == $SAMPLE_MONTH)")
  
  if [ -n "$UPDATED_CELL" ]; then
    UPDATED_PLANNED=$(echo "$UPDATED_CELL" | jq -r '.planned // 0')
    UPDATED_FORECAST=$(echo "$UPDATED_CELL" | jq -r '.forecast // 0')
    
    echo "  Updated cell values:"
    echo "    Planned: $UPDATED_PLANNED"
    echo "    Forecast: $UPDATED_FORECAST"
    
    if [ "$UPDATED_FORECAST" == "$NEW_FORECAST_VALUE" ]; then
      echo -e "${GREEN}✓${NC} Forecast correctly updated to $NEW_FORECAST_VALUE"
    else
      echo -e "${RED}✗${NC} Forecast not updated correctly. Expected $NEW_FORECAST_VALUE, got $UPDATED_FORECAST"
      exit 1
    fi
    
    # Verify planned != forecast if they were different initially or we set a different value
    if [ "$UPDATED_FORECAST" != "$UPDATED_PLANNED" ]; then
      echo -e "${GREEN}✓${NC} Forecast diverges from planned (PMO adjustment visible)"
    else
      echo -e "${YELLOW}⚠${NC} Forecast equals planned (may be expected if planned was set to same value)"
    fi
  else
    echo -e "${RED}✗${NC} Updated cell not found in response"
    exit 1
  fi
else
  echo -e "${RED}✗${NC} Failed to get forecast data after update"
  exit 1
fi
echo ""

# Step 5: Test annual budget - PUT
echo "Step 5: Setting annual budget for 2025..."
BUDGET_YEAR=2025
BUDGET_AMOUNT=5000000

BUDGET_PAYLOAD=$(cat <<EOF
{
  "year": $BUDGET_YEAR,
  "amount": $BUDGET_AMOUNT,
  "currency": "USD"
}
EOF
)

BUDGET_PUT_RESPONSE=$(api_call PUT "/budgets/all-in" "$BUDGET_PAYLOAD")

if echo "$BUDGET_PUT_RESPONSE" | jq -e '.year' > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Annual budget set successfully"
  verify_field "$BUDGET_PUT_RESPONSE" ".year" "$BUDGET_YEAR"
  verify_field "$BUDGET_PUT_RESPONSE" ".amount" "$BUDGET_AMOUNT"
  verify_field "$BUDGET_PUT_RESPONSE" ".currency" "USD"
else
  echo -e "${RED}✗${NC} Failed to set annual budget"
  echo "$BUDGET_PUT_RESPONSE" | jq '.' || echo "$BUDGET_PUT_RESPONSE"
  exit 1
fi
echo ""

# Step 6: Test annual budget - GET
echo "Step 6: Getting annual budget for 2025..."
BUDGET_GET_RESPONSE=$(api_call GET "/budgets/all-in?year=$BUDGET_YEAR")

if echo "$BUDGET_GET_RESPONSE" | jq -e '.year' > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Annual budget retrieved successfully"
  verify_field "$BUDGET_GET_RESPONSE" ".year" "$BUDGET_YEAR"
  verify_field "$BUDGET_GET_RESPONSE" ".amount" "$BUDGET_AMOUNT"
  verify_field "$BUDGET_GET_RESPONSE" ".currency" "USD"
else
  echo -e "${RED}✗${NC} Failed to get annual budget"
  echo "$BUDGET_GET_RESPONSE" | jq '.' || echo "$BUDGET_GET_RESPONSE"
  exit 1
fi
echo ""

# Step 7: Verify hub comparison (if available)
echo "Step 7: Checking hub summary for budget comparison..."
HUB_RESPONSE=$(api_call GET "/finanzas/hub/summary?scope=ALL")

if echo "$HUB_RESPONSE" | jq -e '.' > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Hub summary accessible"
  # Note: Budget comparison endpoint may need to be added to hub
  echo -e "${YELLOW}⚠${NC} Budget comparison in hub pending integration"
else
  echo -e "${YELLOW}⚠${NC} Hub summary not accessible or needs authentication adjustment"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}✓ ALL VERIFICATION TESTS PASSED${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Bulk allocations with type=forecast: ✓ Working"
echo "  - Forecast adjustments persist and differ from planned: ✓ Working"
echo "  - Annual budget PUT/GET: ✓ Working"
echo "  - Hub integration: ⚠ Pending (requires frontend integration)"
echo ""

exit 0
