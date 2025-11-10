# Finanzas SD Documentation Index

**Documentation Index / Índice de Documentación**

---

## EN: Overview

This documentation repository contains comprehensive guides, architecture diagrams, process documentation, and governance materials for the Finanzas SD system. All content is provided in bilingual format (Spanish/English) to support our diverse team and stakeholders.

## ES: Descripción General

Este repositorio de documentación contiene guías completas, diagramas de arquitectura, documentación de procesos y materiales de gobernanza para el sistema Finanzas SD. Todo el contenido se proporciona en formato bilingüe (español/inglés) para apoyar a nuestro equipo diverso y partes interesadas.

---

## EN: Documentation Structure

### Architecture Documentation
Located in `docs/architecture/`

- **[finanzas-architecture.md](architecture/finanzas-architecture.md)** - Complete system architecture overview (ES/EN)
- **Architecture Diagrams** (`docs/architecture/diagrams/`):
  - `erd-finanzas.mmd` - Entity-Relationship Diagram showing all tables, actors, and relationships
  - `aws-architecture.mmd` - AWS infrastructure and service architecture
  - `data-lineage.mmd` - Data flow and processing pipeline
  - `cicd-pipeline.mmd` - CI/CD deployment pipeline

### Process Documentation

#### Ikusi Processes (`docs/process/ikusi/`)
- **[SOP-finanzas-ikusi.md](process/ikusi/SOP-finanzas-ikusi.md)** - Financial Management SOP (ES/EN)

#### CVDex Processes (`docs/process/cvdex/`)
- **[runbook-ci-cd.md](process/cvdex/runbook-ci-cd.md)** - CI/CD Operations Runbook (ES/EN)
- **[security-and-iam.md](process/cvdex/security-and-iam.md)** - Security and IAM Guidelines (ES/EN)

### Governance Documentation (`docs/governance/`)
- **[raci-matrix.md](governance/raci-matrix.md)** - Responsibility Assignment Matrix (ES/EN)
- **[controls-and-audit.md](governance/controls-and-audit.md)** - Controls and Audit Framework (ES/EN)

### UI Documentation (`docs/ui/`)
- **[layouts-and-states.md](ui/layouts-and-states.md)** - UI layouts, component maps, empty states, and imputation rules (ES/EN)

### API Documentation (`openapi/`)
- **[finanzas.yaml](../openapi/finanzas.yaml)** - OpenAPI specification for Finanzas SD API
- See also: [API Contracts](api-contracts.md) and [Endpoint Coverage](endpoint-coverage.md)

### Operations (`docs/ops/`)
- Runbooks and operational procedures
- Deployment guides
- Monitoring and alerting

### Finanzas Production Release (`docs/finanzas-release/`)
- **[README.md](finanzas-release/README.md)** - Critical deployment documentation and verification procedures
- **[DEPLOYMENT_VERIFICATION_CHECKLIST.md](finanzas-release/DEPLOYMENT_VERIFICATION_CHECKLIST.md)** - Complete deployment checklist
- **[VERIFICATION_SCRIPTS_GUIDE.md](finanzas-release/VERIFICATION_SCRIPTS_GUIDE.md)** - Verification scripts usage guide
- **[FINANZAS-DEPLOYMENT-COMPLETE.md](finanzas-release/FINANZAS-DEPLOYMENT-COMPLETE.md)** - Ground truth infrastructure values
- **[FINANZAS_DEPLOYMENT_VERIFICATION.md](finanzas-release/FINANZAS_DEPLOYMENT_VERIFICATION.md)** - Manual verification procedures
- **[FINANZAS_NEXT_STEPS.md](finanzas-release/FINANZAS_NEXT_STEPS.md)** - Configuration guides and troubleshooting

### Additional Documentation
- **[quick-reference.md](quick-reference.md)** - Quick reference guide (ES/EN)
- **[auth-usage.md](auth-usage.md)** - Authentication usage guide
- **[deploy.md](deploy.md)** - Deployment procedures
- **[tree.structure.md](tree.structure.md)** - Repository structure

---

## ES: Estructura de Documentación

### Documentación de Arquitectura
Ubicada en `docs/architecture/`

- **[finanzas-architecture.md](architecture/finanzas-architecture.md)** - Descripción general completa de la arquitectura del sistema (ES/EN)
- **Diagramas de Arquitectura** (`docs/architecture/diagrams/`):
  - `erd-finanzas.mmd` - Diagrama Entidad-Relación mostrando todas las tablas, actores y relaciones
  - `aws-architecture.mmd` - Arquitectura de infraestructura y servicios AWS
  - `data-lineage.mmd` - Flujo de datos y pipeline de procesamiento
  - `cicd-pipeline.mmd` - Pipeline de despliegue CI/CD

### Documentación de Procesos

#### Procesos Ikusi (`docs/process/ikusi/`)
- **[SOP-finanzas-ikusi.md](process/ikusi/SOP-finanzas-ikusi.md)** - SOP de Gestión Financiera (ES/EN)

#### Procesos CVDex (`docs/process/cvdex/`)
- **[runbook-ci-cd.md](process/cvdex/runbook-ci-cd.md)** - Runbook de Operaciones CI/CD (ES/EN)
- **[security-and-iam.md](process/cvdex/security-and-iam.md)** - Directrices de Seguridad e IAM (ES/EN)

### Documentación de Gobernanza (`docs/governance/`)
- **[raci-matrix.md](governance/raci-matrix.md)** - Matriz de Asignación de Responsabilidades (ES/EN)
- **[controls-and-audit.md](governance/controls-and-audit.md)** - Marco de Controles y Auditoría (ES/EN)

### Documentación de UI (`docs/ui/`)
- **[layouts-and-states.md](ui/layouts-and-states.md)** - Layouts de UI, mapas de componentes, estados vacíos y reglas de imputación (ES/EN)

### Documentación de API (`openapi/`)
- **[finanzas.yaml](../openapi/finanzas.yaml)** - Especificación OpenAPI para API de Finanzas SD
- Ver también: [Contratos API](api-contracts.md) y [Cobertura de Endpoints](endpoint-coverage.md)

### Operaciones (`docs/ops/`)
- Runbooks y procedimientos operacionales
- Guías de despliegue
- Monitoreo y alertas

### Finanzas Despliegue en Producción (`docs/finanzas-release/`)
- **[README.md](finanzas-release/README.md)** - Documentación crítica de despliegue y procedimientos de verificación
- **[DEPLOYMENT_VERIFICATION_CHECKLIST.md](finanzas-release/DEPLOYMENT_VERIFICATION_CHECKLIST.md)** - Lista de verificación completa de despliegue
- **[VERIFICATION_SCRIPTS_GUIDE.md](finanzas-release/VERIFICATION_SCRIPTS_GUIDE.md)** - Guía de uso de scripts de verificación
- **[FINANZAS-DEPLOYMENT-COMPLETE.md](finanzas-release/FINANZAS-DEPLOYMENT-COMPLETE.md)** - Valores de infraestructura de referencia
- **[FINANZAS_DEPLOYMENT_VERIFICATION.md](finanzas-release/FINANZAS_DEPLOYMENT_VERIFICATION.md)** - Procedimientos de verificación manual
- **[FINANZAS_NEXT_STEPS.md](finanzas-release/FINANZAS_NEXT_STEPS.md)** - Guías de configuración y solución de problemas

### Documentación Adicional
- **[quick-reference.md](quick-reference.md)** - Guía de referencia rápida (ES/EN)
- **[auth-usage.md](auth-usage.md)** - Guía de uso de autenticación
- **[deploy.md](deploy.md)** - Procedimientos de despliegue
- **[tree.structure.md](tree.structure.md)** - Estructura del repositorio

---

## EN: System Components

### Core R1 Tables
1. **projects** - Project definitions and metadata
2. **rubros** - Cost categories and centers
3. **allocations** - Budget allocations by project and rubro
4. **payroll_actuals** - Payroll data and actuals
5. **adjustments** - Budget adjustments and corrections
6. **alerts** - System alerts and notifications
7. **providers** - Vendor and provider information
8. **audit_log** - Complete audit trail
9. **http_api** - API context and metadata

- **approval_event** - Approval workflow events
- **document** - Generated PDFs with folio/stamp
- **notification_log** - Email notifications
- **sharepoint_deposit** - SharePoint integration records

### System Actors
- **User** - System users with email and display name
- **Role** - System roles (SDT, PM, FIN, AUD)
- **CognitoGroup** - AWS Cognito group mappings
- **ServiceDeliveryManager** - Service delivery oversight
- **ProjectManager** - Project-level management

## ES: Componentes del Sistema

### Tablas Principales R1
1. **projects** - Definiciones y metadatos de proyectos
2. **rubros** - Categorías y centros de costo
3. **allocations** - Asignaciones presupuestarias por proyecto y rubro
4. **payroll_actuals** - Datos de nómina y valores reales
5. **adjustments** - Ajustes y correcciones presupuestarias
6. **alerts** - Alertas y notificaciones del sistema
7. **providers** - Información de vendedores y proveedores
8. **audit_log** - Registro de auditoría completo
9. **http_api** - Contexto y metadatos de API

- **approval_event** - Eventos del flujo de aprobación
- **document** - PDFs generados con folio/sello
- **notification_log** - Notificaciones por correo electrónico
- **sharepoint_deposit** - Registros de integración SharePoint

### Actores del Sistema
- **User** - Usuarios del sistema con email y nombre para mostrar
- **Role** - Roles del sistema (SDT, PM, FIN, AUD)
- **CognitoGroup** - Mapeos de grupos AWS Cognito
- **ServiceDeliveryManager** - Supervisión de entrega de servicios
- **ProjectManager** - Gestión a nivel de proyecto

---

## EN: How to Use This Documentation

1. **For Developers**: Start with `architecture/finanzas-architecture.md` and the architecture diagrams
3. **For Operations**: See `process/cvdex/runbook-ci-cd.md` and `ops/` directory
4. **For Auditors**: Review `governance/controls-and-audit.md` and `governance/raci-matrix.md`
5. **For Deployment & Verification**: See `finanzas-release/` directory for critical production deployment documentation
6. **For Quick Reference**: See `quick-reference.md`

## ES: Cómo Usar Esta Documentación

1. **Para Desarrolladores**: Comience con `architecture/finanzas-architecture.md` y los diagramas de arquitectura
3. **Para Operaciones**: Vea `process/cvdex/runbook-ci-cd.md` y el directorio `ops/`
4. **Para Auditores**: Revise `governance/controls-and-audit.md` y `governance/raci-matrix.md`
5. **Para Despliegue y Verificación**: Vea el directorio `finanzas-release/` para documentación crítica de despliegue en producción
6. **Para Referencia Rápida**: Vea `quick-reference.md`

---

## EN: Generating Documentation

This repository uses an automated bilingual documentation pipeline to generate PDF and DOCX versions of all documentation:

```bash
# Generate with default branding (Ikusi)
npm run render-docs

# Generate with CVDex branding
USE_CVDEX_BRANDING=true npm run render-docs
```

See [DOCUMENTATION_PIPELINE.md](../DOCUMENTATION_PIPELINE.md) for details.

## ES: Generación de Documentación

Este repositorio utiliza un pipeline automatizado de documentación bilingüe para generar versiones PDF y DOCX de toda la documentación:

```bash
# Generar con marca predeterminada (Ikusi)
npm run render-docs

# Generar con marca CVDex
USE_CVDEX_BRANDING=true npm run render-docs
```

Vea [DOCUMENTATION_PIPELINE.md](../DOCUMENTATION_PIPELINE.md) para detalles.

---

**Last Updated / Última Actualización**: November 2024  
**Maintainers / Mantenedores**: Finanzas SD Team  
**Status / Estado**: Active / Activo
