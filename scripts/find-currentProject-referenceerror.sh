#!/usr/bin/env bash
set -euo pipefail

echo "Searching for currentProject references..."
rg -n "\bcurrentProject\b" src || true

echo ""
echo "Searching for suspicious patterns (usage without declaration)..."
# crude heuristics: currentProject used but no 'const currentProject' or destructure in same file
for f in $(rg -l "\bcurrentProject\b" src); do
  if ! rg -n "const\s+\{\s*[^}]*currentProject|const\s+currentProject\b|let\s+currentProject\b|var\s+currentProject\b" "$f" >/dev/null; then
    echo "⚠️  POSSIBLE UNDECLARED currentProject in: $f"
  fi
done
