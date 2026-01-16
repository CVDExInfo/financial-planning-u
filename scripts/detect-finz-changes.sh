#!/usr/bin/env bash
set -euo pipefail

COMPARE_REF="${1:-}"

if [ -z "$COMPARE_REF" ] || [ "$COMPARE_REF" = "null" ]; then
  COMPARE_REF="HEAD~1"
fi

if ! git rev-parse "$COMPARE_REF" >/dev/null 2>&1; then
  COMPARE_REF="HEAD~1"
fi

echo "🔍 Detecting Finanzas source changes..."
echo "📊 Comparing ${COMPARE_REF}...HEAD"

CHANGED_FILES=$(git diff --name-only "${COMPARE_REF}"...HEAD 2>/dev/null || git diff --name-only "${COMPARE_REF}" HEAD 2>/dev/null || true)
printf '%s\n' "$CHANGED_FILES" > /tmp/finz-changed-files.txt

echo "📝 Total files changed: $(wc -l < /tmp/finz-changed-files.txt)"

FINZ_PATTERN='^(src/modules/finanzas|src/features/sdmt|src/components|src/api|public/|index\.html|vite\.config|package\.json$|pnpm-lock\.yaml$|tailwind\.config\.js|tsconfig)'
FINZ_FILES=$(printf '%s\n' "$CHANGED_FILES" | grep -E "$FINZ_PATTERN" || true)

if [ -n "$FINZ_FILES" ]; then
  FINZ_FILES=$(printf '%s\n' "$FINZ_FILES" | grep -v '^public/docs/' || true)
fi

if [ "$FINZ_FILES" = "package.json" ]; then
  echo "📋 Checking if package.json change affects bundle..."
  if git diff "${COMPARE_REF}"...HEAD -- package.json | grep -E '^\+.*"(dependencies|devDependencies|scripts)"' >/dev/null 2>&1; then
    echo "✅ package.json has dependency or script changes (affects bundle)"
  elif git diff "${COMPARE_REF}"...HEAD -- package.json | grep -E '^\+' | grep -v '^\+\+\+' | grep -v 'packageManager' | grep -v '^$' >/dev/null 2>&1; then
    echo "✅ package.json has non-packageManager changes"
  else
    echo "ℹ️ package.json changed but only metadata (packageManager field)"
    FINZ_FILES=""
  fi
fi

FINZ_CHANGED_VAL="false"

if [ -n "$FINZ_FILES" ]; then
  echo "✅ Finanzas source files changed:"
  printf '%s\n' "$FINZ_FILES" | head -20
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'finz_changed=true\n' >> "$GITHUB_OUTPUT"
  fi
  if [ -n "${GITHUB_ENV:-}" ]; then
    printf 'finz_changed=true\n' >> "$GITHUB_ENV"
  fi
  FINZ_CHANGED_VAL="true"
else
  echo "ℹ️ No Finanzas source files changed (CI-only changes or other modules)"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'finz_changed=false\n' >> "$GITHUB_OUTPUT"
  fi
  if [ -n "${GITHUB_ENV:-}" ]; then
    printf 'finz_changed=false\n' >> "$GITHUB_ENV"
  fi
fi

echo ""
echo "📋 Changed files (first 50):"
head -50 /tmp/finz-changed-files.txt || true

if [ -n "$FINZ_FILES" ]; then
  echo ""
  echo "📋 Finanzas-relevant files (matched by pattern):"
  printf '%s\n' "$FINZ_FILES"
fi

if printf '%s\n' "$CHANGED_FILES" | grep -q 'pnpm-lock\.yaml'; then
  echo ""
  echo "📋 pnpm-lock.yaml changed - checking dependency updates..."
  if [ -f pnpm-lock.yaml ]; then
    echo "  pnpm-lock.yaml size: $(wc -c < pnpm-lock.yaml) bytes"
    echo "  pnpm-lock.yaml lockfileVersion: $(grep -m1 'lockfileVersion:' pnpm-lock.yaml || echo 'N/A')"
  fi
fi

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Finanzas file changes (detected vs ${COMPARE_REF})"
    echo "- Total files changed: $(wc -l < /tmp/finz-changed-files.txt)"
    echo "- Finanzas source changed: ${FINZ_CHANGED_VAL}"
    echo ""
    echo "#### Changed files:"
    head -50 /tmp/finz-changed-files.txt
    echo ""
    if [ -n "$FINZ_FILES" ]; then
      echo "#### Finanzas-relevant files:"
      printf '%s\n' "$FINZ_FILES"
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi
