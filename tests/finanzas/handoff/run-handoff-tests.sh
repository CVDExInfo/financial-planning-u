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

# Safety: don't hit prod from this workflow
if [[ "$FINZ_API_BASE" == *"/prod"* ]]; then
  echo "❌ FINZ_API_BASE points to a prod stage: $FINZ_API_BASE"
  echo "   Tests must run against dev (https://<id>.execute-api.us-east-2.amazonaws.com/dev)."
  exit 1
fi

echo "Discovering projects from ${FINZ_API_BASE}/projects..."

PROJECTS_URL="${FINZ_API_BASE}/projects?limit=50"
TEMP_PROJECTS_LOG="${FINZ_LOG_DIR}/finz_projects_discovery.log"

finz_curl GET "${PROJECTS_URL}" "" "${TEMP_PROJECTS_LOG}"

# Validate HTTP response
HTTP_CODE=$(tail -n1 "${TEMP_PROJECTS_LOG}" | awk '{print $2}')
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ /projects call returned HTTP $HTTP_CODE"
  cat "${TEMP_PROJECTS_LOG}" >&2
  exit 1
fi

PROJECTS_BODY=$(sed '$d' "${TEMP_PROJECTS_LOG}")
PROJECT_IDS=$(echo "$PROJECTS_BODY" | jq -r '.[] | (.id // .projectId // .pk)')

if [[ -z "$PROJECT_IDS" ]]; then
  echo "⚠️  No projects found. Skipping handoff tests." >&2
  exit 0
fi

# Use a placeholder email if COGNITO_TESTER_USERNAME not set (for unauthenticated tests)
OWNER_EMAIL="${COGNITO_TESTER_USERNAME:-tester@example.com}"

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
  "owner": "${OWNER_EMAIL}",
  "fields": {
    "status": "submitted",
    "notes": "Automated handoff evidence"
  }
}
JSON
  
  # POST handoff (without authentication for smoke test)
  curl -sS -w "\nHTTP %{http_code}\n" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: ${idempotency_key}" \
    --data "${payload}" \
    "${POST_URL}" | tee "${LOG_POST}"
  
  HTTP_CODE=$(tail -n1 "${LOG_POST}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo "❌ POST /handoff for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  # GET handoff
  finz_curl GET "${GET_URL}" "" "${LOG_GET}"
  HTTP_CODE=$(tail -n1 "${LOG_GET}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /handoff for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  echo "✅ Handoff tests passed for project ${PROJECT_ID}"
done
