# RACI Matrix - Finanzas SD

**Responsibility Assignment Matrix**  
**Matriz de Asignación de Responsabilidades**

---

## EN: Overview

This RACI matrix defines roles and responsibilities for key activities in the Finanzas SD system across all stakeholder groups.

**RACI Legend**:
- **R** = Responsible (does the work)
- **A** = Accountable (ultimately answerable)
- **C** = Consulted (provides input)
- **I** = Informed (kept up-to-date)

## ES: Descripción General

Esta matriz RACI define roles y responsabilidades para actividades clave en el sistema Finanzas SD a través de todos los grupos de partes interesadas.

**Leyenda RACI**:
- **R** = Responsable (hace el trabajo)
- **A** = Responsable (finalmente responde)
- **C** = Consultado (proporciona input)
- **I** = Informado (se mantiene actualizado)

---


| Activity | PM | FIN | SDT | AUD | SRE |
|----------|----|----|-----|-----|-----|
| Validate business justification | C | R | A | - | - |
| Approve/Reject request | C | R,A | I | I | - |
| Generate PDF with folio/stamp | - | - | - | - | R |
| Deposit to SharePoint | - | I | - | I | R |
| Monitor approval queue | - | A | R | - | - |
| Generate traceability report | C | R | A | C | - |
| Audit trail review | I | C | - | R,A | - |


| Actividad | PM | FIN | SDT | AUD | SRE |
|-----------|----|----|-----|-----|-----|
| Validar justificación de negocio | C | R | A | - | - |
| Aprobar/Rechazar solicitud | C | R,A | I | I | - |
| Generar PDF con folio/sello | - | - | - | - | R |
| Depositar en SharePoint | - | I | - | I | R |
| Monitorear cola de aprobación | - | A | R | - | - |
| Generar reporte de trazabilidad | C | R | A | C | - |
| Revisión de registro de auditoría | I | C | - | R,A | - |

---

## EN: Budget Management / Gestión Presupuesto

| Activity | PM | FIN | SDT | AUD | SRE |
|----------|----|----|-----|-----|-----|
| Create budget allocation | R | C | A | I | - |
| Approve budget allocation | C | R,A | I | I | - |
| Ingest payroll data | I | R | C | - | A |
| Validate payroll imputations | C | R | A | - | - |
| Create budget adjustment | R | C | A | I | - |
| Approve adjustment (PM) | R,A | C | - | I | - |
| Approve adjustment (FIN) | C | R,A | I | I | - |
| Monthly pre-close | C | R,A | I | I | - |
| Generate execution reports | C | R | A | C | - |
| Review budget deviations | C | R,A | I | - | - |

## ES: Gestión Presupuestaria

| Actividad | PM | FIN | SDT | AUD | SRE |
|-----------|----|----|-----|-----|-----|
| Crear asignación presupuestaria | R | C | A | I | - |
| Aprobar asignación presupuestaria | C | R,A | I | I | - |
| Ingestar datos de nómina | I | R | C | - | A |
| Validar imputaciones de nómina | C | R | A | - | - |
| Crear ajuste presupuestario | R | C | A | I | - |
| Aprobar ajuste (PM) | R,A | C | - | I | - |
| Aprobar ajuste (FIN) | C | R,A | I | I | - |
| Pre-cierre mensual | C | R,A | I | I | - |
| Generar reportes de ejecución | C | R | A | C | - |
| Revisar desviaciones presupuestarias | C | R,A | I | - | - |

---

## EN: Operations / Operaciones

| Activity | PM | FIN | SDT | AUD | SRE |
|----------|----|----|-----|-----|-----|
| Deploy to development | - | - | - | - | R,A |
| Deploy to staging | - | I | C | - | R,A |
| Deploy to production | I | I | C | - | R,A |
| Monitor system health | - | - | I | - | R,A |
| Configure CloudWatch alarms | - | - | C | - | R,A |
| Manage canaries/synthetics | - | - | I | - | R,A |
| Incident response | I | I | C | - | R,A |
| Performance optimization | - | - | C | - | R,A |
| Security patching | I | I | C | I | R,A |
| Backup and recovery | - | - | I | C | R,A |

## ES: Operaciones

| Actividad | PM | FIN | SDT | AUD | SRE |
|-----------|----|----|-----|-----|-----|
| Desplegar a desarrollo | - | - | - | - | R,A |
| Desplegar a staging | - | I | C | - | R,A |
| Desplegar a producción | I | I | C | - | R,A |
| Monitorear salud del sistema | - | - | I | - | R,A |
| Configurar alarmas CloudWatch | - | - | C | - | R,A |
| Gestionar canaries/sintéticos | - | - | I | - | R,A |
| Respuesta a incidentes | I | I | C | - | R,A |
| Optimización de rendimiento | - | - | C | - | R,A |
| Parcheo de seguridad | I | I | C | I | R,A |
| Respaldo y recuperación | - | - | I | C | R,A |

---

## EN: Governance & Compliance

| Activity | PM | FIN | SDT | AUD | SRE |
|----------|----|----|-----|-----|-----|
| Define security policies | C | C | C | C | R,A |
| Conduct security audits | I | C | C | R,A | C |
| Review access controls | I | C | I | R,A | C |
| Manage user permissions | C | C | R,A | I | C |
| Evidence pack preparation | I | C | C | I | R,A |
| Compliance reporting | I | C | C | R,A | C |
| Risk assessment | C | C | C | R,A | C |
| Change management approval | I | C | R,A | I | C |

## ES: Gobernanza y Cumplimiento

| Actividad | PM | FIN | SDT | AUD | SRE |
|-----------|----|----|-----|-----|-----|
| Definir políticas de seguridad | C | C | C | C | R,A |
| Conducir auditorías de seguridad | I | C | C | R,A | C |
| Revisar controles de acceso | I | C | I | R,A | C |
| Gestionar permisos de usuarios | C | C | R,A | I | C |
| Preparación de paquete de evidencia | I | C | C | I | R,A |
| Reportes de cumplimiento | I | C | C | R,A | C |
| Evaluación de riesgos | C | C | C | R,A | C |
| Aprobación de gestión de cambios | I | C | R,A | I | C |

---

## EN: Role Definitions

### PM (Project Manager)
- Owns project budget and delivery
- Approves project-level adjustments
- Reviews project execution reports

### FIN (Finance Team)
- Owns financial accuracy and compliance
- Manages monthly close process
- Generates financial reports

### SDT (Service Delivery Team)
- Owns overall portfolio health
- Oversees approval workflows
- Manages user access
- Escalates critical issues

### AUD (Audit Team)
- Owns compliance verification
- Reviews audit trails
- Conducts periodic audits
- Reports on control effectiveness

### SRE (Site Reliability Engineering)
- Owns system uptime and performance
- Manages deployments and infrastructure
- Responds to incidents
- Maintains observability

## ES: Definiciones de Roles

### PM (Gerente de Proyecto)
- Dueño del presupuesto y entrega del proyecto
- Aprueba ajustes a nivel de proyecto
- Revisa reportes de ejecución del proyecto

### FIN (Equipo de Finanzas)
- Dueño de precisión financiera y cumplimiento
- Gestiona proceso de cierre mensual
- Genera reportes financieros

### SDT (Equipo de Entrega de Servicios)
- Dueño de salud general del portafolio
- Supervisa flujos de aprobación
- Gestiona acceso de usuarios
- Escala problemas críticos

### AUD (Equipo de Auditoría)
- Dueño de verificación de cumplimiento
- Revisa registros de auditoría
- Conduce auditorías periódicas
- Reporta sobre efectividad de controles

### SRE (Ingeniería de Confiabilidad del Sitio)
- Dueño de uptime y rendimiento del sistema
- Gestiona despliegues e infraestructura
- Responde a incidentes
- Mantiene observabilidad

---

**Document Version**: 1.0  
**Effective Date**: November 2024  
**Review Date**: Quarterly / Trimestral  
**Owner**: Governance Team / Equipo de Gobernanza  
**Status**: Active / Activo
