#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

mkdir -p diagrams dist/docs dist/checks scripts/docs

###############################################################################
# 0) Scope guard (Repo A only) — scan only content files under docs/diagrams
###############################################################################
PATTERN='Pre-?Fact(ura)?|acta-ui-pre-factura'
if grep -RniE "$PATTERN" \
     --binary-files=without-match \
     --exclude-dir .git \
     --exclude-dir dist \
     --exclude-dir node_modules \
     --include '*.md' \
     --include '*.mdx' \
     --include '*.mmd' \
     --include '*.svg' \
     --include '*.drawio' \
     --include '*.yaml' --include '*.yml' \
     --include '*.json' \
     docs diagrams >/tmp/prefact_matches.txt 2>/dev/null; then
  echo "ERROR: Pre-Factura content detected in Repo A content files. Purge before exporting."
  echo "----- Matches -----"
  cat /tmp/prefact_matches.txt
  echo "-------------------"
  exit 1
fi

###############################################################################
# 1) Normalize image paths inside Markdown
#    ../docs/diagrams/xyz.png  ->  ../diagrams/xyz.png
###############################################################################
if find docs -maxdepth 1 -name '*.md' | grep -q .; then
  while IFS= read -r -d '' MD; do
    sed -i.bak -E 's@\.\./docs/diagrams/@../diagrams/@g' "$MD"
  done < <(find docs -maxdepth 1 -name '*.md' -print0)
fi

###############################################################################
# 2) Mermaid rendering with Puppeteer no-sandbox
###############################################################################
PUP_CONF="scripts/docs/puppeteer.json"
cat > "$PUP_CONF" <<'JSON'
{
  "args": ["--no-sandbox", "--disable-setuid-sandbox"]
}
JSON

render_mermaid_dir () {
  local search_dir="$1"
  if [ -d "$search_dir" ] && command -v mmdc >/dev/null 2>&1; then
    while IFS= read -r -d '' M; do
      base="$(basename "${M%.*}")"
      echo "Rendering Mermaid: $M"
      mmdc -p "$PUP_CONF" -i "$M" -o "diagrams/${base}.png"
      mmdc -p "$PUP_CONF" -i "$M" -o "diagrams/${base}.svg"
    done < <(find "$search_dir" -type f -name '*.mmd' -print0)
  fi
}
render_mermaid_dir "docs"
render_mermaid_dir "diagrams"

###############################################################################
# 3) Pandoc PDF auto-fit (Lua filter)
###############################################################################
LUA_FILTER="scripts/docs/autofig.lua"
cat > "$LUA_FILTER" <<'LUA'
-- Ensure images scale to page width in PDF
function Image(el)
  el.attributes['width'] = el.attributes['width'] or '100%'
  return el
end
LUA

###############################################################################
# 4) Convert Markdown -> HTML/PDF using Pandoc in Docker
###############################################################################
convert_md () {
  local in="$1"
  local name
  name="$(basename "${in%.*}")"

  # HTML
  docker run --rm -v "$PWD:/data" pandoc/core:latest \
    --standalone \
    --from gfm+attributes \
    --resource-path=".:docs:diagrams" \
    -V toc=true \
    -V numbersections=false \
    -o "dist/docs/${name}.html" \
    "$in"

  # PDF
  docker run --rm -v "$PWD:/data" pandoc/latex:latest \
    --standalone \
    --from gfm+attributes \
    --pdf-engine=xelatex \
    --resource-path=".:docs:diagrams" \
    --lua-filter="scripts/docs/autofig.lua" \
    -V geometry:margin=0.8in \
    -V colorlinks=true -V linkcolor=blue \
    -o "dist/docs/${name}.pdf" \
    "$in"
}

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

# Create minimal shells if missing
while read -r f; do
  if [ ! -f "$f" ]; then
    mkdir -p "$(dirname "$f")"
    {
      echo "# $(basename "$f")"
      echo
      echo "_This page will be populated as part of the Finanzas SD documentation rebuild._"
    } > "$f"
  fi
done <<< "$DOCS_LIST"

# Convert each page
while read -r f; do
  echo "Converting: $f"
  convert_md "$f"
done <<< "$DOCS_LIST"

###############################################################################
# 5) Index page of outputs
###############################################################################
{
  echo "# Document Index"
  echo
  find dist/docs -maxdepth 1 -type f | while read -r of; do
    sz=$(stat -f%z "$of" 2>/dev/null || stat -c%s "$of")
    echo "- $(basename "$of") (${sz} bytes)"
  done | sort
} > dist/docs/INDEX.md

###############################################################################
# 6) Sanity checks (relaxed)
###############################################################################
fail=0
while IFS= read -r -d '' out; do
  sz=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out")
  if [ "$sz" -eq 0 ]; then
    echo "ERROR: Empty export: $(basename "$out")"
    fail=1
  elif [ "$sz" -lt 500 ]; then
    echo "WARN: Very small export ($sz bytes): $(basename "$out")"
  fi
done < <(find dist/docs -type f \( -name "*.pdf" -o -name "*.html" \) -print0)

###############################################################################
# 7) Warn on missing image files referenced from Markdown (robust parser)
###############################################################################
# Pattern: ![alt](../diagrams/<file>.png|svg)
if grep -RniE '!\[[^]]*\]\(\.\./diagrams/[^)]+\.(png|svg)\)' docs >/tmp/img_refs.txt 2>/dev/null; then
  while IFS= read -r line; do
    # Split "path:line:content" safely: first field=path, second=line, rest=content
    file="${line%%:*}"                    # up to first ':'
    rest="${line#*:}"                     # after first ':'
    lno="${rest%%:*}"                     # up to next ':'
    content="${rest#*:}"                  # after second ':'

    # Extract all ../diagrams/...png|svg occurrences from content
    while IFS= read -r img; do
      # Resolve relative to file's directory
      # file is like docs/10-Architecture-AWS.md; want ../diagrams/foo.png relative to docs/
      base_dir="$(dirname "$file")"
      path_rel="$base_dir/$img"
      path_rel="${path_rel//..\/}"        # collapse one ../
      # Accept either the resolved path or top-level diagrams/ fallback
      if [ ! -f "$path_rel" ] && [ ! -f "${img#../}" ]; then
        echo "WARN: Referenced image not found: $img (from $file:$lno)"
      fi
    done < <(echo "$content" | grep -oE '\(\.\./diagrams/[^)]+\.(png|svg)\)' | tr -d '()')
  done < /tmp/img_refs.txt
fi

###############################################################################
# 8) Checksums for traceability
###############################################################################
( find docs -type f; find diagrams -type f; find dist/docs -type f ) \
  | sort | xargs -I{} sh -c 'cksum "{}" || shasum -a 256 "{}"' > dist/checks/checksums.txt || true

# Final status
if [ "$fail" -ne 0 ]; then
  echo "ERROR: One or more outputs are invalid."
  exit 1
fi

echo "Docs export complete."
