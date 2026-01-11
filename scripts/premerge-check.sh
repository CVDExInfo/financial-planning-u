#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "Running premerge checks..."
echo "=========================================="

# Install dependencies with frozen lockfile
echo "📦 Installing dependencies..."
npm ci

# Run linter
echo "🔍 Running linter..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test -- --ci --reporters=default

# Build the project
echo "🏗️  Building project..."
npm run build

# Optional quick smoke check (non-blocking)
echo "💨 Running smoke check (optional)..."
if [ -f "./scripts/smoke-check.js" ]; then
  node ./scripts/smoke-check.js --url http://localhost:3000 || true
else
  echo "ℹ️  Smoke check script not found, skipping..."
fi

echo "=========================================="
echo "✅ All premerge checks passed!"
echo "=========================================="
