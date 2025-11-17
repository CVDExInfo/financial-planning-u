#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

require_var FINZ_API_BASE
PROJECT_ID="${1:-${FINZ_PROJECT_ALMOJABANAS}}"

LIST_URL="${FINZ_API_BASE}/adjustments?project_id=${PROJECT_ID}&limit=10"
CREATE_URL="${FINZ_API_BASE}/adjustments"
LOG_BEFORE="${FINZ_LOG_DIR}/finz_adjustments_before.log"
LOG_CREATE="${FINZ_LOG_DIR}/finz_adjustments_create.log"
LOG_AFTER="${FINZ_LOG_DIR}/finz_adjustments_after.log"

finz_curl GET "${LIST_URL}" "" "${LOG_BEFORE}"

timestamp="$(date +%s)"
read -r -d '' payload <<JSON
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
