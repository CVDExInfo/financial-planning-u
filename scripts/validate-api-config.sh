#!/usr/bin/env bash
#
# validate-api-config.sh
# =====================
# Comprehensive API Configuration and Connectivity Validation
#
# This script validates that:
# 1. VITE_API_BASE_URL is set and non-empty
# 2. The API endpoint is reachable via network (DNS/SSL/HTTP)
# 3. The API responds with expected status codes
# 4. CORS configuration allows frontend access
#
# Usage:
#   ./scripts/validate-api-config.sh
#
# Environment Variables:
#   VITE_API_BASE_URL (required) - The API base URL to validate
#   SKIP_CONNECTIVITY_CHECK - Set to "true" to skip actual HTTP checks (for offline builds)
#

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     API Configuration & Connectivity Validation                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# SECTION 1: Environment Variable Validation
# ============================================================================
echo -e "${BLUE}📍 Section 1: Environment Variable Validation${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Check if VITE_API_BASE_URL is set
if [ -z "${VITE_API_BASE_URL:-}" ]; then
  echo -e "${RED}❌ CRITICAL: VITE_API_BASE_URL is not set${NC}"
  echo ""
  echo "This variable is REQUIRED for the Finanzas frontend to function."
  echo ""
  echo "🔧 To fix this:"
  echo "  1. Set VITE_API_BASE_URL in your environment:"
  echo "     export VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
  echo ""
  echo "  2. Or set DEV_API_URL in GitHub repository variables"
  echo ""
  echo "  3. For production: Set via CI/CD environment variables"
  echo ""
  ERRORS=$((ERRORS + 1))
  exit 1
fi

# Normalize the URL (remove trailing slashes and whitespace)
VITE_API_BASE_URL="$(echo "$VITE_API_BASE_URL" | sed 's/[[:space:]]*$//' | sed 's:/*$::')"

# Validate URL format
if ! echo "$VITE_API_BASE_URL" | grep -qE '^https?://[a-zA-Z0-9]'; then
  echo -e "${RED}❌ CRITICAL: VITE_API_BASE_URL has invalid format${NC}"
  echo "   Got: '$VITE_API_BASE_URL'"
  echo "   Expected: https://... or http://..."
  ERRORS=$((ERRORS + 1))
  exit 1
fi

echo -e "${GREEN}✅ VITE_API_BASE_URL is set${NC}"
echo "   Value: $VITE_API_BASE_URL"
echo ""

# ============================================================================
# SECTION 2: URL Component Validation
# ============================================================================
echo -e "${BLUE}📍 Section 2: URL Component Validation${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Extract components
PROTOCOL=$(echo "$VITE_API_BASE_URL" | sed -E 's|^(https?)://.*|\1|')
HOST=$(echo "$VITE_API_BASE_URL" | sed -E 's|^https?://([^/]+).*|\1|')
PATH=$(echo "$VITE_API_BASE_URL" | sed -E 's|^https?://[^/]+(/.*)|\1|' | grep '^/' || echo "")

echo "   Protocol: $PROTOCOL"
echo "   Host: $HOST"
echo "   Path: ${PATH:-/}"
echo ""

# Validate protocol
if [ "$PROTOCOL" != "https" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Using non-HTTPS protocol ($PROTOCOL)${NC}"
  echo "   Production deployments should use HTTPS"
  WARNINGS=$((WARNINGS + 1))
  echo ""
fi

# Check if host looks like API Gateway
if command -v grep >/dev/null 2>&1; then
  if echo "$HOST" | grep -qE '\.execute-api\.[a-z0-9-]+\.amazonaws\.com'; then
    API_ID=$(echo "$HOST" | cut -d'.' -f1)
    REGION=$(echo "$HOST" | sed -E 's/.*\.execute-api\.([a-z0-9-]+)\.amazonaws\.com/\1/')
    echo -e "${GREEN}✅ Detected AWS API Gateway${NC}"
    echo "   API ID: $API_ID"
    echo "   Region: $REGION"
    
    # Extract stage from path
    if [ -n "$PATH" ]; then
      STAGE=$(echo "$PATH" | sed 's|^/||' | cut -d'/' -f1)
      echo "   Stage: $STAGE"
    fi
  else
    echo -e "${YELLOW}ℹ️  Non-standard API endpoint (not AWS API Gateway)${NC}"
  fi
else
  echo -e "${YELLOW}ℹ️  Cannot detect API Gateway format (grep not available)${NC}"
fi

echo ""

# ============================================================================
# SECTION 3: Network Connectivity Tests
# ============================================================================
echo -e "${BLUE}📍 Section 3: Network Connectivity Tests${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Check if we should skip connectivity checks
if [ "${SKIP_CONNECTIVITY_CHECK:-false}" = "true" ]; then
  echo -e "${YELLOW}⚠️  Skipping connectivity checks (SKIP_CONNECTIVITY_CHECK=true)${NC}"
  echo ""
else
  # Test 1: DNS Resolution
  echo "Test 1: DNS Resolution"
  if host "$HOST" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ DNS resolution successful for $HOST${NC}"
  else
    echo -e "${RED}❌ DNS resolution failed for $HOST${NC}"
    echo "   This means the hostname cannot be resolved to an IP address"
    echo "   Check network connectivity and DNS configuration"
    ERRORS=$((ERRORS + 1))
  fi
  echo ""

  # Test 2: HTTP Connectivity to /health endpoint
  echo "Test 2: HTTP Connectivity (/health endpoint)"
  HEALTH_URL="${VITE_API_BASE_URL}/health"
  
  if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -sS -o /tmp/health_response.json -w '%{http_code}' \
      --connect-timeout 10 \
      --max-time 30 \
      "$HEALTH_URL" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
      echo -e "${GREEN}✅ GET $HEALTH_URL → HTTP $HTTP_CODE${NC}"
      
      # Try to parse response
      if [ -f /tmp/health_response.json ]; then
        if command -v jq >/dev/null 2>&1; then
          HEALTH_STATUS=$(jq -r '.status // "unknown"' /tmp/health_response.json 2>/dev/null || echo "unknown")
          echo "   Status: $HEALTH_STATUS"
        fi
      fi
    elif [ "$HTTP_CODE" = "000" ]; then
      echo -e "${RED}❌ Connection failed to $HEALTH_URL${NC}"
      echo "   This typically means:"
      echo "   - Network/firewall blocking the connection"
      echo "   - DNS resolution failure"
      echo "   - SSL/TLS certificate issues"
      echo "   - The API endpoint is not deployed or is down"
      ERRORS=$((ERRORS + 1))
    elif [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ]; then
      echo -e "${YELLOW}⚠️  GET $HEALTH_URL → HTTP $HTTP_CODE (Auth Required)${NC}"
      echo "   The endpoint exists but requires authentication"
      echo "   This is acceptable if /health is protected"
      WARNINGS=$((WARNINGS + 1))
    else
      echo -e "${YELLOW}⚠️  GET $HEALTH_URL → HTTP $HTTP_CODE${NC}"
      echo "   Expected 200, got $HTTP_CODE"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    echo -e "${YELLOW}⚠️  curl not available, skipping HTTP connectivity test${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
  echo ""

  # Test 3: CORS Preflight Check
  echo "Test 3: CORS Configuration Check"
  if command -v curl >/dev/null 2>&1; then
    # Simulate a CORS preflight request
    CORS_RESPONSE=$(curl -sS -I \
      -X OPTIONS \
      -H "Origin: https://d7t9x3j66yd8k.cloudfront.net" \
      -H "Access-Control-Request-Method: GET" \
      -H "Access-Control-Request-Headers: authorization,content-type" \
      "$HEALTH_URL" 2>/dev/null || echo "")
    
    if echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
      ALLOW_ORIGIN=$(echo "$CORS_RESPONSE" | grep -i "Access-Control-Allow-Origin" | cut -d' ' -f2- | tr -d '\r\n')
      echo -e "${GREEN}✅ CORS headers present${NC}"
      echo "   Access-Control-Allow-Origin: $ALLOW_ORIGIN"
    else
      echo -e "${YELLOW}⚠️  No CORS headers detected in OPTIONS response${NC}"
      echo "   This may cause browser CORS errors if frontend and API are on different domains"
      echo "   Note: Some APIs don't respond to OPTIONS, which is OK if they set CORS headers on GET/POST"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
  echo ""

  # Test 4: Additional Endpoint Checks
  echo "Test 4: Additional Endpoint Validation"
  
  # Test /catalog/rubros (public endpoint)
  RUBROS_URL="${VITE_API_BASE_URL}/catalog/rubros"
  if command -v curl >/dev/null 2>&1; then
    RUBROS_CODE=$(curl -sS -o /tmp/rubros_response.json -w '%{http_code}' \
      --connect-timeout 10 \
      --max-time 30 \
      "$RUBROS_URL" 2>/dev/null || echo "000")
    
    if [ "$RUBROS_CODE" = "200" ]; then
      echo -e "${GREEN}✅ GET /catalog/rubros → HTTP $RUBROS_CODE${NC}"
      
      # Count items if jq is available
      if [ -f /tmp/rubros_response.json ] && command -v jq >/dev/null 2>&1; then
        ITEM_COUNT=$(jq '.data | length' /tmp/rubros_response.json 2>/dev/null || echo "?")
        echo "   Items returned: $ITEM_COUNT"
        
        if [ "$ITEM_COUNT" = "0" ]; then
          echo -e "${YELLOW}   ⚠️  No items in catalog - database may need seeding${NC}"
          WARNINGS=$((WARNINGS + 1))
        fi
      fi
    elif [ "$RUBROS_CODE" = "000" ]; then
      echo -e "${RED}❌ GET /catalog/rubros → Connection failed${NC}"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "${YELLOW}⚠️  GET /catalog/rubros → HTTP $RUBROS_CODE${NC}"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
  echo ""
fi

# ============================================================================
# SECTION 4: Build Environment File Validation
# ============================================================================
echo -e "${BLUE}📍 Section 4: Build Environment File Validation${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Check .env files
ENV_FILES=(".env" ".env.development" ".env.production" ".env.local")
FOUND_IN_FILE=false

for ENV_FILE in "${ENV_FILES[@]}"; do
  if [ -f "$ENV_FILE" ]; then
    if grep -q "^VITE_API_BASE_URL=" "$ENV_FILE" 2>/dev/null; then
      FILE_VALUE=$(grep "^VITE_API_BASE_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
      if [ -n "$FILE_VALUE" ]; then
        echo -e "${GREEN}✅ Found VITE_API_BASE_URL in $ENV_FILE${NC}"
        echo "   Value: $FILE_VALUE"
        FOUND_IN_FILE=true
        
        # Check if file value matches environment value
        if [ "$FILE_VALUE" != "$VITE_API_BASE_URL" ]; then
          echo -e "${YELLOW}   ⚠️  WARNING: Value differs from environment variable${NC}"
          echo "   Environment: $VITE_API_BASE_URL"
          echo "   File: $FILE_VALUE"
          WARNINGS=$((WARNINGS + 1))
        fi
      fi
    fi
  fi
done

if [ "$FOUND_IN_FILE" = false ]; then
  echo -e "${YELLOW}⚠️  VITE_API_BASE_URL not found in any .env file${NC}"
  echo "   This is OK if the value is set via CI/CD or export"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# SECTION 5: Summary and Recommendations
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Validation Summary                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL CHECKS PASSED${NC}"
  echo ""
  echo "✅ API configuration is valid and endpoint is reachable"
  echo "✅ Ready to proceed with build"
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  VALIDATION COMPLETED WITH WARNINGS${NC}"
  echo ""
  echo "✅ API configuration is valid"
  echo "⚠️  $WARNINGS warning(s) detected (see above)"
  echo ""
  echo "Build can proceed, but review warnings for potential issues"
else
  echo -e "${RED}❌ VALIDATION FAILED${NC}"
  echo ""
  echo "❌ $ERRORS critical error(s) detected"
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  $WARNINGS warning(s) also detected"
  fi
  echo ""
  echo "🔧 Required Actions:"
  echo "  1. Review error messages above"
  echo "  2. Set VITE_API_BASE_URL correctly"
  echo "  3. Ensure API endpoint is deployed and accessible"
  echo "  4. Check network connectivity and firewall rules"
  echo ""
  exit 1
fi

# Print recommendations
if [ "${SKIP_CONNECTIVITY_CHECK:-false}" = "false" ]; then
  echo ""
  echo "📋 Configuration Summary:"
  echo "   API Base URL: $VITE_API_BASE_URL"
  echo "   Protocol: $PROTOCOL"
  echo "   Host: $HOST"
  echo "   Connectivity: Verified ✅"
  echo ""
fi

# Cleanup temp files
if command -v rm >/dev/null 2>&1; then
  rm -f /tmp/health_response.json /tmp/rubros_response.json 2>/dev/null || true
fi

exit 0
