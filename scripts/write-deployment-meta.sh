#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-dist-finanzas}"

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ ${DIST_DIR} directory not found"
  exit 1
fi

BUILD_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SHORT_SHA="${GITHUB_SHA::7}"

cat > "${DIST_DIR}/deployment-meta.json" <<EOF
{
  "sha": "${GITHUB_SHA}",
  "shortSha": "${SHORT_SHA}",
  "builtAt": "${BUILD_TS}",
  "runId": "${GITHUB_RUN_ID}",
  "runNumber": "${GITHUB_RUN_NUMBER}",
  "workflow": "${GITHUB_WORKFLOW}",
  "repository": "${GITHUB_REPOSITORY}",
  "ref": "${GITHUB_REF}"
}
EOF

echo "✅ deployment-meta.json written"
