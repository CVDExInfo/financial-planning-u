#!/usr/bin/env bash
#
# Diagram Syntax Validation Script
# Validates Mermaid diagram syntax before rendering
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIAGRAMS_DIR="$REPO_ROOT/diagrams"

echo "🔍 Validating Mermaid diagrams..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
TOTAL=0
ERRORS=0
WARNINGS=0

# Find all .mmd files
while IFS= read -r -d '' file; do
    TOTAL=$((TOTAL + 1))
    filename=$(basename "$file")
    
    echo "Checking: $filename"
    
    # Basic syntax checks
    ERROR_FOUND=false
    
    # Check if file is empty
    if [ ! -s "$file" ]; then
        echo -e "${RED}  ✗ Error: File is empty${NC}"
        ERRORS=$((ERRORS + 1))
        ERROR_FOUND=true
    fi
    
    # Check for common syntax issues
    if grep -q "graph TB" "$file" || grep -q "graph LR" "$file" || grep -q "sequenceDiagram" "$file"; then
        # Check for unclosed brackets
        OPEN_BRACKETS=$(grep -o '\[' "$file" | wc -l)
        CLOSE_BRACKETS=$(grep -o '\]' "$file" | wc -l)
        
        if [ "$OPEN_BRACKETS" -ne "$CLOSE_BRACKETS" ]; then
            echo -e "${YELLOW}  ⚠ Warning: Unbalanced brackets (open: $OPEN_BRACKETS, close: $CLOSE_BRACKETS)${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
        
        # Check for unclosed parentheses
        OPEN_PARENS=$(grep -o '(' "$file" | wc -l)
        CLOSE_PARENS=$(grep -o ')' "$file" | wc -l)
        
        if [ "$OPEN_PARENS" -ne "$CLOSE_PARENS" ]; then
            echo -e "${YELLOW}  ⚠ Warning: Unbalanced parentheses (open: $OPEN_PARENS, close: $CLOSE_PARENS)${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
        
        if [ "$ERROR_FOUND" = false ]; then
            echo -e "${GREEN}  ✓ Syntax looks good${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ Warning: No diagram type found (should start with graph, sequenceDiagram, etc.)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    echo ""
done < <(find "$DIAGRAMS_DIR" -name "*.mmd" -type f -print0)

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total diagrams checked: $TOTAL"
echo -e "${RED}Errors: $ERRORS${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Validation failed with $ERRORS error(s)${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Validation completed with $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${GREEN}✅ All diagrams validated successfully!${NC}"
    exit 0
fi
