#!/usr/bin/env bash
# Shared helpers for Finanzas smoke tests (CI mode - no authentication).
# 
# NOTE: This library is designed for GitHub Actions CI where environment variables
# are provided by the workflow. For local testing, manually source env.sh before
# running test scripts.
#
# The library does NOT auto-source env files to avoid confusion in CI.
# All authentication is handled separately by run-login-test.sh.

set -euo pipefail

# Require an environment variable to be set and non-empty
require_env() {
  local v="$1"
  : "${!v:?Missing required env: $v}"
}

# Get the base URL with trailing slash removed and any stray CR/LF stripped
finz_base() {
  require_env FINZ_API_BASE
  # Trim trailing slash and any stray CR/LF
  local base="${FINZ_API_BASE%/}"
  base="$(printf '%s' "$base" | tr -d '\r\n')"
  printf '%s' "$base"
}

# Join base URL and path, ensuring single slash join and no newlines
join_url() {
  local base="$1"; shift
  local path="$1"; shift || true
  # Ensure single slash join and no newlines
  path="$(printf '%s' "$path" | sed 's#^/*#/#' | tr -d '\r\n')"
  printf '%s%s' "$base" "$path"
}

# Execute curl with JSON content type and strict HTTP code validation
curl_json() {
  local url="$1"
  local resp code body
  resp="$(curl -sS -w '\nHTTP %{http_code}\n' "$url" || true)"
  code="$(printf '%s' "$resp" | tail -n1 | awk '{print $2}')"
  body="$(printf '%s' "$resp" | sed '$d')"
  echo "➡️  GET $url"
  echo "HTTP $code"
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    echo "::error::HTTP $code for $url"
    echo "$body"
    return 1
  fi
  printf '%s' "$body"
}

# Legacy function for backward compatibility - wraps existing finz_curl behavior
require_var() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "❌ Environment variable ${var_name} is required." >&2
    exit 1
  fi
}

guard_dev_api_target() {
  require_var FINZ_API_BASE
  # Strip trailing whitespace, newlines, and slashes
  local api="$(printf '%s' "$FINZ_API_BASE" | tr -d '\r\n' | sed 's:/*$::')"
  if [[ "$api" == *"/prod"* ]]; then
    echo "❌ FINZ_API_BASE points to prod: $api" >&2
    echo "   Tests must run against https://<id>.execute-api.<region>.amazonaws.com/dev" >&2
    exit 1
  fi
  if [[ "$api" != */dev ]]; then
    echo "❌ FINZ_API_BASE must point to the dev stage (ends with /dev). Current: $api" >&2
    exit 1
  fi
}

ensure_log_dir() {
  require_var FINZ_LOG_DIR
  mkdir -p "${FINZ_LOG_DIR}"
}

# Simple curl wrapper for unauthenticated smoke tests.
# These tests verify endpoint availability without requiring authentication.
finz_curl() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local log_file="$4"

  ensure_log_dir

  local -a cmd=(curl -sS -w "\nHTTP %{http_code}\n" -X "${method}")
  if [[ -n "${data}" ]]; then
    cmd+=(-H "Content-Type: application/json" --data "${data}")
  fi
  cmd+=("${url}")

  echo "➡️  ${method} ${url}" >&2
  "${cmd[@]}" | tee "${log_file}"
}

# Form POST wrapper for unauthenticated multipart uploads.
finz_curl_form() {
  local url="$1"
  local log_file="$2"
  shift 2

  ensure_log_dir

  local -a cmd=(curl -sS -w "\nHTTP %{http_code}\n" -X POST)
  cmd+=("$@" "$url")

  echo "➡️  FORM POST ${url}" >&2
  "${cmd[@]}" | tee "${log_file}"
}
