#!/usr/bin/env bash
# Quick forecast smoke check
# Serves the built finanzas app and verifies the forecast page renders correctly

set -euo pipefail

echo "🔍 Starting Forecast Smoke Test..."

# Serve the build on local port
echo "📦 Starting server on port 4173..."
pnpm exec serve -s dist-finanzas -l 4173 &> serve.log &
SERVER_PID=$!

# Function to cleanup on exit
cleanup() {
  echo "🧹 Cleaning up..."
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to start
echo "⏳ Waiting for server to be ready..."
for i in {1..20}; do
  if curl -sSf http://127.0.0.1:4173/finanzas/ > /dev/null 2>&1; then
    echo "✅ Server is ready"
    break
  fi
  sleep 1
  if [ $i -eq 20 ]; then
    echo "❌ Server failed to start within 20 seconds"
    tail -n 50 serve.log || true
    exit 1
  fi
done

# Check forecast route
echo "🎯 Checking forecast route..."
if ! curl -sSf http://127.0.0.1:4173/finanzas/sdmt/cost/forecast | grep -q "Cuadrícula de Pronóstico"; then
  echo "❌ Forecast page didn't render expected content"
  echo "📄 Server log:"
  tail -n 200 serve.log || true
  exit 1
fi

echo "✅ Forecast smoke test passed!"
echo "   - Server started successfully"
echo "   - Forecast route returns 200"
echo "   - Page contains 'Cuadrícula de Pronóstico'"
