#!/bin/bash
#
# QA UI Testing - Finanzas Module
# 
# This script tests the Finanzas UI components by starting a local dev server
# and performing manual checks on UI elements, navigation, and rendering.
#
# Usage:
#   bash scripts/qa-ui-test.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() {
  echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

pass() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
}

fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
}

section() {
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo " $1"
  echo "════════════════════════════════════════════════════════════════"
  echo ""
}

# ============ BANNER ============
clear
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║     QA UI TESTING - FINANZAS MODULE                           ║"
echo "║     Local Development Server Testing                          ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============ PREREQUISITES ============
section "Prerequisites Check"

# Check if npm is available
if command -v npm &> /dev/null; then
  pass "npm is installed"
else
  fail "npm is not installed"
  exit 1
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
  pass "node_modules directory exists"
else
  fail "node_modules not found. Run 'npm ci' first."
  exit 1
fi

# Check if package.json exists
if [ -f "package.json" ]; then
  pass "package.json found"
else
  fail "package.json not found"
  exit 1
fi

# ============ ENVIRONMENT SETUP ============
section "Environment Configuration"

# Create temporary .env.test file for local testing
cat > .env.test << 'EOF'
# Test Environment Configuration for Finanzas QA
VITE_PUBLIC_BASE=/finanzas/
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
VITE_FINZ_ENABLED=true
VITE_USE_MOCKS=false
VITE_SKIP_AUTH=false

# Cognito Configuration
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_WEB_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_DOMAIN=us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com

# API Configuration
VITE_AWS_REGION=us-east-2
VITE_APP_REGION=us-east-2

# Feature Flags
VITE_FINANZAS_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
EOF

pass "Created .env.test configuration file"
info "Environment variables configured for Finanzas testing"

# ============ BUILD CHECK ============
section "Build Verification"

info "Testing TypeScript compilation..."
if npm run build 2>&1 | tee /tmp/build.log; then
  pass "Build completed successfully"
else
  fail "Build failed. Check /tmp/build.log for details"
  tail -20 /tmp/build.log
  exit 1
fi

# ============ UI COMPONENT CHECKLIST ============
section "UI Component Checklist"

echo "The following components need manual verification:"
echo ""
echo "1. ✓ Finanzas Home Page (FinanzasHome.tsx)"
echo "   - Location: src/modules/finanzas/FinanzasHome.tsx"
echo "   - Route: / (with basename /finanzas/)"
echo "   - Features to test:"
echo "     • Page heading displays"
echo "     • Two action cards render"
echo "     • Links navigate correctly"
echo ""
echo "2. ✓ Catálogo de Rubros (RubrosCatalog.tsx)"
echo "   - Location: src/modules/finanzas/RubrosCatalog.tsx"
echo "   - Route: /catalog/rubros"
echo "   - Features to test:"
echo "     • Page loads without errors"
echo "     • API call to /catalog/rubros succeeds"
echo "     • Rubros data displays in table"
echo "     • All 71 rubros visible"
echo ""
echo "3. ✓ Allocation Rules (AllocationRulesPreview.tsx)"
echo "   - Location: src/modules/finanzas/AllocationRulesPreview.tsx"
echo "   - Route: /rules"
echo "   - Features to test:"
echo "     • Page loads without errors"
echo "     • API call to /allocation-rules succeeds"
echo "     • Rules data displays correctly"
echo ""
echo "4. ✓ Navigation Bar"
echo "   - Location: src/components/Navigation.tsx"
echo "   - Features to test:"
echo "     • Finanzas menu items visible"
echo "     • Rubros link works"
echo "     • Rules link works"
echo "     • User profile accessible"
echo ""

# ============ DEV SERVER INSTRUCTIONS ============
section "Development Server"

info "To start the development server manually, run:"
echo ""
echo "    npm run dev"
echo ""
info "Then open your browser to:"
echo ""
echo "    http://localhost:5173/finanzas/"
echo ""
info "Test Credentials:"
echo "    Username: christian.valencia@ikusi.com"
echo "    Password: (use your test password)"
echo ""

# ============ TESTING CHECKLIST ============
section "Manual Testing Checklist"

cat << 'EOF'
Please verify the following manually in your browser:

[ ] Sign-in page loads
[ ] User can authenticate with credentials
[ ] Redirect to /finanzas/ after login
[ ] Navigation bar displays correctly
[ ] Finanzas menu items visible (Rubros, Rules)
[ ] Home page displays with two action cards
[ ] Clicking "Catálogo de Rubros" navigates to /catalog/rubros
[ ] Rubros page loads and displays data
[ ] API call to GET /catalog/rubros succeeds (check Network tab)
[ ] All 71 rubros display in the list/table
[ ] Clicking "Rules" navigates to /rules
[ ] Rules page loads and displays data
[ ] API call to GET /allocation-rules succeeds
[ ] Rules display with correct structure (rule_id, driver, priority)
[ ] No console errors during navigation
[ ] No 4xx/5xx errors in Network tab for permitted actions
[ ] Loading states display correctly
[ ] Error states handled gracefully
[ ] Responsive design works on different screen sizes

EOF

# ============ CLEANUP ============
info "Test environment file created: .env.test"
info "You can clean up by removing .env.test after testing"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           UI Testing Setup Complete                            ║${NC}"
echo -e "${GREEN}║           Run 'npm run dev' to start testing                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
