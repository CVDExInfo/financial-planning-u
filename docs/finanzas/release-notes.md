# Finanzas SD – Release notes

**Last updated:** 2025-12-06  
**Audience:** All stakeholders  
**Purpose:** Track major releases and changes

## 2025-12-06 (Documentation Refresh)
- Comprehensive documentation cleanup and alignment with current codebase.
- Added "Last updated" dates and audience/purpose metadata to all core docs.
- Updated module names and UI labels to match current React implementation.
- Verified all API endpoints against SAM template (template.yaml).
- Corrected DynamoDB table list (12 tables including finz_rubros_taxonomia, finz_docs, finz_prefacturas).
- Removed duplicate archived documents (docs/archive/finanzas/).
- Improved bilingual consistency in terminology.

## 2024-11 (Docs rebuild)
- Nueva colección de documentos enfocada solo en Finanzas SD (sin Acta/Prefactura).
- Índice central `INDEX.md` con enlaces a arquitectura, modelos, API y seguridad.
- Manual operativo PMO en español con RACI, checklist y SOP de evidencia.
- Diagramas PlantUML exportados a SVG para arquitectura y flujos clave.
- Workflows `docs-monthly.yml` y `docs-on-demand.yml` para regenerar paquetes y artefacto `FinanzasDocsBundle.zip`.

## 2024-10
- Ajustes de conciliación y cierres mensuales documentados en `/close-month`.
- Mejoras de alerta para variaciones de forecast vs. facturas.

## 2024-09
- Endpoints de handoff a SDMT estabilizados y documentados.
- Validaciones de moneda y roles agregadas a proyectos y rubros.
