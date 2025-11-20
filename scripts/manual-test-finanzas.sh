#!/bin/bash
###############################################################################
# Finanzas SD Module - Manual Testing Script
# 
# This script helps QA engineers test all Finanzas API endpoints and UI
# functionality using credentials from GitHub secrets or environment variables.
#
# Usage:
#   # From GitHub Actions (secrets auto-injected):
#   ./scripts/manual-test-finanzas.sh
#
#   # Local testing with explicit credentials:
#   COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY \
#   COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m \
#   TEST_USERNAME=finanzas-test-user \
#   TEST_PASSWORD=YourPassword123! \
#   API_BASE_URL=https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev \
#   ./scripts/manual-test-finanzas.sh
#
###############################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (use GitHub secrets or env vars)
COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-us-east-2_FyHLtOhiY}"
COGNITO_CLIENT_ID="${COGNITO_CLIENT_ID:-dshos5iou44tuach7ta3ici5m}"
COGNITO_REGION="${COGNITO_REGION:-us-east-2}"
TEST_USERNAME="${TEST_USERNAME:-${USERNAME:-}}"
TEST_PASSWORD="${TEST_PASSWORD:-${PASSWORD:-}}"
API_BASE_URL="${API_BASE_URL:-https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev}"

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Report file
REPORT_FILE="test-results-$(date +%Y%m%d-%H%M%S).md"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_test() {
    echo -e "${YELLOW}▶ TEST:${NC} $1"
}

print_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((TESTS_PASSED++))
    echo "✅ **PASS**: $1" >> "$REPORT_FILE"
}

print_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((TESTS_FAILED++))
    echo "❌ **FAIL**: $1" >> "$REPORT_FILE"
}

print_skip() {
    echo -e "${YELLOW}⊘ SKIP:${NC} $1"
    ((TESTS_SKIPPED++))
    echo "⊘ **SKIP**: $1" >> "$REPORT_FILE"
}

print_info() {
    echo -e "${BLUE}ℹ INFO:${NC} $1"
}

###############################################################################
# Authentication
###############################################################################

authenticate_cognito() {
    print_header "Authentication"
    
    if [[ -z "$TEST_USERNAME" || -z "$TEST_PASSWORD" ]]; then
        print_fail "Missing TEST_USERNAME or TEST_PASSWORD environment variables"
        echo -e "\nPlease set credentials:"
        echo -e "  export TEST_USERNAME=your-username"
        echo -e "  export TEST_PASSWORD=your-password"
        exit 1
    fi
    
    print_test "Authenticating with Cognito (USER_PASSWORD_AUTH)"
    
    # Authenticate and get tokens
    AUTH_RESPONSE=$(aws cognito-idp initiate-auth \
        --region "$COGNITO_REGION" \
        --auth-flow USER_PASSWORD_AUTH \
        --client-id "$COGNITO_CLIENT_ID" \
        --auth-parameters "USERNAME=$TEST_USERNAME,PASSWORD=$TEST_PASSWORD" \
        --query 'AuthenticationResult' \
        --output json 2>&1) || {
        print_fail "Cognito authentication failed: $AUTH_RESPONSE"
        exit 1
    }
    
    # Extract tokens
    export JWT_ID_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.IdToken')
    export JWT_ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.AccessToken')
    export JWT_REFRESH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.RefreshToken')
    
    if [[ -z "$JWT_ID_TOKEN" || "$JWT_ID_TOKEN" == "null" ]]; then
        print_fail "Failed to extract JWT ID token"
        exit 1
    fi
    
    print_pass "Successfully authenticated with Cognito"
    
    # Decode and display token info
    print_info "Token expiration: $(echo "$JWT_ID_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq -r '.exp' | xargs -I {} date -d @{} 2>/dev/null || echo 'Unable to decode')"
    
    # Extract groups/roles
    GROUPS=$(echo "$JWT_ID_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq -r '."cognito:groups" // [] | join(", ")' || echo "")
    print_info "User groups: ${GROUPS:-none}"
}

###############################################################################
# API Tests
###############################################################################

test_api_health() {
    print_header "API Test: Health Check"
    
    print_test "GET /health (no auth required)"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE_URL/health")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        print_pass "Health endpoint returned 200 OK"
        print_info "Response: $BODY"
        echo "\`\`\`json" >> "$REPORT_FILE"
        echo "$BODY" | jq '.' >> "$REPORT_FILE" 2>/dev/null || echo "$BODY" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
    else
        print_fail "Health endpoint returned $HTTP_CODE (expected 200)"
        echo "Response: $BODY" >> "$REPORT_FILE"
    fi
}

test_api_rubros_catalog() {
    print_header "API Test: Rubros Catalog"
    
    print_test "GET /catalog/rubros (public endpoint)"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE_URL/catalog/rubros")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        COUNT=$(echo "$BODY" | jq -r '.data | length' 2>/dev/null || echo "0")
        if [[ "$COUNT" -gt 0 ]]; then
            print_pass "Rubros catalog returned $COUNT items"
            print_info "Sample rubros:"
            echo "$BODY" | jq -r '.data[:3] | .[] | "  - \(.rubro_id): \(.nombre)"' 2>/dev/null || echo "  Unable to parse"
            echo "\`\`\`json" >> "$REPORT_FILE"
            echo "$BODY" | jq '.data[:5]' >> "$REPORT_FILE" 2>/dev/null
            echo "\`\`\`" >> "$REPORT_FILE"
        else
            print_fail "Rubros catalog returned 200 but no data"
        fi
    else
        print_fail "Rubros catalog returned $HTTP_CODE (expected 200)"
        echo "Response: $BODY" >> "$REPORT_FILE"
    fi
}

test_api_allocation_rules() {
    print_header "API Test: Allocation Rules"
    
    print_test "GET /allocation-rules (requires auth)"
    
    if [[ -z "$JWT_ID_TOKEN" ]]; then
        print_skip "No JWT token available (authentication may have failed)"
        return
    fi
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $JWT_ID_TOKEN" \
        "$API_BASE_URL/allocation-rules")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        COUNT=$(echo "$BODY" | jq -r '.data | length' 2>/dev/null || echo "0")
        print_pass "Allocation rules returned $COUNT rules"
        if [[ "$COUNT" -gt 0 ]]; then
            print_info "Sample rules:"
            echo "$BODY" | jq -r '.data[:3] | .[] | "  - Rule \(.rule_id): \(.driver) -> \(.linea_codigo)"' 2>/dev/null || echo "  Unable to parse"
            echo "\`\`\`json" >> "$REPORT_FILE"
            echo "$BODY" | jq '.data[:3]' >> "$REPORT_FILE" 2>/dev/null
            echo "\`\`\`" >> "$REPORT_FILE"
        fi
    elif [[ "$HTTP_CODE" == "401" ]]; then
        print_fail "Allocation rules returned 401 Unauthorized (check JWT token validity)"
        echo "Response: $BODY" >> "$REPORT_FILE"
    else
        print_fail "Allocation rules returned $HTTP_CODE (expected 200)"
        echo "Response: $BODY" >> "$REPORT_FILE"
    fi
}

test_api_projects_list() {
    print_header "API Test: Projects List"
    
    print_test "GET /projects (requires auth)"
    
    if [[ -z "$JWT_ID_TOKEN" ]]; then
        print_skip "No JWT token available"
        return
    fi
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $JWT_ID_TOKEN" \
        "$API_BASE_URL/projects")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        print_pass "Projects endpoint returned 200 OK"
        COUNT=$(echo "$BODY" | jq -r '.data | length' 2>/dev/null || echo "0")
        print_info "Projects count: $COUNT"
    elif [[ "$HTTP_CODE" == "501" ]]; then
        print_skip "Projects endpoint returned 501 Not Implemented (feature not yet deployed)"
    elif [[ "$HTTP_CODE" == "401" ]]; then
        print_fail "Projects endpoint returned 401 Unauthorized"
    else
        print_fail "Projects endpoint returned $HTTP_CODE"
        echo "Response: $BODY" >> "$REPORT_FILE"
    fi
}

test_api_create_project() {
    print_header "API Test: Create Project (Write Operation)"
    
    print_test "POST /projects (requires auth + write permissions)"
    
    if [[ -z "$JWT_ID_TOKEN" ]]; then
        print_skip "No JWT token available"
        return
    fi
    
    # Generate unique project code
    TIMESTAMP=$(date +%s)
    PROJECT_CODE="PROJ-2025-${TIMESTAMP: -3}"
    
    PAYLOAD=$(cat <<EOF
{
  "name": "Test Project $TIMESTAMP",
  "code": "$PROJECT_CODE",
  "client": "Test Client",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "currency": "USD",
  "mod_total": 100000,
  "description": "Automated test project"
}
EOF
)
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $JWT_ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" \
        "$API_BASE_URL/projects")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]]; then
        print_pass "Project created successfully (HTTP $HTTP_CODE)"
        PROJECT_ID=$(echo "$BODY" | jq -r '.id // .project_id' 2>/dev/null)
        print_info "Created project ID: $PROJECT_ID"
        echo "\`\`\`json" >> "$REPORT_FILE"
        echo "$BODY" | jq '.' >> "$REPORT_FILE" 2>/dev/null || echo "$BODY" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
    elif [[ "$HTTP_CODE" == "501" ]]; then
        print_skip "Create project returned 501 Not Implemented"
    elif [[ "$HTTP_CODE" == "401" ]]; then
        print_fail "Create project returned 401 Unauthorized"
    elif [[ "$HTTP_CODE" == "403" ]]; then
        print_fail "Create project returned 403 Forbidden (insufficient permissions)"
    else
        print_fail "Create project returned $HTTP_CODE"
        echo "Response: $BODY" >> "$REPORT_FILE"
    fi
}

###############################################################################
# UI Tests (Manual Checklist)
###############################################################################

generate_ui_test_checklist() {
    print_header "UI Manual Test Checklist"
    
    cat >> "$REPORT_FILE" <<EOF

## UI Manual Test Checklist

### Prerequisites
- [ ] Local dev server running: \`npm run dev\`
- [ ] Browser opened to: http://localhost:5173/finanzas/
- [ ] DevTools opened (F12): Console + Network tabs visible

### Test 1: Authentication Flow
- [ ] Navigate to http://localhost:5173/finanzas/
- [ ] **Expected**: Redirect to Cognito Hosted UI
- [ ] Enter credentials: $TEST_USERNAME / [password]
- [ ] **Expected**: Successful login, redirect back to /finanzas/
- [ ] Open DevTools → Application → Local Storage
- [ ] **Expected**: \`cv.jwt\` key exists with JWT token value
- [ ] Copy JWT and decode at https://jwt.io
- [ ] **Expected**: Token contains \`cognito:groups\` claim with appropriate roles

**Console Errors**: _______________  
**Network Errors**: _______________  
**Status**: ☐ PASS  ☐ FAIL  ☐ PARTIAL

---

### Test 2: Home Page
**Route**: http://localhost:5173/finanzas/

- [ ] Home page loads after authentication
- [ ] **Expected**: Finanzas home screen with navigation cards
- [ ] Verify visible cards: Projects, Rubros, Allocation Rules, Adjustments, Providers
- [ ] Check navigation bar shows "Rubros" and "Rules" menu items
- [ ] **Expected**: No console errors related to routing or rendering

**Console Errors**: _______________  
**Status**: ☐ PASS  ☐ FAIL

---

### Test 3: Rubros Catalog Page
**Route**: http://localhost:5173/finanzas/catalog/rubros

- [ ] Click "Rubros" in navigation menu OR click Rubros card on home
- [ ] **Expected**: Navigate to /catalog/rubros
- [ ] **Expected**: Page shows table/grid of rubros
- [ ] Open DevTools → Network tab
- [ ] **Expected**: See GET request to \`$API_BASE_URL/catalog/rubros\`
- [ ] Click on the request, check Response tab
- [ ] **Expected**: JSON response with \`data\` array containing rubros
- [ ] **Expected**: Response shows ~71 rubros
- [ ] Verify data renders correctly in UI (rubro_id, nombre visible)
- [ ] Test search/filter functionality (if implemented)
- [ ] Test pagination/sorting (if implemented)

**Console Errors**: _______________  
**Network Request Status**: _______________  
**Data Count**: _______________  
**Status**: ☐ PASS  ☐ FAIL

---

### Test 4: Allocation Rules Page
**Route**: http://localhost:5173/finanzas/rules

- [ ] Click "Rules" in navigation menu
- [ ] **Expected**: Navigate to /rules
- [ ] **Expected**: Page shows allocation rules table/list
- [ ] Open DevTools → Network tab
- [ ] **Expected**: See GET request to \`$API_BASE_URL/allocation-rules\`
- [ ] Click on the request, check Headers tab
- [ ] **Expected**: \`Authorization: Bearer [JWT]\` header present
- [ ] Check Response tab
- [ ] **Expected**: JSON response with rules data
- [ ] Verify rules render correctly (rule_id, driver, linea_codigo)
- [ ] Test any interactive features (edit, delete buttons)

**Console Errors**: _______________  
**Network Request Status**: _______________  
**Auth Header Present**: ☐ YES  ☐ NO  
**Status**: ☐ PASS  ☐ FAIL

---

### Test 5: Projects Manager Page
**Route**: http://localhost:5173/finanzas/projects

- [ ] Navigate to /projects (via home card or direct URL)
- [ ] **Expected**: Projects page loads
- [ ] Check Network tab for API calls
- [ ] **Expected**: GET request to \`$API_BASE_URL/projects\` with auth header
- [ ] Test "Create Project" button (if visible)
- [ ] Fill out project form with test data:
  - Name: Test Project [timestamp]
  - Code: PROJ-2025-XXX
  - Client: Test Client
  - Dates, currency, budget
- [ ] Click Save/Submit
- [ ] **Expected**: POST request to /projects in Network tab
- [ ] **Expected**: Success toast notification OR 501 error (if not implemented)

**Console Errors**: _______________  
**Create Button Works**: ☐ YES  ☐ NO  ☐ N/A  
**Status**: ☐ PASS  ☐ FAIL  ☐ PARTIAL

---

### Test 6: Adjustments Manager Page
**Route**: http://localhost:5173/finanzas/adjustments

- [ ] Navigate to /adjustments
- [ ] **Expected**: Adjustments page loads
- [ ] Test any list/table displays
- [ ] Test "Create Adjustment" functionality (if available)
- [ ] Check Network tab for appropriate API calls

**Console Errors**: _______________  
**Status**: ☐ PASS  ☐ FAIL  ☐ PARTIAL

---

### Test 7: Providers Manager Page
**Route**: http://localhost:5173/finanzas/providers

- [ ] Navigate to /providers
- [ ] **Expected**: Providers page loads
- [ ] Test any list/table displays
- [ ] Test "Create Provider" functionality (if available)
- [ ] Check Network tab for appropriate API calls

**Console Errors**: _______________  
**Status**: ☐ PASS  ☐ FAIL  ☐ PARTIAL

---

### Test 8: Production Deployment
**URL**: https://d7t9x3j66yd8k.cloudfront.net/finanzas/

- [ ] Open production URL in browser
- [ ] **Expected**: CloudFront serves the application
- [ ] Repeat Tests 1-7 on production environment
- [ ] Compare behavior: Local vs Production
- [ ] Note any differences in:
  - Loading speed: _______________
  - API response times: _______________
  - Console errors: _______________
  - Missing features: _______________

**CloudFront Issues**: _______________  
**Status**: ☐ PASS  ☐ FAIL

---

### Test 9: Error Handling
- [ ] Test with invalid JWT (modify localStorage \`cv.jwt\` to garbage value)
- [ ] **Expected**: 401 errors show user-friendly messages
- [ ] Test with expired JWT (wait for token expiration or forge old \`exp\` claim)
- [ ] **Expected**: Prompt to re-authenticate
- [ ] Test network offline (DevTools → Network → Offline)
- [ ] **Expected**: Graceful error messages, no crashes
- [ ] Test API endpoint returning 500 error (mock if possible)
- [ ] **Expected**: Error toast with helpful message

**Status**: ☐ PASS  ☐ FAIL

---

### Test 10: Cross-Browser Compatibility
- [ ] Chrome: ☐ PASS  ☐ FAIL
- [ ] Firefox: ☐ PASS  ☐ FAIL
- [ ] Safari: ☐ PASS  ☐ FAIL
- [ ] Edge: ☐ PASS  ☐ FAIL

---

### Test 11: Responsive Design
- [ ] Test on mobile viewport (DevTools → Toggle device toolbar)
- [ ] **Expected**: UI adapts to small screens
- [ ] Navigation menu collapses to hamburger (if implemented)
- [ ] Tables scroll horizontally or stack appropriately
- [ ] Buttons and forms remain usable

**Status**: ☐ PASS  ☐ FAIL

---

### Test 12: Performance
- [ ] Open DevTools → Lighthouse tab
- [ ] Run Performance audit
- [ ] **Expected**: Performance score > 80
- [ ] Check Network tab for large bundle sizes
- [ ] Verify lazy loading of routes (if implemented)

**Performance Score**: _______________  
**Status**: ☐ PASS  ☐ FAIL

---

## Summary
- **Total Tests**: 12
- **Passed**: _______________
- **Failed**: _______________
- **Partial/Skipped**: _______________

## Critical Issues Found
1. _______________
2. _______________
3. _______________

## Recommendations
1. _______________
2. _______________
3. _______________

EOF

    print_info "UI test checklist added to report: $REPORT_FILE"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    print_header "Finanzas SD Module - Manual Testing"
    print_info "Test Date: $(date)"
    print_info "API Base URL: $API_BASE_URL"
    print_info "Report File: $REPORT_FILE"
    
    # Initialize report
    cat > "$REPORT_FILE" <<EOF
# Finanzas E2E Test Results
**Date**: $(date)  
**Tester**: $(whoami)  
**API Base**: $API_BASE_URL  
**Cognito Pool**: $COGNITO_USER_POOL_ID

---

## Automated API Tests

EOF
    
    # Run automated tests
    authenticate_cognito
    test_api_health
    test_api_rubros_catalog
    test_api_allocation_rules
    test_api_projects_list
    test_api_create_project
    
    # Generate UI checklist
    generate_ui_test_checklist
    
    # Summary
    print_header "Test Summary"
    echo "Tests Passed:  $TESTS_PASSED" | tee -a "$REPORT_FILE"
    echo "Tests Failed:  $TESTS_FAILED" | tee -a "$REPORT_FILE"
    echo "Tests Skipped: $TESTS_SKIPPED" | tee -a "$REPORT_FILE"
    echo ""
    echo "Report saved to: $REPORT_FILE"
    
    if [[ $TESTS_FAILED -gt 0 ]]; then
        print_fail "Some tests failed. Please review the report."
        exit 1
    else
        print_pass "All automated tests passed!"
        print_info "Complete the manual UI tests using the checklist in the report."
    fi
}

# Run main function
main "$@"
