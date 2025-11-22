#!/usr/bin/env bash
set -euo pipefail

# Finanzas build + hash helper
# Usage: scripts/finanzas-build-hash-check.sh [reference-hash-file]
# - Builds the Finanzas bundle with explicit env vars
# - Computes SHA-256 hashes for index JS/CSS
# - If a reference hash file is provided and exists, compares against it

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/dist-finanzas"
HASH_FILE="$ROOT_DIR/dist-finanzas-bundle-hashes.txt"
REFERENCE_FILE="${1:-}"

API_BASE=${VITE_API_BASE_URL:-${DEV_API_URL:-https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev}}
PUBLIC_BASE=${VITE_PUBLIC_BASE:-/finanzas/}
USE_MOCKS=${VITE_USE_MOCKS:-false}

cd "$ROOT_DIR"

echo "🔧 Building Finanzas bundle with explicit environment..."
rm -rf "$OUT_DIR"
BUILD_TARGET=finanzas \
VITE_API_BASE_URL="$API_BASE" \
VITE_PUBLIC_BASE="$PUBLIC_BASE" \
VITE_USE_MOCKS="$USE_MOCKS" \
npm run build

echo "🔍 Computing bundle hashes..."
sha256sum "$OUT_DIR"/assets/index-*.js "$OUT_DIR"/assets/index-*.css | tee "$HASH_FILE"

if [[ -n "$REFERENCE_FILE" && -f "$REFERENCE_FILE" ]]; then
  echo "🔁 Comparing against reference: $REFERENCE_FILE"
  if cmp -s "$HASH_FILE" "$REFERENCE_FILE"; then
    echo "✅ Hashes match reference."
  else
    echo "⚠️ Hashes differ from reference. Showing diff:" && diff -u "$REFERENCE_FILE" "$HASH_FILE" || true
  fi
else
  [[ -n "$REFERENCE_FILE" ]] && echo "ℹ️ Reference file not found ($REFERENCE_FILE); skipping comparison"
fi

echo "✅ Done. Hashes written to $HASH_FILE"
