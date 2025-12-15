#!/usr/bin/env bash
#
# post-deploy-verify.sh
# ====================
# Post-deployment verification script
#
# This script validates that a deployment was successful by checking:
# 1. S3 bucket contains the expected files
# 2. CloudFront distribution is accessible
# 3. API endpoints are reachable from the deployed UI
# 4. Static assets load correctly
#
# Usage:
#   ./scripts/post-deploy-verify.sh
#
# Environment Variables:
#   CLOUDFRONT_DOMAIN - CloudFront domain (default: d7t9x3j66yd8k.cloudfront.net)
#   VITE_API_BASE_URL - API base URL to verify
#   S3_BUCKET - S3 bucket name (optional, for S3 verification)
#

set -euo pipefail

# Configuration
CLOUDFRONT_DOMAIN="${CLOUDFRONT_DOMAIN:-d7t9x3j66yd8k.cloudfront.net}"
FINANZAS_URL="https://${CLOUDFRONT_DOMAIN}/finanzas/"
API_BASE_URL="${VITE_API_BASE_URL:-https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            Post-Deployment Verification                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# SECTION 1: CloudFront UI Accessibility
# ============================================================================
echo -e "${BLUE}📍 Section 1: CloudFront UI Accessibility${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

echo "Testing: $FINANZAS_URL"
HTTP_CODE=$(curl -sS -o /tmp/finanzas_ui.html -w '%{http_code}' \
  --connect-timeout 10 \
  --max-time 30 \
  "$FINANZAS_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ CloudFront UI accessible (HTTP $HTTP_CODE)${NC}"
  
  # Verify HTML content
  if [ -f /tmp/finanzas_ui.html ]; then
    # Check for base path references
    if grep -q "/finanzas/assets/" /tmp/finanzas_ui.html; then
      echo -e "${GREEN}✅ HTML contains correct base path (/finanzas/assets/)${NC}"
    else
      echo -e "${RED}❌ HTML missing /finanzas/assets/ references${NC}"
      ERRORS=$((ERRORS + 1))
    fi
    
    # Check for common issues
    if grep -q "src=\"/assets/" /tmp/finanzas_ui.html; then
      echo -e "${RED}❌ HTML contains incorrect root /assets/ paths${NC}"
      ERRORS=$((ERRORS + 1))
    fi
    
    # Verify it's not an error page
    if grep -qi "<title>.*error" /tmp/finanzas_ui.html; then
      echo -e "${RED}❌ UI returned an error page${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  fi
else
  echo -e "${RED}❌ CloudFront UI not accessible (HTTP $HTTP_CODE)${NC}"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================================================
# SECTION 2: Auth Callback Verification
# ============================================================================
echo -e "${BLUE}📍 Section 2: Auth Callback Verification${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

AUTH_CALLBACK_URL="https://${CLOUDFRONT_DOMAIN}/finanzas/auth/callback.html"
echo "Testing: $AUTH_CALLBACK_URL"
AUTH_CODE=$(curl -sS -o /tmp/auth_callback.html -w '%{http_code}' \
  --connect-timeout 10 \
  --max-time 30 \
  "$AUTH_CALLBACK_URL" 2>/dev/null || echo "000")

if [ "$AUTH_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Auth callback accessible (HTTP $AUTH_CODE)${NC}"
  
  # Verify it's actually callback.html, not index.html
  if [ -f /tmp/auth_callback.html ]; then
    # Check for callback-specific markers
    if grep -q "Signing you in" /tmp/auth_callback.html && grep -q "\[Callback\]" /tmp/auth_callback.html; then
      echo -e "${GREEN}✅ Callback.html is being served (verified content markers)${NC}"
    else
      echo -e "${RED}❌ CloudFront returned index.html instead of callback.html${NC}"
      echo "   This means SPA error handling is intercepting the callback route"
      echo "   Check CloudFront behavior configuration for /finanzas/auth/* path"
      ERRORS=$((ERRORS + 1))
    fi
  fi
else
  echo -e "${YELLOW}⚠️  Auth callback not accessible (HTTP $AUTH_CODE)${NC}"
  echo "   This is acceptable if authentication callback is not yet deployed"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# SECTION 3: Nested SPA Routes Verification
# ============================================================================
echo -e "${BLUE}📍 Section 3: Nested SPA Routes Verification${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

echo "Testing nested SPA routes under /finanzas/..."
echo ""

# Test multiple nested routes to ensure SPA routing works
NESTED_ROUTES=(
  "/finanzas/sdmt"
  "/finanzas/sdmt/cost"
  "/finanzas/sdmt/cost/forecast"
  "/finanzas/budget"
  "/finanzas/catalog"
)

NESTED_SUCCESS=0
NESTED_TESTED=0

for ROUTE in "${NESTED_ROUTES[@]}"; do
  NESTED_TESTED=$((NESTED_TESTED + 1))
  ROUTE_URL="https://${CLOUDFRONT_DOMAIN}${ROUTE}"
  
  ROUTE_CODE=$(curl -sS -o /tmp/nested_route_${NESTED_TESTED}.html -w '%{http_code}' \
    --connect-timeout 10 \
    --max-time 30 \
    "$ROUTE_URL" 2>/dev/null || echo "000")
  
  if [ "$ROUTE_CODE" = "200" ]; then
    # Verify it's a valid SPA response (contains /finanzas/assets/)
    if [ -f "/tmp/nested_route_${NESTED_TESTED}.html" ]; then
      if grep -q "/finanzas/assets/" "/tmp/nested_route_${NESTED_TESTED}.html"; then
        echo -e "${GREEN}✅ ${ROUTE} → HTTP 200 (valid SPA content)${NC}"
        NESTED_SUCCESS=$((NESTED_SUCCESS + 1))
      else
        echo -e "${YELLOW}⚠️  ${ROUTE} → HTTP 200 (but missing SPA markers)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
    fi
  else
    echo -e "${YELLOW}⚠️  ${ROUTE} → HTTP ${ROUTE_CODE}${NC}"
  fi
done

echo ""

if [ $NESTED_SUCCESS -gt 0 ]; then
  echo -e "${GREEN}✅ Nested SPA routing verified (${NESTED_SUCCESS}/${NESTED_TESTED} routes working)${NC}"
else
  echo -e "${RED}❌ No nested SPA routes working${NC}"
  echo "   CloudFront may not be configured for SPA routing"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================================================
# SECTION 4: Static Asset Loading
# ============================================================================
echo -e "${BLUE}📍 Section 4: Static Asset Loading${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Extract asset URLs from HTML
if [ -f /tmp/finanzas_ui.html ]; then
  # Find JS assets
  JS_ASSETS=$(grep -oP '(?<=src=")[^"]*\.js[^"]*(?=")' /tmp/finanzas_ui.html | head -3 || echo "")
  
  if [ -n "$JS_ASSETS" ]; then
    echo "Testing sample JavaScript assets..."
    for ASSET in $JS_ASSETS; do
      # Make absolute URL if relative
      if [[ "$ASSET" == /* ]]; then
        ASSET_URL="https://${CLOUDFRONT_DOMAIN}${ASSET}"
      else
        ASSET_URL="$ASSET"
      fi
      
      ASSET_CODE=$(curl -sS -o /dev/null -w '%{http_code}' \
        --connect-timeout 10 \
        --max-time 30 \
        "$ASSET_URL" 2>/dev/null || echo "000")
      
      if [ "$ASSET_CODE" = "200" ]; then
        echo -e "${GREEN}✅ $ASSET_URL → HTTP $ASSET_CODE${NC}"
      else
        echo -e "${RED}❌ $ASSET_URL → HTTP $ASSET_CODE${NC}"
        ERRORS=$((ERRORS + 1))
      fi
    done
  else
    echo -e "${YELLOW}⚠️  No JavaScript assets found in HTML${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${YELLOW}⚠️  HTML file not available for asset checking${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# SECTION 5: API Endpoint Verification
# ============================================================================
echo -e "${BLUE}📍 Section 5: API Endpoint Verification${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

echo "Testing API: $API_BASE_URL"
echo ""

# Test /health endpoint
echo "Test 1: GET /health"
HEALTH_CODE=$(curl -sS -o /tmp/api_health.json -w '%{http_code}' \
  --connect-timeout 10 \
  --max-time 30 \
  "${API_BASE_URL}/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CODE" = "200" ]; then
  echo -e "${GREEN}✅ GET /health → HTTP $HEALTH_CODE${NC}"
  
  if [ -f /tmp/api_health.json ] && command -v jq >/dev/null 2>&1; then
    HEALTH_STATUS=$(jq -r '.status // "unknown"' /tmp/api_health.json 2>/dev/null || echo "unknown")
    echo "   Status: $HEALTH_STATUS"
  fi
else
  echo -e "${RED}❌ GET /health → HTTP $HEALTH_CODE${NC}"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# Test /catalog/rubros endpoint
echo "Test 2: GET /catalog/rubros"
RUBROS_CODE=$(curl -sS -o /tmp/api_rubros.json -w '%{http_code}' \
  --connect-timeout 10 \
  --max-time 30 \
  "${API_BASE_URL}/catalog/rubros" 2>/dev/null || echo "000")

case "$RUBROS_CODE" in
  200)
    echo -e "${GREEN}✅ GET /catalog/rubros → HTTP $RUBROS_CODE${NC}"

    if [ -f /tmp/api_rubros.json ] && command -v jq >/dev/null 2>&1; then
      ITEM_COUNT=$(jq '.data | length' /tmp/api_rubros.json 2>/dev/null || echo "?")
      echo "   Items: $ITEM_COUNT"

      if [ "$ITEM_COUNT" = "0" ]; then
        echo -e "${YELLOW}   ⚠️  No catalog items - database may need seeding${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
    fi
    ;;
  401|403)
    echo -e "${GREEN}✅ GET /catalog/rubros → HTTP $RUBROS_CODE (protected endpoint requires auth)${NC}"
    echo "   This is expected: /catalog/rubros now enforces authentication/authorization."
    ;;
  *)
    echo -e "${RED}❌ GET /catalog/rubros → HTTP $RUBROS_CODE${NC}"
    echo "   Expected 200 for public access or 401/403 for protected endpoint."
    ERRORS=$((ERRORS + 1))
    ;;
esac

echo ""

# Test payroll actuals CORS and routing
echo "Test 3: OPTIONS /payroll/actuals (CORS preflight)"
PAYROLL_ACTUALS_OPTIONS_RESP=$(curl -sS -i -X OPTIONS --max-time 15 "${API_BASE_URL}/payroll/actuals" || true)
PAYROLL_ACTUALS_OPTIONS_CODE=$(echo "$PAYROLL_ACTUALS_OPTIONS_RESP" | awk 'NR==1 {print $2}')

if [ "$PAYROLL_ACTUALS_OPTIONS_CODE" = "200" ] || [ "$PAYROLL_ACTUALS_OPTIONS_CODE" = "204" ]; then
  if echo "$PAYROLL_ACTUALS_OPTIONS_RESP" | grep -qi "access-control-allow-origin"; then
    echo -e "${GREEN}✅ OPTIONS /payroll/actuals → HTTP ${PAYROLL_ACTUALS_OPTIONS_CODE} with CORS${NC}"
  else
    echo -e "${RED}❌ OPTIONS /payroll/actuals missing Access-Control-Allow-Origin header${NC}"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${RED}❌ OPTIONS /payroll/actuals → HTTP ${PAYROLL_ACTUALS_OPTIONS_CODE:-"n/a"}${NC}"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Test 4: POST /payroll/actuals (CORS)"
PAYROLL_ACTUALS_POST_RESP=$(curl -sS -i -X POST --max-time 15 -H "Content-Type: application/json" -d '{}' "${API_BASE_URL}/payroll/actuals" || true)
PAYROLL_ACTUALS_POST_CODE=$(echo "$PAYROLL_ACTUALS_POST_RESP" | awk 'NR==1 {print $2}')

case "$PAYROLL_ACTUALS_POST_CODE" in
  200|201|400|401|403)
    if echo "$PAYROLL_ACTUALS_POST_RESP" | grep -qi "access-control-allow-origin"; then
      echo -e "${GREEN}✅ POST /payroll/actuals → HTTP ${PAYROLL_ACTUALS_POST_CODE} with CORS${NC}"
    else
      echo -e "${RED}❌ POST /payroll/actuals missing Access-Control-Allow-Origin header${NC}"
      ERRORS=$((ERRORS + 1))
    fi
    ;;
  *)
    echo -e "${RED}❌ POST /payroll/actuals → HTTP ${PAYROLL_ACTUALS_POST_CODE:-"n/a"}${NC}"
    ERRORS=$((ERRORS + 1))
    ;;
esac

echo ""
echo "Test 5: OPTIONS /payroll/actuals/bulk (CORS preflight)"
PAYROLL_BULK_OPTIONS_RESP=$(curl -sS -i -X OPTIONS --max-time 15 "${API_BASE_URL}/payroll/actuals/bulk" || true)
PAYROLL_BULK_OPTIONS_CODE=$(echo "$PAYROLL_BULK_OPTIONS_RESP" | awk 'NR==1 {print $2}')

if [ "$PAYROLL_BULK_OPTIONS_CODE" = "200" ] || [ "$PAYROLL_BULK_OPTIONS_CODE" = "204" ]; then
  if echo "$PAYROLL_BULK_OPTIONS_RESP" | grep -qi "access-control-allow-origin"; then
    echo -e "${GREEN}✅ OPTIONS /payroll/actuals/bulk → HTTP ${PAYROLL_BULK_OPTIONS_CODE} with CORS${NC}"
  else
    echo -e "${RED}❌ OPTIONS /payroll/actuals/bulk missing Access-Control-Allow-Origin header${NC}"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${RED}❌ OPTIONS /payroll/actuals/bulk → HTTP ${PAYROLL_BULK_OPTIONS_CODE:-"n/a"}${NC}"
  ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# SECTION 6: End-to-End Connectivity Test
# ============================================================================
echo -e "${BLUE}📍 Section 6: End-to-End Connectivity${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Check if the deployed bundle contains the API URL
if [ -f /tmp/finanzas_ui.html ]; then
  # Look for API base URL in the HTML or try to fetch and check JS bundle
  echo "Checking if API URL is embedded in frontend bundle..."
  
  # Try to find main JS bundle
  MAIN_JS=$(grep -oP '(?<=src=")[^"]*index[^"]*\.js[^"]*(?=")' /tmp/finanzas_ui.html | head -1 || echo "")
  
  if [ -n "$MAIN_JS" ]; then
    # Make absolute URL if relative
    if [[ "$MAIN_JS" == /* ]]; then
      MAIN_JS_URL="https://${CLOUDFRONT_DOMAIN}${MAIN_JS}"
    else
      MAIN_JS_URL="$MAIN_JS"
    fi
    
    echo "Fetching main bundle: $MAIN_JS_URL"
    curl -sS "$MAIN_JS_URL" -o /tmp/main_bundle.js 2>/dev/null || true
    
    if [ -f /tmp/main_bundle.js ]; then
      # Extract the host part of the API URL for searching
      API_HOST=$(echo "$API_BASE_URL" | sed -E 's|https?://([^/]+).*|\1|')
      
      if grep -q "$API_HOST" /tmp/main_bundle.js; then
        echo -e "${GREEN}✅ API URL found in frontend bundle${NC}"
        echo "   This confirms VITE_API_BASE_URL was properly injected at build time"
      else
        echo -e "${YELLOW}⚠️  API URL not found in frontend bundle${NC}"
        echo "   This may indicate VITE_API_BASE_URL was not set during build"
        WARNINGS=$((WARNINGS + 1))
      fi
    fi
  else
    echo -e "${YELLOW}⚠️  Could not identify main JS bundle${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

echo ""

# ============================================================================
# SECTION 7: Optional S3 Bucket Verification
# ============================================================================
if [ -n "${S3_BUCKET:-}" ]; then
  echo -e "${BLUE}📍 Section 7: S3 Bucket Verification${NC}"
  echo "────────────────────────────────────────────────────────────────"
  echo ""
  
  echo "Checking S3 bucket: $S3_BUCKET"
  
  if command -v aws >/dev/null 2>&1; then
    # Check if bucket exists
    if aws s3api head-bucket --bucket "$S3_BUCKET" 2>/dev/null; then
      echo -e "${GREEN}✅ S3 bucket exists and is accessible${NC}"
      
      # Check for key files
      KEY_FILES=("finanzas/index.html" "finanzas/assets/")
      for KEY_FILE in "${KEY_FILES[@]}"; do
        if aws s3 ls "s3://${S3_BUCKET}/${KEY_FILE}" >/dev/null 2>&1; then
          echo -e "${GREEN}✅ Found: s3://${S3_BUCKET}/${KEY_FILE}${NC}"
        else
          echo -e "${YELLOW}⚠️  Missing: s3://${S3_BUCKET}/${KEY_FILE}${NC}"
          WARNINGS=$((WARNINGS + 1))
        fi
      done
    else
      echo -e "${RED}❌ S3 bucket not accessible: $S3_BUCKET${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  else
    echo -e "${YELLOW}⚠️  AWS CLI not available, skipping S3 checks${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
  
  echo ""
fi

# ============================================================================
# Summary
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   Verification Summary                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL VERIFICATION CHECKS PASSED${NC}"
  echo ""
  echo "✅ CloudFront UI is accessible"
  echo "✅ Static assets load correctly"
  echo "✅ API endpoints are reachable"
  echo "✅ Deployment is successful"
  echo ""
  echo "🌐 Access the application at: $FINANZAS_URL"
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  VERIFICATION COMPLETED WITH WARNINGS${NC}"
  echo ""
  echo "✅ Deployment appears successful"
  echo "⚠️  $WARNINGS warning(s) detected (see above)"
  echo ""
  echo "🌐 Access the application at: $FINANZAS_URL"
else
  echo -e "${RED}❌ VERIFICATION FAILED${NC}"
  echo ""
  echo "❌ $ERRORS critical error(s) detected"
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  $WARNINGS warning(s) also detected"
  fi
  echo ""
  echo "🔧 Deployment may have issues. Review errors above."
  exit 1
fi

# Cleanup
if command -v rm >/dev/null 2>&1; then
  rm -f /tmp/finanzas_ui.html /tmp/auth_callback.html /tmp/nested_route_*.html /tmp/api_health.json /tmp/api_rubros.json /tmp/main_bundle.js 2>/dev/null || true
fi

exit 0
