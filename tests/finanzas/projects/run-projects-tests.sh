#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

require_var FINZ_API_BASE

# Safety: don't hit prod from this workflow
if [[ "$FINZ_API_BASE" == *"/prod"* ]]; then
  echo "❌ FINZ_API_BASE points to a prod stage: $FINZ_API_BASE"
  echo "   Tests must run against dev (https://<id>.execute-api.us-east-2.amazonaws.com/dev)."
  exit 1
fi

echo "Discovering projects from $FINZ_API_BASE/projects..."

PROJECTS_URL="${FINZ_API_BASE}/projects?limit=50"
PROJECT_LOG="${FINZ_LOG_DIR}/finz_projects_list.log"

date >&2

# Make the request and capture response
PROJECTS_JSON=$(finz_curl GET "${PROJECTS_URL}" "" "${PROJECT_LOG}")

# Extract HTTP code from last line
HTTP_CODE=$(tail -n1 "${PROJECT_LOG}" | awk '{print $2}')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ /projects call returned HTTP $HTTP_CODE"
  cat "${PROJECT_LOG}" >&2
  exit 1
fi

echo "✅ /projects returned HTTP 200"

if command -v jq >/dev/null 2>&1; then
  # Extract body (all lines except last which has HTTP code)
  PROJECTS_BODY=$(sed '$d' "${PROJECT_LOG}")
  echo "Sample listing (up to five projects):" >&2
  echo "$PROJECTS_BODY" | jq -r '.[] | "- \(.id) :: \(.name)"' 2>/dev/null | head -5 || true
else
  echo "jq not available; raw response stored at ${PROJECT_LOG}." >&2
fi
