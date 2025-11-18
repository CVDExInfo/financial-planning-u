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

ensure_log_dir

# Loop through each project and run reconciliation tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing reconciliation APIs for project ${PROJECT_ID}" >&2
  
  # Try to get a line item for this project
  RUBROS_URL="$(join_url "$BASE" "/projects/$PROJECT_ID/rubros")"
  TEMP_RUBROS_LOG="${FINZ_LOG_DIR}/finz_rubros_${PROJECT_ID}_temp.log"
  
  finz_curl GET "${RUBROS_URL}" "" "${TEMP_RUBROS_LOG}"
  HTTP_CODE=$(tail -n1 "${TEMP_RUBROS_LOG}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "⚠️  GET /rubros for project $PROJECT_ID returned HTTP $HTTP_CODE, skipping"
    continue
  fi
  
  RUBROS_BODY=$(sed '$d' "${TEMP_RUBROS_LOG}")
  LINE_ITEM_ID=$(echo "$RUBROS_BODY" | jq -r '.[0].rubroId // .[0].id // empty' 2>/dev/null || echo "")
  
  if [[ -z "$LINE_ITEM_ID" ]]; then
    echo "⚠️  No line items found for project ${PROJECT_ID}. Skipping reconciliation for this project." >&2
    continue
  fi
  
  PREF_URL="$(join_url "$BASE" "/prefacturas?projectId=${PROJECT_ID}")"
  UPLOAD_URL="$(join_url "$BASE" "/prefacturas")"
  LOG_BEFORE="${FINZ_LOG_DIR}/finz_prefacturas_${PROJECT_ID}_before.log"
  LOG_UPLOAD="${FINZ_LOG_DIR}/finz_prefacturas_${PROJECT_ID}_upload.log"
  LOG_AFTER="${FINZ_LOG_DIR}/finz_prefacturas_${PROJECT_ID}_after.log"
  
  # GET prefacturas before
  finz_curl GET "${PREF_URL}" "" "${LOG_BEFORE}"
  HTTP_CODE=$(tail -n1 "${LOG_BEFORE}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /prefacturas for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  # Upload prefactura
  tmpfile="$(mktemp)"
  trap 'rm -f "${tmpfile}"' EXIT
  printf "Automated evidence upload %s" "$(date --iso-8601=seconds)" > "${tmpfile}"
  
  finz_curl_form "${UPLOAD_URL}" "${LOG_UPLOAD}" \
    -F "projectId=${PROJECT_ID}" \
    -F "line_item_id=${LINE_ITEM_ID}" \
    -F "month=1" \
    -F "amount=100" \
    -F "file=@${tmpfile};type=text/plain"
  
  HTTP_CODE=$(tail -n1 "${LOG_UPLOAD}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo "❌ POST /prefacturas for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  # GET prefacturas after
  finz_curl GET "${PREF_URL}" "" "${LOG_AFTER}"
  HTTP_CODE=$(tail -n1 "${LOG_AFTER}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /prefacturas (after) for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  echo "✅ Reconciliation tests passed for project ${PROJECT_ID}"
done
