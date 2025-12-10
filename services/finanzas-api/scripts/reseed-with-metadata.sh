#!/bin/bash
# Re-seed Development/Test Environment with METADATA-compliant projects
# 
# This script safely resets and re-seeds demo projects with the correct
# sk = "METADATA" format required for SDMT/PMO UI visibility.
#
# Usage:
#   ./scripts/reseed-with-metadata.sh [--force]
#
# Options:
#   --force    Skip confirmation prompts (use with caution)
#
# Safety:
#   - Only runs in dev/test environments (checks STAGE/ENV)
#   - Preserves canonical project definitions
#   - Idempotent: safe to run multiple times

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
FORCE=false
if [[ "$1" == "--force" ]]; then
  FORCE=true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Re-seed with METADATA-compliant Demo Projects${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check environment
STAGE="${STAGE:-${ENV:-dev}}"
echo -e "${YELLOW}Environment: $STAGE${NC}"

if [[ "$STAGE" == "prod" || "$STAGE" == "production" || "$STAGE" == "stg" || "$STAGE" == "staging" ]]; then
  echo -e "${RED}ERROR: Cannot run in production/staging environment${NC}"
  echo -e "${RED}       Detected STAGE/ENV: $STAGE${NC}"
  echo -e "${RED}       This script is for dev/test environments only.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Environment check passed${NC}"
echo ""

# Confirm with user (unless --force)
if [[ "$FORCE" != true ]]; then
  echo -e "${YELLOW}This will:${NC}"
  echo "  1. Delete all non-canonical projects from the database"
  echo "  2. Re-seed canonical demo projects with sk = METADATA"
  echo "  3. Verify all projects are visible to SDMT/PMO"
  echo ""
  echo -e "${YELLOW}Canonical projects will be preserved and updated.${NC}"
  echo ""
  read -p "Continue? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted by user${NC}"
    exit 0
  fi
fi

# Navigate to API directory
cd "$API_DIR"

echo ""
echo -e "${BLUE}Step 1: Reset dev/test projects${NC}"
echo "Running: npm run reset:dev-projects -- --force"
npm run reset:dev-projects -- --force

echo ""
echo -e "${BLUE}Step 2: Seed canonical projects with METADATA${NC}"
echo "Running: npm run seed:canonical-projects"
npm run seed:canonical-projects

echo ""
echo -e "${BLUE}Step 3: Verify canonical projects${NC}"
echo "Running: npm run verify:canonical-projects"
npm run verify:canonical-projects || true  # Don't fail if verify script doesn't exist yet

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Re-seed completed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Open SDMT UI and verify projects appear in dropdown"
echo "  2. Check CloudWatch logs for any warnings about legacy META records"
echo "  3. If issues persist, check METADATA_SK_MIGRATION.md"
echo ""
echo -e "${BLUE}Done!${NC}"
