#!/bin/bash
#
# QA Full Review - Finanzas Module End-to-End Testing
# 
# This script performs a comprehensive functional review of the Finanzas UI and API
# to validate all features work correctly before production deployment.
#
# Usage:
#   export USERNAME="christian.valencia@ikusi.com"
#   export PASSWORD="<your-password>"
#   bash scripts/qa-full-review.sh
#

set -euo pipefail

# ============ CONFIGURATION ============
REGION="us-east-2"
API_BASE="https://m3g6am67aj.execute-api.${REGION}.amazonaws.com/dev"
CF_URL="https://d7t9x3j66yd8k.cloudfront.net"
FINANZAS_URL="${CF_URL}/finanzas"
APP_CLIENT="dshos5iou44tuach7ta3ici5m"
COGNITO_POOL_ID="us-east-2_FyHLtOhiY"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Require credentials
USERNAME="${USERNAME:?ERROR: set USERNAME env var}"
PASSWORD="${PASSWORD:?ERROR: set PASSWORD env var}"

# Helper functions
pass() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
  ((PASSED_TESTS++))
  ((TOTAL_TESTS++))
}

fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  ((FAILED_TESTS++))
  ((TOTAL_TESTS++))
}

skip() {
  echo -e "${YELLOW}⏭️  SKIP${NC}: $1"
  ((SKIPPED_TESTS++))
  ((TOTAL_TESTS++))
}

info() {
  echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

section() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║ $1"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
}

# ============ BANNER ============
clear
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║     QA FULL REVIEW - FINANZAS MODULE                          ║"
echo "║     Comprehensive End-to-End Testing                          ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
info "Test Environment: Development (dev stage)"
info "API Base URL: $API_BASE"
info "UI URL: $FINANZAS_URL"
info "Test User: $USERNAME"
echo ""

# ============ SECTION 1: AUTHENTICATION ============
section "SECTION 1: Authentication & Token Validation"

info "Authenticating with Cognito..."
ID_TOKEN=$(aws cognito-idp initiate-auth \
  --region "$REGION" \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$APP_CLIENT" \
  --auth-parameters "USERNAME=$USERNAME,PASSWORD=$PASSWORD" \
  --query "AuthenticationResult.IdToken" \
  --output text 2>/dev/null || echo "FAILED")

if [[ "$ID_TOKEN" == "FAILED" || -z "$ID_TOKEN" || "$ID_TOKEN" == "None" ]]; then
  fail "Could not obtain IdToken from Cognito"
  exit 1
fi

pass "Successfully obtained IdToken from Cognito"

# Verify token structure
PAYLOAD=$(echo "$ID_TOKEN" | cut -d'.' -f2)
CLAIMS=$(echo "$PAYLOAD" | base64 -d 2>/dev/null | jq . 2>/dev/null || echo "{}")
TOKEN_AUD=$(echo "$CLAIMS" | jq -r '.aud // "unknown"' 2>/dev/null)
TOKEN_GROUPS=$(echo "$CLAIMS" | jq -r '."cognito:groups" // [] | join(", ")' 2>/dev/null)

if [[ "$TOKEN_AUD" == "$APP_CLIENT" ]]; then
  pass "Token audience matches app client ID"
else
  fail "Token audience mismatch (got: $TOKEN_AUD, expected: $APP_CLIENT)"
fi

info "User groups: $TOKEN_GROUPS"

if [[ "$TOKEN_GROUPS" == *"SDT"* ]] || [[ "$TOKEN_GROUPS" == *"FIN"* ]]; then
  pass "User has required Finanzas access groups"
else
  fail "User missing required groups (SDT or FIN)"
fi

# ============ SECTION 2: API HEALTH CHECK ============
section "SECTION 2: API Health & Public Endpoints"

info "Testing GET /health (public endpoint)..."
HEALTH_CODE=$(curl -sS -o /tmp/health.json -w '%{http_code}' "$API_BASE/health" 2>/dev/null || echo "000")
HEALTH_BODY=$(cat /tmp/health.json 2>/dev/null || echo "{}")

if [[ "$HEALTH_CODE" == "200" ]]; then
  pass "GET /health returns 200"
  info "Response: $(echo $HEALTH_BODY | jq -c . 2>/dev/null || echo $HEALTH_BODY)"
else
  fail "GET /health returns $HEALTH_CODE (expected 200)"
fi

# ============ SECTION 3: CATALOG RUBROS ============
section "SECTION 3: Catalog - Rubros"

info "Testing GET /catalog/rubros..."
RUBROS_CODE=$(curl -sS -o /tmp/rubros.json -w '%{http_code}' \
  -H "Authorization: Bearer $ID_TOKEN" \
  "$API_BASE/catalog/rubros" 2>/dev/null || echo "000")
RUBROS_BODY=$(cat /tmp/rubros.json 2>/dev/null || echo "{}")

if [[ "$RUBROS_CODE" == "200" ]]; then
  pass "GET /catalog/rubros returns 200"
  
  # Count rubros
  RUBROS_COUNT=$(echo "$RUBROS_BODY" | jq '.data | length' 2>/dev/null || echo "0")
  info "Rubros count: $RUBROS_COUNT"
  
  if [[ "$RUBROS_COUNT" -gt "0" ]]; then
    pass "Rubros data contains $RUBROS_COUNT items"
    
    # Verify structure of first rubro
    FIRST_RUBRO=$(echo "$RUBROS_BODY" | jq '.data[0]' 2>/dev/null)
    HAS_ID=$(echo "$FIRST_RUBRO" | jq 'has("rubro_id")' 2>/dev/null)
    HAS_NOMBRE=$(echo "$FIRST_RUBRO" | jq 'has("nombre")' 2>/dev/null)
    
    if [[ "$HAS_ID" == "true" ]] && [[ "$HAS_NOMBRE" == "true" ]]; then
      pass "Rubro structure contains required fields (rubro_id, nombre)"
    else
      fail "Rubro structure missing required fields"
    fi
    
    # Display sample
    info "Sample rubro: $(echo $FIRST_RUBRO | jq -c '.' 2>/dev/null)"
  else
    fail "Rubros response is empty"
  fi
else
  fail "GET /catalog/rubros returns $RUBROS_CODE (expected 200)"
  info "Response: $RUBROS_BODY"
fi

# ============ SECTION 4: ALLOCATION RULES ============
section "SECTION 4: Allocation Rules"

info "Testing GET /allocation-rules..."
RULES_CODE=$(curl -sS -o /tmp/rules.json -w '%{http_code}' \
  -H "Authorization: Bearer $ID_TOKEN" \
  "$API_BASE/allocation-rules" 2>/dev/null || echo "000")
RULES_BODY=$(cat /tmp/rules.json 2>/dev/null || echo "{}")

if [[ "$RULES_CODE" == "200" ]]; then
  pass "GET /allocation-rules returns 200"
  
  # Count rules
  RULES_COUNT=$(echo "$RULES_BODY" | jq 'length' 2>/dev/null || echo "0")
  info "Rules count: $RULES_COUNT"
  
  if [[ "$RULES_COUNT" -gt "0" ]]; then
    pass "Rules data contains $RULES_COUNT items"
    
    # Display sample
    FIRST_RULE=$(echo "$RULES_BODY" | jq '.[0]' 2>/dev/null)
    info "Sample rule: $(echo $FIRST_RULE | jq -c '.' 2>/dev/null)"
  else
    fail "Rules response is empty"
  fi
else
  fail "GET /allocation-rules returns $RULES_CODE (expected 200)"
  info "Response: $RULES_BODY"
fi

# ============ SECTION 5: ADDITIONAL API ENDPOINTS ============
section "SECTION 5: Additional API Endpoints (Exploratory)"

# Test projects endpoint
info "Testing GET /projects..."
PROJECTS_CODE=$(curl -sS -o /tmp/projects.json -w '%{http_code}' \
  -H "Authorization: Bearer $ID_TOKEN" \
  "$API_BASE/projects" 2>/dev/null || echo "000")

if [[ "$PROJECTS_CODE" == "200" ]]; then
  pass "GET /projects returns 200"
  PROJECTS_COUNT=$(cat /tmp/projects.json | jq 'length' 2>/dev/null || echo "0")
  info "Projects count: $PROJECTS_COUNT"
elif [[ "$PROJECTS_CODE" == "501" ]]; then
  skip "GET /projects not implemented (501)"
elif [[ "$PROJECTS_CODE" == "403" ]]; then
  info "GET /projects forbidden (403) - may require additional permissions"
else
  info "GET /projects returns $PROJECTS_CODE"
fi

# Test adjustments endpoint
info "Testing GET /adjustments..."
ADJ_CODE=$(curl -sS -o /tmp/adjustments.json -w '%{http_code}' \
  -H "Authorization: Bearer $ID_TOKEN" \
  "$API_BASE/adjustments" 2>/dev/null || echo "000")

if [[ "$ADJ_CODE" == "200" ]]; then
  pass "GET /adjustments returns 200"
elif [[ "$ADJ_CODE" == "501" ]]; then
  skip "GET /adjustments not implemented (501)"
elif [[ "$ADJ_CODE" == "403" ]]; then
  info "GET /adjustments forbidden (403)"
else
  info "GET /adjustments returns $ADJ_CODE"
fi

# Test movements endpoint
info "Testing GET /movements..."
MOV_CODE=$(curl -sS -o /tmp/movements.json -w '%{http_code}' \
  -H "Authorization: Bearer $ID_TOKEN" \
  "$API_BASE/movements" 2>/dev/null || echo "000")

if [[ "$MOV_CODE" == "200" ]]; then
  pass "GET /movements returns 200"
elif [[ "$MOV_CODE" == "501" ]]; then
  skip "GET /movements not implemented (501)"
elif [[ "$MOV_CODE" == "403" ]]; then
  info "GET /movements forbidden (403)"
else
  info "GET /movements returns $MOV_CODE"
fi

# ============ SECTION 6: UNAUTHORIZED ACCESS TEST ============
section "SECTION 6: Security & Access Control"

info "Testing unauthorized access (no token)..."
UNAUTH_CODE=$(curl -sS -o /tmp/unauth.json -w '%{http_code}' \
  "$API_BASE/catalog/rubros" 2>/dev/null || echo "000")

if [[ "$UNAUTH_CODE" == "401" ]] || [[ "$UNAUTH_CODE" == "403" ]]; then
  pass "Unauthorized request properly rejected ($UNAUTH_CODE)"
else
  fail "Unauthorized request returned $UNAUTH_CODE (expected 401 or 403)"
fi

# Test with invalid token
info "Testing with invalid token..."
INVALID_CODE=$(curl -sS -o /tmp/invalid.json -w '%{http_code}' \
  -H "Authorization: Bearer invalid-token-12345" \
  "$API_BASE/catalog/rubros" 2>/dev/null || echo "000")

if [[ "$INVALID_CODE" == "401" ]] || [[ "$INVALID_CODE" == "403" ]]; then
  pass "Invalid token properly rejected ($INVALID_CODE)"
else
  fail "Invalid token returned $INVALID_CODE (expected 401 or 403)"
fi

# ============ FINAL SUMMARY ============
section "TEST SUMMARY"

echo "Total Tests:   $TOTAL_TESTS"
echo "Passed:        $PASSED_TESTS"
echo "Failed:        $FAILED_TESTS"
echo "Skipped:       $SKIPPED_TESTS"
echo ""

if [[ $FAILED_TESTS -eq 0 ]]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                   ALL TESTS PASSED ✅                          ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                  SOME TESTS FAILED ❌                          ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
  exit 1
fi
