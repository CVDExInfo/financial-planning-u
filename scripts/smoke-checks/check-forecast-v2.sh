#!/usr/bin/env bash
# Quick Forecast V2 smoke check
# Serves the built finanzas app and verifies the forecast-v2 page loads correctly

set -euo pipefail

echo "🔍 Starting Forecast V2 Smoke Test..."

# Quick guard: make sure build produced the expected directory
if [ ! -d "dist-finanzas" ]; then
  echo "❌ dist-finanzas missing - build step likely failed or output moved"
  ls -la || true
  exit 1
fi

# Serve the build on local port using npx (auto-installs if needed)
echo "📦 Starting server on port 4173..."
npx --yes serve -s dist-finanzas -l 4173 &> serve-v2.log &
SERVER_PID=$!

# Function to cleanup on exit
cleanup() {
  echo "🧹 Cleaning up..."
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to be ready using wait-on
echo "⏳ Waiting for server to be ready..."
if ! npx --yes wait-on http://127.0.0.1:4173/finanzas/; then
  echo "❌ Server failed to start within timeout"
  echo "📄 Server log:"
  tail -n 200 serve-v2.log || true
  exit 1
fi
echo "✅ Server is ready"

# Check forecast-v2 route returns valid HTML (basic smoke - doesn't check React-rendered content)
echo "🎯 Checking forecast-v2 route..."
if ! RESPONSE=$(curl -sSf http://127.0.0.1:4173/finanzas/sdmt/cost/forecast-v2); then
  echo "❌ Forecast V2 page failed to return HTML"
  echo "📄 Server log:"
  tail -n 200 serve-v2.log || true
  exit 1
fi

if ! echo "$RESPONSE" | grep -q "<div id=\"root\">"; then
  echo "❌ Forecast V2 page didn't return valid HTML structure (missing root div)"
  echo "📄 Server log:"
  tail -n 200 serve-v2.log || true
  exit 1
fi

# Check that assets are loaded properly
if ! echo "$RESPONSE" | grep -q -E "(\.js|\.css)"; then
  echo "❌ Forecast V2 page didn't include JS/CSS assets"
  echo "📄 Server log:"
  tail -n 200 serve-v2.log || true
  exit 1
fi

# Note: We can't check for data-testid="sdmt-forecast-v2-root" in the static HTML
# because it's added by React after client-side rendering.
# For that check, use Playwright E2E tests instead.

echo "✅ Forecast V2 smoke test passed!"
echo "   - Server started successfully"
echo "   - Forecast V2 route returns HTTP 200"
echo "   - Page contains valid HTML structure"
echo "   - JS/CSS assets are referenced"
echo ""
echo "ℹ️  Note: This test validates static HTML delivery."
echo "   For full React component validation (data-testid checks),"
echo "   use: pnpm test:ui"
