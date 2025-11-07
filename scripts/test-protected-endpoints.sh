#!/usr/bin/env bash
# Smoke test protected Finanzas API endpoints with Cognito JWT
# Prereqs: aws cli configured, user exists with USERNAME/PASSWORD, jq (optional)
set -euo pipefail

STACK_NAME=${STACK_NAME:-finanzas-sd-api-dev}
REGION=${AWS_REGION:-us-east-2}
: "${CLIENT_ID:?CLIENT_ID required}" 
: "${USERNAME:?USERNAME required}" 
: "${PASSWORD:?PASSWORD required}" 
: "${USER_POOL_ID:?USER_POOL_ID required}" 

if [[ -z "${API_URL:-}" ]]; then
  echo "[info] Resolving API_URL from CloudFormation stack ${STACK_NAME}" >&2
  API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[?OutputKey==`FinzApiUrl`].OutputValue' --output text --region "$REGION")
fi

if [[ -z "$API_URL" || "$API_URL" == "None" ]]; then
  echo "[error] Unable to resolve API URL; ensure stack exists and AWS credentials are set." >&2
  exit 1
fi

echo "[info] API_URL=$API_URL"

echo "[info] Initiating USER_PASSWORD_AUTH to fetch tokens" >&2
AUTH_JSON=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  --region "$REGION")

# Extract ID token (preferred for authorizer) & Access token
ID_TOKEN=$(echo "$AUTH_JSON" | jq -r '.AuthenticationResult.IdToken')
ACCESS_TOKEN=$(echo "$AUTH_JSON" | jq -r '.AuthenticationResult.AccessToken')

if [[ -z "$ID_TOKEN" || "$ID_TOKEN" == "null" ]]; then
  echo "[error] Failed to obtain IdToken" >&2
  exit 2
fi

echo "[info] Token lengths: ID_TOKEN=${#ID_TOKEN} ACCESS_TOKEN=${#ACCESS_TOKEN}" >&2

# Decode JWT parts (non-validated, for debugging only)
header_b64=$(echo "$ID_TOKEN" | cut -d '.' -f1)
claims_b64=$(echo "$ID_TOKEN" | cut -d '.' -f2)
header_json=$(echo "$header_b64" | base64 -d 2>/dev/null || echo '<decode-error>')
claims_json=$(echo "$claims_b64" | base64 -d 2>/dev/null || echo '<decode-error>')

echo "[debug] JWT header: $header_json" >&2
echo "[debug] JWT claims: $claims_json" | sed 's/,/\n/g' >&2

run_call() {
  local path="$1"; shift
  local url="${API_URL}${path}"
  echo "[info] Curling: $url" >&2
  local status
  # Use proper Bearer prefix for JWT authorizer
  status=$(curl -s -o /tmp/resp.json -w '%{http_code}' -H "Authorization: Bearer $ID_TOKEN" "$url" || true)
  local body
  body=$(cat /tmp/resp.json)
  echo "----- $path -----"; echo "Status: $status"; echo "Body: $body" | sed 's/\\n/ /g'
  # Append summary metrics to a scratch file for Evidence Pack
  if [[ "$path" == "/catalog/rubros" ]]; then
    local total=$(echo "$body" | jq -r '.total // ""' 2>/dev/null || true)
    local sample=$(echo "$body" | jq -c '.data[0]' 2>/dev/null || true)
    echo "rubros_total=$total" >> /tmp/finz_evidence.env
    echo "rubros_sample=$sample" >> /tmp/finz_evidence.env
  elif [[ "$path" == "/allocation-rules" ]]; then
    local rule_sample=$(echo "$body" | jq -c '.data[0]' 2>/dev/null || true)
    echo "allocation_rule_sample=$rule_sample" >> /tmp/finz_evidence.env
  elif [[ "$path" == "/adjustments" ]]; then
    echo "adjustments_status=$status" >> /tmp/finz_evidence.env
  fi
}

run_call /catalog/rubros
run_call /allocation-rules
run_call /adjustments

echo "[info] Recent access log lines (last 2m) (showing any 401)" >&2
LOG_GROUP="/aws/http-api/dev/finz-access"
aws logs tail "$LOG_GROUP" --since 2m --region "$REGION" 2>/dev/null | grep -E ' 401 |"401"' || echo "[warn] No access log events or insufficient permissions" >&2

echo "[done]" >&2
