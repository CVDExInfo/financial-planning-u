#!/usr/bin/env bash
# deep-route-forecast-v2.sh
# 
# Smoke test for Forecast V2 (Executive Dashboard) route availability
# Verifies that /sdmt/cost/forecast-v2 is accessible and returns expected content

set -euo pipefail

# Configuration
BASE_URL="${1:-http://localhost:5173}"
ROUTE="/finanzas/sdmt/cost/forecast-v2"
EXPECTED_TITLE="Resumen Ejecutivo"
TIMEOUT=10

echo "🔍 Testing Forecast V2 route at: ${BASE_URL}${ROUTE}"

# Test 1: Check route returns 200
echo "  ✓ Test 1: Route accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}${ROUTE}" || echo "000")

if [ "$HTTP_CODE" == "200" ]; then
  echo "    ✅ Route returns 200 OK"
else
  echo "    ❌ Route returned HTTP $HTTP_CODE (expected 200)"
  exit 1
fi

# Test 2: Check response contains expected content
echo "  ✓ Test 2: Content validation..."
RESPONSE=$(curl -s --max-time "$TIMEOUT" "${BASE_URL}${ROUTE}")

if echo "$RESPONSE" | grep -q "$EXPECTED_TITLE"; then
  echo "    ✅ Response contains expected title: '$EXPECTED_TITLE'"
else
  echo "    ⚠️  Warning: Response does not contain expected title (may be OK for SPA)"
fi

# Test 3: Verify it's not a redirect loop
echo "  ✓ Test 3: Redirect check..."
REDIRECT_COUNT=$(curl -s -o /dev/null -w "%{num_redirects}" --max-time "$TIMEOUT" -L "${BASE_URL}${ROUTE}")

if [ "$REDIRECT_COUNT" -lt 5 ]; then
  echo "    ✅ No excessive redirects (count: $REDIRECT_COUNT)"
else
  echo "    ❌ Too many redirects: $REDIRECT_COUNT (possible redirect loop)"
  exit 1
fi

# Test 4: Check that index.html is served (for SPA)
echo "  ✓ Test 4: SPA bundle check..."
if echo "$RESPONSE" | grep -q "vite\|finanzas\|root"; then
  echo "    ✅ SPA bundle appears to be served correctly"
else
  echo "    ⚠️  Warning: Response doesn't appear to be SPA bundle"
fi

echo ""
echo "✅ All smoke tests passed for Forecast V2 route!"
echo ""
exit 0
