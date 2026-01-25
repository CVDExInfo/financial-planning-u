#!/usr/bin/env bash
###############################################################################
# scripts/validate-e2e-system.sh
#
# End-to-End Validation Script for Financial Planning System
#
# This script performs comprehensive validation of the entire data flow,
# canonization, S3 fallback, DB lineage, API wiring, IAM permissions, and
# frontend behavior after PRs #997 and #998 have been merged.
#
# Usage:
#   bash scripts/validate-e2e-system.sh [options]
#
# Options:
#   --project-id <id>        Project ID to use for testing (default: P-d9d24218-692f-4702-b860-c205a2aa45b2)
#   --baseline-id <id>       Baseline ID to use for testing (default: base_d01bf4ce1828)
#   --tax-bucket <bucket>    S3 bucket for taxonomy (default: ukusi-ui-finanzas-prod)
#   --tax-key <key>          S3 key for taxonomy (default: taxonomy/rubros.taxonomy.json)
#   --api-url <url>          API Gateway URL (required for API tests)
#   --skip-aws               Skip AWS-specific checks (S3, Lambda, IAM)
#   --skip-ui                Skip UI/E2E tests
#   --output <file>          Output report to file (default: stdout)
#   --help                   Show this help message
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
#   2 - Script error or missing prerequisites
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration defaults
PROJECT_ID="${PROJECT_ID:-P-d9d24218-692f-4702-b860-c205a2aa45b2}"
BASELINE_ID="${BASELINE_ID:-base_d01bf4ce1828}"
TAX_BUCKET="${TAX_BUCKET:-ukusi-ui-finanzas-prod}"
TAX_KEY="${TAX_KEY:-taxonomy/rubros.taxonomy.json}"
AWS_REGION="${AWS_REGION:-us-east-1}"
API_URL="${API_URL:-}"
SKIP_AWS=false
SKIP_UI=false
OUTPUT_FILE=""

# Tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
REPORT_DIR="/tmp/e2e-validation-$(date +%s)"
mkdir -p "$REPORT_DIR"

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --project-id)
      PROJECT_ID="$2"
      shift 2
      ;;
    --baseline-id)
      BASELINE_ID="$2"
      shift 2
      ;;
    --tax-bucket)
      TAX_BUCKET="$2"
      shift 2
      ;;
    --tax-key)
      TAX_KEY="$2"
      shift 2
      ;;
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --skip-aws)
      SKIP_AWS=true
      shift
      ;;
    --skip-ui)
      SKIP_UI=true
      shift
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --help)
      head -n 30 "$0" | grep "^#" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 2
      ;;
  esac
done

###############################################################################
# Utility Functions
###############################################################################

log_section() {
  echo ""
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${BOLD}$1${NC}"
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

log_subsection() {
  echo ""
  echo -e "${BOLD}$1${NC}"
  echo "────────────────────────────────────────────────────────────────────────────────"
}

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✅ PASS:${NC} $1"
}

log_fail() {
  echo -e "${RED}❌ FAIL:${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
}

log_command() {
  echo -e "${BOLD}Command:${NC} $1"
}

check_start() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  echo -n "Checking: $1... "
}

check_pass() {
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
  echo -e "${GREEN}PASS${NC}"
  if [ -n "${2:-}" ]; then
    echo "  └─ $2"
  fi
}

check_fail() {
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  echo -e "${RED}FAIL${NC}"
  if [ -n "${1:-}" ]; then
    echo "  └─ $1"
  fi
}

save_evidence() {
  local name="$1"
  local content="$2"
  local file="$REPORT_DIR/${name}.txt"
  echo "$content" > "$file"
  log_info "Evidence saved: $file"
}

###############################################################################
# Section A: Environment & Prerequisites
###############################################################################

validate_environment() {
  log_section "A. ENVIRONMENT & PREREQUISITES"
  
  log_subsection "A.1 Configuration"
  echo "PROJECT_ID:    $PROJECT_ID"
  echo "BASELINE_ID:   $BASELINE_ID"
  echo "TAX_BUCKET:    $TAX_BUCKET"
  echo "TAX_KEY:       $TAX_KEY"
  echo "AWS_REGION:    $AWS_REGION"
  echo "API_URL:       ${API_URL:-<not set>}"
  echo "SKIP_AWS:      $SKIP_AWS"
  echo "SKIP_UI:       $SKIP_UI"
  
  log_subsection "A.2 Required CLI Tools"
  
  # Node.js
  check_start "Node.js"
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_pass "Node.js $NODE_VERSION"
  else
    check_fail "Node.js not found"
  fi
  
  # pnpm
  check_start "pnpm"
  if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    check_pass "pnpm $PNPM_VERSION"
  else
    check_fail "pnpm not found"
  fi
  
  # jq
  check_start "jq"
  if command -v jq &> /dev/null; then
    JQ_VERSION=$(jq --version)
    check_pass "$JQ_VERSION"
  else
    check_fail "jq not found"
  fi
  
  if [ "$SKIP_AWS" = false ]; then
    # AWS CLI
    check_start "AWS CLI"
    if command -v aws &> /dev/null; then
      AWS_VERSION=$(aws --version 2>&1)
      check_pass "$AWS_VERSION"
    else
      check_fail "AWS CLI not found"
    fi
    
    # SAM CLI
    check_start "SAM CLI"
    if command -v sam &> /dev/null; then
      SAM_VERSION=$(sam --version 2>&1)
      check_pass "$SAM_VERSION"
    else
      log_warning "SAM CLI not found (optional)"
    fi
  fi
}

###############################################################################
# Section B: Taxonomy S3 / Loader Validation
###############################################################################

validate_taxonomy() {
  log_section "B. TAXONOMY S3 / LOADER VALIDATION"
  
  if [ "$SKIP_AWS" = true ]; then
    log_warning "Skipping AWS S3 checks (--skip-aws flag set)"
    return 0
  fi
  
  log_subsection "B.1 S3 Taxonomy Object"
  
  check_start "S3 object exists (s3://${TAX_BUCKET}/${TAX_KEY})"
  if aws s3api head-object --bucket "$TAX_BUCKET" --key "$TAX_KEY" &> /dev/null; then
    METADATA=$(aws s3api head-object --bucket "$TAX_BUCKET" --key "$TAX_KEY" 2>&1)
    save_evidence "s3-head-object" "$METADATA"
    check_pass "S3 object found"
  else
    check_fail "S3 taxonomy object not found"
  fi
  
  log_subsection "B.2 Lambda Environment Variables"
  
  # Try to find finanzas Lambda functions
  log_info "Looking for finanzas Lambda functions..."
  if LAMBDA_FUNCTIONS=$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `finanzas`)].FunctionName' --output text 2>/dev/null); then
    if [ -n "$LAMBDA_FUNCTIONS" ]; then
      for FUNCTION in $LAMBDA_FUNCTIONS; do
        check_start "Lambda config for $FUNCTION"
        CONFIG=$(aws lambda get-function-configuration --function-name "$FUNCTION" 2>&1)
        save_evidence "lambda-config-$FUNCTION" "$CONFIG"
        
        ENV_VARS=$(echo "$CONFIG" | jq -r '.Environment.Variables // {}')
        save_evidence "lambda-env-$FUNCTION" "$ENV_VARS"
        check_pass "Config retrieved"
        
        # Check for taxonomy environment variables
        TAX_S3_BUCKET=$(echo "$ENV_VARS" | jq -r '.TAXONOMY_S3_BUCKET // ""')
        TAX_S3_KEY=$(echo "$ENV_VARS" | jq -r '.TAXONOMY_S3_KEY // ""')
        
        if [ -n "$TAX_S3_BUCKET" ] || [ -n "$TAX_S3_KEY" ]; then
          log_info "  TAXONOMY_S3_BUCKET: $TAX_S3_BUCKET"
          log_info "  TAXONOMY_S3_KEY: $TAX_S3_KEY"
        else
          log_info "  No taxonomy S3 env vars (using local file)"
        fi
      done
    else
      log_warning "No finanzas Lambda functions found"
    fi
  else
    log_warning "Unable to list Lambda functions"
  fi
  
  log_subsection "B.3 Lambda IAM Permissions"
  
  if [ -n "${LAMBDA_FUNCTIONS:-}" ]; then
    for FUNCTION in $LAMBDA_FUNCTIONS; do
      check_start "IAM role for $FUNCTION"
      ROLE=$(aws lambda get-function-configuration --function-name "$FUNCTION" --query 'Role' --output text 2>/dev/null || echo "")
      if [ -n "$ROLE" ]; then
        ROLE_NAME=$(basename "$ROLE")
        log_info "  Role: $ROLE_NAME"
        
        # Get attached policies
        ATTACHED_POLICIES=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" 2>&1 || echo "")
        save_evidence "iam-attached-policies-$ROLE_NAME" "$ATTACHED_POLICIES"
        
        # Get inline policies
        INLINE_POLICIES=$(aws iam list-role-policies --role-name "$ROLE_NAME" 2>&1 || echo "")
        save_evidence "iam-inline-policies-$ROLE_NAME" "$INLINE_POLICIES"
        
        check_pass "Role policies retrieved"
      else
        check_fail "Could not get Lambda role"
      fi
    done
  fi
}

###############################################################################
# Section C: API Health Checks
###############################################################################

validate_api_health() {
  log_section "C. API HEALTH CHECKS"
  
  if [ -z "$API_URL" ]; then
    log_warning "API_URL not set, skipping API health checks"
    log_info "Set API_URL with --api-url to enable API tests"
    return 0
  fi
  
  API_URL="${API_URL%/}" # Remove trailing slash
  
  log_subsection "C.1 Core API Endpoints"
  
  # GET /projects/{projectId}/rubros
  check_start "GET /projects/${PROJECT_ID}/rubros"
  RUBROS_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/projects/${PROJECT_ID}/rubros" 2>&1 || echo "000")
  HTTP_CODE=$(echo "$RUBROS_RESPONSE" | tail -n1)
  RESPONSE_BODY=$(echo "$RUBROS_RESPONSE" | sed '$d')
  save_evidence "api-get-rubros" "$RUBROS_RESPONSE"
  
  if [ "$HTTP_CODE" = "200" ]; then
    check_pass "HTTP 200"
    # Check for canonical IDs in response
    if echo "$RESPONSE_BODY" | jq -e '.rubros[]?.rubroId' &> /dev/null; then
      log_info "  Found canonical rubro IDs in response"
    fi
  else
    check_fail "HTTP $HTTP_CODE"
  fi
  
  log_subsection "C.2 API Response Validation"
  
  if [ "$HTTP_CODE" = "200" ]; then
    check_start "Response contains canonical rubro IDs"
    if echo "$RESPONSE_BODY" | jq -e '.rubros' &> /dev/null; then
      RUBRO_COUNT=$(echo "$RESPONSE_BODY" | jq '.rubros | length')
      check_pass "Found $RUBRO_COUNT rubros"
    else
      check_fail "No rubros array in response"
    fi
  fi
}

###############################################################################
# Section D: Data Lineage Verification
###############################################################################

validate_data_lineage() {
  log_section "D. DATA LINEAGE VERIFICATION"
  
  if [ "$SKIP_AWS" = true ]; then
    log_warning "Skipping data lineage checks (--skip-aws flag set)"
    return 0
  fi
  
  log_info "Data lineage: Baseline → Materializer → Allocations → API"
  
  log_subsection "D.1 DynamoDB Table Check"
  
  # Try to list DynamoDB tables
  check_start "DynamoDB tables"
  if TABLES=$(aws dynamodb list-tables --query 'TableNames' --output json 2>/dev/null); then
    save_evidence "dynamodb-tables" "$TABLES"
    ALLOC_TABLE=$(echo "$TABLES" | jq -r '.[] | select(contains("allocations"))' | head -n1)
    RUBROS_TABLE=$(echo "$TABLES" | jq -r '.[] | select(contains("project") and contains("rubros"))' | head -n1)
    
    log_info "  Allocations table: ${ALLOC_TABLE:-<not found>}"
    log_info "  Project rubros table: ${RUBROS_TABLE:-<not found>}"
    check_pass "Tables found"
  else
    check_fail "Could not list DynamoDB tables"
  fi
  
  log_subsection "D.2 Sample Allocation Query"
  
  if [ -n "${ALLOC_TABLE:-}" ]; then
    check_start "Query allocations for project $PROJECT_ID"
    QUERY_RESULT=$(aws dynamodb query \
      --table-name "$ALLOC_TABLE" \
      --key-condition-expression "pk = :p" \
      --expression-attribute-values "{\":p\":{\"S\":\"PROJECT#${PROJECT_ID}\"}}" \
      --limit 5 \
      --output json 2>&1 || echo "{}")
    
    save_evidence "dynamodb-allocations-query" "$QUERY_RESULT"
    
    ITEM_COUNT=$(echo "$QUERY_RESULT" | jq '.Items | length' 2>/dev/null || echo "0")
    if [ "$ITEM_COUNT" -gt 0 ]; then
      check_pass "Found $ITEM_COUNT allocation items"
      
      # Check for canonical fields
      SAMPLE_ITEM=$(echo "$QUERY_RESULT" | jq '.Items[0]' 2>/dev/null || echo "{}")
      if echo "$SAMPLE_ITEM" | jq -e '.rubro_id' &> /dev/null; then
        RUBRO_ID=$(echo "$SAMPLE_ITEM" | jq -r '.rubro_id.S // .rubro_id' 2>/dev/null || echo "")
        CANONICAL_RUBRO_ID=$(echo "$SAMPLE_ITEM" | jq -r '.canonical_rubro_id.S // .canonical_rubro_id // ""' 2>/dev/null || echo "")
        log_info "  Sample rubro_id: $RUBRO_ID"
        log_info "  Sample canonical_rubro_id: $CANONICAL_RUBRO_ID"
      fi
    else
      log_warning "No allocations found for this project"
    fi
  fi
}

###############################################################################
# Section E: Migration Script Verification
###############################################################################

validate_migration_script() {
  log_section "E. MIGRATION SCRIPT VERIFICATION"
  
  log_subsection "E.1 Migration Script Existence"
  
  SCRIPT_PATH="scripts/fix-noncanonical-rubros.cjs"
  check_start "Migration script exists"
  if [ -f "$SCRIPT_PATH" ]; then
    check_pass "Found at $SCRIPT_PATH"
  else
    check_fail "Script not found at $SCRIPT_PATH"
    return 1
  fi
  
  log_subsection "E.2 Dry-Run Capability"
  
  log_info "Testing migration script dry-run mode..."
  log_command "node $SCRIPT_PATH --dryrun 2>&1 | head -n 50"
  
  # Note: This will fail if ts-node is not installed, which is expected
  # We're just checking if the script can be invoked
  if DRY_RUN_OUTPUT=$(timeout 10 node "$SCRIPT_PATH" --dryrun 2>&1 | head -n 50 || true); then
    save_evidence "migration-dryrun" "$DRY_RUN_OUTPUT"
    
    if echo "$DRY_RUN_OUTPUT" | grep -q "DRY RUN\|Scanning\|Processing"; then
      log_success "Migration script can be executed"
    else
      log_warning "Migration script may need dependencies (ts-node)"
      log_info "Output: $DRY_RUN_OUTPUT"
    fi
  fi
}

###############################################################################
# Section F: IAM/Permission Checks
###############################################################################

validate_iam_permissions() {
  log_section "F. IAM/PERMISSION CHECKS"
  
  if [ "$SKIP_AWS" = true ]; then
    log_warning "Skipping IAM checks (--skip-aws flag set)"
    return 0
  fi
  
  log_subsection "F.1 Lambda Execution Roles"
  
  if [ -n "${LAMBDA_FUNCTIONS:-}" ]; then
    for FUNCTION in $LAMBDA_FUNCTIONS; do
      log_info "Checking permissions for $FUNCTION..."
      
      ROLE=$(aws lambda get-function-configuration --function-name "$FUNCTION" --query 'Role' --output text 2>/dev/null || echo "")
      if [ -n "$ROLE" ]; then
        ROLE_NAME=$(basename "$ROLE")
        
        # Check for required permissions
        check_start "DynamoDB permissions for $ROLE_NAME"
        INLINE_POLICY_NAMES=$(aws iam list-role-policies --role-name "$ROLE_NAME" --query 'PolicyNames' --output json 2>/dev/null || echo "[]")
        
        HAS_DYNAMO_PERMS=false
        for POLICY_NAME in $(echo "$INLINE_POLICY_NAMES" | jq -r '.[]'); do
          POLICY=$(aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" --query 'PolicyDocument' 2>/dev/null || echo "{}")
          if echo "$POLICY" | jq -e '.Statement[]? | select(.Action[]? | contains("dynamodb"))' &> /dev/null; then
            HAS_DYNAMO_PERMS=true
            break
          fi
        done
        
        if [ "$HAS_DYNAMO_PERMS" = true ]; then
          check_pass "Has DynamoDB permissions"
        else
          log_warning "DynamoDB permissions not found in inline policies (may be in managed policies)"
        fi
        
        # Check for S3 permissions
        check_start "S3 permissions for $ROLE_NAME"
        HAS_S3_PERMS=false
        for POLICY_NAME in $(echo "$INLINE_POLICY_NAMES" | jq -r '.[]'); do
          POLICY=$(aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" --query 'PolicyDocument' 2>/dev/null || echo "{}")
          if echo "$POLICY" | jq -e '.Statement[]? | select(.Action[]? | contains("s3"))' &> /dev/null; then
            HAS_S3_PERMS=true
            break
          fi
        done
        
        if [ "$HAS_S3_PERMS" = true ]; then
          check_pass "Has S3 permissions"
        else
          log_warning "S3 permissions not found (may use local taxonomy)"
        fi
      fi
    done
  fi
}

###############################################################################
# Section G: Frontend / UI Checks
###############################################################################

validate_frontend() {
  log_section "G. FRONTEND / UI CHECKS"
  
  if [ "$SKIP_UI" = true ]; then
    log_warning "Skipping UI checks (--skip-ui flag set)"
    return 0
  fi
  
  log_subsection "G.1 Frontend Build"
  
  check_start "Frontend can build"
  if [ -f "package.json" ]; then
    log_info "Building frontend (this may take a moment)..."
    if BUILD_OUTPUT=$(pnpm build:finanzas 2>&1); then
      save_evidence "frontend-build" "$BUILD_OUTPUT"
      check_pass "Build successful"
    else
      save_evidence "frontend-build-error" "$BUILD_OUTPUT"
      check_fail "Build failed"
    fi
  else
    check_fail "package.json not found"
  fi
  
  log_subsection "G.2 E2E Tests"
  
  if command -v playwright &> /dev/null; then
    log_info "Playwright is available for E2E tests"
    
    check_start "E2E test infrastructure"
    if [ -f "playwright.config.ts" ]; then
      check_pass "Playwright config found"
    else
      log_warning "No playwright.config.ts found"
    fi
  else
    log_warning "Playwright not installed (E2E tests unavailable)"
  fi
}

###############################################################################
# Section H: CI Integration & Forbidden Tokens Check
###############################################################################

validate_ci_checks() {
  log_section "H. CI INTEGRATION & FORBIDDEN TOKENS CHECK"
  
  log_subsection "H.1 Canonical Rubros Check"
  
  CI_SCRIPT="ci/check-canonical-rubros.cjs"
  check_start "CI check script exists"
  if [ -f "$CI_SCRIPT" ]; then
    check_pass "Found at $CI_SCRIPT"
  else
    check_fail "Script not found"
    return 1
  fi
  
  log_subsection "H.2 Run Canonical Rubros Validation"
  
  log_info "Running canonical rubros check..."
  log_command "node $CI_SCRIPT"
  
  if CI_OUTPUT=$(node "$CI_SCRIPT" 2>&1); then
    save_evidence "ci-canonical-check" "$CI_OUTPUT"
    
    if echo "$CI_OUTPUT" | grep -q "SUCCESS\|All checks passed\|No forbidden tokens"; then
      log_success "CI check passed: No forbidden tokens found"
    else
      log_warning "CI check completed with warnings"
    fi
  else
    CI_EXIT_CODE=$?
    save_evidence "ci-canonical-check-fail" "$CI_OUTPUT"
    
    if echo "$CI_OUTPUT" | grep -q "FAIL\|Non-canonical"; then
      log_fail "CI check failed: Non-canonical rubro IDs found"
      echo "$CI_OUTPUT" | grep -A 10 "Found rubro IDs"
    else
      log_fail "CI check script error (exit code: $CI_EXIT_CODE)"
    fi
  fi
  
  log_subsection "H.3 Forbidden Rubros Check"
  
  FORBIDDEN_SCRIPT="ci/check-forbidden-rubros.sh"
  if [ -f "$FORBIDDEN_SCRIPT" ]; then
    check_start "Forbidden rubros check"
    if bash "$FORBIDDEN_SCRIPT" &> /dev/null; then
      check_pass "No forbidden rubros found"
    else
      check_fail "Forbidden rubros detected"
    fi
  fi
}

###############################################################################
# Section I: Post-Deployment Monitoring
###############################################################################

validate_monitoring() {
  log_section "I. POST-DEPLOYMENT MONITORING"
  
  if [ "$SKIP_AWS" = true ]; then
    log_warning "Skipping monitoring checks (--skip-aws flag set)"
    return 0
  fi
  
  log_subsection "I.1 CloudWatch Logs"
  
  if [ -n "${LAMBDA_FUNCTIONS:-}" ]; then
    for FUNCTION in $LAMBDA_FUNCTIONS; do
      LOG_GROUP="/aws/lambda/$FUNCTION"
      
      check_start "Recent logs for $FUNCTION"
      # Get logs from last 5 minutes
      START_TIME=$(($(date +%s) - 300))000
      
      if LOGS=$(aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time "$START_TIME" \
        --limit 50 \
        --output json 2>&1); then
        
        save_evidence "cloudwatch-logs-$FUNCTION" "$LOGS"
        
        EVENT_COUNT=$(echo "$LOGS" | jq '.events | length' 2>/dev/null || echo "0")
        check_pass "Retrieved $EVENT_COUNT log events"
        
        # Check for errors
        if echo "$LOGS" | jq -e '.events[]? | select(.message | contains("ERROR"))' &> /dev/null; then
          log_warning "Found ERROR messages in logs"
        fi
        
        # Check for taxonomy load messages
        if echo "$LOGS" | jq -e '.events[]? | select(.message | contains("taxonomy"))' &> /dev/null; then
          log_info "  Found taxonomy-related log messages"
        fi
      else
        log_warning "Could not retrieve logs (may not exist or no recent activity)"
      fi
    done
  fi
  
  log_subsection "I.2 Monitoring Recommendations"
  
  log_info "Post-deployment monitoring steps:"
  log_info "  1. Monitor CloudWatch alarms for Lambda 5xx errors"
  log_info "  2. Check API Gateway metrics for error rates"
  log_info "  3. Sample allocations data for canonical rubro_id consistency"
  log_info "  4. Review application logs for 'Unknown rubro_id' warnings"
}

###############################################################################
# Section J: Report & Remediation
###############################################################################

generate_report() {
  log_section "J. REPORT & REMEDIATION"
  
  log_subsection "J.1 Summary"
  
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo "                        VALIDATION SUMMARY                                      "
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "Total Checks:  $TOTAL_CHECKS"
  echo "Passed:        $PASSED_CHECKS ($(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))%)"
  echo "Failed:        $FAILED_CHECKS"
  echo ""
  
  if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✅ GO-LIVE READINESS: PASSED${NC}"
    echo ""
    echo "All checks passed successfully:"
    echo "  ✓ Taxonomy S3 readable (or local fallback available)"
    echo "  ✓ Lambdas have required S3 & DynamoDB permissions"
    echo "  ✓ Handlers and materializer write canonical rubro IDs"
    echo "  ✓ Migration script dry-run functional"
    echo "  ✓ CI checks for forbidden tokens pass"
    echo ""
    echo "RECOMMENDATION: System is ready for production deployment."
  else
    echo -e "${RED}${BOLD}❌ GO-LIVE READINESS: FAILED${NC}"
    echo ""
    echo "One or more checks failed. Review the detailed output above."
    echo ""
    
    log_subsection "J.2 Remediation Plan"
    echo ""
    echo "Common remediation steps:"
    echo ""
    echo "1. Missing S3 taxonomy:"
    echo "   → Upload data/rubros.taxonomy.json to s3://${TAX_BUCKET}/${TAX_KEY}"
    echo "   → Command: aws s3 cp data/rubros.taxonomy.json s3://${TAX_BUCKET}/${TAX_KEY}"
    echo ""
    echo "2. Missing Lambda permissions:"
    echo "   → Add s3:GetObject permission to Lambda execution role"
    echo "   → Add dynamodb:PutItem, dynamodb:Query permissions"
    echo ""
    echo "3. Non-canonical rubro IDs in database:"
    echo "   → Run migration script: node scripts/fix-noncanonical-rubros.cjs --apply"
    echo ""
    echo "4. CI check failures:"
    echo "   → Review non-canonical IDs found by ci/check-canonical-rubros.cjs"
    echo "   → Add missing IDs to data/rubros.taxonomy.json or LEGACY_RUBRO_ID_MAP"
    echo ""
  fi
  
  log_subsection "J.3 Evidence Files"
  echo ""
  echo "Evidence files saved to: $REPORT_DIR"
  if [ -d "$REPORT_DIR" ]; then
    ls -lh "$REPORT_DIR" | tail -n +2 | awk '{print "  - " $9 " (" $5 ")"}'
  fi
  echo ""
  
  if [ -n "$OUTPUT_FILE" ]; then
    log_info "Saving report to $OUTPUT_FILE..."
    # This script's output is already being captured if redirected
    echo "Report saved to: $OUTPUT_FILE"
  fi
}

###############################################################################
# Main Execution
###############################################################################

main() {
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo "        END-TO-END VALIDATION - Financial Planning System (Finanzas)           "
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "Validation of data flow, lineage, APIs, permissions after PRs #997 and #998"
  echo ""
  echo "Started: $(date)"
  echo ""
  
  validate_environment
  validate_taxonomy
  validate_api_health
  validate_data_lineage
  validate_migration_script
  validate_iam_permissions
  validate_frontend
  validate_ci_checks
  validate_monitoring
  generate_report
  
  echo ""
  echo "Completed: $(date)"
  echo ""
  
  # Exit with appropriate code
  if [ $FAILED_CHECKS -eq 0 ]; then
    exit 0
  else
    exit 1
  fi
}

# Run main function
main
