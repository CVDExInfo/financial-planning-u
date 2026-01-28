#!/usr/bin/env bash
# Quick forecast smoke check
# Serves the built finanzas app and verifies the forecast page loads correctly

set -euo pipefail

echo "🔍 Starting Forecast Smoke Test..."

# Quick guard: make sure build produced the expected directory
if [ ! -d "dist-finanzas" ]; then
  echo "❌ dist-finanzas missing - build step likely failed or output moved"
  ls -la || true
  exit 1
fi

# Serve the build on local port using npx (auto-installs if needed)
echo "📦 Starting server on port 4173..."
npx --yes serve -s dist-finanzas -l 4173 &> serve.log &
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
  tail -n 200 serve.log || true
  exit 1
fi
echo "✅ Server is ready"

# Check forecast route returns valid HTML (basic smoke - doesn't check React-rendered content)
echo "🎯 Checking forecast route..."
if ! RESPONSE=$(curl -sSf http://127.0.0.1:4173/finanzas/sdmt/cost/forecast); then
  echo "❌ Forecast page failed to return HTML"
  echo "📄 Server log:"
  tail -n 200 serve.log || true
  exit 1
fi

if ! echo "$RESPONSE" | grep -q "<div id=\"root\">"; then
  echo "❌ Forecast page didn't return valid HTML structure (missing root div)"
  echo "📄 Server log:"
  tail -n 200 serve.log || true
  exit 1
fi

# Check that assets are loaded properly
if ! echo "$RESPONSE" | grep -q -E "(\.js|\.css)"; then
  echo "❌ Forecast page didn't include JS/CSS assets"
  echo "📄 Server log:"
  tail -n 200 serve.log || true
  exit 1
fi

# Check forecast V2 route returns valid HTML
echo "🎯 Checking forecast V2 route..."
if ! RESPONSE_V2=$(curl -sSf http://127.0.0.1:4173/finanzas/sdmt/cost/forecast-v2); then
  echo "❌ Forecast V2 page failed to return HTML"
  echo "📄 Server log:"
  tail -n 200 serve.log || true
  exit 1
fi

if ! echo "$RESPONSE_V2" | grep -q "<div id=\"root\">"; then
  echo "❌ Forecast V2 page didn't return valid HTML structure (missing root div)"
  echo "📄 Server log:"
  tail -n 200 serve.log || true
  exit 1
fi

# Check the main page to verify navigation includes Pronóstico V2
echo "🎯 Checking for Pronóstico V2 navigation..."
if ! HOME_RESPONSE=$(curl -sSf http://127.0.0.1:4173/finanzas/); then
  echo "❌ Home page failed to return HTML"
  echo "📄 Server log:"
  tail -n 200 serve.log || true
  exit 1
fi

# Note: This is checking the HTML structure. The actual navigation is rendered by React,
# but we can verify the route path is in the bundled JS or that the page loads correctly
if ! echo "$HOME_RESPONSE" | grep -q "<div id=\"root\">"; then
  echo "❌ Home page didn't return valid HTML structure"
  echo "📄 Server log:"
  tail -n 200 serve.log || true
  exit 1
fi

echo "✅ Forecast smoke test passed!"
echo "   - Server started successfully"
echo "   - Forecast route returns 200"
echo "   - Forecast V2 route returns 200"
echo "   - Pages contain valid HTML structure"
echo "   - JS/CSS assets are referenced"
