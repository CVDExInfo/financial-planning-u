# Finanzas SD Documentation

**Last updated:** 2025-12-06

This directory contains the complete documentation for Finanzas SD (Service Delivery Financial Management), focusing exclusively on the Finanzas module without Acta or Prefactura content.

## 📚 Current Documentation

### Executive & Overview
- **[INDEX.md](INDEX.md)** - Central documentation portal with categorized links
- **[overview.md](overview.md)** - Executive overview of Finanzas SD capabilities and scope
- **[status-r1.md](status-r1.md)** - R1 release status and completed features
- **[release-notes.md](release-notes.md)** - Release history and major changes

### Technical Documentation
- **[architecture.md](architecture.md)** - Technical architecture (AWS services, deployment, request flow)
- **[data-models.md](data-models.md)** - DynamoDB table schemas and data relationships
- **[api-reference.md](api-reference.md)** - Quick API endpoint reference table
- **[api-contracts.md](api-contracts.md)** - Detailed API contracts with request/response examples
- **[sequence-diagrams.md](sequence-diagrams.md)** - Visual flows for key processes

### Operational Documentation
- **[pmo-handbook.md](pmo-handbook.md)** - PMO operational manual (Spanish, includes RACI)
- **[runbook-pmo-colombia.md](runbook-pmo-colombia.md)** - Day-to-day operational procedures
- **[security-compliance.md](security-compliance.md)** - Security controls and compliance guidelines
- **[glossary.md](glossary.md)** - Bilingual terminology reference (ES/EN)

### Diagrams
- **[diagrams/](diagrams/)** - PlantUML source files and rendered SVG diagrams
  - `finanzas-architecture.svg` - System architecture diagram
  - `finanzas-sequence-handoff.svg` - Project handoff flow
  - `finanzas-sequence-recon.svg` - Invoice reconciliation flow

### Annexes
- **[annex-r1/](annex-r1/)** - Historical R1 execution documentation (planning, test plans, completion reports)

## 🗄️ Archived Documentation

The **[archive/](archive/)** directory contains outdated or superseded documents:
- `finanzas-build-forensics.md` - Build troubleshooting (superseded by current overview)
- `infra-audit-finanzas-sd.md` - Infrastructure audit (superseded by architecture.md)
- `router-callback-validation.md` - Callback routing validation (superseded by current implementation)

These files are kept for historical reference and lessons learned but should not be used for current operations.

## 📦 Generated Documentation

The documentation build process generates:
- **PDF versions** of all core documents for client delivery
- **FinanzasDocsBinder.pdf** - Complete documentation bundle
- Located in `generated-pdf/` after running `scripts/docs/finanzas-docs.sh`

## 🔄 Updating Documentation

When updating docs:
1. Update the **"Last updated"** date in the front matter
2. Verify accuracy against code in `src/modules/finanzas/` and `services/finanzas-api/`
3. Check API endpoints against `services/finanzas-api/template.yaml`
4. Update `release-notes.md` with significant changes
5. Run `scripts/docs/finanzas-docs.sh` to regenerate PDFs

## 🎯 Audience Guide

- **PMO Colombia**: Start with [overview.md](overview.md), then [pmo-handbook.md](pmo-handbook.md) and [runbook-pmo-colombia.md](runbook-pmo-colombia.md)
- **SDMT / Finanzas**: Review [architecture.md](architecture.md), [data-models.md](data-models.md), and [api-reference.md](api-reference.md)
- **Engineers**: Use [api-contracts.md](api-contracts.md), [architecture.md](architecture.md), and [sequence-diagrams.md](sequence-diagrams.md)
- **Audit**: Refer to [security-compliance.md](security-compliance.md) and [glossary.md](glossary.md)
- **Executives**: Start with [overview.md](overview.md) and [status-r1.md](status-r1.md)

## 🔗 Related Resources

- Main repository: `/home/runner/work/financial-planning-u/financial-planning-u`
- UI source code: `src/modules/finanzas/`
- API source code: `services/finanzas-api/src/handlers/`
- SAM template: `services/finanzas-api/template.yaml`
- Doc build scripts: `scripts/docs/`
