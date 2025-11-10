#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

mkdir -p diagrams dist/docs dist/checks

# -------- 0) Housekeeping & scope guard --------
if grep -RniE 'Pre-?Fact(ura)?|acta-ui-pre-factura' docs diagrams scripts >/dev/null 2>&1; then
  echo "ERROR: Pre-Factura content detected in Repo A. Purge before exporting."
  exit 1
fi

# -------- 1) Render Mermaid .mmd -> PNG/SVG (if any) --------
if command -v mmdc >/dev/null 2>&1; then
  while IFS= read -r -d '' M; do
    base="$(basename "${M%.*}")"
    echo "Rendering Mermaid: $M"
    mmdc -i "$M" -o "diagrams/${base}.png" -w 2400 -H 1600 -b transparent || true
    mmdc -i "$M" -o "diagrams/${base}.svg" -b transparent || true
  done < <(find docs diagrams -maxdepth 2 -name '*.mmd' -print0)
fi

# -------- 2) (Optional) DRAWIO notes --------
# If you keep .drawio sources under docs/, they will be packaged as-is by package.sh.
# Rendering them in CI requires a headless Draw.io binary; we intentionally avoid that dependency here.

# -------- 3) Lua filter to auto-fit images in PDFs --------
LUA_FILTER="scripts/docs/autofig.lua"
mkdir -p scripts/docs
cat > "$LUA_FILTER" <<'LUA'
-- Auto-scale all images to page width for Pandoc PDF
function Image(el)
  el.attributes['width'] = el.attributes['width'] or '100%'
  return el
end
LUA

# -------- 4) Convert Markdown -> HTML/PDF (Pandoc via Docker for LaTeX engine) --------
# Use the official pandoc/latex image so we don't install TeXlive on the runner
convert_md () {
  local in="$1"
  local name
  name="$(basename "${in%.*}")"

  echo "Converting: $in"

  # HTML (already auto-fits images with width=100%)
  docker run --rm -v "$PWD:/data" pandoc/core:latest \
    --from gfm+attributes \
    --resource-path=".:docs:diagrams" \
    -V toc=true \
    -V numbersections=false \
    -o "dist/docs/${name}.html" \
    "$in" || echo "Warning: HTML conversion failed for $in"

  # PDF (auto-fit images via lua filter)
  docker run --rm -v "$PWD:/data" pandoc/latex:latest \
    --from gfm+attributes \
    --pdf-engine=xelatex \
    --resource-path=".:docs:diagrams" \
    --lua-filter="scripts/docs/autofig.lua" \
    -V geometry:margin=0.8in \
    -V colorlinks=true -V linkcolor=blue \
    -o "dist/docs/${name}.pdf" \
    "$in" || echo "Warning: PDF conversion failed for $in"
}

# Only top-level doc pages; keep a clear table of contents in ZZ-Doc-Index.md
DOCS_LIST=$(cat <<'EOF'
docs/00-Executive-Summary.md
docs/10-Architecture-AWS.md
docs/11-CICD-Pipeline.md
docs/12-Business-Flowcharts.md
docs/13-Data-Lifecycle.md
docs/20-Runbook.md
docs/30-API-Contracts.md
docs/ZZ-Doc-Index.md
EOF
)

# Ensure files exist (create minimal shells if missing)
while read -r f; do
  test -f "$f" || { mkdir -p "$(dirname "$f")"; printf "# %s\n\n" "$(basename "$f")" > "$f"; }
done <<< "$DOCS_LIST"

# Embed PNGs by reference (authors maintain links in MD). If needed, enforce width=100% examples:
# e.g., ![Overview](../diagrams/finanzas-aws-architecture.png){ width=100% }

# Convert each doc
while read -r f; do
  convert_md "$f"
done <<< "$DOCS_LIST"

# -------- 5) Build an index and sanity checks --------
{
  echo "# Document Index"
  echo
  find dist/docs -maxdepth 1 -type f -printf "- %f (%s bytes)\n" 2>/dev/null \
  || find dist/docs -maxdepth 1 -type f -exec sh -c 'for f; do sz=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f"); echo "- $(basename "$f") (${sz} bytes)"; done' sh {} +
} > dist/docs/INDEX.md

# Basic readability check (ensure PDFs/HTML not zero bytes)
fail=0
while IFS= read -r -d '' out; do
  sz=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out")
  if [ "$sz" -le 1000 ]; then
    echo "ERROR: Suspect output (too small): $out"
    fail=1
  fi
done < <(find dist/docs -type f \( -name "*.pdf" -o -name "*.html" \) -print0)

# Check for common issues: missing diagram files referenced in MD
if grep -Rni 'diagrams/.*\.\(png\|svg\)' docs/*.md | cut -d: -f1-2 | while read -r hit; do
  f=$(echo "$hit" | cut -d: -f1)
  line=$(echo "$hit" | cut -d: -f2)
  img=$(sed -n "${line}p" "$f" | sed -nE 's/.*\(([^)]+)\).*/\1/p')
  [ -n "$img" ] && [ ! -f "$img" ] && echo "WARN: Referenced image not found: $img (from $f:$line)"
done | grep -q .; then
  echo "WARNING: Some referenced images are missing. Please verify diagram filenames."
fi

# Checksums for traceability
( find docs -type f; find diagrams -type f; find dist/docs -type f ) \
  | sort | xargs -I{} sh -c 'cksum "{}" || shasum -a 256 "{}"' > dist/checks/checksums.txt || true

# Final status
if [ "$fail" -ne 0 ]; then
  echo "ERROR: One or more outputs look invalid."
  exit 1
fi

echo "Docs export complete."
