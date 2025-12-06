# Finanzas SD – Sequence diagrams / Diagramas de secuencia

**Last updated:** 2025-12-06  
**Audience:** Engineers, SDMT, PMO  
**Purpose:** Visual flows for key processes and interactions

Executive perspective: these flows show how PMO, Finanzas, and SDMT coordinate handoffs and reconciliations with evidence and access controls at every step. / Perspectiva ejecutiva: estos flujos muestran cómo PMO, Finanzas y SDMT coordinan handoffs y conciliaciones con evidencia y controles de acceso en cada paso.

## Architecture Diagrams / Diagramas de arquitectura

### Executive View
- **Executive Architecture** (`diagrams/finanzas-architecture-executive.svg`) - High-level business view showing users, application modules, AWS cloud, and external systems. Ideal for stakeholder presentations.

### Technical View
- **Technical AWS Architecture** (`diagrams/finanzas-architecture-technical.svg`) - Detailed AWS services diagram showing CloudFront, S3, Cognito, API Gateway, Lambda functions, DynamoDB tables, and CloudWatch. For engineering and DevOps teams.

### Original Architecture
- **System Architecture** (`diagrams/finanzas-architecture.svg`) - Original compact architecture showing component relationships.

For creating professional Lucid versions, see **[LUCID_GUIDELINES.md](diagrams/LUCID_GUIDELINES.md)**.

## Sequence Flows / Flujos de secuencia

## Project intake to SDMT handoff
- Flujo: PMO crea proyecto → define baseline → asocia rubros → genera handoff para SDMT.
- Ver `diagrams/finanzas-sequence-handoff.svg` para pasos y validaciones.

## Invoice reconciliation with evidence
- Flujo: Finanzas registra factura → adjunta evidencia → reconcilia contra forecast → actualiza estado.
- Ver `diagrams/finanzas-sequence-recon.svg` para detalles de llamadas y accesos a DynamoDB/S3.

## Notes / Notas
- Todos los pasos requieren JWT con grupo habilitado; fallas de auth responden 401/403.
- La UI usa loaders optimistas, pero la confirmación depende de la respuesta de API.
