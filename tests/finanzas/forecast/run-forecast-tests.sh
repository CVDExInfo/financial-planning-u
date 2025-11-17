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
  echo "⚠️  No projects found. Skipping forecast tests." >&2
  exit 0
fi

MONTHS_SHORT=6
MONTHS_LONG=12

# Loop through each project and run forecast tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing forecast APIs for project ${PROJECT_ID}" >&2
  
  LOG_SHORT="${FINZ_LOG_DIR}/finz_forecast_${PROJECT_ID}_${MONTHS_SHORT}.log"
  LOG_LONG="${FINZ_LOG_DIR}/finz_forecast_${PROJECT_ID}_${MONTHS_LONG}.log"
  
  URL_SHORT="${FINZ_API_BASE}/plan/forecast?projectId=${PROJECT_ID}&months=${MONTHS_SHORT}"
  URL_LONG="${FINZ_API_BASE}/plan/forecast?projectId=${PROJECT_ID}&months=${MONTHS_LONG}"
  
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
