#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../shared/lib.sh
source "${SCRIPT_DIR}/../shared/lib.sh"

guard_dev_api_target
BASE="$(finz_base)"

# Health pre-flight
curl_json "$(join_url "$BASE" '/health')" >/dev/null || echo "⚠️  Health check not available, continuing..."

echo "Discovering projects from $(join_url "$BASE" '/projects')..."

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required"
  exit 1
fi

date >&2

# Build URL and fetch projects
PROJECTS_URL="$(join_url "$BASE" '/projects?limit=50')"
PROJECTS_BODY="$(curl_json "$PROJECTS_URL")"

PROJECT_IDS="$(printf '%s' "$PROJECTS_BODY" | jq -r '.[] | (.id // .projectId // .pk)')"

if [[ -z "$PROJECT_IDS" ]]; then
  echo "::error::No projects returned by /projects"
  exit 1
fi

echo "✅ /projects returned data"
echo "Sample listing (up to five projects):" >&2
echo "$PROJECTS_BODY" | jq -r '.[] | "- \(.id) :: \(.name)"' 2>/dev/null | head -5 || true
