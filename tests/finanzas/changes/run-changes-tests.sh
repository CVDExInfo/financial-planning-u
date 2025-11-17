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
  echo "⚠️  No projects found. Skipping changes tests." >&2
  exit 0
fi

# Loop through each project and run changes/adjustments tests
for PROJECT_ID in $PROJECT_IDS; do
  echo "" >&2
  echo "Testing adjustments APIs for project ${PROJECT_ID}" >&2
  
  LIST_URL="${FINZ_API_BASE}/adjustments?project_id=${PROJECT_ID}&limit=10"
  CREATE_URL="${FINZ_API_BASE}/adjustments"
  LOG_BEFORE="${FINZ_LOG_DIR}/finz_adjustments_${PROJECT_ID}_before.log"
  LOG_CREATE="${FINZ_LOG_DIR}/finz_adjustments_${PROJECT_ID}_create.log"
  LOG_AFTER="${FINZ_LOG_DIR}/finz_adjustments_${PROJECT_ID}_after.log"
  
  finz_curl GET "${LIST_URL}" "" "${LOG_BEFORE}"
  
  timestamp="$(date +%s)"
  read -r -d '' payload <<JSON || true
{
  "project_id": "${PROJECT_ID}",
  "tipo": "exceso",
  "monto": 1000,
  "fecha_inicio": "2025-01",
  "metodo_distribucion": "pro_rata_forward",
  "justificacion": "CLI evidence payload ${timestamp}",
  "solicitado_por": "${FINZ_TEST_EMAIL}"
}
JSON
  
  finz_curl POST "${CREATE_URL}" "${payload}" "${LOG_CREATE}"
  finz_curl GET "${LIST_URL}" "" "${LOG_AFTER}"
  
  echo "Expected outcome: GET calls return HTTP 200 lists, POST returns 201 with newly created adjustment referencing the justification text." >&2
done
