#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

require_var FINZ_API_BASE
PROJECT_ID="${1:-${FINZ_PROJECT_RECONCILIATION}}"
LINE_ITEM_ID="${FINZ_SAMPLE_LINE_ITEM}"
require_var LINE_ITEM_ID

PREF_URL="${FINZ_API_BASE}/prefacturas?projectId=${PROJECT_ID}"
UPLOAD_URL="${FINZ_API_BASE}/prefacturas"
LOG_BEFORE="${FINZ_LOG_DIR}/finz_prefacturas_before.log"
LOG_UPLOAD="${FINZ_LOG_DIR}/finz_prefacturas_upload.log"
LOG_AFTER="${FINZ_LOG_DIR}/finz_prefacturas_after.log"

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
