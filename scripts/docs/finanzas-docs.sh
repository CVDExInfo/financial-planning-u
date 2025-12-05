#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCS_ROOT="$ROOT_DIR/docs/finanzas"
DIAGRAM_DIR="$DOCS_ROOT/diagrams"
BUILD_DIR="$ROOT_DIR/build/finanzas-docs"
ARTIFACT_DIR="$ROOT_DIR/build/artifacts"

mkdir -p "$BUILD_DIR" "$ARTIFACT_DIR"

# 1) Render PlantUML diagrams to SVG (high-resolution)
if command -v plantuml >/dev/null 2>&1; then
  echo "Rendering PlantUML diagrams from $DIAGRAM_DIR"
  plantuml -tsvg "$DIAGRAM_DIR"/*.puml
else
  echo "WARN: plantuml not found; skipping diagram rendering" >&2
fi

# 2) Generate PDFs (individual + binder) from Markdown sources
if command -v pandoc >/dev/null 2>&1 && command -v wkhtmltopdf >/dev/null 2>&1 && command -v pdfunite >/dev/null 2>&1; then
  echo "Rendering Finanzas Markdown to PDFs"
  DOCS=(
    "overview.md"
    "architecture.md"
    "data-models.md"
    "api-reference.md"
    "sequence-diagrams.md"
    "security-compliance.md"
    "pmo-handbook.md"
    "runbook-pmo-colombia.md"
    "glossary.md"
    "status-r1.md"
    "release-notes.md"
  )

  OUT_DIR="$DOCS_ROOT/generated-pdf"
  mkdir -p "$OUT_DIR"

  (
    cd "$DOCS_ROOT"

    for file in "${DOCS[@]}"; do
      base="${file%.md}"
      case "$base" in
        overview)               TITLE="Finanzas SD – Overview" ;;
        architecture)           TITLE="Finanzas SD – Technical Architecture" ;;
        data-models)            TITLE="Finanzas SD – Data Models" ;;
        api-reference)          TITLE="Finanzas SD – API Reference" ;;
        sequence-diagrams)      TITLE="Finanzas SD – Sequence Diagrams & Flows" ;;
        security-compliance)    TITLE="Finanzas SD – Security & Compliance" ;;
        pmo-handbook)           TITLE="Manual de uso PMO Colombia – Finanzas SD" ;;
        runbook-pmo-colombia)   TITLE="Runbook PMO Colombia – Finanzas SD" ;;
        glossary)               TITLE="Finanzas SD – Glossary (ES/EN)" ;;
        status-r1)              TITLE="Finanzas SD – R1 Status & Scope" ;;
        release-notes)          TITLE="Finanzas SD – Release Notes" ;;
        *)                      TITLE="$base" ;;
      esac

      pandoc "$file" \
        --from=gfm \
        --to=pdf \
        --pdf-engine=wkhtmltopdf \
        --resource-path=".:diagrams" \
        --metadata "title=$TITLE" \
        -o "generated-pdf/${base}.pdf"
    done

    pdfs_in_order=()
    for file in "${DOCS[@]}"; do
      base="${file%.md}"
      pdfs_in_order+=("generated-pdf/${base}.pdf")
    done

    pdfunite "${pdfs_in_order[@]}" "generated-pdf/FinanzasDocsBinder.pdf"
  )
else
  echo "WARN: pandoc/wkhtmltopdf/pdfunite not available; skipping PDF generation" >&2
fi

# 3) Refresh working copy of Finanzas docs (Markdown + diagrams + generated PDFs)
rsync -a --delete "$DOCS_ROOT/" "$BUILD_DIR/"

# 4) Bundle delivery artifact
ZIP_PATH="$ARTIFACT_DIR/FinanzasDocsBundle.zip"
rm -f "$ZIP_PATH"
( cd "$BUILD_DIR" && zip -r "$ZIP_PATH" . )

echo "Docs bundle ready → $ZIP_PATH"
