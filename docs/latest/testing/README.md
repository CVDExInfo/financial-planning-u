# Testing Report Artifacts

This folder contains the latest Finanzas SDMT + Prefactura testing report generated with the AIGOR blueprint.

## Regenerating the PDF (wkhtmltopdf)

Some Codex environments do not ship `wkhtmltopdf` by default and will return a "binary not supported" error. To avoid binary artifacts in the repo, the PDF is **not committed**; generate it locally as needed by installing the binary and rendering the Markdown to HTML first:

```bash
# Install prerequisites
apt-get update && apt-get install -y wkhtmltopdf
npm install -g markdown-it-cli

# Render Markdown to HTML (not committed)
markdown-it docs/latest/testing/testing-report.md > docs/latest/testing/testing-report.html

# Convert HTML to PDF with local asset access enabled
wkhtmltopdf --enable-local-file-access docs/latest/testing/testing-report.html docs/latest/testing/testing-report.pdf
```

Only the Markdown source is stored in Git to keep Codex diff tools readable; visual evidence (PNG) was intentionally removed from the bundle. Use the steps above only if you need to refresh the artifacts after editing `testing-report.md`.
