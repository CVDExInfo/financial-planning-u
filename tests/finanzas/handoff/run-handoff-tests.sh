#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

guard_dev_api_target
BASE="$(finz_base)"

# Check for jq availability
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ Error: jq is not installed. Please install jq to run this script." >&2
  exit 1
fi

# Health pre-flight
curl_json "$(join_url "$BASE" '/health')" >/dev/null || echo "⚠️  Health check not available, continuing..."

echo "Discovering projects from $(join_url "$BASE" '/projects')..."

PROJECTS_URL="$(join_url "$BASE" '/projects?limit=50')"
PROJECTS_BODY="$(curl_json "$PROJECTS_URL")"

PROJECT_IDS="$(printf '%s' "$PROJECTS_BODY" | jq -r '.[] | (.id // .projectId // .pk)')"

if [[ -z "$PROJECT_IDS" ]]; then
  echo "::error::No projects returned by /projects"
  exit 1
fi

# Use a placeholder email if COGNITO_TESTER_USERNAME not set (for unauthenticated tests)
OWNER_EMAIL="${COGNITO_TESTER_USERNAME:-tester@example.com}"

ensure_log_dir

# Loop through each project and run handoff tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing handoff APIs for project ${PROJECT_ID}" >&2
  
  POST_URL="$(join_url "$BASE" "/projects/$PROJECT_ID/handoff")"
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
