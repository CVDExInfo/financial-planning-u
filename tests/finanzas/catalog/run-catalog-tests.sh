#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

BASE="$(finz_base)"

# Safety: don't hit prod from this workflow
if [[ "$BASE" == *"/prod" ]]; then
  echo "::error::FINZ_API_BASE points to prod: $BASE"
  exit 1
fi

# Health pre-flight
curl_json "$(join_url "$BASE" '/health')" >/dev/null || echo "⚠️  Health check not available, continuing..."

# Check for jq availability
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required"
  exit 1
fi

echo "Discovering projects from $(join_url "$BASE" '/projects')..."

PROJECTS_URL="$(join_url "$BASE" '/projects?limit=50')"
PROJECTS_BODY="$(curl_json "$PROJECTS_URL")"

PROJECT_IDS="$(printf '%s' "$PROJECTS_BODY" | jq -r '.[] | (.id // .projectId // .pk)')"

if [[ -z "$PROJECT_IDS" ]]; then
  echo "::error::No projects returned by /projects"
  exit 1
fi

# Loop through each project and run catalog tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing catalog APIs for project ${PROJECT_ID}" >&2
  
  RUBROS_URL="$(join_url "$BASE" "/projects/$PROJECT_ID/rubros")"
  LOG_BEFORE="${FINZ_LOG_DIR}/finz_catalog_${PROJECT_ID}_before.log"
  LOG_CREATE="${FINZ_LOG_DIR}/finz_catalog_${PROJECT_ID}_create.log"
  LOG_AFTER="${FINZ_LOG_DIR}/finz_catalog_${PROJECT_ID}_after.log"
  
  ensure_log_dir
  
  # GET rubros before
  finz_curl GET "${RUBROS_URL}" "" "${LOG_BEFORE}"
  HTTP_CODE=$(tail -n1 "${LOG_BEFORE}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /rubros for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  # POST new rubro
  timestamp="$(date +%s)"
  read -r -d '' payload <<JSON || true
{
  "rubroId": "CLI-RUBRO-${timestamp}",
  "qty": 1,
  "unitCost": 123.45,
  "type": "service",
  "duration": "one-time"
}
JSON
  
  finz_curl POST "${RUBROS_URL}" "${payload}" "${LOG_CREATE}"
  HTTP_CODE=$(tail -n1 "${LOG_CREATE}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo "❌ POST /rubros for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  # GET rubros after
  finz_curl GET "${RUBROS_URL}" "" "${LOG_AFTER}"
  HTTP_CODE=$(tail -n1 "${LOG_AFTER}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /rubros (after) for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  echo "✅ Catalog tests passed for project ${PROJECT_ID}"
done
