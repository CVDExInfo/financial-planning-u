#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

# Check for jq availability
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ Error: jq is not installed. Please install jq to run this script." >&2
  exit 1
fi

require_var FINZ_API_BASE

# Dynamically discover project IDs
echo "Discovering projects from ${FINZ_API_BASE}/projects..." >&2
PROJECTS_URL="${FINZ_API_BASE}/projects?limit=50"
TEMP_PROJECTS_LOG="${FINZ_LOG_DIR}/finz_projects_discovery.log"
finz_curl GET "${PROJECTS_URL}" "" "${TEMP_PROJECTS_LOG}"

PROJECTS_BODY=$(sed '$d' "${TEMP_PROJECTS_LOG}")
PROJECT_IDS=$(echo "$PROJECTS_BODY" | jq -r '.[] | (.id // .projectId // .pk)')

if [[ -z "$PROJECT_IDS" ]]; then
  echo "⚠️  No projects found. Skipping handoff tests." >&2
  exit 0
fi

# Loop through each project and run handoff tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing handoff APIs for project ${PROJECT_ID}" >&2
  
  POST_URL="${FINZ_API_BASE}/projects/${PROJECT_ID}/handoff"
  GET_URL="${POST_URL}"
  LOG_POST="${FINZ_LOG_DIR}/finz_handoff_${PROJECT_ID}_post.log"
  LOG_GET="${FINZ_LOG_DIR}/finz_handoff_${PROJECT_ID}_get.log"
  
  idempotency_key="CLI-HANDOFF-${RANDOM}-$(date +%s)"
  read -r -d '' payload <<JSON || true
{
  "owner": "${FINZ_TEST_EMAIL}",
  "fields": {
    "status": "submitted",
    "notes": "Automated handoff evidence"
  }
}
JSON
  
  auth_header="$(finz_auth_header)"
  
  curl -sS -w "\nHTTP %{http_code}\n" \
    -X POST \
    -H "${auth_header}" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: ${idempotency_key}" \
    --data "${payload}" \
    "${POST_URL}" | tee "${LOG_POST}"
  
  finz_curl GET "${GET_URL}" "" "${LOG_GET}"
  
  echo "Expected outcome: POST returns HTTP 201 (or 200 if idempotent) with new handoffId, GET returns latest handoff matching the submitted notes." >&2
done
