#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
OUT_DIR="$ROOT/public/docs/latest"
REL_DIR="$ROOT/public/docs/releases"

DATE_STR="$(date +%Y%m%d)"
PKG_NAME="Ikusi_FinanzasSD_Architecture_Pack_${DATE_STR}"
PKG_ROOT="$ROOT/public/docs/${PKG_NAME}"
ZIP_PATH="$REL_DIR/${PKG_NAME}.zip"

rm -rf "$PKG_ROOT"
mkdir -p "$PKG_ROOT" "$REL_DIR"

# Curated structure for client delivery (premium ordering)
mkdir -p "$PKG_ROOT"/{01_Executive,02_AWS_Architecture,03_ERD,04_Data_Flows,05_Prefactura_Swimlane,06_SOPs,07_Governance,08_UI_Layouts,99_Appendix}

# Map outputs into curated folders (adjust names if your MD files differ)
cp -f "$OUT_DIR/Executive_Summary.pdf"          "$PKG_ROOT/01_Executive/" 2>/dev/null || true
cp -f "$OUT_DIR/Executive_Summary.docx"         "$PKG_ROOT/01_Executive/" 2>/dev/null || true

cp -f "$OUT_DIR/AWS_Architecture.pdf"           "$PKG_ROOT/02_AWS_Architecture/" 2>/dev/null || true
cp -f "$OUT_DIR/AWS_Architecture.docx"          "$PKG_ROOT/02_AWS_Architecture/" 2>/dev/null || true

cp -f "$OUT_DIR/ERD.pdf"                        "$PKG_ROOT/03_ERD/" 2>/dev/null || true
cp -f "$OUT_DIR/ERD.docx"                       "$PKG_ROOT/03_ERD/" 2>/dev/null || true

cp -f "$OUT_DIR/Data_Flows.pdf"                 "$PKG_ROOT/04_Data_Flows/" 2>/dev/null || true
cp -f "$OUT_DIR/Data_Flows.docx"                "$PKG_ROOT/04_Data_Flows/" 2>/dev/null || true

cp -f "$OUT_DIR/Prefactura_Swimlane.pdf"        "$PKG_ROOT/05_Prefactura_Swimlane/" 2>/dev/null || true
cp -f "$OUT_DIR/Prefactura_Swimlane.docx"       "$PKG_ROOT/05_Prefactura_Swimlane/" 2>/dev/null || true

# SOPs (bilingual)
cp -f "$OUT_DIR/SOP_Ikusi.pdf"                  "$PKG_ROOT/06_SOPs/" 2>/dev/null || true
cp -f "$OUT_DIR/SOP_Ikusi.docx"                 "$PKG_ROOT/06_SOPs/" 2>/dev/null || true
cp -f "$OUT_DIR/SOP_CVDex.pdf"                  "$PKG_ROOT/06_SOPs/" 2>/dev/null || true
cp -f "$OUT_DIR/SOP_CVDex.docx"                 "$PKG_ROOT/06_SOPs/" 2>/dev/null || true

# Governance (RACI, Controls & Audit)
cp -f "$OUT_DIR/Governance_RACI.pdf"            "$PKG_ROOT/07_Governance/" 2>/dev/null || true
cp -f "$OUT_DIR/Governance_RACI.docx"           "$PKG_ROOT/07_Governance/" 2>/dev/null || true
cp -f "$OUT_DIR/Controls_and_Audit.pdf"         "$PKG_ROOT/07_Governance/" 2>/dev/null || true
cp -f "$OUT_DIR/Controls_and_Audit.docx"        "$PKG_ROOT/07_Governance/" 2>/dev/null || true

# UI Layouts
cp -f "$OUT_DIR/UI_Layouts.pdf"                 "$PKG_ROOT/08_UI_Layouts/" 2>/dev/null || true
cp -f "$OUT_DIR/UI_Layouts.docx"                "$PKG_ROOT/08_UI_Layouts/" 2>/dev/null || true

# Appendix (OpenAPI/Contracts/Any extra)
cp -f "$OUT_DIR/Appendix_OpenAPI.pdf"           "$PKG_ROOT/99_Appendix/" 2>/dev/null || true
cp -f "$OUT_DIR/Appendix_OpenAPI.docx"          "$PKG_ROOT/99_Appendix/" 2>/dev/null || true

# Include a browsable index.html at root of package (copy latest index)
cp -f "$OUT_DIR/index.html" "$PKG_ROOT/index.html" 2>/dev/null || true

# Include the rendered diagram assets for reference
mkdir -p "$PKG_ROOT/99_Appendix/diagrams"
cp -f "$OUT_DIR/img/"* "$PKG_ROOT/99_Appendix/diagrams/" 2>/dev/null || true

# Zip it all
( cd "$(dirname "$PKG_ROOT")" && zip -r "$ZIP_PATH" "$(basename "$PKG_ROOT")" )

echo "Client ZIP ready → $ZIP_PATH"
