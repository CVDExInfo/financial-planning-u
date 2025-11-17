#!/usr/bin/env bash
# Shared helpers for Finanzas CLI smoke tests.

FINZ_SHARED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FINZ_ENV_FILE_DEFAULT="${FINZ_SHARED_DIR}/env.sh"
FINZ_ENV_FILE_PATH="${FINZ_ENV_FILE:-${FINZ_ENV_FILE_DEFAULT}}"

if [[ -f "${FINZ_ENV_FILE_PATH}" ]]; then
  # shellcheck disable=SC1090
  source "${FINZ_ENV_FILE_PATH}"
elif [[ -f "${FINZ_SHARED_DIR}/env-example.sh" ]]; then
  # shellcheck disable=SC1090
  source "${FINZ_SHARED_DIR}/env-example.sh"
  echo "⚠️  Using env-example.sh values; copy to env.sh with real credentials." >&2
else
  echo "❌ Missing env configuration. Provide tests/finanzas/shared/env.sh" >&2
  exit 1
fi

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

obtain_id_token() {
  if [[ -n "${FINZ_ID_TOKEN:-}" ]]; then
    echo "${FINZ_ID_TOKEN}"
    return
  fi

  require_var FINZ_COGNITO_REGION
  require_var FINZ_COGNITO_CLIENT_ID
  require_var FINZ_TEST_EMAIL
  require_var FINZ_TEST_PASSWORD

  FINZ_ID_TOKEN="$(aws cognito-idp initiate-auth \
    --region "${FINZ_COGNITO_REGION}" \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "${FINZ_COGNITO_CLIENT_ID}" \
    --auth-parameters USERNAME="${FINZ_TEST_EMAIL}",PASSWORD="${FINZ_TEST_PASSWORD}" \
    --query 'AuthenticationResult.IdToken' \
    --output text)"

  echo "${FINZ_ID_TOKEN}"
}

finz_auth_header() {
  echo "Authorization: Bearer $(obtain_id_token)"
}

finz_curl() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local log_file="$4"

  ensure_log_dir
  local auth_header
  auth_header="$(finz_auth_header)"

  local -a cmd=(curl -sS -w "\nHTTP %{http_code}\n" -X "${method}" -H "${auth_header}")
  if [[ -n "${data}" ]]; then
    cmd+=(-H "Content-Type: application/json" --data "${data}")
  fi
  cmd+=("${url}")

  echo "➡️  ${method} ${url}" >&2
  "${cmd[@]}" | tee "${log_file}"
}

finz_curl_form() {
  local url="$1"
  local log_file="$2"
  shift 2

  ensure_log_dir
  local auth_header
  auth_header="$(finz_auth_header)"

  local -a cmd=(curl -sS -w "\nHTTP %{http_code}\n" -X POST -H "${auth_header}")
  cmd+=("$@" "$url")

  echo "➡️  FORM POST ${url}" >&2
  "${cmd[@]}" | tee "${log_file}"
}
