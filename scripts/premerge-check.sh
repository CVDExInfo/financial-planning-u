#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "Running premerge checks..."
echo "=========================================="

# Install dependencies with frozen lockfile
echo "📦 Installing dependencies..."
yarn install --frozen-lockfile

# Run linter
echo "🔍 Running linter..."
yarn lint

# Run tests
echo "🧪 Running tests..."
yarn test --ci --reporters=default

# Build the project
echo "🏗️  Building project..."
yarn build

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
