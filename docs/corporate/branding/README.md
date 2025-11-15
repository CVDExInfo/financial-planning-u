# Branding Templates

This directory contains branding templates and styles for documentation generation.

## Files

- `template.tex` - LaTeX template for PDF generation with branded cover page and headers/footers
- `reference.docx` - Microsoft Word reference document for DOCX styling
- `styles.css` - CSS styles for HTML output (optional)

## LaTeX Template (template.tex)

The LaTeX template includes:
- Custom cover page with logo and bilingual title
- Header with logo/project name
- Footer with page numbers
- Corporate fonts and colors
- Support for bilingual content

## DOCX Reference Template (reference.docx)

The DOCX reference template defines:
- Document styles (headings, body text, captions)
- Header with logo
- Footer with page numbers
- Corporate fonts and colors
- Paragraph spacing and formatting

## Usage

Templates are automatically selected by the render-docs.ts script based on the `USE_CVDEX_BRANDING` environment variable.
