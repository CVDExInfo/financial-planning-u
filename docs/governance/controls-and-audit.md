# Controls and Audit Framework

**Controls and Audit Framework for Finanzas SD**  
**Marco de Controles y Auditoría para Finanzas SD**

---

## EN: Overview

This document defines the controls and audit framework for Finanzas SD, ensuring financial accuracy, security compliance, and operational integrity.

## ES: Descripción General

Este documento define el marco de controles y auditoría para Finanzas SD, asegurando precisión financiera, cumplimiento de seguridad e integridad operacional.

---

## EN: Control Categories

### Preventive Controls
- **Access Control**: Cognito groups enforce RBAC
- **Input Validation**: All forms validate data before submission
- **Budget Limits**: System prevents over-budget allocations
- **Dual Approval**: High-value items require two approvers
- **Encryption**: Data encrypted at rest and in transit

### Detective Controls
- **Audit Logging**: All actions logged with actor and timestamp
- **CloudWatch Alarms**: Automated alerts for anomalies
- **Deviation Reports**: Monthly variance analysis
- **Access Reviews**: Quarterly user access audits
- **Security Scans**: Automated CodeQL and dependency checks

### Corrective Controls
- **Adjustment Workflow**: Structured process for corrections
- **Incident Response**: Defined procedures for issues
- **Rollback Capability**: Ability to revert deployments
- **Backup and Recovery**: Regular backups with tested restore

## ES: Categorías de Control

### Controles Preventivos
- **Control de Acceso**: Grupos Cognito aplican RBAC
- **Validación de Entrada**: Todos los formularios validan datos antes de envío
- **Límites Presupuestarios**: Sistema previene asignaciones sobre presupuesto
- **Aprobación Dual**: Elementos de alto valor requieren dos aprobadores
- **Encriptación**: Datos encriptados en reposo y en tránsito

### Controles Detectivos
- **Registro de Auditoría**: Todas las acciones registradas con actor y marca de tiempo
- **Alarmas CloudWatch**: Alertas automatizadas para anomalías
- **Reportes de Desviación**: Análisis de varianza mensual
- **Revisiones de Acceso**: Auditorías trimestrales de acceso de usuarios
- **Escaneos de Seguridad**: Verificaciones automatizadas CodeQL y dependencias

### Controles Correctivos
- **Flujo de Ajuste**: Proceso estructurado para correcciones
- **Respuesta a Incidentes**: Procedimientos definidos para problemas
- **Capacidad de Rollback**: Habilidad para revertir despliegues
- **Respaldo y Recuperación**: Respaldos regulares con restauración probada

---

## EN: Audit Trail Requirements

### Logged Events
Every system action must log:
- **Actor**: user_id and email
- **Timestamp**: ISO 8601 format with timezone
- **Action**: create, read, update, delete, approve, reject
- **Entity ID**: unique identifier
- **Before/After**: state change details (for updates)
- **Metadata**: additional context (IP address, user agent, etc.)

### Retention Policy
- **DynamoDB Audit Log**: 7 years minimum
- **CloudWatch Logs**: 90 days (exported to S3 for long-term)
- **S3 Archived Logs**: 7 years with Glacier transition after 1 year

### Tamper Protection
- Audit logs are append-only
- No deletion or modification allowed
- Write-only IAM permissions for log writers
- Read permissions restricted to audit team

## ES: Requisitos de Registro de Auditoría

### Eventos Registrados
Cada acción del sistema debe registrar:
- **Actor**: user_id y email
- **Marca de Tiempo**: Formato ISO 8601 con zona horaria
- **Acción**: crear, leer, actualizar, eliminar, aprobar, rechazar
- **ID de Entidad**: identificador único
- **Antes/Después**: detalles de cambio de estado (para actualizaciones)
- **Metadatos**: contexto adicional (dirección IP, agente de usuario, etc.)

### Política de Retención
- **Registro de Auditoría DynamoDB**: 7 años mínimo
- **Registros CloudWatch**: 90 días (exportados a S3 para largo plazo)
- **Registros Archivados S3**: 7 años con transición a Glacier después de 1 año

### Protección contra Manipulación
- Registros de auditoría son solo anexar
- Sin eliminación o modificación permitida
- Permisos IAM solo escritura para escritores de log
- Permisos de lectura restringidos a equipo de auditoría

---

## EN: Compliance Requirements

### Financial Controls
- **Segregation of Duties**: Requestor ≠ Approver
- **Dual Authorization**: Amounts > threshold require two approvals
- **Budget Enforcement**: System blocks over-budget transactions
- **Reconciliation**: Monthly comparison of plan vs actual

### Security Controls
- **Authentication**: MFA required for all users
- **Authorization**: Role-based access via Cognito groups
- **Encryption**: TLS 1.2+ and AES-256
- **Vulnerability Management**: Regular security scans

### Operational Controls
- **Change Management**: All production changes require evidence pack
- **Backup and Recovery**: Daily backups, tested restore procedures
- **Monitoring**: 24/7 CloudWatch alarms and canaries
- **Incident Management**: Defined response procedures

## ES: Requisitos de Cumplimiento

### Controles Financieros
- **Segregación de Deberes**: Solicitante ≠ Aprobador
- **Autorización Dual**: Montos > umbral requieren dos aprobaciones
- **Aplicación Presupuestaria**: Sistema bloquea transacciones sobre presupuesto
- **Reconciliación**: Comparación mensual de plan vs real

### Controles de Seguridad
- **Autenticación**: MFA requerido para todos los usuarios
- **Autorización**: Acceso basado en roles vía grupos Cognito
- **Encriptación**: TLS 1.2+ y AES-256
- **Gestión de Vulnerabilidades**: Escaneos de seguridad regulares

### Controles Operacionales
- **Gestión de Cambios**: Todos los cambios de producción requieren paquete de evidencia
- **Respaldo y Recuperación**: Respaldos diarios, procedimientos de restauración probados
- **Monitoreo**: Alarmas y canaries CloudWatch 24/7
- **Gestión de Incidentes**: Procedimientos de respuesta definidos

---

## EN: Audit Schedule

### Monthly Audits
- Budget execution vs plan
- Access control review (new users)
- System error rates

### Quarterly Audits
- Complete user access review
- Segregation of duties compliance
- Audit log integrity check
- Control effectiveness assessment

### Annual Audits
- Comprehensive financial audit
- Security posture assessment
- Business continuity plan test
- Third-party penetration test

## ES: Cronograma de Auditoría

### Auditorías Mensuales
- Ejecución presupuestaria vs plan
- Revisión de control de acceso (nuevos usuarios)
- Tasas de error del sistema

### Auditorías Trimestrales
- Revisión completa de acceso de usuarios
- Cumplimiento de segregación de deberes
- Verificación de integridad de registro de auditoría
- Evaluación de efectividad de controles

### Auditorías Anuales
- Auditoría financiera comprensiva
- Evaluación de postura de seguridad
- Prueba de plan de continuidad de negocio
- Prueba de penetración de terceros

---

## EN: Reporting

### Audit Reports Generated
1. **Monthly Control Report**
   - Control testing results
   - Exceptions identified
   - Remediation status
   
2. **Quarterly Compliance Report**
   - Compliance status summary
   - Key risk indicators
   - Trend analysis
   
3. **Annual Audit Report**
   - Overall control environment
   - Material findings
   - Management responses
   - Recommendations

### Report Distribution
- **Executive Summary**: Board and executives
- **Detailed Report**: Audit committee
- **Findings**: Management for remediation
- **Trends**: Risk management team

## ES: Reportes

### Reportes de Auditoría Generados
1. **Reporte de Control Mensual**
   - Resultados de prueba de controles
   - Excepciones identificadas
   - Estado de remediación
   
2. **Reporte de Cumplimiento Trimestral**
   - Resumen de estado de cumplimiento
   - Indicadores clave de riesgo
   - Análisis de tendencias
   
3. **Reporte de Auditoría Anual**
   - Ambiente de control general
   - Hallazgos materiales
   - Respuestas de gerencia
   - Recomendaciones

### Distribución de Reportes
- **Resumen Ejecutivo**: Junta y ejecutivos
- **Reporte Detallado**: Comité de auditoría
- **Hallazgos**: Gerencia para remediación
- **Tendencias**: Equipo de gestión de riesgos

---

**Document Version**: 1.0  
**Effective Date**: November 2024  
**Review Date**: Quarterly / Trimestral  
**Owner**: Audit Team / Equipo de Auditoría  
**Status**: Active / Activo
