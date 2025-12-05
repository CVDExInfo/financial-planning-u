#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SRC_DIR="$ROOT/docs/finanzas"
BUILD_DIR="$ROOT/build/finanzas-docs"
ARTIFACT_DIR="$ROOT/build/artifacts"

mkdir -p "$BUILD_DIR" "$ARTIFACT_DIR"

# 1) Render PlantUML diagrams to SVG (high-resolution)
if command -v plantuml >/dev/null 2>&1; then
  echo "Rendering PlantUML diagrams from $SRC_DIR/diagrams"
  plantuml -tsvg "$SRC_DIR/diagrams"/*.puml
else
  echo "WARN: plantuml not found; skipping diagram rendering" >&2
fi

# 2) Generate PDFs (individual + binder) from Markdown sources
if command -v pandoc >/dev/null 2>&1 && command -v wkhtmltopdf >/dev/null 2>&1 && command -v pdfunite >/dev/null 2>&1; then
  echo "Rendering Finanzas Markdown to PDFs"
  python "$ROOT/scripts/docs/render_pdfs.py"
else
  echo "WARN: pandoc/wkhtmltopdf/pdfunite not available; skipping PDF generation" >&2
fi

# 3) Refresh working copy of Finanzas docs (Markdown + diagrams + generated PDFs)
rsync -a --delete "$SRC_DIR/" "$BUILD_DIR/"

# 4) Bundle delivery artifact
ZIP_PATH="$ARTIFACT_DIR/FinanzasDocsBundle.zip"
rm -f "$ZIP_PATH"
( cd "$BUILD_DIR" && zip -r "$ZIP_PATH" . )

echo "Docs bundle ready → $ZIP_PATH"
