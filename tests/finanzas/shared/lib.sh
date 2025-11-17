#!/usr/bin/env bash
# Shared helpers for Finanzas smoke tests (CI mode - no authentication).
# 
# NOTE: This library is designed for GitHub Actions CI where environment variables
# are provided by the workflow. For local testing, manually source env.sh before
# running test scripts.
#
# The library does NOT auto-source env files to avoid confusion in CI.
# All authentication is handled separately by run-login-test.sh.

require_var() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "❌ Environment variable ${var_name} is required." >&2
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
