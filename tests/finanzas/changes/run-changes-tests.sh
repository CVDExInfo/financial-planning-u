#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

FINZ_LOG_DIR="${FINZ_LOG_DIR:-/tmp/finanzas-tests}"
ensure_log_dir

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq is required to run changes contract tests" >&2
  exit 1
fi

guard_dev_api_target
BASE="$(finz_base)"

: "${AWS_REGION:?AWS_REGION is required}"
: "${COGNITO_WEB_CLIENT:?COGNITO_WEB_CLIENT is required}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID is required}"
: "${COGNITO_TESTER_USERNAME:?COGNITO_TESTER_USERNAME is required}"
: "${COGNITO_TESTER_PASSWORD:?COGNITO_TESTER_PASSWORD is required}"

if [[ ! -x "scripts/cognito/get-jwt.sh" ]]; then
  echo "❌ scripts/cognito/get-jwt.sh not found or not executable" >&2
  exit 1
fi

echo "🔐 Fetching Cognito token for contract tests..."
TOKEN="$(scripts/cognito/get-jwt.sh || true)"
if [[ -z "$TOKEN" ]]; then
  echo "❌ Unable to obtain Cognito token" >&2
  exit 1
fi

echo "🌐 Using API base: $BASE"
PROJECTS_URL="$(join_url "$BASE" '/projects?limit=50')"
PROJECTS_RAW="${FINZ_LOG_DIR}/changes-projects.json"

curl -sS -o "$PROJECTS_RAW" -w '' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  "$PROJECTS_URL"

PROJECT_ID="$(jq -r 'first((.data // .items // .data.items // .data.data // .)[]? | (.id // .projectId // .pk // .project_id))' "$PROJECTS_RAW")"

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "❌ No project id discovered from /projects" >&2
  head -c 400 "$PROJECTS_RAW" || true
  exit 1
fi

echo "✅ Using project $PROJECT_ID"

LIST_URL="$(join_url "$BASE" "/projects/${PROJECT_ID}/changes")"
LOG_LIST_BEFORE="${FINZ_LOG_DIR}/changes_${PROJECT_ID}_before.json"
HTTP_CODE="$(curl -sS -o "$LOG_LIST_BEFORE" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  "$LIST_URL")"

echo "➡️  GET $LIST_URL → HTTP $HTTP_CODE"
if [[ "$HTTP_CODE" != 2?? ]]; then
  echo "❌ Expected 2xx from GET /projects/{id}/changes" >&2
  head -c 400 "$LOG_LIST_BEFORE" || true
  exit 1
fi

TIMESTAMP="$(date +%s)"
read -r -d '' PAYLOAD <<JSON || true
{
  "title": "Contract test change ${TIMESTAMP}",
  "description": "Automated change request from contract script",
  "impact_amount": 1234,
  "currency": "USD",
  "justification": "CI coverage",
  "affected_line_items": ["line-item-${TIMESTAMP}"]
}
JSON

LOG_CREATE="${FINZ_LOG_DIR}/changes_${PROJECT_ID}_create.json"
HTTP_CREATE="$(curl -sS -o "$LOG_CREATE" -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$LIST_URL" \
  --data "$PAYLOAD")"

echo "➡️  POST $LIST_URL → HTTP $HTTP_CREATE"
if [[ "$HTTP_CREATE" != 2?? ]]; then
  echo "❌ Expected 2xx/201 from POST /projects/{id}/changes" >&2
  head -c 400 "$LOG_CREATE" || true
  exit 1
fi

NEW_ID="$(jq -r '.id // .changeId // .sk // ""' "$LOG_CREATE")"

LOG_LIST_AFTER="${FINZ_LOG_DIR}/changes_${PROJECT_ID}_after.json"
HTTP_AFTER="$(curl -sS -o "$LOG_LIST_AFTER" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  "$LIST_URL")"

echo "➡️  GET $LIST_URL (after) → HTTP $HTTP_AFTER"
if [[ "$HTTP_AFTER" != 2?? ]]; then
  echo "❌ Expected 2xx after creation" >&2
  head -c 400 "$LOG_LIST_AFTER" || true
  exit 1
fi

if [[ -n "$NEW_ID" ]]; then
  if ! jq -e --arg id "$NEW_ID" '
    ((.data // .items // .data.items // .data.data // .) // [])
    | map((.id // .changeId // (.sk // "") | sub("^CHANGE#"; "")))
    | any(. == $id)
  ' "$LOG_LIST_AFTER" >/dev/null; then
    echo "❌ Created change $NEW_ID not found in follow-up GET" >&2
    exit 1
  fi
fi

echo "✅ Changes contract test passed for project $PROJECT_ID"
