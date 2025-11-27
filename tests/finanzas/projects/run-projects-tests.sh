#!/usr/bin/env bash
set -Eeuo pipefail

###############################################################################
# Finanzas – Projects API contract test
#
# Env required:
#   FINZ_API_BASE              – full API base URL, e.g. https://.../dev
#   AWS_REGION                 – e.g. us-east-2
#   COGNITO_USER_POOL_ID       – Cognito user pool ID
#   COGNITO_WEB_CLIENT         – Cognito app client ID
#   COGNITO_TESTER_USERNAME    – test user (from GitHub Secrets)
#   COGNITO_TESTER_PASSWORD    – test user password (from GitHub Secrets)
#   FINZ_LOG_DIR               – optional; defaults to /tmp/finanzas-tests
#
# Dependencies:
#   - jq installed
#   - scripts/cognito/get-jwt.sh present and executable
###############################################################################

FINZ_LOG_DIR="${FINZ_LOG_DIR:-/tmp/finanzas-tests}"
mkdir -p "$FINZ_LOG_DIR"

# ---------------------------------------------------------------------------
# Resolve API base (and sanitize it)
# ---------------------------------------------------------------------------
BASE="${FINZ_API_BASE:-${DEV_API_URL:-}}"

if [[ -z "${BASE}" ]]; then
  echo "❌ FINZ_API_BASE or DEV_API_URL must be set (e.g. https://.../dev)"
  exit 1
fi

# Remove any CR/LF characters that may have slipped into the env var
BASE="$(printf '%s' "$BASE" | tr -d '\r\n')"

# Normalize trailing slash
BASE="${BASE%/}"

FINZ_API_BASE="$BASE"
echo "ℹ️ Using FINZ_API_BASE: $FINZ_API_BASE"

# Soft check on stage – warn only
if [[ "$FINZ_API_BASE" != *"/dev" ]]; then
  echo "⚠️ Warning: FINZ_API_BASE does not end with /dev (current: $FINZ_API_BASE) – continuing anyway."
fi

# ---------------------------------------------------------------------------
# Validate required Cognito + region env
# ---------------------------------------------------------------------------
: "${AWS_REGION:?AWS_REGION is required}"
: "${COGNITO_WEB_CLIENT:?COGNITO_WEB_CLIENT is required}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID is required}"
: "${COGNITO_TESTER_USERNAME:?COGNITO_TESTER_USERNAME is required}"
: "${COGNITO_TESTER_PASSWORD:?COGNITO_TESTER_PASSWORD is required}"

if [[ ! -x "scripts/cognito/get-jwt.sh" ]]; then
  echo "❌ scripts/cognito/get-jwt.sh not found or not executable"
  exit 1
fi

# ---------------------------------------------------------------------------
# Obtain JWT via helper
# ---------------------------------------------------------------------------
echo "🔐 Obtaining Cognito token for test user..."
TOKEN="$(scripts/cognito/get-jwt.sh || true)"

if [[ -z "$TOKEN" ]]; then
  echo "❌ Unable to obtain Cognito token (scripts/cognito/get-jwt.sh returned empty output)"
  exit 1
fi

echo "✅ Cognito token acquired"

# ---------------------------------------------------------------------------
# Call /projects with Authorization header
# ---------------------------------------------------------------------------
OUT_FILE="$FINZ_LOG_DIR/projects-list.json"
URL="${FINZ_API_BASE}/projects"

echo "🌐 Calling: GET $URL"

HTTP_CODE="$(curl -sS -o "$OUT_FILE" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  "$URL" || echo "000")"

echo "➡️  GET $URL → HTTP $HTTP_CODE"

if [[ "$HTTP_CODE" != 2?? ]]; then
  echo "❌ Expected 2xx from /projects, got $HTTP_CODE"
  echo "--- Response body (first 500 chars) ---"
  if [[ -s "$OUT_FILE" ]]; then
    head -c 500 "$OUT_FILE" || true
    echo
  else
    echo "(empty body)"
  fi
  exit 1
fi

# ---------------------------------------------------------------------------
# Validate JSON structure
# ---------------------------------------------------------------------------
if ! jq -e '.' "$OUT_FILE" >/dev/null 2>&1; then
  echo "❌ /projects response body is not valid JSON"
  echo "--- Raw body (first 500 chars) ---"
  head -c 500 "$OUT_FILE" || true
  echo
  exit 1
fi

echo "✅ /projects reachable and JSON valid"

# ---------------------------------------------------------------------------
# POST /projects happy path
# ---------------------------------------------------------------------------

CREATE_PAYLOAD="${FINZ_LOG_DIR}/project-create.json"
CREATE_CODE="PROJ-$(date +%Y)-$(( (RANDOM % 900) + 100 ))"

cat >"$CREATE_PAYLOAD" <<JSON
{
  "name": "QA Proyecto SD",
  "code": "${CREATE_CODE}",
  "client": "QA Client",
  "start_date": "2025-01-15",
  "end_date": "2025-06-30",
  "currency": "USD",
  "mod_total": 12345.67,
  "description": "Contrato de prueba automatizado"
}
JSON

POST_OK_OUT="$FINZ_LOG_DIR/project-create-response.json"

echo "🌐 Calling: POST ${URL}"
HTTP_CODE=$(curl -sS -o "$POST_OK_OUT" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$CREATE_PAYLOAD" \
  "$URL" || echo "000")

echo "➡️  POST $URL → HTTP $HTTP_CODE"

if [[ "$HTTP_CODE" != 2?? ]]; then
  echo "❌ Expected 2xx from POST /projects, got $HTTP_CODE"
  head -c 500 "$POST_OK_OUT" || true
  exit 1
fi

if ! jq -e '.' "$POST_OK_OUT" >/dev/null 2>&1; then
  echo "❌ POST /projects body is not valid JSON"
  head -c 500 "$POST_OK_OUT" || true
  exit 1
fi

echo "✅ POST /projects accepted payload and returned JSON"

# ---------------------------------------------------------------------------
# POST /projects validation failure (expect 4xx)
# ---------------------------------------------------------------------------
INVALID_PAYLOAD="${FINZ_LOG_DIR}/project-create-invalid.json"

cat >"$INVALID_PAYLOAD" <<'JSON'
{
  "name": "",
  "code": "INVALID",
  "client": "",
  "start_date": "2025-05-10",
  "end_date": "2025-04-01",
  "currency": "USD",
  "mod_total": -1
}
JSON

POST_BAD_OUT="$FINZ_LOG_DIR/project-create-invalid-response.json"

HTTP_CODE=$(curl -sS -o "$POST_BAD_OUT" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$INVALID_PAYLOAD" \
  "$URL" || echo "000")

echo "➡️  POST (invalid) $URL → HTTP $HTTP_CODE"

if [[ "$HTTP_CODE" != 4?? ]]; then
  echo "❌ Expected 4xx from invalid POST /projects, got $HTTP_CODE"
  head -c 500 "$POST_BAD_OUT" || true
  exit 1
fi

echo "✅ Validation errors surface as 4xx for POST /projects"
echo "✅ Finanzas Projects API contract test PASSED"
