#!/usr/bin/env bash
set -euo pipefail

PREV_HASH_FILE="${1:-}"
FINZ_CHANGED="${2:-}" # expected "true" or "false"
CURRENT_HASH_FILE="dist-finanzas-bundle-hashes.txt"

if [ -z "$PREV_HASH_FILE" ]; then
  echo "❌ Previous hash file path not provided"
  exit 1
fi

if [ ! -f "$PREV_HASH_FILE" ]; then
  echo "❌ Previous hash file does not exist: $PREV_HASH_FILE"
  exit 1
fi

if [ ! -f "$CURRENT_HASH_FILE" ]; then
  echo "❌ Current hash file missing: $CURRENT_HASH_FILE"
  exit 1
fi

echo "🔍 Validating bundle hash vs source changes consistency..."
echo "📊 Debug info:"
echo "  - Previous hash file: $PREV_HASH_FILE"
echo "  - Finanzas source changed: ${FINZ_CHANGED:-unset}"

echo ""
echo "📝 Previous bundle hashes:"
cat "$PREV_HASH_FILE" || echo "  (file not readable)"

echo ""
echo "📝 Current bundle hashes:"
cat "$CURRENT_HASH_FILE"

echo ""
echo "🔬 Comparing hashes..."

HASHES_MATCH=false
if diff -u "$PREV_HASH_FILE" "$CURRENT_HASH_FILE" > /tmp/hash-diff.txt; then
  HASHES_MATCH=true
  echo "ℹ️  Bundle hashes are IDENTICAL to previous successful deploy"
else
  echo "✅ Bundle hashes DIFFER from previous successful deploy:"
  cat /tmp/hash-diff.txt
fi

echo ""
echo "🔎 Source change detection: finz_changed=${FINZ_CHANGED:-unset}"

if [ "$HASHES_MATCH" = "true" ]; then
  if [ "${FINZ_CHANGED}" = "true" ]; then
    echo ""
    echo "❌ GUARD FAILURE: Bundle hashes match previous successful deploy, but Finanzas source files changed."
    echo ""
    echo "This indicates a build problem:"
    echo "  - Source files were modified (detected by git diff)"
    echo "  - But the build output hashes are identical"
    echo "  - This suggests the build is not picking up the source changes"
    echo ""
    echo "🔧 Possible causes:"
    echo "  1. Build cache issue (try clearing node_modules and dist)"
    echo "  2. Vite configuration not watching certain files"
    echo "  3. Source changes in files that don't affect the bundle"
    echo ""
    if [ -f /tmp/finz-changed-files.txt ]; then
      echo "Changed files were:"
      cat /tmp/finz-changed-files.txt
    else
      echo "Changed files list not available (missing /tmp/finz-changed-files.txt)"
    fi
    exit 1
  else
    echo "✅ Bundle hashes unchanged and no Finanzas source files changed; safe to continue."
  fi
else
  echo "✅ Bundle hashes differ from previous deploy; changes detected correctly."
fi
