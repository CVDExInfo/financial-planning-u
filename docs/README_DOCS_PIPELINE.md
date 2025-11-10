# Documentation & Packaging Pipeline

This directory contains the bilingual (ES/EN) documentation and packaging pipeline for Finanzas SD.

## Overview

The documentation pipeline generates professional PDF and DOCX documents with branded templates and packages them into a single, client-ready ZIP file. All documents are bilingual with Spanish and English content.

## Quick Start

### Automated Generation (GitHub Actions)

1. Navigate to **Actions** → **Build & Package Bilingual Docs (PDF/DOCX/ZIP)**
2. Click **Run workflow**
3. Select branch: `main`
4. Click **Run workflow**
5. Wait for completion (~5-10 minutes)
6. Download the generated ZIP from `public/docs/releases/`

### Manual Generation (Local)

Prerequisites:
```bash
# Install dependencies
sudo apt-get install -y pandoc texlive-xetex texlive-fonts-recommended texlive-latex-extra fonts-lmodern zip imagemagick
npm install -g @mermaid-js/mermaid-cli drawio-export
```

Generate documents:
```bash
# Set branding (CVDex or Ikusi)
export USE_CVDEX_BRANDING=true  # or false for Ikusi

# Render all documents (PDF, DOCX)
bash scripts/docs/render-docs.sh

# Package into client-ready ZIP
bash scripts/docs/package-docs.sh
```

Outputs:
- `public/docs/latest/` - Individual PDF/DOCX files and HTML index
- `public/docs/releases/Ikusi_FinanzasSD_Architecture_Pack_YYYYMMDD.zip` - Client ZIP

## Document Structure

### Source Files (`docs/`)

Key documentation files that are automatically rendered:

1. **Executive_Summary.md** - High-level system overview
2. **AWS_Architecture.md** - AWS infrastructure and services
3. **ERD.md** - Entity relationship diagram and data model
4. **Data_Flows.md** - End-to-end process flows
5. **Prefactura_Swimlane.md** - Detailed pre-factura workflow
6. **SOP_Ikusi.md** - Standard operating procedures for Ikusi
7. **SOP_CVDex.md** - Standard operating procedures for CVDex
8. **Governance_RACI.md** - RACI matrix and governance policies
9. **Controls_and_Audit.md** - Audit framework and controls
10. **UI_Layouts.md** - User interface specifications
11. **Appendix_OpenAPI.md** - API documentation reference

### Generated Output (`public/docs/`)

```
public/docs/
├── latest/                    # Rolling "current" outputs
│   ├── *.pdf                  # PDF documents
│   ├── *.docx                 # DOCX documents
│   ├── img/                   # Rendered diagrams (SVG)
│   └── index.html             # Navigation index
└── releases/                  # Immutable dated releases
    └── Ikusi_FinanzasSD_Architecture_Pack_YYYYMMDD.zip
```

### ZIP Package Structure

```
Ikusi_FinanzasSD_Architecture_Pack_YYYYMMDD/
├── 01_Executive/
│   ├── Executive_Summary.pdf
│   └── Executive_Summary.docx
├── 02_AWS_Architecture/
│   ├── AWS_Architecture.pdf
│   └── AWS_Architecture.docx
├── 03_ERD/
│   ├── ERD.pdf
│   └── ERD.docx
├── 04_Data_Flows/
│   ├── Data_Flows.pdf
│   └── Data_Flows.docx
├── 05_Prefactura_Swimlane/
│   ├── Prefactura_Swimlane.pdf
│   └── Prefactura_Swimlane.docx
├── 06_SOPs/
│   ├── SOP_Ikusi.pdf
│   ├── SOP_Ikusi.docx
│   ├── SOP_CVDex.pdf
│   └── SOP_CVDex.docx
├── 07_Governance/
│   ├── Governance_RACI.pdf
│   ├── Governance_RACI.docx
│   ├── Controls_and_Audit.pdf
│   └── Controls_and_Audit.docx
├── 08_UI_Layouts/
│   ├── UI_Layouts.pdf
│   └── UI_Layouts.docx
├── 99_Appendix/
│   ├── Appendix_OpenAPI.pdf
│   ├── Appendix_OpenAPI.docx
│   └── diagrams/              # All rendered diagrams
└── index.html                 # Browsable index
```

## Branding

### CVDex Branding (Default)
- Logo: `assets/logo/cvdex.png`
- Colors: Dark blue (#003366)
- Enable: `USE_CVDEX_BRANDING=true`

### Ikusi Branding
- Logo: `assets/logo/ikusi.png`
- Colors: Green (#0C6E4F, #4AC795)
- Enable: `USE_CVDEX_BRANDING=false`

### Template Files
- **LaTeX PDF**: `assets/branding/template.tex`
- **Word DOCX**: `assets/branding/reference.docx`
- **Cover Image**: `assets/branding/cover.png`
- **Header**: `assets/branding/header.png`
- **Footer**: `assets/branding/footer.png`

## Diagram Support

### Mermaid Diagrams (.mmd)
Place `.mmd` files in `diagrams/` directory. They will be automatically converted to SVG and embedded in documents.

Example:
```
diagrams/end-to-end-flow.mmd
```

### Draw.io Diagrams (.drawio)
Place `.drawio` files in `diagrams/` directory. They will be automatically converted to SVG (requires `drawio-export` CLI).

### Lucid Diagrams
Export from Lucid as **SVG** or **PNG** and place in `diagrams/` directory with descriptive names:
- `AWS_Architecture.svg`
- `ERD.svg`
- `Data_Flows.svg`

For premium AWS diagrams, use the **AWS Architecture Icons** library in Lucid.

## Updating Documentation

### Add a New Document

1. Create a new Markdown file in `docs/`:
   ```bash
   docs/My_New_Document.md
   ```

2. Add bilingual content with clear section headers:
   ```markdown
   # My New Document / Mi Nuevo Documento
   
   ## EN: English Section
   Content in English...
   
   ## ES: Sección en Español
   Contenido en español...
   ```

3. Update `scripts/docs/package-docs.sh` to include it in the ZIP:
   ```bash
   cp -f "$OUT_DIR/My_New_Document.pdf" "$PKG_ROOT/10_NewCategory/" 2>/dev/null || true
   cp -f "$OUT_DIR/My_New_Document.docx" "$PKG_ROOT/10_NewCategory/" 2>/dev/null || true
   ```

4. Run the pipeline:
   ```bash
   bash scripts/docs/render-docs.sh
   bash scripts/docs/package-docs.sh
   ```

### Update Existing Document

1. Edit the Markdown file in `docs/`
2. Re-run the pipeline (manual or via GitHub Actions)
3. New ZIP will be generated with today's date

### Add Diagrams

1. Place diagram file in `diagrams/`:
   - Mermaid: `diagrams/my-diagram.mmd`
   - Draw.io: `diagrams/my-diagram.drawio`
   - Static: `diagrams/my-diagram.svg`

2. Reference in your Markdown:
   ```markdown
   ![My Diagram](img/my-diagram.svg)
   ```

3. The pipeline will automatically convert and include it

## Troubleshooting

### PDF Generation Fails
- **Issue**: LaTeX compilation errors
- **Fix**: Check for special characters, ensure code blocks use proper syntax
- **Workaround**: DOCX still generated; can convert manually

### Mermaid Diagrams Not Rendering
- **Issue**: `mmdc` command not found
- **Fix**: `npm install -g @mermaid-js/mermaid-cli`
- **Workaround**: Export diagram as SVG manually and place in `diagrams/`

### Missing Fonts
- **Issue**: Font errors in PDF generation
- **Fix**: Install required fonts: `sudo apt-get install fonts-dejavu fonts-liberation`

### ZIP Missing Files
- **Issue**: Some documents not in ZIP
- **Fix**: Ensure source `.md` files use exact names expected in `package-docs.sh`
- **Check**: Review `package-docs.sh` mapping logic

## Version Control

### Immutable Releases
Each workflow run creates a dated ZIP:
```
Ikusi_FinanzasSD_Architecture_Pack_20251110.zip
Ikusi_FinanzasSD_Architecture_Pack_20251115.zip
Ikusi_FinanzasSD_Architecture_Pack_20251120.zip
```

### Git Tagging (Optional)
Tag releases for traceability:
```bash
git tag docs-20251110
git push origin docs-20251110
```

### Latest Outputs
The `public/docs/latest/` directory always contains the most recent build. This directory is committed to the repository for easy access.

## Best Practices

1. **Write bilingual content** - Always include both EN and ES sections
2. **Use consistent naming** - Follow the naming convention for source files
3. **Include diagrams** - Visual documentation is more effective
4. **Test locally first** - Run scripts locally before pushing
5. **Review PDFs** - Check generated PDFs for formatting issues
6. **Update index** - Ensure `package-docs.sh` includes new documents
7. **Commit generated files** - Include `public/docs/latest/` and `public/docs/releases/` in commits

## Contact

For questions or issues with the documentation pipeline, contact:
- **Engineering**: IT Team
- **Content**: SDM / Finance Team
- **Branding**: Marketing Team
