#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

require_var FINZ_API_BASE
PROJECT_ID="${1:-${FINZ_PROJECT_ALMOJABANAS}}"
POST_URL="${FINZ_API_BASE}/projects/${PROJECT_ID}/handoff"
GET_URL="${POST_URL}"
LOG_POST="${FINZ_LOG_DIR}/finz_handoff_post.log"
LOG_GET="${FINZ_LOG_DIR}/finz_handoff_get.log"

idempotency_key="CLI-HANDOFF-${RANDOM}-$(date +%s)"
read -r -d '' payload <<JSON
{
  "owner": "${FINZ_TEST_EMAIL}",
  "fields": {
    "status": "submitted",
    "notes": "Automated handoff evidence"
  }
}
JSON

auth_header="$(finz_auth_header)"

curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST \
  -H "${auth_header}" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: ${idempotency_key}" \
  --data "${payload}" \
  "${POST_URL}" | tee "${LOG_POST}"

finz_curl GET "${GET_URL}" "" "${LOG_GET}"

echo "Expected outcome: POST returns HTTP 201 (or 200 if idempotent) with new handoffId, GET returns latest handoff matching the submitted notes." >&2
