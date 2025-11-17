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
  echo "⚠️  No projects found. Skipping catalog tests." >&2
  exit 0
fi

# Loop through each project and run catalog tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing catalog APIs for project ${PROJECT_ID}" >&2
  
  RUBROS_URL="${FINZ_API_BASE}/projects/${PROJECT_ID}/rubros"
  LOG_BEFORE="${FINZ_LOG_DIR}/finz_catalog_${PROJECT_ID}_before.log"
  LOG_CREATE="${FINZ_LOG_DIR}/finz_catalog_${PROJECT_ID}_create.log"
  LOG_AFTER="${FINZ_LOG_DIR}/finz_catalog_${PROJECT_ID}_after.log"
  
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
