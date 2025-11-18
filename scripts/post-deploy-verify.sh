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
API_BASE_URL="${VITE_API_BASE_URL:-https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev}"

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
# SECTION 2: Static Asset Loading
# ============================================================================
echo -e "${BLUE}📍 Section 2: Static Asset Loading${NC}"
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
# SECTION 3: API Endpoint Verification
# ============================================================================
echo -e "${BLUE}📍 Section 3: API Endpoint Verification${NC}"
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

if [ "$RUBROS_CODE" = "200" ]; then
  echo -e "${GREEN}✅ GET /catalog/rubros → HTTP $RUBROS_CODE${NC}"
  
  if [ -f /tmp/api_rubros.json ] && command -v jq >/dev/null 2>&1; then
    ITEM_COUNT=$(jq '.data | length' /tmp/api_rubros.json 2>/dev/null || echo "?")
    echo "   Items: $ITEM_COUNT"
    
    if [ "$ITEM_COUNT" = "0" ]; then
      echo -e "${YELLOW}   ⚠️  No catalog items - database may need seeding${NC}"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
else
  echo -e "${RED}❌ GET /catalog/rubros → HTTP $RUBROS_CODE${NC}"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================================================
# SECTION 4: End-to-End Connectivity Test
# ============================================================================
echo -e "${BLUE}📍 Section 4: End-to-End Connectivity${NC}"
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
# SECTION 5: Optional S3 Bucket Verification
# ============================================================================
if [ -n "${S3_BUCKET:-}" ]; then
  echo -e "${BLUE}📍 Section 5: S3 Bucket Verification${NC}"
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
  rm -f /tmp/finanzas_ui.html /tmp/api_health.json /tmp/api_rubros.json /tmp/main_bundle.js 2>/dev/null || true
fi

exit 0
