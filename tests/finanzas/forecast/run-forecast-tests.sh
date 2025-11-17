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

MONTHS_SHORT=6
MONTHS_LONG=12

ensure_log_dir

# Loop through each project and run forecast tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing forecast APIs for project ${PROJECT_ID}" >&2
  
  LOG_SHORT="${FINZ_LOG_DIR}/finz_forecast_${PROJECT_ID}_${MONTHS_SHORT}.log"
  LOG_LONG="${FINZ_LOG_DIR}/finz_forecast_${PROJECT_ID}_${MONTHS_LONG}.log"
  
  URL_SHORT="$(join_url "$BASE" "/plan/forecast?projectId=${PROJECT_ID}&months=${MONTHS_SHORT}")"
  URL_LONG="$(join_url "$BASE" "/plan/forecast?projectId=${PROJECT_ID}&months=${MONTHS_LONG}")"
  
  # Test short forecast
  finz_curl GET "${URL_SHORT}" "" "${LOG_SHORT}"
  HTTP_CODE=$(tail -n1 "${LOG_SHORT}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /plan/forecast (${MONTHS_SHORT} months) for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  # Test long forecast
  finz_curl GET "${URL_LONG}" "" "${LOG_LONG}"
  HTTP_CODE=$(tail -n1 "${LOG_LONG}" | awk '{print $2}')
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ GET /plan/forecast (${MONTHS_LONG} months) for project $PROJECT_ID returned HTTP $HTTP_CODE"
    exit 1
  fi
  
  echo "✅ Forecast tests passed for project ${PROJECT_ID}"
done
