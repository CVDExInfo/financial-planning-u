#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

REPO="$(basename "$ROOT")"
OUT="dist/package-${REPO}-docs.zip"
mkdir -p dist/checks

# (Checksums already built in export.sh, but keep idempotent)
( find docs -type f; find diagrams -type f; find dist/docs -type f ) \
  | sort | xargs -I{} sh -c 'cksum "{}" || shasum -a 256 "{}"' > dist/checks/checksums.txt || true

# Build zip
zip -r "$OUT" docs diagrams dist/docs dist/checks >/dev/null

echo "Package created: $OUT"
ls -lah "$OUT"
