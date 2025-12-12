#!/bin/bash
# CORS Preflight Validation Script
# Tests CORS configuration for critical API endpoints

set -euo pipefail

API_BASE="${FINZ_API_BASE:-https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev}"
CF_ORIGIN="${CF_ORIGIN:-https://d7t9x3j66yd8k.cloudfront.net}"

echo "═══════════════════════════════════════════════════════════"
echo "  CORS Preflight Validation"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "API Base:      ${API_BASE}"
echo "Origin:        ${CF_ORIGIN}"
echo ""

ENDPOINTS=(
  "/projects"
  "/plan/forecast"
  "/catalog/rubros"
  "/allocation-rules"
  "/providers"
  "/line-items"
)

PASSED=0
FAILED=0

for endpoint in "${ENDPOINTS[@]}"; do
  echo "───────────────────────────────────────────────────────────"
  echo "Testing: OPTIONS ${endpoint}"
  echo ""
  
  RESPONSE=$(curl -s -i -X OPTIONS "${API_BASE}${endpoint}" \
    -H "Origin: ${CF_ORIGIN}" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,content-type")
  
  # Extract status code
  STATUS=$(echo "$RESPONSE" | head -1 | grep -oP 'HTTP/\d(\.\d)? \K\d+' || echo "000")
  
  echo "Status: ${STATUS}"
  
  # Check for required CORS headers
  HAS_ORIGIN=$(echo "$RESPONSE" | grep -i "access-control-allow-origin" || echo "")
  HAS_METHODS=$(echo "$RESPONSE" | grep -i "access-control-allow-methods" || echo "")
  HAS_HEADERS=$(echo "$RESPONSE" | grep -i "access-control-allow-headers" || echo "")
  
  ENDPOINT_PASSED=true
  
  if [ -z "$HAS_ORIGIN" ]; then
    echo "  ✗ Missing: access-control-allow-origin"
    ENDPOINT_PASSED=false
  else
    echo "  ✓ Found: $(echo "$HAS_ORIGIN" | tr -d '\r')"
  fi
  
  if [ -z "$HAS_METHODS" ]; then
    echo "  ✗ Missing: access-control-allow-methods"
    ENDPOINT_PASSED=false
  else
    echo "  ✓ Found: $(echo "$HAS_METHODS" | tr -d '\r')"
  fi
  
  if [ -z "$HAS_HEADERS" ]; then
    echo "  ✗ Missing: access-control-allow-headers"
    ENDPOINT_PASSED=false
  else
    echo "  ✓ Found: $(echo "$HAS_HEADERS" | tr -d '\r')"
  fi
  
  if [ "$ENDPOINT_PASSED" = true ]; then
    echo "  ✅ PASS"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ FAIL"
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
done

echo "═══════════════════════════════════════════════════════════"
echo "  Results"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Passed: ${PASSED}/${#ENDPOINTS[@]}"
echo "Failed: ${FAILED}/${#ENDPOINTS[@]}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ All CORS preflight tests passed"
  exit 0
else
  echo "❌ ${FAILED} CORS preflight test(s) failed"
  echo ""
  echo "Troubleshooting:"
  echo "1. Verify API Gateway CORS configuration in services/finanzas-api/template.yaml"
  echo "2. Check CloudFront domain matches: ${CF_ORIGIN}"
  echo "3. Ensure API has been deployed: sam deploy"
  echo "4. Review docs/runbooks/cors-preflight.md for more details"
  exit 1
fi
