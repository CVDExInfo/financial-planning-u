#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

BASE="$(finz_base)"
URL="$(join_url "$BASE" '/projects?limit=1')"

if [[ "$URL" == *$'\n'* ]]; then
  echo "::error::URL contains newline: $URL"
  exit 1
fi

echo "✅ URL sanity check passed: $URL"
