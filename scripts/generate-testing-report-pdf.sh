#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Generate Testing Report PDFs with CVDEx Branding
# ==============================================================================
# This script converts testing report markdown files to PDF format using
# wkhtmltopdf with custom styling for CVDEx/Ikusi PMO compliance.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="${SCRIPT_DIR}/../docs/latest/testing"
OUTPUT_DIR="${DOCS_DIR}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==============================================================================
# Functions
# ==============================================================================

log_info() {
    echo -e "${BLUE}ℹ ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️ ${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v wkhtmltopdf &> /dev/null; then
        log_error "wkhtmltopdf is not installed"
        log_info "Install with: sudo apt-get install -y wkhtmltopdf"
        exit 1
    fi
    
    local version=$(wkhtmltopdf --version | head -n1)
    log_success "Found $version"
}

create_header_html() {
    local output_file="$1"
    cat > "$output_file" <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 10px 20px;
            font-family: Arial, sans-serif;
            font-size: 9pt;
            color: #666;
        }
        .header-content {
            border-bottom: 2px solid #003366;
            padding-bottom: 5px;
        }
        .company-name {
            font-weight: bold;
            color: #003366;
            font-size: 11pt;
        }
        .report-title {
            color: #666;
            font-size: 9pt;
            margin-top: 2px;
        }
    </style>
</head>
<body>
    <div class="header-content">
        <div class="company-name">CVDEx / Ikusi PMO</div>
        <div class="report-title">Finanzas SDMT + Prefactura - Test Execution Report</div>
    </div>
</body>
</html>
EOF
}

create_footer_html() {
    local output_file="$1"
    cat > "$output_file" <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 10px 20px;
            font-family: Arial, sans-serif;
            font-size: 8pt;
            color: #666;
            text-align: center;
        }
        .footer-content {
            border-top: 1px solid #ccc;
            padding-top: 5px;
        }
        .confidential {
            color: #999;
            font-size: 7pt;
            margin-top: 3px;
        }
    </style>
    <script>
        function subst() {
            var vars = {};
            var query_strings_from_url = document.location.search.substring(1).split('&');
            for (var query_string in query_strings_from_url) {
                if (query_strings_from_url.hasOwnProperty(query_string)) {
                    var temp_var = query_strings_from_url[query_string].split('=', 2);
                    vars[temp_var[0]] = decodeURI(temp_var[1]);
                }
            }
            var css_selector_classes = ['page', 'frompage', 'topage', 'webpage', 'section', 'subsection', 'date', 'isodate', 'time', 'title', 'doctitle', 'sitepage', 'sitepages'];
            for (var css_class in css_selector_classes) {
                if (css_selector_classes.hasOwnProperty(css_class)) {
                    var element = document.getElementsByClassName(css_selector_classes[css_class]);
                    for (var j = 0; j < element.length; ++j) {
                        element[j].textContent = vars[css_selector_classes[css_class]];
                    }
                }
            }
        }
    </script>
</head>
<body onload="subst()">
    <div class="footer-content">
        <div>Page <span class="page"></span> of <span class="topage"></span></div>
        <div class="confidential">Confidential - For Audit and Reimbursement Purposes - Generated <span class="date"></span></div>
    </div>
</body>
</html>
EOF
}

create_css_file() {
    local output_file="$1"
    cat > "$output_file" <<'EOF'
/* CVDEx / Ikusi PMO Report Styling */

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
    max-width: none;
    margin: 0;
    padding: 20px;
    background: white;
}

/* Headings */
h1 {
    font-size: 24pt;
    color: #003366;
    border-bottom: 3px solid #003366;
    padding-bottom: 10px;
    margin-top: 30px;
    margin-bottom: 20px;
    page-break-after: avoid;
}

h2 {
    font-size: 18pt;
    color: #0066cc;
    border-bottom: 2px solid #0066cc;
    padding-bottom: 8px;
    margin-top: 25px;
    margin-bottom: 15px;
    page-break-after: avoid;
}

h3 {
    font-size: 14pt;
    color: #0066cc;
    margin-top: 20px;
    margin-bottom: 12px;
    page-break-after: avoid;
}

h4 {
    font-size: 12pt;
    color: #333;
    font-weight: bold;
    margin-top: 15px;
    margin-bottom: 10px;
}

/* Tables */
table {
    border-collapse: collapse;
    width: 100%;
    margin: 15px 0;
    font-size: 10pt;
    page-break-inside: auto;
}

table th {
    background-color: #003366;
    color: white;
    padding: 10px 8px;
    text-align: left;
    font-weight: bold;
    border: 1px solid #002244;
}

table td {
    border: 1px solid #ddd;
    padding: 8px 8px;
    background-color: white;
}

table tr:nth-child(even) td {
    background-color: #f9f9f9;
}

table tr {
    page-break-inside: avoid;
}

/* Code blocks */
pre {
    background-color: #f6f8fa;
    border: 1px solid #e1e4e8;
    border-radius: 6px;
    padding: 16px;
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.45;
    page-break-inside: avoid;
}

code {
    background-color: #f6f8fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
}

pre code {
    background-color: transparent;
    padding: 0;
}

/* Lists */
ul, ol {
    margin: 10px 0;
    padding-left: 30px;
}

li {
    margin: 5px 0;
}

/* Blockquotes */
blockquote {
    border-left: 4px solid #0066cc;
    padding-left: 20px;
    margin: 15px 0;
    color: #555;
    font-style: italic;
}

/* Horizontal rules */
hr {
    border: none;
    border-top: 2px solid #ddd;
    margin: 30px 0;
}

/* Status indicators */
.pass, .success {
    color: #28a745;
    font-weight: bold;
}

.fail, .error {
    color: #dc3545;
    font-weight: bold;
}

.warning {
    color: #ffc107;
    font-weight: bold;
}

.pending {
    color: #6c757d;
    font-weight: bold;
}

/* Page breaks */
.page-break {
    page-break-after: always;
}

/* Signature section */
.signature-section {
    margin-top: 40px;
    page-break-inside: avoid;
}

.signature-line {
    border-bottom: 1px solid #333;
    width: 300px;
    margin: 20px 0 5px 0;
}

/* Metadata */
.metadata {
    background-color: #f0f0f0;
    border-left: 4px solid #0066cc;
    padding: 15px;
    margin: 20px 0;
    page-break-inside: avoid;
}

/* Links */
a {
    color: #0066cc;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

/* Print-specific */
@media print {
    body {
        padding: 0;
    }
    
    a {
        color: #0066cc;
    }
    
    .no-print {
        display: none;
    }
}

/* Paragraphs */
p {
    margin: 10px 0;
    text-align: justify;
}

/* Strong emphasis */
strong {
    font-weight: bold;
    color: #003366;
}

/* Emphasize CVDEx branding */
.cvdex-brand {
    color: #003366;
    font-weight: bold;
}
EOF
}

convert_markdown_to_pdf() {
    local md_file="$1"
    local pdf_file="$2"
    local title="$3"
    local header_html="$4"
    local footer_html="$5"
    local css_file="$6"
    
    log_info "Converting $(basename "$md_file") to PDF..."
    
    # Convert markdown to HTML first (preserving tables and formatting)
    local html_file="${md_file%.md}.html"
    
    # Simple markdown to HTML conversion with proper table support
    cat > "$html_file" <<EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>$title</title>
    <link rel="stylesheet" href="$css_file">
</head>
<body>
EOF
    
    # Process markdown (basic conversion)
    # This is a simplified conversion - in production, you'd use a proper markdown processor
    sed -e 's/^# \(.*\)/<h1>\1<\/h1>/' \
        -e 's/^## \(.*\)/<h2>\1<\/h2>/' \
        -e 's/^### \(.*\)/<h3>\1<\/h3>/' \
        -e 's/^#### \(.*\)/<h4>\1<\/h4>/' \
        -e 's/^\*\*\(.*\)\*\*/<strong>\1<\/strong>/g' \
        -e 's/^- \(.*\)/<li>\1<\/li>/' \
        -e 's/^$/\<p\>\<\/p\>/' \
        "$md_file" >> "$html_file"
    
    cat >> "$html_file" <<EOF
</body>
</html>
EOF
    
    # Convert HTML to PDF with wkhtmltopdf
    wkhtmltopdf \
        --page-size A4 \
        --margin-top 25mm \
        --margin-right 20mm \
        --margin-bottom 25mm \
        --margin-left 20mm \
        --header-html "$header_html" \
        --header-spacing 5 \
        --footer-html "$footer_html" \
        --footer-spacing 5 \
        --enable-local-file-access \
        --print-media-type \
        --no-stop-slow-scripts \
        --javascript-delay 1000 \
        --encoding UTF-8 \
        "$html_file" \
        "$pdf_file" 2>&1 | grep -v "Exit with code 1" || true
    
    # Clean up temporary HTML file
    rm -f "$html_file"
    
    if [ -f "$pdf_file" ]; then
        local size=$(du -h "$pdf_file" | cut -f1)
        log_success "Generated: $(basename "$pdf_file") ($size)"
        return 0
    else
        log_error "Failed to generate $(basename "$pdf_file")"
        return 1
    fi
}

# ==============================================================================
# Main Script
# ==============================================================================

main() {
    echo ""
    log_info "====================================================================="
    log_info "  Finanzas Testing Report PDF Generator"
    log_info "  CVDEx / Ikusi PMO Compliance"
    log_info "====================================================================="
    echo ""
    
    # Check dependencies
    check_dependencies
    
    # Create temporary files for headers, footers, and CSS
    local temp_dir="/tmp/testing-report-pdf-gen-$$"
    mkdir -p "$temp_dir"
    
    local header_html="${temp_dir}/header.html"
    local footer_html="${temp_dir}/footer.html"
    local css_file="${temp_dir}/report-style.css"
    
    log_info "Creating styling templates..."
    create_header_html "$header_html"
    create_footer_html "$footer_html"
    create_css_file "$css_file"
    log_success "Templates created"
    
    # Ensure output directory exists
    mkdir -p "$OUTPUT_DIR"
    
    # Convert English report
    local en_md="${DOCS_DIR}/testing-report.md"
    local en_pdf="${DOCS_DIR}/testing-report.pdf"
    
    if [ -f "$en_md" ]; then
        convert_markdown_to_pdf \
            "$en_md" \
            "$en_pdf" \
            "Finanzas SDMT + Prefactura - Test Execution Report" \
            "$header_html" \
            "$footer_html" \
            "$css_file"
    else
        log_warning "English report not found: $en_md"
    fi
    
    # Convert Spanish report
    local es_md="${DOCS_DIR}/testing-report.es.md"
    local es_pdf="${DOCS_DIR}/testing-report.es.pdf"
    
    if [ -f "$es_md" ]; then
        convert_markdown_to_pdf \
            "$es_md" \
            "$es_pdf" \
            "Finanzas SDMT + Prefactura - Informe de Ejecución de Pruebas" \
            "$header_html" \
            "$footer_html" \
            "$css_file"
    else
        log_warning "Spanish report not found: $es_md"
    fi
    
    # Clean up temporary files
    rm -rf "$temp_dir"
    
    echo ""
    log_info "====================================================================="
    log_success "PDF Generation Complete!"
    log_info "====================================================================="
    echo ""
    log_info "Output location: $OUTPUT_DIR"
    echo ""
    
    # List generated PDFs
    if [ -f "$en_pdf" ]; then
        log_success "English Report: $(basename "$en_pdf")"
    fi
    if [ -f "$es_pdf" ]; then
        log_success "Spanish Report: $(basename "$es_pdf")"
    fi
    
    echo ""
    log_info "Evidence files location: ${DOCS_DIR}/testing-evidence/"
    echo ""
}

# Run main function
main "$@"
