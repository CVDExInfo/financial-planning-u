#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
DOCS_DIR="$ROOT/docs"
DIAG_DIR="$ROOT/diagrams"
OUT_DIR="$ROOT/public/docs/latest"
BRAND_DIR="$ROOT/assets/branding"
LOGO_DIR="$ROOT/assets/logo"

mkdir -p "$OUT_DIR" "$OUT_DIR/img" "$OUT_DIR/tmp"

# 0) Helper: choose branding logo
if [[ "${USE_CVDEX_BRANDING:-true}" == "true" ]]; then
  BRAND_LOGO="$LOGO_DIR/cvdex.png"
else
  BRAND_LOGO="$LOGO_DIR/ikusi.png"
fi

# 1) Convert Mermaid diagrams (.mmd) -> SVG
shopt -s nullglob
for mmd in "$DIAG_DIR"/*.mmd "$DOCS_DIR"/*.mmd; do
  base="$(basename "$mmd" .mmd)"
  echo "Rendering Mermaid: $mmd"
  mmdc -i "$mmd" -o "$OUT_DIR/img/${base}.svg" --backgroundColor transparent --scale 1 || echo "Warning: Failed to convert $mmd"
done

# 2) Convert Draw.io diagrams (.drawio) -> SVG
for d in "$DIAG_DIR"/*.drawio "$DOCS_DIR"/*.drawio; do
  base="$(basename "$d" .drawio)"
  echo "Exporting Draw.io: $d"
  drawio-export --format svg --output "$OUT_DIR/img/${base}.svg" "$d" || echo "Warning: Failed to convert $d"
done

# 3) Copy any static SVG/PNG from diagrams/ to OUT/img
for img in "$DIAG_DIR"/*.svg "$DIAG_DIR"/*.png; do
  cp -f "$img" "$OUT_DIR/img/" || true
done

# 4) Render Markdown -> PDF/DOCX (and optional HTML)
# Requirements:
# - $BRAND_DIR/template.tex (LaTeX template uses cover/header/footer images; includes logo)
# - $BRAND_DIR/reference.docx (Word styles with header/footer & logo)
render_one() {
  src_md="$1"
  name="$(basename "${src_md%.*}")"
  echo "Rendering: $src_md"

  # Try PDF generation
  if pandoc "$src_md" \
    --from gfm \
    --resource-path="$DOCS_DIR:$DIAG_DIR:$OUT_DIR/img" \
    --metadata=logo:"$BRAND_LOGO" \
    --metadata=title:"$name" \
    --pdf-engine=xelatex \
    --template="$BRAND_DIR/template.tex" \
    -o "$OUT_DIR/${name}.pdf" 2>/dev/null; then
    echo "  ✓ PDF generated"
  else
    echo "  ⚠ Warning: PDF generation failed for $name"
  fi

  # Try DOCX generation
  if pandoc "$src_md" \
    --from gfm \
    --resource-path="$DOCS_DIR:$DIAG_DIR:$OUT_DIR/img" \
    --reference-doc="$BRAND_DIR/reference.docx" \
    -o "$OUT_DIR/${name}.docx" 2>/dev/null; then
    echo "  ✓ DOCX generated"
  else
    echo "  ⚠ Warning: DOCX generation failed for $name"
  fi

  # Optional HTML preview (comment out if not needed)
  # pandoc "$src_md" \
  #   --from gfm \
  #   --resource-path="$DOCS_DIR:$DIAG_DIR:$OUT_DIR/img" \
  #   -s -o "$OUT_DIR/${name}.html"
}

# Render top-level docs and subfolders
find "$DOCS_DIR" -type f -name "*.md" -print0 | while IFS= read -r -d '' md; do
  render_one "$md" || echo "Warning: Failed to render $md"
done

# 5) Generate an index.html listing
{
  echo "<!doctype html><html><head><meta charset='utf-8'><title>Documentation – latest</title></head><body>"
  echo "<h1>Documentation (Latest)</h1><ul>"
  for f in "$OUT_DIR"/*.pdf; do
    base="$(basename "$f" .pdf)"
    echo "<li><strong>${base}</strong> — <a href='./${base}.pdf'>PDF</a> | <a href='./${base}.docx'>DOCX</a></li>"
  done
  echo "</ul></body></html>"
} > "$OUT_DIR/index.html"

echo "Render complete → $OUT_DIR"
