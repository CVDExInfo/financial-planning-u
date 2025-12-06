# Finanzas SD – Overview / Resumen ejecutivo

**Last updated:** 2025-12-06  
**Audience:** PMO, Finanzas, SDMT, Executives  
**Purpose:** Executive overview of Finanzas SD capabilities and scope

Finanzas SD explains how the platform governs project costs, rubros, and evidence end-to-end so PMO, Finanzas, and SDMT share a single source of truth. / Finanzas SD describe cómo la plataforma gobierna costos de proyecto, rubros y evidencia de punta a punta para que PMO, Finanzas y SDMT compartan una sola fuente de verdad.

## Purpose / Propósito
Finanzas SD delivers end-to-end cost governance for Ikusi/CVDEx projects. It standardizes rubros, tracks project baselines, reconciles invoices, and produces auditable evidence for PMO Colombia without mixing Acta or Prefactura materials.

## Scope and audiences / Alcance y audiencias
- **PMO Colombia**: project intake, baseline definition, evidence handling.
- **Finanzas & SDMT**: catalog alignment, allocations, forecast vs. actuals.
- **Auditoría**: traceability of approvals, document history, access control.

## Core capabilities / Capacidades clave
- Project creation, baseline capture, and SDMT handoff.
- Rubros catalog selection with allocation rules and monthly plan generation.
- Evidence-driven reconciliation for invoices (facturas) with document uploads.
- Health and observability endpoints for platform readiness.

## Modules / Módulos funcionales
- **Proyectos (Projects)**: crear y gestionar proyectos con presupuestos, fechas y responsables.
- **Catálogo de Rubros (Rubros Catalog)**: consultar catálogo maestro de rubros con taxonomía y línea contable.
- **Reglas de Asignación (Allocation Rules)**: definir reglas de distribución de presupuesto (driver percent, fixed, tickets, hours).
- **Ajustes Presupuestarios (Adjustments)**: gestionar excesos, reducciones y reasignaciones de presupuesto.
- **Flujo de Caja (Cashflow)**: monitorear ingresos, egresos y margen mensual.
- **Forecast SDMT**: visualizar y ajustar forecast mensual por proyecto.
- **Escenarios (Scenarios)**: comparar escenarios frente al baseline.
- **Proveedores (Providers)**: registrar y administrar proveedores del sistema.
- **SDMT Cost Modules**: Catálogo (Catalog), Conciliación (Reconciliation), Cambios (Changes) para SDMT users.

## High-level flow / Flujo de alto nivel
1. PMO registra proyecto y baseline inicial.
2. Se seleccionan rubros del catálogo y se generan line items con reglas de asignación.
3. Finanzas registra facturas y adjunta evidencia; se reconcilian contra forecast.
4. SDMT recibe handoff consolidado y alertas de desviaciones.

## Dependencies and constraints / Dependencias
- AWS Cognito para autenticación (grupos `PMO`, `FIN`, `SDMT`, `AUDIT`, `EXEC_RO`).
- API Gateway `finanzas-sd-api` con Lambdas por dominio bajo `services/finanzas-api`.
- DynamoDB para proyectos, rubros, line items, allocations y facturas; S3 para UI y evidencias.
- Región operativa: `us-east-2`.

Para detalles técnicos consulte `architecture.md`, modelos en `data-models.md`, y API en `api-reference.md`.
