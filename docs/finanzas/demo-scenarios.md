# Finanzas SD – Demo Scenarios

**Last updated:** 2025-12-11  
**Audience:** Engineers, SDM, Finance, QA  
**Purpose:** Canonical demo data scenarios for testing, development, and demonstrations

---

## Overview

This document defines **5 canonical baseline projects** that serve as realistic, end-to-end demo data for the Finanzas SD platform. These scenarios are designed to light up all major UI screens with meaningful data, including:

- **Projects & Portfolio**: Donut charts and bar charts showing MOD distribution
- **Cost Structure** (Estructura de Costos): Rubro-level breakdowns
- **Forecast** (Gestión de Pronóstico): Plan vs. Forecast vs. Actual comparisons
- **Cashflow**: Monthly spend trends across projects

### Why These Scenarios?

These 5 projects cover the typical range of Ikusi service delivery contracts:
- Different durations (24–60 months)
- Different budget scales ($4M–$25M)
- Different variance patterns (front-loaded, ramp-up, seasonal, stable)
- Different client types (telecom, banking, aviation, oil & gas, multi-client)

---

## The 5 Canonical Demo Projects

### 1. Cloud Ops Ecopetrol 🛢️

**Profile**: Flagship project, stable operations, high MOD base

- **Project ID**: `P-CLOUD-ECOPETROL`
- **Baseline ID**: `BL-CLOUD-ECOPETROL-001`
- **Client**: Ecopetrol
- **Service Type**: Cloud Infrastructure Operations
- **Status**: Active
- **Duration**: 60 months (5 years)
- **Start Date**: 2025-01-01
- **Currency**: USD
- **Planned Monthly MOD**: ~$375,000 (nearly flat)
- **Total MOD**: ~$22,500,000
- **SDM Manager**: `sdm.cloud@ikusi.com`

**MOD Pattern**: Stable baseline with minor fluctuations
```
Monthly: $375K (±2%)
Year 1–5: Consistent flat spend
```

**Rubros Distribution**:
- RB-ENG (Ingeniería): 60% → $225K/month
- RB-NOC (Operación NOC 24x7): 25% → $93.75K/month
- RB-MGMT (Gestión SDM): 10% → $37.5K/month
- RB-TOOLS (Herramientas & SaaS): 5% → $18.75K/month

**Actuals Variance Pattern**: Cycles `[0.97, 1.02, 1.04, 1.00, 0.99, 1.03]` → repeating pattern

**Use Case**: Test long-term stable operations, low variance scenarios

---

### 2. Datacenter ETB 🏢

**Profile**: Front-loaded spend for infrastructure setup, then stabilizes

- **Project ID**: `P-DATACENTER-ETB`
- **Baseline ID**: `BL-DATACENTER-ETB-001`
- **Client**: ETB (Empresa de Telecomunicaciones de Bogotá)
- **Service Type**: Datacenter Operations & Maintenance
- **Status**: Active
- **Duration**: 48 months (4 years)
- **Start Date**: 2025-01-01
- **Currency**: USD
- **Planned Monthly MOD**: 
  - Year 1: $550K–$600K (front-loaded for setup)
  - Years 2–4: $480K–$520K (steady-state)
- **Total MOD**: ~$25,000,000
- **SDM Manager**: `sdm.datacenter@ikusi.com`

**MOD Pattern**: Front-loaded ramp-down
```
Months 1–12: $575K avg (high initial setup)
Months 13–48: $500K avg (steady-state ops)
```

**Rubros Distribution**:
- RB-ENG (Ingeniería): 55% → $302.5K/month avg
- RB-NOC (Operación NOC): 20% → $110K/month
- RB-MGMT (Gestión SDM): 10% → $55K/month
- RB-TOOLS (Herramientas): 10% → $55K/month
- RB-TRAVEL (Viajes): 5% → $27.5K/month (onsite work)

**Actuals Variance Pattern**: Cycles `[1.05, 1.02, 0.98, 0.97, 1.01, 0.99]` → repeating

**Use Case**: Test front-loaded budgets, travel costs, multi-rubro allocation

---

### 3. SD-WAN Bancolombia 🏦

**Profile**: Ramp-up scenario (gradual increase in Year 1, then stabilizes)

- **Project ID**: `P-SDWAN-BANCOLOMBIA`
- **Baseline ID**: `BL-SDWAN-BANCO-001`
- **Client**: Bancolombia
- **Service Type**: SD-WAN Network Operations
- **Status**: Active
- **Duration**: 36 months (3 years)
- **Start Date**: 2025-01-01
- **Currency**: USD
- **Planned Monthly MOD**:
  - Year 1: Ramps from $260K → $320K (gradual growth)
  - Years 2–3: ~$310K (stable)
- **Total MOD**: ~$10,800,000
- **SDM Manager**: `sdm.sdwan@ikusi.com`

**MOD Pattern**: Linear ramp-up in Year 1
```
Month 1: $260K
Month 6: $290K
Month 12: $320K
Months 13–36: $310K avg
```

**Rubros Distribution**:
- RB-ENG (Ingeniería): 65% → $201.5K/month avg
- RB-NOC (Operación NOC): 15% → $46.5K/month
- RB-MGMT (Gestión SDM): 15% → $46.5K/month
- RB-TOOLS (Herramientas): 5% → $15.5K/month

**Actuals Variance Pattern**: Cycles `[0.96, 1.00, 1.03, 1.02, 1.01, 0.99]` → repeating

**Use Case**: Test ramp-up scenarios, growth projections, forecasting adjustments

---

### 4. WiFi Aeropuerto El Dorado ✈️

**Profile**: Seasonal peaks during holiday travel periods

- **Project ID**: `P-WIFI-ELDORADO`
- **Baseline ID**: `BL-WIFI-ELDORADO-001`
- **Client**: OPAIN / Aeropuerto El Dorado
- **Service Type**: WiFi Infrastructure & Operations
- **Status**: Active
- **Duration**: 24 months (2 years)
- **Start Date**: 2025-01-01
- **Currency**: USD
- **Planned Monthly MOD**:
  - Base: $180K
  - Holiday peaks (Jun–Jul, Nov–Dec): +25% → $225K
- **Total MOD**: ~$4,320,000
- **SDM Manager**: `sdm.wifi@ikusi.com`

**MOD Pattern**: Seasonal spikes
```
Jan–May: $180K (base)
Jun–Jul: $225K (summer travel peak)
Aug–Oct: $180K (base)
Nov–Dec: $225K (holiday peak)
```

**Rubros Distribution**:
- RB-ENG (Ingeniería): 50% → $90K/month base
- RB-NOC (Operación NOC): 20% → $36K/month
- RB-MGMT (Gestión SDM): 10% → $18K/month
- RB-TOOLS (Herramientas): 10% → $18K/month
- RB-TRAVEL (Viajes): 10% → $18K/month (airport support)

**Actuals Variance Pattern**: Cycles `[1.00, 0.99, 0.97, 1.10, 1.12, 0.95]` → repeating (bigger spikes in Jun, Jul, Nov, Dec)

**Use Case**: Test seasonal variance, peak budget handling, travel cost tracking

---

### 5. SOC Multicliente 🔒

**Profile**: Very stable, predictable, multi-client SOC service

- **Project ID**: `P-SOC-MULTICLIENT`
- **Baseline ID**: `BL-SOC-MULTI-001`
- **Client**: Multi-Client (shared SOC service)
- **Service Type**: Security Operations Center 24x7
- **Status**: Active
- **Duration**: 36 months (3 years)
- **Start Date**: 2025-01-01
- **Currency**: USD
- **Planned Monthly MOD**: $220,000 (almost flat)
- **Total MOD**: ~$7,920,000
- **SDM Manager**: `sdm.soc@ikusi.com`

**MOD Pattern**: Extremely stable
```
Monthly: $220K (±1%)
Year 1–3: Minimal variance
```

**Rubros Distribution**:
- RB-ENG (Ingeniería): 40% → $88K/month
- RB-NOC (Operación NOC): 40% → $88K/month
- RB-MGMT (Gestión SDM): 15% → $33K/month
- RB-TOOLS (Herramientas): 5% → $11K/month

**Actuals Variance Pattern**: Cycles `[0.99, 1.01, 0.99, 1.00, 1.00, 1.01]` → repeating (minimal variance)

**Use Case**: Test stable operations, minimal variance, multi-tenant SOC scenarios

---

## Rubros Taxonomy Alignment

All demo scenarios use the canonical rubros from `src/modules/finanzas/data/rubros.taxonomia.ts`:

| Rubro ID | Category | Description |
|----------|----------|-------------|
| RB-ENG | Ingeniería | Service Engineers & Technical Resources |
| RB-NOC | Operación NOC 24x7 | Network Operations Center 24x7 |
| RB-MGMT | Gestión de Servicio | Service Delivery Manager & Operations Management |
| RB-TOOLS | Herramientas & SaaS | Tools, SaaS platforms, monitoring systems |
| RB-TRAVEL | Viajes | Travel costs for onsite support |

**Note**: If actual rubro IDs differ in the system (e.g., `RB0001` instead of `RB-ENG`), the seed script will map to the correct IDs from the catalog.

---

## Data Model Mapping

Demo scenarios populate the following DynamoDB tables:

### `finz_projects`
- **PROJECT#{projectId} / METADATA**: Project core record
- **PROJECT#{projectId} / HANDOFF**: Budget handoff from PMO to SDM
- **BASELINE#{baselineId} / METADATA**: Baseline approval record

### `finz_allocations`
- **PROJECT#{projectId} / ALLOC#{YYYY-MM}#{allocId}**: Monthly budget allocations per rubro

### `finz_payroll_actuals`
- **PROJECT#{projectId} / PAYROLL#{YYYY-MM}#{payrollId}**: Monthly actual spend per rubro

### `finz_rubros`
- **RUBRO#{rubroId} / DEF**: Catalog rubro definitions (already seeded separately)

See [docs/finanzas/data-models.md](./data-models.md) for detailed schema definitions.

---

## Implementation Details

### Month Series Generation

Each project generates a month series based on its duration:
```typescript
generateMonthSeries("2025-01", 60) 
// → ["2025-01", "2025-02", ..., "2029-12"]
```

### Variance Application

Actuals use a repeating variance pattern:
```typescript
applyVariance(planned: 375000, monthIndex: 3, pattern: [0.97, 1.02, 1.04, 1.00, 0.99, 1.03])
// → 375000 * pattern[3 % 6] = 375000 * 1.00 = 375000
```

### Rubro Allocation

Each month's planned MOD is split by rubro percentages:
```typescript
// For P-CLOUD-ECOPETROL (planned $375K/month):
RB-ENG:   $375K × 60% = $225K
RB-NOC:   $375K × 25% = $93.75K
RB-MGMT:  $375K × 10% = $37.5K
RB-TOOLS: $375K × 5%  = $18.75K
```

---

## Seeding Instructions

### Environment Setup

```bash
export AWS_REGION=us-east-2
export STAGE=dev
export FINZ_SEED_DEMO=true
```

### Run the Seed Script

```bash
cd services/finanzas-api
npm run finz:seed-demo
```

**Safety**: Script aborts if `STAGE` is `prod`, `stg`, `production`, or `staging`.

**Idempotency**: Safe to run multiple times. Existing records with the same pk/sk are updated, not duplicated.

---

## Testing & Validation Status

### Unit Tests ✅
- **37 comprehensive tests** covering all demo scenario components
- All tests passing in CI/CD pipeline
- Test coverage includes:
  - Month series generation (6 tests)
  - Variance application (4 tests)
  - Scenario definitions (8 tests)
  - Project/baseline builders (6 tests)
  - Allocation builders (5 tests)
  - Payroll builders (5 tests)
  - Integration tests (3 tests)

### Safety Checks ✅
- **Environment protection**: Script aborts if `STAGE` is prod/stg/production/staging
- **Explicit enablement**: Requires `FINZ_SEED_DEMO=true` environment variable
- **Idempotency**: Safe to run multiple times without data corruption

### Code Quality ✅
- TypeScript compilation: No errors
- ESLint: No linting errors
- All existing tests (312 total) continue to pass

## Validation Checklist

After seeding, verify the following UI screens show non-zero data:

### 1. Projects & Portfolio (`/finanzas/projects`)
- [ ] Portfolio donut chart shows 5 projects with different sizes
- [ ] Bar chart shows MOD breakdown for each project
- [ ] P-CLOUD-ECOPETROL and P-DATACENTER-ETB appear as largest projects

### 2. Cost Structure (`/finanzas/sdmt/cost/catalog`)
Select **P-CLOUD-ECOPETROL**:
- [ ] "Total de Rubros" > 0
- [ ] Table lists RB-ENG, RB-NOC, RB-MGMT, RB-TOOLS
- [ ] Total MOD card shows ~$22.5M

Select **P-DATACENTER-ETB**:
- [ ] All 5 rubros appear (including RB-TRAVEL)
- [ ] Total MOD card shows ~$25M

### 3. Forecast (`/finanzas/sdmt/cost/forecast`)
Select any demo project:
- [ ] Top tiles: Total Plan > 0, Total Forecast > 0, Total Real > 0
- [ ] 12-month forecast grid is populated
- [ ] Line chart shows plan vs. forecast vs. actual over time

### 4. Portfolio / Cashflow
- [ ] Aggregated monthly MOD graph shows non-zero values
- [ ] Multiple projects contribute to total spend
- [ ] Seasonal spikes visible for P-WIFI-ELDORADO (Jun–Jul, Nov–Dec)

---

## Portfolio Summary

| Project | Duration | Total MOD | Monthly Avg | Profile |
|---------|----------|-----------|-------------|---------|
| P-CLOUD-ECOPETROL | 60 mo | $22.5M | $375K | Stable |
| P-DATACENTER-ETB | 48 mo | $25.0M | $521K | Front-loaded |
| P-SDWAN-BANCOLOMBIA | 36 mo | $10.8M | $300K | Ramp-up |
| P-WIFI-ELDORADO | 24 mo | $4.32M | $180K | Seasonal |
| P-SOC-MULTICLIENT | 36 mo | $7.92M | $220K | Very stable |
| **TOTAL** | — | **$70.54M** | — | — |

---

## Related Documentation

- [Data Models](./data-models.md) – DynamoDB table schemas
- [Seed README](../../services/finanzas-api/src/seed/README.md) – Seed script usage
- [API Contracts](./api-contracts.md) – API endpoint specifications

---

## Maintenance Notes

**When to Update**:
- Rubros taxonomy changes → Update rubro IDs in scenario definitions
- New UI screens added → Add validation steps
- Data model changes → Update allocation/payroll record structures

**Safety Reminders**:
- Never run demo seeds in prod/staging
- Always use `FINZ_SEED_DEMO=true` to explicitly enable demo seeding
- Demo project IDs are prefixed with `P-` (not `proj_`) for easy identification
