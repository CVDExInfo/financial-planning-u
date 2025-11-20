#!/bin/bash
###############################################################################
# Quick Test Runner for Finanzas
# Wrapper script that handles credential loading and runs tests
###############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Finanzas Quick Test Runner                        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}\n"

# Check if credentials are available
if [[ -z "${USERNAME:-}" || -z "${PASSWORD:-}" ]]; then
    if [[ -z "${TEST_USERNAME:-}" || -z "${TEST_PASSWORD:-}" ]]; then
        echo -e "${YELLOW}⚠️  No credentials found in environment${NC}\n"
        echo "To run tests, you need to provide Cognito test user credentials."
        echo ""
        echo "Choose one of these methods:"
        echo ""
        echo -e "${GREEN}Method 1: Environment Variables${NC}"
        echo "  export USERNAME='your-cognito-username'"
        echo "  export PASSWORD='your-password'"
        echo "  ./scripts/run-tests.sh"
        echo ""
        echo -e "${GREEN}Method 2: Inline${NC}"
        echo "  USERNAME='user' PASSWORD='pass' ./scripts/run-tests.sh"
        echo ""
        echo -e "${GREEN}Method 3: From GitHub Secrets (CI only)${NC}"
        echo "  GitHub Actions automatically injects:"
        echo "  - secrets.USERNAME"
        echo "  - secrets.PASSWORD"
        echo ""
        echo -e "${BLUE}ℹ️  Test user should have Finanzas role/group in Cognito${NC}"
        echo ""
        exit 1
    else
        # Use TEST_* variables
        export USERNAME="${TEST_USERNAME}"
        export PASSWORD="${TEST_PASSWORD}"
    fi
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    echo "Install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Check jq
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq not found (optional but recommended)${NC}"
    echo "Install: sudo apt-get install jq (or brew install jq on macOS)"
fi

# Display configuration
echo -e "${GREEN}✓ Credentials loaded${NC}"
echo -e "${BLUE}ℹ️  API Base: ${API_BASE_URL:-https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev}${NC}"
echo -e "${BLUE}ℹ️  Cognito Pool: ${COGNITO_USER_POOL_ID:-us-east-2_FyHLtOhiY}${NC}"
echo ""

# Ask what to test
echo "What would you like to test?"
echo ""
echo "  1) Run all API tests (automated)"
echo "  2) Test API connection only"
echo "  3) Open interactive browser test helper"
echo "  4) View existing test results"
echo "  5) Run with custom options"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        echo -e "\n${GREEN}Running all API tests...${NC}\n"
        exec ./scripts/manual-test-finanzas.sh
        ;;
    2)
        echo -e "\n${GREEN}Testing API connection...${NC}\n"
        API_BASE="${API_BASE_URL:-https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev}"
        
        echo "Testing: ${API_BASE}/health"
        if curl -sf "${API_BASE}/health" | jq '.' 2>/dev/null; then
            echo -e "\n${GREEN}✓ API is healthy!${NC}"
        else
            echo -e "\n${RED}✗ API health check failed${NC}"
            exit 1
        fi
        
        echo -e "\nTesting: ${API_BASE}/catalog/rubros"
        COUNT=$(curl -sf "${API_BASE}/catalog/rubros" | jq '.data | length' 2>/dev/null || echo "0")
        if [[ "$COUNT" -gt 0 ]]; then
            echo -e "${GREEN}✓ Rubros catalog returned ${COUNT} items${NC}"
        else
            echo -e "${RED}✗ Rubros catalog failed${NC}"
            exit 1
        fi
        
        echo -e "\n${GREEN}✓ Basic connectivity tests passed!${NC}"
        echo "Run option 1 for comprehensive tests."
        ;;
    3)
        echo -e "\n${GREEN}Opening browser test helper...${NC}\n"
        
        # Check if dev server is running
        if curl -sf http://localhost:5173 > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Dev server is running${NC}"
            TEST_URL="http://localhost:5173/test-helper.html"
        else
            echo -e "${YELLOW}⚠️  Dev server not running${NC}"
            echo "Starting dev server..."
            echo ""
            echo "In another terminal, run: npm run dev"
            echo "Then open: http://localhost:5173/test-helper.html"
            exit 0
        fi
        
        echo "Opening: ${TEST_URL}"
        
        # Try to open in browser
        if command -v xdg-open &> /dev/null; then
            xdg-open "${TEST_URL}" 2>/dev/null || echo "Please open manually: ${TEST_URL}"
        elif [[ -n "${BROWSER:-}" ]]; then
            "$BROWSER" "${TEST_URL}" 2>/dev/null || echo "Please open manually: ${TEST_URL}"
        else
            echo ""
            echo "Please open this URL in your browser:"
            echo -e "${BLUE}${TEST_URL}${NC}"
        fi
        ;;
    4)
        echo -e "\n${GREEN}Recent test results:${NC}\n"
        
        if ls test-results-*.md 1> /dev/null 2>&1; then
            ls -lt test-results-*.md | head -5
            echo ""
            LATEST=$(ls -t test-results-*.md | head -1)
            echo "Latest report: ${LATEST}"
            echo ""
            read -p "View it? [y/N]: " view
            if [[ "$view" =~ ^[Yy]$ ]]; then
                less "$LATEST" || cat "$LATEST"
            fi
        else
            echo "No test results found yet."
            echo "Run option 1 to generate test results."
        fi
        ;;
    5)
        echo -e "\n${GREEN}Custom test options:${NC}\n"
        
        read -p "API Base URL [default: dev]: " custom_api
        if [[ -n "$custom_api" ]]; then
            export API_BASE_URL="$custom_api"
        fi
        
        read -p "Run verbose mode? [y/N]: " verbose
        if [[ "$verbose" =~ ^[Yy]$ ]]; then
            set -x
        fi
        
        exec ./scripts/manual-test-finanzas.sh
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
