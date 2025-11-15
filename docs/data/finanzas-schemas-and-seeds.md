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

## Golden Project: P-GOLDEN-1

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

*Last Updated: 2025-11-15*
