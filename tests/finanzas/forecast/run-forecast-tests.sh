#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

require_var FINZ_API_BASE
PROJECT_ID="${1:-${FINZ_PROJECT_ALMOJABANAS}}"
MONTHS_SHORT=6
MONTHS_LONG=12

LOG_SHORT="${FINZ_LOG_DIR}/finz_forecast_${MONTHS_SHORT}.log"
LOG_LONG="${FINZ_LOG_DIR}/finz_forecast_${MONTHS_LONG}.log"

URL_SHORT="${FINZ_API_BASE}/plan/forecast?projectId=${PROJECT_ID}&months=${MONTHS_SHORT}"
URL_LONG="${FINZ_API_BASE}/plan/forecast?projectId=${PROJECT_ID}&months=${MONTHS_LONG}"

finz_curl GET "${URL_SHORT}" "" "${LOG_SHORT}"
finz_curl GET "${URL_LONG}" "" "${LOG_LONG}"

echo "Expected outcome: both requests return HTTP 200 with arrays of forecast cells matching the requested months window." >&2
