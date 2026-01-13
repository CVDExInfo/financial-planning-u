# generate_phase5_docs.py - Usage Guide

## Overview

This script automates the generation of Phase 5 documentation for the TODOS Executive Layout. It creates markdown, Word, and PDF versions of the visual guide, along with placeholder screenshots.

## What it Creates

1. **PHASE5_VISUAL_GUIDE.md** - Complete markdown documentation (357 lines, 13KB)
2. **PHASE5_VISUAL_GUIDE.docx** - Word document version (42KB)
3. **PHASE5_VISUAL_GUIDE.pdf** - PDF version (if pandoc/docx2pdf available)
4. **docs/phase5/screenshots/** - Directory with:
   - 10 placeholder PNG images (1200x800 each)
   - README.md with screenshot guidelines

## Prerequisites

### Required Dependencies

```bash
pip install python-docx Pillow
```

### Optional Dependencies (for PDF generation)

**Option 1: pandoc (recommended)**
```bash
# macOS
brew install pandoc

# Ubuntu/Debian
sudo apt-get install pandoc

# Windows
# Download from https://pandoc.org/installing.html
```

**Option 2: docx2pdf**
```bash
pip install docx2pdf
```

## Usage

### Basic Usage

```bash
python3 generate_phase5_docs.py
```

### With Virtual Environment (recommended)

```bash
# Create virtual environment
python3 -m venv .venv

# Activate (Linux/macOS)
source .venv/bin/activate

# Activate (Windows)
.venv\Scripts\activate

# Install dependencies
pip install python-docx Pillow

# Run script
python generate_phase5_docs.py
```

## Features

### 1. **Embedded Content**
- Complete Phase 5 visual guide content is embedded in the script as `MD_CONTENT`
- No external dependencies for markdown generation

### 2. **Robust Error Handling**
- Gracefully handles missing dependencies
- Provides clear installation instructions for each platform
- Continues execution even if optional steps fail

### 3. **Cross-Platform Support**
- Works on Windows, macOS, and Linux
- Platform-specific instructions included

### 4. **Placeholder Generation**
- Creates 10 placeholder PNG images with labels
- Each image is 1200x800 pixels with gray background
- Text overlay showing filename for easy identification

### 5. **Progress Reporting**
- Clear console output showing each step
- Success/warning/error indicators
- Summary of created files

## Output Structure

```
repository-root/
├── generate_phase5_docs.py
├── PHASE5_VISUAL_GUIDE.md
├── PHASE5_VISUAL_GUIDE.docx
├── PHASE5_VISUAL_GUIDE.pdf (if PDF engine available)
└── docs/
    └── phase5/
        └── screenshots/
            ├── README.md
            ├── phase5_todos_above_fold.png
            ├── phase5_budget_pill_en_meta.png
            ├── phase5_budget_pill_en_riesgo.png
            ├── phase5_budget_pill_sobre_presupuesto.png
            ├── phase5_collapsed_sections.png
            ├── phase5_expanded_portfolio_summary.png
            ├── phase5_full_page_scroll.png
            ├── phase5_single_above_fold.png
            ├── phase5_single_full_layout.png
            └── phase5_before_after_todos.png
```

## Git Integration

After running the script, commit the changes:

```bash
git checkout -b feature/phase5-docs
git add PHASE5_VISUAL_GUIDE.md PHASE5_VISUAL_GUIDE.docx docs/phase5/
# If PDF was generated:
git add PHASE5_VISUAL_GUIDE.pdf
git commit -m "PHASE5: Add validated visual guide + DOCX/PDF and screenshots placeholders"
git push --set-upstream origin feature/phase5-docs
```

## Troubleshooting

### PDF Generation Fails

**Problem:** PDF is not generated even though pandoc is installed.

**Solution:** Install a PDF engine for pandoc:
```bash
# Ubuntu/Debian
sudo apt-get install texlive-latex-base

# macOS
brew install --cask mactex
```

Or use docx2pdf instead:
```bash
pip install docx2pdf
```

### Import Error: No module named 'docx'

**Problem:** python-docx is not installed.

**Solution:**
```bash
pip install python-docx
```

### Import Error: No module named 'PIL'

**Problem:** Pillow is not installed.

**Solution:**
```bash
pip install Pillow
```

### Empty Placeholder Images

**Problem:** PNG files are 0 bytes.

**Solution:** Install Pillow and re-run the script:
```bash
pip install Pillow
rm -rf docs/phase5/screenshots/*.png
python3 generate_phase5_docs.py
```

## Script Architecture

### Functions

- `write_file()` - Write content to file with directory creation
- `create_screenshot_placeholders()` - Generate 10 placeholder PNGs
- `write_screenshots_readme()` - Create README in screenshots directory
- `create_docx()` - Convert markdown to DOCX format
- `convert_docx_to_pdf()` - Convert DOCX to PDF (pandoc or docx2pdf)
- `print_dependency_instructions()` - Display installation guide
- `print_summary()` - Show created files and next steps
- `main()` - Orchestrate all operations

### Constants

- `PLACEHOLDER_IMG_WIDTH = 1200`
- `PLACEHOLDER_IMG_HEIGHT = 800`
- `PLACEHOLDER_BG_COLOR = (240, 240, 240)`
- `PLACEHOLDER_TEXT_COLOR = (80, 80, 80)`
- `PLACEHOLDER_TEXT_POSITION = (20, 20)`

## Validation

The script has been:
- ✅ Tested on Ubuntu 24.04
- ✅ Code reviewed with feedback addressed
- ✅ Security scanned with CodeQL (0 alerts)
- ✅ Verified to generate all expected files

## Support

For issues or questions, refer to:
- Script inline comments
- This usage guide
- Phase 5 documentation: `PHASE5_VISUAL_GUIDE.md`
- Screenshots README: `docs/phase5/screenshots/README.md`
