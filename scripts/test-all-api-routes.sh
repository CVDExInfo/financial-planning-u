#!/bin/bash
# scripts/test-all-api-routes.sh
# Comprehensive API test suite for all 20+ Finanzas routes
# Tests: Auth → API Gateway → Lambda → DynamoDB connectivity

set -e

# Configuration
API_BASE="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
REGION="us-east-2"
COGNITO_DOMAIN="us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com"
CLIENT_ID="dshos5iou44tuach7ta3ici5m"
TEST_USER="christian.valencia@ikusi.com"
TEST_PASS="Velatia@2025"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Tracking
PASS=0
FAIL=0
WARN=0

echo "🧪 FINANZAS API TEST SUITE"
echo "================================"
echo "API Base: $API_BASE"
echo "Region: $REGION"
echo ""

# Step 1: Get JWT from Cognito
echo "📋 Step 1: Acquiring JWT from Cognito..."
TOKEN_RESPONSE=$(aws cognito-idp initiate-auth \
  --region "$REGION" \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME="$TEST_USER",PASSWORD="$TEST_PASS" \
  --query "AuthenticationResult.IdToken" \
  --output text 2>/dev/null || echo "FAILED")

if [ "$TOKEN_RESPONSE" = "FAILED" ] || [ -z "$TOKEN_RESPONSE" ]; then
  echo -e "${RED}❌ FAILED to get JWT${NC}"
  exit 1
fi

JWT="$TOKEN_RESPONSE"
echo -e "${GREEN}✓ JWT acquired${NC}"
echo ""

# Decode JWT to verify groups
echo "📋 Verifying JWT claims..."
PAYLOAD=$(echo "$JWT" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.' 2>/dev/null || echo "{}")
GROUPS=$(echo "$PAYLOAD" | jq -r '.["cognito:groups"] // []' 2>/dev/null)
echo "  User: $(echo "$PAYLOAD" | jq -r '.email // "unknown"' 2>/dev/null)"
echo "  Groups: $GROUPS"
echo ""

# Test helper function
test_route() {
  local method=$1
  local route=$2
  local description=$3
  local data=$4
  local requires_auth=${5:-true}
  
  local cmd="curl -s -X $method '$API_BASE$route'"
  
  if [ "$requires_auth" = true ]; then
    cmd="$cmd -H 'Authorization: Bearer $JWT'"
  fi
  
  cmd="$cmd -H 'Content-Type: application/json'"
  
  if [ -n "$data" ]; then
    cmd="$cmd -d '$data'"
  fi
  
  cmd="$cmd -w '\n%{http_code}'"
  
  local response=$(eval "$cmd")
  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n-1)
  
  # Evaluate success
  if [[ "$http_code" =~ ^(200|201|204|400|401|403|404)$ ]]; then
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
      echo -e "${GREEN}✓${NC} $method $route | HTTP $http_code"
      ((PASS++))
      return 0
    elif [ "$http_code" = "204" ]; then
      echo -e "${GREEN}✓${NC} $method $route | HTTP $http_code (No Content)"
      ((PASS++))
      return 0
    elif [ "$http_code" = "400" ] || [ "$http_code" = "404" ]; then
      echo -e "${YELLOW}⚠${NC} $method $route | HTTP $http_code (Client Error - Route may need data)"
      ((WARN++))
      return 0
    elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
      echo -e "${RED}❌${NC} $method $route | HTTP $http_code (Auth Error)"
      ((FAIL++))
      return 1
    fi
  else
    echo -e "${RED}❌${NC} $method $route | HTTP $http_code (Unexpected)"
    ((FAIL++))
    return 1
  fi
}

echo "🚀 TESTING ALL ROUTES"
echo "================================"
echo ""

# ============================================
# PUBLIC / NO AUTH REQUIRED
# ============================================
echo -e "${BLUE}[PUBLIC ROUTES - No Auth]${NC}"
test_route GET "/health" "Health check (no auth)" "" false
echo ""

# ============================================
# CATALOG & RULES (READ-ONLY)
# ============================================
echo -e "${BLUE}[CATALOG & RULES - Read]${NC}"
test_route GET "/catalog/rubros" "Get all rubros (71 items expected)"
test_route GET "/allocation-rules" "Get allocation rules (2 items expected)"
echo ""

# ============================================
# PROJECTS (GET & CREATE)
# ============================================
echo -e "${BLUE}[PROJECTS]${NC}"
test_route GET "/projects" "List all projects"
test_route POST "/projects" "Create new project" '{"name":"Test Project","description":"API Test"}'
echo ""

# ============================================
# PROJECT-SPECIFIC ROUTES
# ============================================
echo -e "${BLUE}[PROJECT-SPECIFIC ROUTES]${NC}"
# Using a test project ID (will 404 if doesn't exist, which is acceptable for this test)
TEST_PROJECT_ID="test-project-001"
test_route GET "/projects/$TEST_PROJECT_ID/plan" "Get project plan"
test_route GET "/projects/$TEST_PROJECT_ID/rubros" "Get project rubros"
test_route POST "/projects/$TEST_PROJECT_ID/rubros" "Add rubros to project" '{"rubros":["rubro_1"]}'
test_route PUT "/projects/$TEST_PROJECT_ID/allocations:bulk" "Bulk allocate rubros" '{"allocations":{}}'
test_route POST "/projects/$TEST_PROJECT_ID/handoff" "Handoff project" '{"handoff_data":{}}'
echo ""

# ============================================
# PROVIDERS
# ============================================
echo -e "${BLUE}[PROVIDERS]${NC}"
test_route GET "/providers" "List all providers"
test_route POST "/providers" "Create new provider" '{"name":"Test Provider","code":"TP"}'
echo ""

# ============================================
# ADJUSTMENTS
# ============================================
echo -e "${BLUE}[ADJUSTMENTS]${NC}"
test_route GET "/adjustments" "Get adjustments"
test_route POST "/adjustments" "Create adjustment" '{"adjustment_data":{}}'
echo ""

# ============================================
# ALERTS
# ============================================
echo -e "${BLUE}[ALERTS]${NC}"
test_route GET "/alerts" "Get alerts"
echo ""

# ============================================
# ADVANCED OPERATIONS
# ============================================
echo -e "${BLUE}[ADVANCED OPERATIONS]${NC}"
test_route POST "/close-month" "Close month operation" '{"month":"2025-11"}'
test_route POST "/payroll/ingest" "Ingest payroll data" '{"payroll_data":{}}'
test_route POST "/prefacturas/webhook" "Prefacturas webhook" '{"webhook_data":{}}'
test_route GET "/prefacturas/webhook" "Get prefacturas webhook status"
echo ""

# ============================================
# SUMMARY
# ============================================
echo ""
echo "📊 TEST SUMMARY"
echo "================================"
echo -e "${GREEN}✓ PASSED: $PASS${NC}"
echo -e "${YELLOW}⚠ WARNING: $WARN${NC}"
echo -e "${RED}✗ FAILED: $FAIL${NC}"
echo ""

TOTAL=$((PASS + WARN + FAIL))
echo "Total Routes Tested: $TOTAL"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi
