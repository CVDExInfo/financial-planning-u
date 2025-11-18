#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

guard_dev_api_target
BASE="$(finz_base)"

# Ensure log directory exists
ensure_log_dir

# Get JWT token for authentication
echo "🔐 Obtaining JWT token from Cognito..." >&2
JWT_SCRIPT="${SCRIPT_DIR}/../../../scripts/cognito/get-jwt.sh"
if [[ ! -f "$JWT_SCRIPT" ]]; then
  echo "❌ JWT helper script not found at: $JWT_SCRIPT" >&2
  exit 1
fi

JWT_TOKEN=$(bash "$JWT_SCRIPT") || {
  echo "❌ Failed to obtain JWT token" >&2
  exit 1
}

echo "✅ JWT token obtained successfully" >&2

# Health pre-flight (unauthenticated)
curl_json "$(join_url "$BASE" '/health')" >/dev/null || echo "⚠️  Health check not available, continuing..."

echo "📋 Discovering projects from $(join_url "$BASE" '/projects')..."

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq is required but not found" >&2
  exit 1
fi

# Build URL and fetch projects with authentication
PROJECTS_URL="$(join_url "$BASE" '/projects')"
LOG_FILE="${FINZ_LOG_DIR}/projects-list.json"

echo "➡️  GET $PROJECTS_URL" >&2

# Make authenticated request
HTTP_RESPONSE=$(curl -sS -w '\nHTTP_STATUS:%{http_code}\n' \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Accept: application/json" \
  "$PROJECTS_URL" 2>&1) || {
    echo "❌ curl command failed" >&2
    exit 1
  }

# Extract status code and body
HTTP_CODE=$(echo "$HTTP_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
PROJECTS_BODY=$(echo "$HTTP_RESPONSE" | sed '/HTTP_STATUS:/d')

# Save response body to log file
echo "$PROJECTS_BODY" > "$LOG_FILE"

echo "HTTP $HTTP_CODE" >&2

# Append to GitHub Step Summary if available
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### GET /projects"
    echo ""
    echo "- **URL**: \`$PROJECTS_URL\`"
    echo "- **Status**: HTTP $HTTP_CODE"
    echo ""
    echo "#### Response Preview"
    echo '```json'
    # Safely truncate and escape JSON for display (first 2000 chars)
    echo "$PROJECTS_BODY" | head -c 2000 || true
    echo ""
    echo '```'
    echo ""
  } >> "$GITHUB_STEP_SUMMARY"
fi

# Validate HTTP status
if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]]; then
  echo "❌ HTTP $HTTP_CODE for $PROJECTS_URL" >&2
  echo "Response: $PROJECTS_BODY" >&2
  exit 1
fi

# Validate JSON
if ! echo "$PROJECTS_BODY" | jq empty 2>/dev/null; then
  echo "❌ Invalid JSON response from /projects" >&2
  exit 1
fi

# Extract project IDs
PROJECT_COUNT=$(echo "$PROJECTS_BODY" | jq 'length' 2>/dev/null || echo "0")

echo "✅ /projects returned valid JSON with $PROJECT_COUNT items" >&2

if [[ "$PROJECT_COUNT" -gt 0 ]]; then
  echo "Sample listing (up to five projects):" >&2
  echo "$PROJECTS_BODY" | jq -r '.[] | "- \(.id) :: \(.nombre // .name // "unnamed")"' 2>/dev/null | head -5 || true
else
  echo "ℹ️  No projects found (empty list is valid)" >&2
fi
