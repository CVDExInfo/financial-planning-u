#!/usr/bin/env bash
set -euo pipefail

# This script rebuilds the Finanzas bundle and captures stable SHA-256 hashes for
# the primary JS and CSS entrypoints. Optionally, pass a reference hash file as
# the first argument to compare the freshly built hashes against a prior run.
#
# Usage:
#   VITE_API_BASE_URL=https://<api-id>.execute-api.us-east-2.amazonaws.com/dev \
#   BUILD_TARGET=finanzas \
#   ./scripts/finanzas-build-hash-check.sh [/path/to/previous-hashes.txt]
#
# Output:
#   - dist-finanzas/.bundle-hashes.txt : hash manifest written next to the build
#   - /tmp/finz-bundle-hashes.txt      : same manifest stored in /tmp for convenience
#   - Optional diff vs the reference hash file (if provided and readable)

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

: "${VITE_API_BASE_URL:?VITE_API_BASE_URL must be set (e.g., https://<api-id>.execute-api.us-east-2.amazonaws.com/dev)}"

# Normalize env and defaults
BUILD_TARGET=${BUILD_TARGET:-finanzas}
VITE_USE_MOCKS=${VITE_USE_MOCKS:-false}
VITE_PUBLIC_BASE=${VITE_PUBLIC_BASE:-/finanzas/}
REF_FILE=${1:-}

# Clean and rebuild
rm -rf dist-finanzas
BUILD_TARGET="$BUILD_TARGET" \
VITE_API_BASE_URL="${VITE_API_BASE_URL%/}" \
VITE_USE_MOCKS="$VITE_USE_MOCKS" \
VITE_PUBLIC_BASE="$VITE_PUBLIC_BASE" \
npm run build -- --emptyOutDir

echo "🔍 Computing Finanzas bundle hashes..."
sha256sum dist-finanzas/assets/index-*.js dist-finanzas/assets/index-*.css | tee /tmp/finz-bundle-hashes.txt

# Persist alongside the artifacts for downstream steps (e.g., upload to S3)
cp /tmp/finz-bundle-hashes.txt dist-finanzas/.bundle-hashes.txt

echo "✅ Hash manifest written to dist-finanzas/.bundle-hashes.txt and /tmp/finz-bundle-hashes.txt"

# Optional comparison
if [[ -n "$REF_FILE" && -f "$REF_FILE" ]]; then
  echo "🔁 Comparing against reference file: $REF_FILE"
  if diff -u "$REF_FILE" /tmp/finz-bundle-hashes.txt; then
    echo "ℹ️  Hashes match reference"
  else
    echo "ℹ️  Hashes differ from reference (see diff above)"
  fi
else
  echo "ℹ️  No reference hash file provided; skipping comparison"
fi
