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
REQUESTER_EMAIL="${COGNITO_TESTER_USERNAME:-tester@example.com}"

ensure_log_dir

# Loop through each project and run changes/adjustments tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing adjustments APIs for project ${PROJECT_ID}" >&2
  
  LIST_URL="$(join_url "$BASE" "/adjustments?project_id=${PROJECT_ID}&limit=10")"
  CREATE_URL="$(join_url "$BASE" "/adjustments")"
  LOG_BEFORE="${FINZ_LOG_DIR}/finz_adjustments_${PROJECT_ID}_before.log"
  LOG_CREATE="${FINZ_LOG_DIR}/finz_adjustments_${PROJECT_ID}_create.log"
  LOG_AFTER="${FINZ_LOG_DIR}/finz_adjustments_${PROJECT_ID}_after.log"
  
  # GET adjustments before
  finz_curl GET "${LIST_URL}" "" "${LOG_BEFORE}"
  HTTP_CODE=$(tail -n1 "${LOG_BEFORE}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /adjustments for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  # POST new adjustment
  timestamp="$(date +%s)"
  read -r -d '' payload <<JSON || true
{
  "project_id": "${PROJECT_ID}",
  "tipo": "exceso",
  "monto": 1000,
  "fecha_inicio": "2025-01",
  "metodo_distribucion": "pro_rata_forward",
  "justificacion": "CLI evidence payload ${timestamp}",
  "solicitado_por": "${REQUESTER_EMAIL}"
}
JSON
  
  finz_curl POST "${CREATE_URL}" "${payload}" "${LOG_CREATE}"
  HTTP_CODE=$(tail -n1 "${LOG_CREATE}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo "❌ POST /adjustments for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  # GET adjustments after
  finz_curl GET "${LIST_URL}" "" "${LOG_AFTER}"
  HTTP_CODE=$(tail -n1 "${LOG_AFTER}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /adjustments (after) for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  echo "✅ Changes tests passed for project ${PROJECT_ID}"
done
