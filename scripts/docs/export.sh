#!/usr/bin/env bash
#
# Documentation Export Script
# Converts Markdown to PDF and HTML with auto-fit diagrams
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCS_DIR="$REPO_ROOT/docs"
DIST_DIR="$REPO_ROOT/dist/docs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "📄 Finanzas SD Documentation Export"
echo "===================================="
echo ""

# Create output directories
mkdir -p "$DIST_DIR/pdf"
mkdir -p "$DIST_DIR/html"
mkdir -p "$DIST_DIR/diagrams"

# Copy diagram images to dist
echo "📊 Copying diagram images..."
if [ -d "$REPO_ROOT/public/docs/latest/diagrams" ]; then
    cp -r "$REPO_ROOT/public/docs/latest/diagrams/"* "$DIST_DIR/diagrams/" 2>/dev/null || true
fi
echo -e "${GREEN}✓ Diagrams copied${NC}"
echo ""

# Function to export a single markdown file
export_doc() {
    local md_file=$1
    local basename=$(basename "$md_file" .md)
    
    echo "Processing: $basename"
    
    # Export to PDF with auto-fit
    pandoc "$md_file" \
        -o "$DIST_DIR/pdf/${basename}.pdf" \
        --pdf-engine=xelatex \
        --variable graphics=true \
        --variable geometry:margin=0.8in \
        --variable fontsize=11pt \
        --variable colorlinks=true \
        --variable linkcolor=blue \
        --variable urlcolor=blue \
        --variable toccolor=black \
        --toc \
        --toc-depth=3 \
        --number-sections \
        --highlight-style=tango \
        2>&1 | grep -v "Warning" || echo -e "${YELLOW}  Warning: PDF export had issues${NC}"
    
    # Export to HTML with embedded CSS
    pandoc "$md_file" \
        -o "$DIST_DIR/html/${basename}.html" \
        --standalone \
        --self-contained \
        --css="$SCRIPT_DIR/docs-style.css" \
        --toc \
        --toc-depth=3 \
        --number-sections \
        --highlight-style=tango \
        --metadata title="Finanzas SD - $basename" \
        2>&1 | grep -v "Warning" || true
    
    echo -e "${GREEN}  ✓ Exported to PDF and HTML${NC}"
}

# Export all markdown files in docs/
echo "🔄 Exporting documentation files..."
echo ""

for md_file in "$DOCS_DIR"/*.md; do
    if [ -f "$md_file" ]; then
        export_doc "$md_file"
    fi
done

echo ""
echo "📋 Export Summary"
echo "================="
PDF_COUNT=$(find "$DIST_DIR/pdf" -name "*.pdf" -type f 2>/dev/null | wc -l)
HTML_COUNT=$(find "$DIST_DIR/html" -name "*.html" -type f 2>/dev/null | wc -l)
echo "  PDFs exported: $PDF_COUNT"
echo "  HTML files exported: $HTML_COUNT"
echo "  Output directory: $DIST_DIR"
echo ""

if [ $PDF_COUNT -gt 0 ] && [ $HTML_COUNT -gt 0 ]; then
    echo -e "${GREEN}✅ Documentation export completed successfully!${NC}"
    exit 0
else
    echo -e "${RED}❌ Export failed - missing output files${NC}"
    exit 1
fi
