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
PROJECTS_JSON=$(curl -sS "$FINZ_API_BASE/projects?limit=50")
PROJECTS_BODY=$(echo "$PROJECTS_JSON" | sed '$d')
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
  
  finz_curl GET "${RUBROS_URL}" "" "${LOG_BEFORE}"
  
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
  finz_curl GET "${RUBROS_URL}" "" "${LOG_AFTER}"
  
  echo "Expected outcome: initial GET returns existing rubros, POST responds 200/201 with created entry, second GET includes CLI-RUBRO-${timestamp}." >&2
done
