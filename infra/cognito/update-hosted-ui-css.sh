#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${COGNITO_USER_POOL_ID:-}" || -z "${COGNITO_CLIENT_ID:-}" ]]; then
  echo "COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set in the environment." >&2
  exit 1
fi

aws cognito-idp set-ui-customization \
  --user-pool-id "$COGNITO_USER_POOL_ID" \
  --client-id "$COGNITO_CLIENT_ID" \
  --css file://infra/cognito/finanzas-hosted-ui.css
