#!/usr/bin/env bash

# Finanzas API comprehensive verification script
# Usage: bash scripts/finanzas-api-verify.sh

set -u -o pipefail

API="${API:-https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev}"
AWS_REGION="${AWS_REGION:-us-east-2}"
UPLOAD_BUCKET="${UPLOAD_BUCKET:-finanzas-sd-documents-dev}"
SAMPLE_PROJECT_ID="${SAMPLE_PROJECT_ID:-sample-project-id}"
SAMPLE_RUBRO_ID="${SAMPLE_RUBRO_ID:-sample-rubro-id}"
SAMPLE_BASELINE_ID="${SAMPLE_BASELINE_ID:-sample-baseline-id}"
SAMPLE_INVOICE_ID="${SAMPLE_INVOICE_ID:-sample-invoice-id}"
SAMPLE_PREFAC_ID="${SAMPLE_PREFAC_ID:-sample-prefactura-id}"
SAMPLE_PROJECT_BODY='{"name":"Automated Test Project","description":"CI generated validation project"}'
SAMPLE_RUBRO_BODY='{"rubroId":"${SAMPLE_RUBRO_ID}","amount":1000,"description":"Automated rubro"}'
SAMPLE_HANDOFF_BODY='{"assignee":"qa-user","notes":"Automated handoff"}'
SAMPLE_INVOICE_BODY='{"status":"APPROVED","updatedBy":"qa-user"}'
SAMPLE_PREFAC_BODY='{"projectId":"${SAMPLE_PROJECT_ID}","amount":5000,"description":"Automated prefactura"}'
SAMPLE_BASELINE_BODY='{"projectId":"${SAMPLE_PROJECT_ID}","total":12000}'
SAMPLE_UPLOAD_CONTENT=$(printf "hello" | base64)

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

header() {
  echo "\n=============================="
  echo "$1"
  echo "=============================="
}

require_tools() {
  for tool in aws curl jq column; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo -e "${RED}Missing dependency: $tool${NC}" >&2
      exit 1
    fi
  done
}

status_color() {
  local code=$1
  case "$code" in
    200|201) echo -e "${GREEN}";;
    400|404) echo -e "${YELLOW}";;
    *) echo -e "${RED}";;
  esac
}

trim_body() {
  head -c 200 | tr '\n' ' ' | tr '\r' ' '
}

perform_request() {
  local name=$1 method=$2 path=$3 body=${4:-}
  header "$name"
  local url="${API}${path}"

  # OPTIONS preflight
  echo "-- Preflight: OPTIONS $path"
  local preflight_body preflight_status
  preflight_body=$(mktemp)
  if preflight_status=$(curl -s -o "$preflight_body" -w "%{http_code}" -X OPTIONS "$url" -H "Origin: https://example.com" -H "Access-Control-Request-Method: $method"); then
    local color
    color=$(status_color "$preflight_status")
    echo -e "${color}OPTIONS status: $preflight_status${NC} | $(cat "$preflight_body" | trim_body)"
  else
    echo -e "${RED}OPTIONS request failed${NC}"
  fi

  # Actual request
  echo "-- Actual: $method $path"
  local resp_file status
  resp_file=$(mktemp)
  local curl_args=(-s -o "$resp_file" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json")
  if [[ -n "$body" ]]; then
    curl_args+=( -d "$body" )
  fi
  if status=$(curl "${curl_args[@]}"); then
    local color
    color=$(status_color "$status")
    echo -e "${color}$method status: $status${NC} | $(cat "$resp_file" | trim_body)"
  else
    echo -e "${RED}$method request failed${NC}"
  fi
}

aws_context() {
  header "AWS Context"
  echo "Caller Identity:"
  aws sts get-caller-identity --region "$AWS_REGION"
  echo
  echo "Configured Region: ${AWS_REGION}"
  echo "API Base URL: ${API}"
}

lambda_map() {
  header "API Gateway -> Lambda Integration Map"
  local api_host api_id api_stage
  api_host=${API#https://}
  api_id=${api_host%%.*}
  api_stage=${API##*/}

  echo "Resolved API ID: $api_id"
  echo "Resolved Stage: $api_stage"
  echo

  echo "Available Lambda functions (filtered)"
  aws lambda list-functions --region "$AWS_REGION" --output table
  echo

  local routes_json integrations_json
  routes_json=$(aws apigatewayv2 get-routes --api-id "$api_id" --region "$AWS_REGION")

  printf "| %-8s | %-35s | %-40s | %-10s | %-6s | %-8s |\n" "Method" "Path" "Lambda" "Secured" "CORS" "Status"
  printf "| %-8s | %-35s | %-40s | %-10s | %-6s | %-8s |\n" "--------" "-----------------------------------" "----------------------------------------" "----------" "------" "--------"

  echo "$routes_json" | jq -r '.Items[] | .routeKey + "|" + (.target // "")' | while IFS='|' read -r routeKey target; do
    local method path integration_id integration_json lambda_uri lambda_name
    method=${routeKey%% *}
    path=${routeKey#* }
    integration_id=${target##*/}
    integration_json=$(aws apigatewayv2 get-integration --api-id "$api_id" --integration-id "$integration_id" --region "$AWS_REGION")
    lambda_uri=$(echo "$integration_json" | jq -r '.integrationUri // ""')
    lambda_name=$(basename "$lambda_uri")
    printf "| %-8s | %-35s | %-40s | %-10s | %-6s | %-8s |\n" "$method" "$path" "$lambda_name" "TBD" "TBD" "OK"
  done
}

dynamo_tables() {
  header "DynamoDB Table Health"
  local tables_env tables
  tables_env=${TABLES:-}
  if [[ -n "$tables_env" ]]; then
    IFS=',' read -ra tables <<< "$tables_env"
  else
    tables=("FinanzasProjects" "FinanzasRubros" "FinanzasPrefacturas" "FinanzasBaseline" "FinanzasInvoices" "FinanzasHandoff")
  fi

  printf "| %-25s | %-10s | %-12s | %-50s |\n" "Table" "Status" "ItemCount" "Sample Items"
  printf "| %-25s | %-10s | %-12s | %-50s |\n" "-------------------------" "----------" "------------" "--------------------------------------------------"

  for table in "${tables[@]}"; do
    local desc scan status item_count sample
    if desc=$(aws dynamodb describe-table --table-name "$table" --region "$AWS_REGION" 2>/dev/null); then
      status=$(echo "$desc" | jq -r '.Table.TableStatus')
      item_count=$(echo "$desc" | jq -r '.Table.ItemCount')
      scan=$(aws dynamodb scan --table-name "$table" --region "$AWS_REGION" --max-items 5 2>/dev/null | jq -c '.Items')
      sample=${scan:0:50}
      printf "| %-25s | %-10s | %-12s | %-50s |\n" "$table" "$status" "$item_count" "$sample"
    else
      printf "| %-25s | %-10s | %-12s | %-50s |\n" "$table" "MISSING" "-" "-"
    fi
  done
}

cedar_authorization() {
  header "Cedar Authorization Checks"
  local policy_store=${POLICY_STORE_ID:-P3wQ5UBQ9YvLb4NaXmSTMG}
  local principal='{"entityType":"finanzassd::UserGroup","entityId":"us-east-2_FyHLtOhiY|FIN"}'
  local resource='{"entityType":"finanzassd::Application","entityId":"finanzas-sd-api-dev"}'

  cat <<"TABLE"
| Action | Expected | Result |
| ------ | -------- | ------ |
TABLE

  local actions=(
    "get /projects"
    "post /projects"
    "get /prefacturas"
    "post /prefacturas"
    "get /plan/forecast"
    "post /uploads/docs"
  )

  for action in "${actions[@]}"; do
    local resp status
    resp=$(aws verifiedpermissions is-authorized \
      --policy-store-id "$policy_store" \
      --principal "$principal" \
      --action "{\"actionType\":\"finanzassd::Action\",\"actionId\":\"$action\"}" \
      --resource "$resource" \
      --region "$AWS_REGION" 2>/dev/null)
    status=$(echo "$resp" | jq -r '.decision // "error"')
    printf "| %s | %s | %s |\n" "$action" "Allow" "$status"
  done
}

s3_upload_check() {
  header "S3 Upload Flow"
  local payload="{\"filename\":\"test.txt\",\"content\":\"$SAMPLE_UPLOAD_CONTENT\"}"
  perform_request "Uploads /uploads/docs" "POST" "/uploads/docs" "$payload"
  echo
  echo "Listing uploads bucket prefix after test (if permitted)..."
  aws s3 ls "s3://${UPLOAD_BUCKET}" --region "$AWS_REGION" || true
}

definition_tests() {
  perform_request "Health" "GET" "/health"
  perform_request "Catalog Rubros" "GET" "/catalog/rubros"
  perform_request "List Projects" "GET" "/projects"
  perform_request "Create Project" "POST" "/projects" "$SAMPLE_PROJECT_BODY"

  perform_request "Create Baseline" "POST" "/baseline" "$SAMPLE_BASELINE_BODY"
  perform_request "Get Baseline" "GET" "/baseline/${SAMPLE_BASELINE_ID}"

  perform_request "List Prefacturas" "GET" "/prefacturas"
  perform_request "Create Prefactura" "POST" "/prefacturas" "$SAMPLE_PREFAC_BODY"

  perform_request "Project Rubros List" "GET" "/projects/${SAMPLE_PROJECT_ID}/rubros"
  perform_request "Project Rubros Create" "POST" "/projects/${SAMPLE_PROJECT_ID}/rubros" "$SAMPLE_RUBRO_BODY"
  perform_request "Project Rubros Delete" "DELETE" "/projects/${SAMPLE_PROJECT_ID}/rubros/${SAMPLE_RUBRO_ID}"

  perform_request "Project Billing" "GET" "/projects/${SAMPLE_PROJECT_ID}/billing"
  perform_request "Plan Forecast" "GET" "/plan/forecast"

  perform_request "Project Handoff" "GET" "/projects/${SAMPLE_PROJECT_ID}/handoff"
  perform_request "Project Handoff Create" "POST" "/projects/${SAMPLE_PROJECT_ID}/handoff" "$SAMPLE_HANDOFF_BODY"

  perform_request "Project Invoices" "GET" "/projects/${SAMPLE_PROJECT_ID}/invoices"
  perform_request "Project Invoice Get" "GET" "/projects/${SAMPLE_PROJECT_ID}/invoices/${SAMPLE_INVOICE_ID}"
  perform_request "Project Invoice Update" "PUT" "/projects/${SAMPLE_PROJECT_ID}/invoices/${SAMPLE_INVOICE_ID}/status" "$SAMPLE_INVOICE_BODY"
}

main() {
  require_tools
  aws_context
  definition_tests
  s3_upload_check
  lambda_map
  dynamo_tables
  cedar_authorization
}

main "$@"
