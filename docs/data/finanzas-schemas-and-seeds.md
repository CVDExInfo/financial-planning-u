# Finanzas SD - Schemas and Golden Seeds Documentation

## Overview

This document provides a comprehensive reference for the Finanzas Service Delivery (SD) data schemas and the golden dataset used for testing and development. All schemas are defined in OpenAPI 3.1 format and validated using TypeScript/Zod schemas.

---

## Data Schemas

### 1. HealthResponse

Health check endpoint response.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `ok` | boolean | Yes | Indicates if the service is healthy | `true` |
| `status` | string | No | Status indicator (ok, UP, healthy) | `"ok"` |
| `env` | string | No | Current environment (dev, stg, prod) | `"dev"` |
| `version` | string | No | API version | `"1.0.0"` |

**Location:** OpenAPI `components.schemas.HealthResponse`  
**Validator:** `services/finanzas-api/src/validation/health.ts`

---

### 2. Handoff

Project handoff from sales/PM to Service Delivery Team.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `mod_total` | number | Yes | Total budget being handed off | `12240000` |
| `pct_ingenieros` | number | Yes | Percentage allocated to engineers (0-100) | `85` |
| `pct_sdm` | number | Yes | Percentage for SDM overhead (0-100) | `15` |
| `aceptado_por` | string (email) | Yes | Email of person accepting handoff | `"pm.lead@ikusi.com"` |
| `fecha_handoff` | string (date) | Yes | Date of handoff (YYYY-MM-DD) | `"2024-12-15"` |
| `notas` | string | No | Additional notes (max 2000 chars) | `"Proyecto de plataforma IA..."` |

**Location:** OpenAPI `components.schemas.Handoff`  
**Validator:** `services/finanzas-api/src/validation/handoff.ts`

---

### 3. Rubro (Catalog)

Budget line item from the master catalog (71 items total).

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | No | Unique rubro identifier | `"rubro_abc1234567"` |
| `rubro_id` | string | Yes | Catalog rubro ID | `"RB0001"` |
| `nombre` | string | Yes | Rubro name/description | `"Costo mensual de ingenieros..."` |
| `categoria` | string | No | Category | `"Servicios de Ingeniería"` |
| `tier` | string | No | Service tier | `"Gold"` |
| `tipo_costo` | string | No | Cost type | `"Recurrente"` |
| `tipo_ejecucion` | string | No | Execution type (mensual, puntual, por_hito) | `"mensual"` |

**Location:** OpenAPI `components.schemas.Rubro`  
**Validator:** `services/finanzas-api/src/validation/rubros.ts`

---

### 4. ProjectRubroAttachment

Links a catalog rubro to a specific project.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | No | Unique attachment identifier | `"proj_rubro_abc123"` |
| `projectId` | string | Yes | Project identifier | `"P-GOLDEN-1"` |
| `rubroId` | string | Yes | Catalog rubro ID | `"RB0001"` |
| `attachedAt` | string (datetime) | Yes | Timestamp when attached | `"2025-01-15T10:00:00Z"` |
| `attachedBy` | string (email) | No | User who attached | `"pm.lead@ikusi.com"` |
| `notes` | string | No | Notes (max 500 chars) | `""` |

**Location:** OpenAPI `components.schemas.ProjectRubroAttachment`  
**Validator:** `services/finanzas-api/src/validation/rubros.ts`

---

### 5. EstimatorItem

Line item from the project estimator/baseline.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | Yes | Unique estimator item ID | `"est_gold001"` |
| `projectId` | string | Yes | Project identifier | `"P-GOLDEN-1"` |
| `baselineId` | string | No | Baseline identifier | `"BL-1763192300497"` |
| `rubroId` | string | Yes | Catalog rubro ID | `"RB0001"` |
| `nombre` | string | Yes | Item name/description | `"Ingenieros Gold - 48 meses"` |
| `tier` | string | No | Service tier | `"Gold"` |
| `quantity` | number | Yes | Quantity (resources, months, etc.) | `3` |
| `unitCost` | number | Yes | Cost per unit | `85000` |
| `totalCost` | number | Yes | Total cost (quantity × unitCost) | `12240000` |
| `period` | number (int) | No | Period in months | `48` |
| `startMonth` | string | No | Starting month (YYYY-MM) | `"2025-01"` |
| `endMonth` | string | No | Ending month (YYYY-MM) | `"2028-12"` |
| `committed` | boolean | No | Whether committed to allocations | `true` |
| `createdAt` | string (datetime) | No | Creation timestamp | `"2025-01-10T10:00:00Z"` |

**Location:** OpenAPI `components.schemas.EstimatorItem`  
**Validator:** `services/finanzas-api/src/validation/estimator.ts`

---

### 6. Allocation

Monthly budget allocation for a project.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | Yes | Unique allocation ID | `"alloc_abc123"` |
| `projectId` | string | Yes | Project identifier | `"P-GOLDEN-1"` |
| `rubroId` | string | Yes | Catalog rubro ID | `"RB0001"` |
| `estimatorItemId` | string | No | Related estimator item | `"est_xyz789"` |
| `month` | string | Yes | Month (YYYY-MM) | `"2025-01"` |
| `amount` | number | Yes | Allocated amount | `85000` |
| `source` | string | Yes | Source (estimator, manual, adjustment) | `"estimator"` |
| `status` | string | No | Status (planned, committed, spent) | `"committed"` |
| `createdAt` | string (datetime) | No | Creation timestamp | `"2025-01-10T12:00:00Z"` |

**Location:** OpenAPI `components.schemas.Allocation`  
**Validator:** `services/finanzas-api/src/validation/allocations.ts`

---

### 7. PayrollActual

Actual payroll spend for a project and month.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | Yes | Unique payroll record ID | `"payroll_def456"` |
| `projectId` | string | Yes | Project identifier | `"P-GOLDEN-1"` |
| `allocationId` | string | No | Related allocation | `"alloc_abc123"` |
| `rubroId` | string | Yes | Catalog rubro ID | `"RB0001"` |
| `month` | string | Yes | Month (YYYY-MM) | `"2025-01"` |
| `amount` | number | Yes | Actual amount spent | `82500` |
| `resourceCount` | number (int) | No | Number of resources | `3` |
| `source` | string | No | Source system | `"SAP_HR"` |
| `uploadedBy` | string (email) | No | User who uploaded | `"finance@ikusi.com"` |
| `uploadedAt` | string (datetime) | No | Upload timestamp | `"2025-02-01T10:00:00Z"` |
| `notes` | string | No | Notes (max 500 chars) | `""` |

**Location:** OpenAPI `components.schemas.PayrollActual`  
**Validator:** `services/finanzas-api/src/validation/payroll.ts`

---

### 8. Adjustment

Budget adjustment (increase, decrease, reallocation).

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | Yes | Unique adjustment ID | `"adj_pos001"` |
| `project_id` | string | Yes | Project identifier | `"P-GOLDEN-1"` |
| `tipo` | string | Yes | Type (exceso, reduccion, reasignacion) | `"exceso"` |
| `monto` | number | Yes | Adjustment amount | `15000` |
| `origen_rubro_id` | string | No | Source rubro (for reasignacion) | `null` |
| `destino_rubro_id` | string | No | Destination rubro (for reasignacion) | `null` |
| `fecha_inicio` | string | Yes | Starting month (YYYY-MM) | `"2025-03"` |
| `metodo_distribucion` | string | No | Distribution method | `"single_month"` |
| `justificacion` | string | No | Justification (max 2000 chars) | `"Requerimiento adicional..."` |
| `solicitado_por` | string (email) | Yes | Requester email | `"pm.lead@ikusi.com"` |
| `estado` | string | Yes | Status (pending_approval, approved, rejected) | `"approved"` |
| `aprobado_por` | string (email) | No | Approver email | `"director@ikusi.com"` |
| `aprobado_en` | string (datetime) | No | Approval timestamp | `"2025-02-15T14:30:00Z"` |
| `created_at` | string (datetime) | Yes | Creation timestamp | `"2025-02-10T09:00:00Z"` |

**Location:** OpenAPI `components.schemas.Adjustment`  
**Validator:** `services/finanzas-api/src/validation/adjustments.ts`

---

### 9. ReconSummary

Reconciliation summary for a project and month.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `projectId` | string | Yes | Project identifier | `"P-GOLDEN-1"` |
| `month` | string | Yes | Month (YYYY-MM) | `"2025-01"` |
| `totalAllocated` | number | No | Total allocated amount | `470000` |
| `totalActual` | number | No | Total actual spent | `459000` |
| `variance` | number | No | Variance (actual - allocated) | `-11000` |
| `variancePercent` | number | No | Variance percentage | `-2.34` |
| `matched` | number | No | Matched amount | `440000` |
| `matchedCount` | number (int) | No | Number of matched records | `3` |
| `pending` | number | No | Pending amount | `11000` |
| `pendingCount` | number (int) | No | Number of pending records | `1` |
| `disputed` | number | No | Disputed amount | `0` |
| `disputedCount` | number (int) | No | Number of disputed records | `0` |
| `adjustments` | number | No | Total adjustments | `0` |
| `adjustmentsCount` | number (int) | No | Number of adjustments | `0` |
| `lastUpdated` | string (datetime) | No | Last update timestamp | `"2025-02-05T15:30:00Z"` |

**Location:** OpenAPI `components.schemas.ReconSummary`  
**Validator:** `services/finanzas-api/src/validation/recon.ts`

---

## Rubros Seed – Finanzas SD

### Overview

Canonical script for seeding the **rubros** (budget line items catalog) DynamoDB table.

**Script location:** `src/modules/finanzas/data/seed_rubros.ts`

### Required Environment Variables

- `AWS_REGION` (e.g., `us-east-2`) - AWS region for DynamoDB
- `TABLE_RUBROS` - DynamoDB table name for rubros

### Usage

#### From Repository Root

```bash
npm run seed:finanzas:rubros
```

#### From services/finanzas-api/

```bash
npm run seed:rubros
```

#### Direct Execution

```bash
# With ts-node ESM loader
TS_NODE_PROJECT=tsconfig.node.json node --loader ts-node/esm/transpile-only src/modules/finanzas/data/seed_rubros.ts

# Or with shebang (if configured)
./src/modules/finanzas/data/seed_rubros.ts
```

### What Gets Seeded

The script seeds the rubros catalog from `RUBROS_CATALOG` defined in `src/modules/finanzas/data/rubros.catalog.ts`. Each rubro includes:

- `rubro_id` - Unique identifier (e.g., "RB0001")
- `nombre` - Name/description of the budget line item
- `descripcion` - Additional description (optional)

The script is idempotent and uses `PutItem` to upsert records by `rubro_id`.

### Authentication

Requires AWS credentials via:
- OIDC in CI/CD pipelines
- Local AWS profile/credentials for development

---

## Canonical Demo Projects Universe

### Overview

For testing and development, Finanzas SD uses a **small, realistic universe of 5–10 demo projects** based on actual Ikusi service delivery scenarios. These projects cover different:

- Service types (NOC, SOC, WiFi, Cloud, Connectivity)
- Durations (24, 36, 48, 60 months)
- Budget scales ($2M to $25M)
- Clients (Claro, Bancolombia, Avianca, etc.)
- Margin scenarios (favorable, on-target, challenged)

**Purpose**: Provide consistent, presentation-ready data for:
- Unit and integration tests
- Contract/API tests
- Dev environment demos
- UI screenshots and walkthroughs
- Role-based scenario testing (PM, SDM, FIN)

### Canonical Projects List

| Project ID | Name | Client | Service Type | Duration | Start | Total Budget | Status |
|------------|------|--------|--------------|----------|-------|--------------|--------|
| P-NOC-CLARO-BOG | NOC Claro Bogotá | Claro Colombia | NOC 24x7 | 60 months | 2025-01 | $18.5M USD | active |
| P-SOC-BANCOL-MED | SOC Bancolombia Medellín | Bancolombia | SOC/Security | 36 months | 2025-02 | $12.8M USD | active |
| P-WIFI-ELDORADO | WiFi Aeropuerto El Dorado | Avianca | WiFi Infrastructure | 24 months | 2025-01 | $4.2M USD | active |
| P-CLOUD-ECOPETROL | Cloud Ops Ecopetrol | Ecopetrol | Cloud Operations | 48 months | 2024-12 | $22.5M USD | active |
| P-SD-TIGO-CALI | Service Delivery Tigo Cali | Tigo Colombia | Managed Services | 36 months | 2025-03 | $9.6M USD | active |
| P-CONNECT-AVIANCA | Connectivity Avianca | Avianca | SD-WAN/MPLS | 48 months | 2024-11 | $15.3M USD | active |
| P-DATACENTER-ETB | Datacenter ETB | ETB | Datacenter Ops | 60 months | 2025-01 | $25.0M USD | active |

**Total Portfolio Value:** ~$108M USD across 7 active projects

### Project Details

#### 1. P-NOC-CLARO-BOG (NOC Claro Bogotá)

**Business Context**: 24x7 Network Operations Center for Claro's corporate network in Bogotá region.

- **Duration**: 60 months (2025-01 to 2029-12)
- **Total Budget**: $18.5M USD ($308,333/month)
- **Contract Value**: $18M (MOD) + $0.5M (indirect)
- **Target Margin**: 12%
- **MOD Resources**:
  - 8 x NOC Engineers (Gold tier)
  - 2 x NOC Leads (Premium tier)
  - 1 x SDM (Gold tier)
- **Baseline ID**: BL-NOC-CLARO-001
- **Baseline Items**: 11 line items (MOD, monitoring tools, circuits, facilities)
- **Margin Profile**: **Favorable** (consistently under budget due to efficient staffing)

#### 2. P-SOC-BANCOL-MED (SOC Bancolombia Medellín)

**Business Context**: Security Operations Center for financial services monitoring and incident response.

- **Duration**: 36 months (2025-02 to 2028-01)
- **Total Budget**: $12.8M USD ($355,556/month)
- **Contract Value**: $12M (MOD) + $0.8M (indirect)
- **Target Margin**: 15%
- **MOD Resources**:
  - 6 x Security Analysts (Premium tier)
  - 1 x SOC Lead (Premium tier)
  - 1 x SDM (Gold tier)
- **Baseline ID**: BL-SOC-BANCOL-001
- **Baseline Items**: 9 line items (MOD, SIEM licenses, security tools, training)
- **Margin Profile**: **On-target** (meeting margin expectations)

#### 3. P-WIFI-ELDORADO (WiFi Aeropuerto El Dorado)

**Business Context**: Enterprise WiFi infrastructure and management for El Dorado International Airport.

- **Duration**: 24 months (2025-01 to 2026-12)
- **Total Budget**: $4.2M USD ($175,000/month)
- **Contract Value**: $3.8M (MOD + equipment) + $0.4M (indirect)
- **Target Margin**: 10%
- **MOD Resources**:
  - 3 x WiFi Engineers (Gold tier)
  - 1 x Tech Lead (Premium tier)
  - 1 x SDM (Gold tier)
- **Baseline ID**: BL-WIFI-ELDORADO-001
- **Baseline Items**: 8 line items (MOD, AP licenses, controllers, support)
- **Margin Profile**: **On-target** (steady performance)

#### 4. P-CLOUD-ECOPETROL (Cloud Ops Ecopetrol)

**Business Context**: Hybrid cloud operations (AWS + Azure) for national oil company.

- **Duration**: 48 months (2024-12 to 2028-11)
- **Total Budget**: $22.5M USD ($468,750/month)
- **Contract Value**: $21M (MOD + cloud) + $1.5M (indirect)
- **Target Margin**: 14%
- **MOD Resources**:
  - 10 x Cloud Engineers (Premium tier)
  - 2 x Cloud Architects (Premium tier)
  - 1 x SDM (Premium tier)
- **Baseline ID**: BL-CLOUD-ECOPETROL-001
- **Baseline Items**: 14 line items (MOD, AWS/Azure spend, observability, compliance)
- **Margin Profile**: **Challenged** (cloud cost overruns in some months)

#### 5. P-SD-TIGO-CALI (Service Delivery Tigo Cali)

**Business Context**: Managed IT services for Tigo's Cali operations center.

- **Duration**: 36 months (2025-03 to 2028-02)
- **Total Budget**: $9.6M USD ($266,667/month)
- **Contract Value**: $9M (MOD) + $0.6M (indirect)
- **Target Margin**: 11%
- **MOD Resources**:
  - 5 x Service Engineers (Gold tier)
  - 1 x Service Lead (Gold tier)
  - 1 x SDM (Gold tier)
- **Baseline ID**: BL-SD-TIGO-001
- **Baseline Items**: 10 line items (MOD, ITSM tools, spare parts, training)
- **Margin Profile**: **Favorable** (well-controlled costs)

#### 6. P-CONNECT-AVIANCA (Connectivity Avianca)

**Business Context**: SD-WAN and MPLS connectivity for Avianca's nationwide network.

- **Duration**: 48 months (2024-11 to 2028-10)
- **Total Budget**: $15.3M USD ($318,750/month)
- **Contract Value**: $14.5M (MOD + circuits) + $0.8M (indirect)
- **Target Margin**: 13%
- **MOD Resources**:
  - 6 x Network Engineers (Gold tier)
  - 1 x Network Architect (Premium tier)
  - 1 x SDM (Gold tier)
- **Baseline ID**: BL-CONNECT-AVIANCA-001
- **Baseline Items**: 12 line items (MOD, circuits, SD-WAN licenses, NOC support)
- **Margin Profile**: **On-target** (meeting margin expectations)

#### 7. P-DATACENTER-ETB (Datacenter ETB)

**Business Context**: Co-location and managed datacenter services for ETB's enterprise clients.

- **Duration**: 60 months (2025-01 to 2029-12)
- **Total Budget**: $25.0M USD ($416,667/month)
- **Contract Value**: $23M (MOD + facilities) + $2M (indirect)
- **Target Margin**: 16%
- **MOD Resources**:
  - 12 x Datacenter Ops Engineers (Gold tier)
  - 2 x Datacenter Leads (Premium tier)
  - 1 x SDM (Premium tier)
- **Baseline ID**: BL-DATACENTER-ETB-001
- **Baseline Items**: 15 line items (MOD, power, cooling, monitoring, compliance)
- **Margin Profile**: **Favorable** (economies of scale on facilities)

### Role Scenario Coverage

The canonical projects support the following role-based test scenarios:

#### PM (Project Manager) Scenarios
1. **Project Creation + Baseline**: Create project, define baseline, handoff to SDM
2. **Baseline Revision**: Update baseline mid-project (change orders)
3. **Multi-Baseline Projects**: Handle projects with multiple baselines/amendments

**Test Projects**: All 7 projects

#### SDM (Service Delivery Manager) Scenarios
1. **Forecast Management**: Monthly forecast updates, variance analysis
2. **Allocation Management**: Manage resource allocations across rubros
3. **Reconciliation**: Monthly recon between allocations and actuals
4. **Adjustment Requests**: Request budget adjustments (excesos, reducciones)
5. **Over/Under Budget**: Handle both favorable and unfavorable variances

**Test Projects**: 
- Favorable variance: P-NOC-CLARO-BOG, P-SD-TIGO-CALI, P-DATACENTER-ETB
- On-target: P-SOC-BANCOL-MED, P-WIFI-ELDORADO, P-CONNECT-AVIANCA
- Challenged: P-CLOUD-ECOPETROL

#### FIN (Finance) Scenarios
1. **Portfolio Dashboard**: View all projects, total budget, margins
2. **Payroll Reconciliation**: Match payroll actuals to allocations
3. **Financial Reports**: Generate monthly/quarterly financial summaries
4. **Variance Analysis**: Identify projects over/under budget
5. **Audit Trail**: Review all financial transactions and approvals

**Test Projects**: All 7 projects (full portfolio view)

### Seed Data Requirements

For each canonical project, the seed script must provide:

1. **Project record** with metadata (client, name, dates, budget, status)
2. **Baseline record(s)** with acceptance data
3. **Catalog rubros** (from standard Ikusi catalog)
4. **Project-rubro attachments** (1:1 match with baseline items)
5. **Estimator items** (baseline breakdown by rubro)
6. **Allocations** (first 2-3 months, distributed per rubro)
7. **Payroll actuals** (first 2-3 months, with realistic variance)
8. **Adjustments** (1-2 samples for projects with variances)

**Total seed records per project**: ~50-100 records (depending on rubros count)

---

## Golden Project: P-GOLDEN-1 (DEPRECATED - Use Canonical Projects)

### Overview

**Project ID:** `P-GOLDEN-1`  
**Name:** IA plataforma  
**Baseline ID:** `BL-1763192300497`  
**Period:** 48 months  
**Start Month:** 2025-01  
**Currency:** USD  
**Status:** active

### Handoff Details

- **Total Budget (MOD):** $12,240,000
- **Engineers %:** 85%
- **SDM %:** 15%
- **Accepted By:** pm.lead@ikusi.com
- **Handoff Date:** 2024-12-15
- **Notes:** Proyecto de plataforma IA - Entregable incluye 3 ingenieros Gold tier por 48 meses

### Catalog Rubros (Attached)

| Rubro ID | Name | Tier | Category |
|----------|------|------|----------|
| RB0001 | Costo mensual de ingenieros asignados al servicio según % de asignación | Gold | Servicios de Ingeniería |
| RB0002 | Perfil senior técnico con responsabilidad de coordinación técnica | Premium | Servicios de Ingeniería |
| RB0003 | Gestión operativa, relación con cliente, reportes, SLAs | Gold | Servicios de Ingeniería |

### Estimator Items

| ID | Rubro | Name | Tier | Qty | Unit Cost | Total Cost | Period |
|----|-------|------|------|-----|-----------|------------|--------|
| est_gold001 | RB0001 | Ingenieros Gold - 48 meses | Gold | 3 | $85,000 | $12,240,000 | 48 months |
| est_prem002 | RB0002 | Tech Lead Premium - 48 meses | Premium | 1 | $120,000 | $5,760,000 | 48 months |
| est_gold003 | RB0003 | Service Manager Gold - 48 meses | Gold | 1 | $95,000 | $4,560,000 | 48 months |

**Total Estimated Value:** $22,560,000 over 48 months

### Allocations (First 2 Months)

#### January 2025

| Allocation ID | Rubro | Estimator Item | Amount | Resources | Source | Status |
|---------------|-------|----------------|--------|-----------|--------|--------|
| alloc_g1m1 | RB0001 | est_gold001 | $255,000 | 3 | estimator | committed |
| alloc_p2m1 | RB0002 | est_prem002 | $120,000 | 1 | estimator | committed |
| alloc_g3m1 | RB0003 | est_gold003 | $95,000 | 1 | estimator | committed |

**Total Allocated (Jan 2025):** $470,000

#### February 2025

| Allocation ID | Rubro | Estimator Item | Amount | Resources | Source | Status |
|---------------|-------|----------------|--------|-----------|--------|--------|
| alloc_g1m2 | RB0001 | est_gold001 | $255,000 | 3 | estimator | committed |
| alloc_p2m2 | RB0002 | est_prem002 | $120,000 | 1 | estimator | committed |
| alloc_g3m2 | RB0003 | est_gold003 | $95,000 | 1 | estimator | committed |

**Total Allocated (Feb 2025):** $470,000

### Payroll Actuals (First 2 Months)

#### January 2025 (Slightly Under Budget)

| Payroll ID | Rubro | Allocation | Amount | Resources | Variance | Source |
|------------|-------|------------|--------|-----------|----------|--------|
| payroll_g1m1 | RB0001 | alloc_g1m1 | $247,500 | 3 | -$7,500 | SAP_HR |
| payroll_p2m1 | RB0002 | alloc_p2m1 | $118,000 | 1 | -$2,000 | SAP_HR |
| payroll_g3m1 | RB0003 | alloc_g3m1 | $93,500 | 1 | -$1,500 | SAP_HR |

**Total Actual (Jan 2025):** $459,000  
**Variance:** -$11,000 (-2.34% favorable)

#### February 2025 (On Target)

| Payroll ID | Rubro | Allocation | Amount | Resources | Variance | Source |
|------------|-------|------------|--------|-----------|----------|--------|
| payroll_g1m2 | RB0001 | alloc_g1m2 | $255,000 | 3 | $0 | SAP_HR |
| payroll_p2m2 | RB0002 | alloc_p2m2 | $120,000 | 1 | $0 | SAP_HR |
| payroll_g3m2 | RB0003 | alloc_g3m2 | $95,000 | 1 | $0 | SAP_HR |

**Total Actual (Feb 2025):** $470,000  
**Variance:** $0 (0% on target)

### Adjustments

| Adjustment ID | Type | Amount | Month | Justification | Status | Approved By |
|---------------|------|--------|-------|---------------|--------|-------------|
| adj_pos001 | exceso (increase) | $15,000 | 2025-03 | Requerimiento adicional de infraestructura cloud no contemplado inicialmente | approved | director@ikusi.com |
| adj_neg002 | reduccion (decrease) | $8,000 | 2025-03 | Optimización de recursos - un ingeniero con mayor productividad de lo estimado | approved | director@ikusi.com |

**Net Adjustment for March 2025:** +$7,000

### Reconciliation Summary

#### January 2025

| Metric | Value |
|--------|-------|
| Total Allocated | $470,000 |
| Total Actual | $459,000 |
| Variance | -$11,000 |
| Variance % | -2.34% |
| Matched | $440,000 |
| Matched Count | 3 records |
| Pending | $11,000 |
| Pending Count | 1 record |
| Disputed | $0 |
| Disputed Count | 0 records |
| Adjustments | $0 |
| Adjustments Count | 0 records |
| Status | ✅ Under budget (favorable) |

#### February 2025

| Metric | Value |
|--------|-------|
| Total Allocated | $470,000 |
| Total Actual | $470,000 |
| Variance | $0 |
| Variance % | 0.00% |
| Matched | $470,000 |
| Matched Count | 3 records |
| Pending | $0 |
| Pending Count | 0 records |
| Disputed | $0 |
| Disputed Count | 0 records |
| Adjustments | $0 |
| Adjustments Count | 0 records |
| Status | ✅ On target |

---

## Seed Script Usage

### Running the Seed Script

```bash
cd services/finanzas-api
npm run seed:finanzas:golden
```

### Environment Variables

The script uses the following environment variables (with defaults):

- `AWS_REGION` (default: `us-east-2`)
- `TABLE_PROJECTS` (default: `finz_projects`)
- `TABLE_RUBROS` (default: `finz_rubros`)
- `TABLE_ALLOC` (default: `finz_allocations`)
- `TABLE_PAYROLL` (default: `finz_payroll_actuals`)
- `TABLE_ADJ` (default: `finz_adjustments`)

### Idempotency

The seed script is **idempotent**. Running it multiple times:
- Updates existing records if they already exist
- Creates new records if they don't exist
- Does not create duplicates

### What Gets Seeded

1. **Project record** (P-GOLDEN-1)
2. **Handoff data** for the project
3. **3 catalog rubros** (RB0001, RB0002, RB0003)
4. **3 project rubro attachments**
5. **3 estimator items** (totaling $22.56M over 48 months)
6. **6 allocations** (2 months × 3 rubros)
7. **6 payroll actuals** (2 months × 3 rubros)
8. **2 adjustments** (1 positive, 1 negative for month 3)

---

## Verification Queries

### Check Project

```typescript
// DynamoDB query
pk: "PROJECT#P-GOLDEN-1"
sk: "META"
```

### Check Handoff

```typescript
// DynamoDB query
pk: "PROJECT#P-GOLDEN-1"
sk: "HANDOFF"
```

### Check Allocations for January 2025

```typescript
// DynamoDB query
pk: "PROJECT#P-GOLDEN-1#MONTH#2025-01"
sk: begins_with("ALLOC#")
```

### Check Payroll Actuals for January 2025

```typescript
// DynamoDB query
pk: "PROJECT#P-GOLDEN-1#MONTH#2025-01"
sk: begins_with("PAYROLL#")
```

### API Endpoints for Verification

```bash
# Health check
GET /finanzas/health

# Get project handoff
GET /finanzas/projects/P-GOLDEN-1/handoff

# List project rubros
GET /finanzas/projects/P-GOLDEN-1/rubros

# Get reconciliation summary (when implemented)
GET /finanzas/recon?projectId=P-GOLDEN-1&month=2025-01
```

---

## Notes for QA and Development

1. **No DEFAULT Values**: The golden dataset contains realistic data based on Ikusi context. No fallback or sentinel values like "DEFAULT" are used.

2. **Project-Scoped Design**: All entities (rubros, allocations, actuals, adjustments) are scoped to the project via `projectId`.

3. **Consistent IDs**: 
   - Project: `P-GOLDEN-1`
   - Baseline: `BL-1763192300497`
   - Estimator items: `est_*`
   - Allocations: `alloc_*`
   - Payroll actuals: `payroll_*`
   - Adjustments: `adj_*`

4. **Validation**: All seeded data conforms to the zod schemas in `services/finanzas-api/src/validation/`.

5. **Timeline**: The golden project starts in January 2025 and runs for 48 months. The seed includes data for the first 2 months plus adjustments planned for month 3.

6. **Recon Testing**: The data is structured to support reconciliation testing:
   - January shows a favorable variance (under budget)
   - February shows perfect alignment (on target)
   - March will include adjustments

---

## Related Files

- **OpenAPI Spec:** `openapi/finanzas.yaml`
- **Zod Validators:** `services/finanzas-api/src/validation/`
- **Seed Script:** `services/finanzas-api/src/seed/seed_finanzas_golden_project.ts`
- **Health Handler:** `services/finanzas-api/src/handlers/health.ts`

---

## Reset Script for Dev/Test Environments

### Purpose

The reset script (`services/finanzas-api/scripts/reset-dev-projects.ts`) provides a **safe mechanism** to clean up test/dev environments by deleting non-canonical projects and their related data.

**Use Cases**:
- Reset dev environment to a clean slate
- Remove noisy test data accumulated during development
- Prepare environment for demos or QA testing
- Start fresh after failed test runs

### Safety Features

1. **Environment Guard**: Aborts if `STAGE` or `ENV` environment variables indicate production (`prod`, `stg`, `production`, `staging`)
2. **Dry Run Mode**: Preview what will be deleted without making changes (`--dry-run` flag)
3. **Canonical Project Protection**: Never deletes the 7 canonical demo projects
4. **Confirmation Prompt**: Requires explicit confirmation before deletion (unless `--force` flag is used)
5. **Audit Log**: Records all deletion operations with timestamps

### Usage

#### Dry Run (Safe Preview)

```bash
cd services/finanzas-api
npm run reset:dev-projects -- --dry-run
```

**Output Example**:
```
🔍 Scanning for non-canonical projects...
   Found 23 projects in database
   - 7 are canonical (protected)
   - 16 are non-canonical (candidates for deletion)

📋 Projects to be deleted:
   - PROJ-1 (test project from unit tests)
   - P-TEST-123 (temporary test project)
   - P-OLD-DEMO-001 (old demo data)
   ... (13 more)

📊 Related records to be deleted:
   - Rubros: 48 attachments
   - Allocations: 192 records
   - Payroll: 192 records
   - Adjustments: 12 records
   - Total: 444 records

⚠️  DRY RUN MODE - No changes made
```

#### Actual Deletion

```bash
cd services/finanzas-api
npm run reset:dev-projects
```

**Confirmation Prompt**:
```
⚠️  WARNING: This will delete 16 projects and 444 related records
   Environment: dev
   Protected: 7 canonical projects will NOT be deleted
   
   Type 'CONFIRM' to proceed: _
```

#### Force Mode (No Confirmation)

```bash
cd services/finanzas-api
npm run reset:dev-projects -- --force
```

**Use with caution!** Recommended only in CI/CD pipelines.

### Environment Variables

- `AWS_REGION` (default: `us-east-2`)
- `STAGE` or `ENV` - If set to `prod`, `stg`, `production`, or `staging`, script will abort
- `TABLE_PROJECTS` (default: `finz_projects`)
- `TABLE_RUBROS` (default: `finz_rubros`)
- `TABLE_ALLOC` (default: `finz_allocations`)
- `TABLE_PAYROLL` (default: `finz_payroll_actuals`)
- `TABLE_ADJ` (default: `finz_adjustments`)

### Canonical Projects (Protected)

The following project IDs are **never deleted**:

1. `P-NOC-CLARO-BOG`
2. `P-SOC-BANCOL-MED`
3. `P-WIFI-ELDORADO`
4. `P-CLOUD-ECOPETROL`
5. `P-SD-TIGO-CALI`
6. `P-CONNECT-AVIANCA`
7. `P-DATACENTER-ETB`

### What Gets Deleted

For each non-canonical project:

1. **Project record** (pk: `PROJECT#{projectId}`, sk: `META`)
2. **Handoff record** (pk: `PROJECT#{projectId}`, sk: `HANDOFF`)
3. **Rubro attachments** (pk: `PROJECT#{projectId}`, sk: `RUBRO#*`)
4. **Estimator items** (pk: `PROJECT#{projectId}`, sk: `ESTIMATOR#*`)
5. **Allocations** (pk: `PROJECT#{projectId}#MONTH#*`, sk: `ALLOC#*`)
6. **Payroll actuals** (pk: `PROJECT#{projectId}#MONTH#*`, sk: `PAYROLL#*`)
7. **Adjustments** (pk: `PROJECT#{projectId}`, sk: `ADJ#*`)
8. **Audit logs** (pk: `PROJECT#{projectId}`, sk: `AUDIT#*`)

### After Reset: Re-seed Canonical Projects

After running the reset script, re-seed the canonical projects:

```bash
cd services/finanzas-api
npm run seed:canonical-projects
```

This ensures the dev environment has the full set of 7 demo projects with consistent data.

### Integration with CI/CD

Example workflow step:

```yaml
- name: Reset and seed dev environment
  run: |
    cd services/finanzas-api
    npm run reset:dev-projects -- --force
    npm run seed:canonical-projects
  env:
    AWS_REGION: us-east-2
    STAGE: dev
```

---

## Related Files

- **OpenAPI Spec:** `openapi/finanzas.yaml`
- **Zod Validators:** `services/finanzas-api/src/validation/`
- **Seed Scripts:**
  - Canonical Projects: `services/finanzas-api/src/seed/seed_canonical_projects.ts`
  - Legacy Golden Project: `services/finanzas-api/src/seed/seed_finanzas_golden_project.ts` (deprecated)
- **Reset Script:** `services/finanzas-api/scripts/reset-dev-projects.ts`
- **Health Handler:** `services/finanzas-api/src/handlers/health.ts`

---

*Last Updated: 2025-12-10*
