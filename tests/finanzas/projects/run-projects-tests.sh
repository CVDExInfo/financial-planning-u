#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

require_var FINZ_API_BASE

PROJECTS_URL="${FINZ_API_BASE}/projects?limit=20"
PROJECT_LOG="${FINZ_LOG_DIR}/finz_projects_list.log"

date >&2
finz_curl GET "${PROJECTS_URL}" "" "${PROJECT_LOG}"

echo "Expected outcome: HTTP 200 with a non-empty array of {id,name} entries." >&2
if command -v jq >/dev/null 2>&1; then
  echo "Sample listing (up to five projects) from ${PROJECT_LOG}:" >&2
  jq -r '.[] | "- \(.id) :: \(.name)"' "${PROJECT_LOG}" 2>/dev/null | head -5 || true
else
  echo "jq not available; raw response stored at ${PROJECT_LOG}." >&2
fi
