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
  echo "⚠️  No projects found. Skipping reconciliation tests." >&2
  exit 0
fi

# Loop through each project and run reconciliation tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing reconciliation APIs for project ${PROJECT_ID}" >&2
  
  # Try to get a line item for this project
  RUBROS_URL="${FINZ_API_BASE}/projects/${PROJECT_ID}/rubros"
  TEMP_RUBROS_LOG="${FINZ_LOG_DIR}/finz_rubros_${PROJECT_ID}_temp.log"
  finz_curl GET "${RUBROS_URL}" "" "${TEMP_RUBROS_LOG}"
  
  RUBROS_BODY=$(sed '$d' "${TEMP_RUBROS_LOG}")
  LINE_ITEM_ID=$(echo "$RUBROS_BODY" | jq -r '.[0].rubroId // .[0].id // empty' 2>/dev/null || echo "")
  
  if [[ -z "$LINE_ITEM_ID" ]]; then
    echo "⚠️  No line items found for project ${PROJECT_ID}. Skipping reconciliation for this project." >&2
    continue
  fi
  
  PREF_URL="${FINZ_API_BASE}/prefacturas?projectId=${PROJECT_ID}"
  UPLOAD_URL="${FINZ_API_BASE}/prefacturas"
  LOG_BEFORE="${FINZ_LOG_DIR}/finz_prefacturas_${PROJECT_ID}_before.log"
  LOG_UPLOAD="${FINZ_LOG_DIR}/finz_prefacturas_${PROJECT_ID}_upload.log"
  LOG_AFTER="${FINZ_LOG_DIR}/finz_prefacturas_${PROJECT_ID}_after.log"
  
  finz_curl GET "${PREF_URL}" "" "${LOG_BEFORE}"
  
  tmpfile="$(mktemp)"
  trap 'rm -f "${tmpfile}"' EXIT
  printf "Automated evidence upload %s" "$(date --iso-8601=seconds)" > "${tmpfile}"
  
  finz_curl_form "${UPLOAD_URL}" "${LOG_UPLOAD}" \
    -F "projectId=${PROJECT_ID}" \
    -F "line_item_id=${LINE_ITEM_ID}" \
    -F "month=1" \
    -F "amount=100" \
    -F "file=@${tmpfile};type=text/plain"
  
  finz_curl GET "${PREF_URL}" "" "${LOG_AFTER}"
  
  echo "Expected outcome: first GET shows current invoices, POST returns HTTP 200/201 with uploaded metadata, second GET includes the new invoice reference." >&2
done
