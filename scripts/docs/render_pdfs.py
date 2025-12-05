import subprocess
from pathlib import Path


DOC_ROOT = Path(__file__).resolve().parent.parent.parent / "docs" / "finanzas"
DIAGRAMS = DOC_ROOT / "diagrams"
OUT_DIR = DOC_ROOT / "generated-pdf"

DOCS_ORDER = [
    "overview.md",
    "architecture.md",
    "data-models.md",
    "api-reference.md",
    "sequence-diagrams.md",
    "security-compliance.md",
    "pmo-handbook.md",
    "runbook-pmo-colombia.md",
    "glossary.md",
    "status-r1.md",
    "release-notes.md",
]


def run(*cmd: str, cwd: Path | None = None) -> None:
    print("::", " ".join(cmd))
    subprocess.check_call(cmd, cwd=str(cwd) if cwd else None)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate individual PDFs
    for md in DOCS_ORDER:
        src = DOC_ROOT / md
        dst = OUT_DIR / f"{src.stem}.pdf"
        run(
            "pandoc",
            str(src.relative_to(DOC_ROOT)),
            "--from=gfm",
            "--to=pdf",
            "--pdf-engine=wkhtmltopdf",
            f"--resource-path=.:{DIAGRAMS}",
            "-o",
            str(dst),
            cwd=DOC_ROOT,
        )

    # Build binder
    binder = OUT_DIR / "FinanzasDocsBinder.pdf"
    pdfs_in_order = [OUT_DIR / f"{Path(md).stem}.pdf" for md in DOCS_ORDER]
    run("pdfunite", *(str(p) for p in pdfs_in_order), str(binder))


if __name__ == "__main__":
    main()
