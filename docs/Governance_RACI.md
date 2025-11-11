# Governance & RACI Matrix / Gobernanza y Matriz RACI

## EN: Governance Structure

### RACI Matrix for Finanzas SD

The RACI matrix defines roles and responsibilities for key activities in the Finanzas SD system.

**Legend**:
- **R** = Responsible (does the work)
- **A** = Accountable (final approval)
- **C** = Consulted (provides input)
- **I** = Informed (kept updated)


| Activity | SDM | PM | FIN | AUD | IT |
|----------|-----|----|----|-----|-----|
| Generate PDF | I | I | I | I | R |
| Upload to SharePoint | I | I | I | I | R |

#### Budget Management

| Activity | SDM | PM | FIN | AUD | IT |
|----------|-----|----|----|-----|-----|
| Create Budget | R/A | C | C | I | I |
| Approve Budget | R/A | C | C | I | I |
| Monitor Budget | C | R | R/A | I | I |
| Adjust Budget | R/A | C | C | I | I |
| Close Month Budget | C | I | R/A | C | I |
| Audit Budget | C | I | C | R/A | C |

#### System Administration

| Activity | SDM | PM | FIN | AUD | IT |
|----------|-----|----|----|-----|-----|
| User Management | C | I | C | I | R/A |
| Role Assignment | C | I | C | I | R/A |
| Policy Configuration | C | I | C | C | R/A |
| System Monitoring | I | I | I | I | R/A |
| Incident Response | I | I | I | I | R/A |
| Security Patching | I | I | I | I | R/A |

#### Reporting & Analytics

| Activity | SDM | PM | FIN | AUD | IT |
|----------|-----|----|----|-----|-----|
| Generate Reports | C | R | R | R | I |
| Review Analytics | R/A | R | R/A | C | I |
| Month-End Reports | A | C | R | C | I |
| Annual Reports | A | C | R | C | I |
| Audit Reports | C | I | C | R/A | C |

#### Compliance & Audit

| Activity | SDM | PM | FIN | AUD | IT |
|----------|-----|----|----|-----|-----|
| Audit Planning | C | I | C | R/A | C |
| Evidence Collection | C | C | C | R | R |
| Audit Execution | C | I | C | R/A | C |
| Findings Review | A | C | C | R | C |
| Remediation | C | I | R | C | R/A |
| Compliance Reporting | A | I | C | R | I |

### Governance Policies

#### 1. Access Control Policy
- **Principle**: Least privilege access
- **Implementation**: AVP Cedar policies
- **Review Frequency**: Quarterly
- **Owner**: IT with FIN approval

#### 2. Data Retention Policy
- **Budgets**: 7 years
- **Audit Logs**: 10 years
- **Documents**: 7 years
- **Notifications**: 1 year

#### 3. Approval Workflow Policy
- Budgets over $50K require SDM approval
- Budget adjustments require justification
- Rejected items require documented reason

#### 4. Change Management Policy
- All system changes require change request
- Production deployments require approval
- Rollback plan required for all changes
- Post-deployment validation mandatory

#### 5. Incident Response Policy
- Severity levels: Critical, High, Medium, Low
- Response times: 1h, 4h, 24h, 48h
- Escalation paths defined
- Post-mortem required for Critical/High

### Decision Rights

#### Strategic Decisions (SDM)
- Budget allocation across projects
- Policy changes affecting all users
- System enhancement priorities
- Vendor selection

#### Operational Decisions (FIN)
- Month-end close procedures
- Report distribution
- Budget variance explanations

#### Technical Decisions (IT)
- Infrastructure changes
- Security configurations
- Integration approaches
- Performance optimizations

#### Compliance Decisions (AUD)
- Audit scope and frequency
- Evidence requirements
- Finding severity
- Remediation priorities

---

## ES: Estructura de Gobernanza

### Matriz RACI para Finanzas SD

La matriz RACI define roles y responsabilidades para actividades clave en el sistema Finanzas SD.

**Leyenda**:
- **R** = Responsable (hace el trabajo)
- **A** = Aprobador (aprobación final)
- **C** = Consultado (proporciona información)
- **I** = Informado (mantenido actualizado)

[Traducción de todas las tablas RACI y políticas de gobernanza]

### Políticas de Gobernanza

#### 1. Política de Control de Acceso
- **Principio**: Acceso de mínimo privilegio
- **Implementación**: Políticas Cedar de AVP
- **Frecuencia de Revisión**: Trimestral
- **Propietario**: TI con aprobación de FIN

#### 2. Política de Retención de Datos
- **Presupuestos**: 7 años
- **Registros de Auditoría**: 10 años
- **Documentos**: 7 años
- **Notificaciones**: 1 año

[Traducción de las políticas restantes]
