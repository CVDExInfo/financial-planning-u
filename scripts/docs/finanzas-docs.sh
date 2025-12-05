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
  CORE_DOCS=(
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

  ANNEX_DOCS=(
    "annex-r1/FINANZAS_PATH_TO_GREEN.md"
    "annex-r1/LANE1_AUTH_UI_TEST_PLAN.md"
    "annex-r1/LANE1_COMPLETION_REPORT.md"
    "annex-r1/COPILOT_EXECUTION_SUMMARY.md"
    "annex-r1/FINANZAS_SERVICE_DELIVERY_ARCHITECTURE.md"
    "annex-r1/AUDIT_FINANZAS_MODULE_IMPLEMENTATION.md"
    "annex-r1/COPILOT_OPERATING_INSTRUCTIONS.md"
  )

  OUT_DIR="$DOCS_ROOT/generated-pdf"
  mkdir -p "$OUT_DIR" "$OUT_DIR/annex-r1"

  (
    cd "$DOCS_ROOT"

    RESOURCE_PATH=".:diagrams:annex-r1"

    generate_pdf() {
      local file="$1"
      local base="${file%.md}"
      local name
      name="$(basename "$base")"
      local TITLE
      case "$name" in
        overview)                             TITLE="Finanzas SD – Overview" ;;
        architecture)                         TITLE="Finanzas SD – Technical Architecture" ;;
        data-models)                          TITLE="Finanzas SD – Data Models" ;;
        api-reference)                        TITLE="Finanzas SD – API Reference" ;;
        sequence-diagrams)                    TITLE="Finanzas SD – Sequence Diagrams & Flows" ;;
        security-compliance)                  TITLE="Finanzas SD – Security & Compliance" ;;
        pmo-handbook)                         TITLE="Manual de uso PMO Colombia – Finanzas SD" ;;
        runbook-pmo-colombia)                 TITLE="Runbook PMO Colombia – Finanzas SD" ;;
        glossary)                             TITLE="Finanzas SD – Glossary (ES/EN)" ;;
        status-r1)                            TITLE="Finanzas SD – R1 Status & Scope" ;;
        release-notes)                        TITLE="Finanzas SD – Release Notes" ;;
        FINANZAS_PATH_TO_GREEN)               TITLE="Annex A – R1 Execution Roadmap" ;;
        LANE1_AUTH_UI_TEST_PLAN)              TITLE="Annex B – Lane 1 Test Plan" ;;
        LANE1_COMPLETION_REPORT)              TITLE="Annex C – Lane 1 Completion Report" ;;
        COPILOT_EXECUTION_SUMMARY)            TITLE="Annex D – Copilot Execution Summary" ;;
        FINANZAS_SERVICE_DELIVERY_ARCHITECTURE) TITLE="Annex E – R1 Service Delivery Architecture" ;;
        AUDIT_FINANZAS_MODULE_IMPLEMENTATION) TITLE="Annex F – Implementation Audit" ;;
        COPILOT_OPERATING_INSTRUCTIONS)       TITLE="Annex G – Copilot Operating Instructions" ;;
        *)                                    TITLE="$name" ;;
      esac

      pandoc "$file" \
        --from=gfm \
        --to=pdf \
        --pdf-engine=wkhtmltopdf \
        --resource-path="$RESOURCE_PATH" \
        --metadata "title=$TITLE" \
        -o "generated-pdf/${base}.pdf"
    }

    for file in "${CORE_DOCS[@]}"; do
      generate_pdf "$file"
    done

    for file in "${ANNEX_DOCS[@]}"; do
      generate_pdf "$file"
    done

    core_pdfs=()
    for file in "${CORE_DOCS[@]}"; do
      base="${file%.md}"
      core_pdfs+=("generated-pdf/${base}.pdf")
    done

    annex_pdfs=()
    for file in "${ANNEX_DOCS[@]}"; do
      base="${file%.md}"
      annex_pdfs+=("generated-pdf/${base}.pdf")
    done

    pdfunite "${core_pdfs[@]}" "${annex_pdfs[@]}" "generated-pdf/FinanzasDocsBinder.pdf"
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