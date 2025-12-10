# Finanzas SD Seed Scripts

This directory contains seed scripts for populating DynamoDB tables with test and development data.

## 🌟 Canonical Projects Seed (RECOMMENDED)

### Overview

The **canonical projects seed** (`seed_canonical_projects.ts`) creates a complete portfolio of **7 realistic demo projects** based on actual Ikusi service delivery scenarios. This is the **recommended seed script** for dev/test environments.

**Why use this instead of the golden project?**
- ✅ Portfolio of 7 projects vs 1 single project
- ✅ Covers different scenarios (favorable, on-target, challenged margins)
- ✅ Realistic client names (Claro, Bancolombia, Avianca, etc.)
- ✅ Diverse service types (NOC, SOC, WiFi, Cloud, SD-WAN, Datacenter)
- ✅ Role-based test scenarios (PM, SDM, FIN)
- ✅ Total portfolio value: ~$108M USD

### What Gets Seeded

For **each of the 7 projects**:
- **Project Record**: Metadata (client, name, dates, budget)
- **Baseline/Handoff**: Budget handoff with acceptance
- **Catalog Rubros**: Standard Ikusi rubros (MOD, TEC, INF, etc.)
- **Project Rubro Attachments**: Links rubros to the project (matches baseline)
- **Estimator Items**: Resource breakdown by role (engineers, leads, SDM)
- **Allocations**: First 3 months of monthly budget distribution
- **Payroll Actuals**: First 3 months with realistic variance
- **Adjustments**: For challenged projects (budget overruns)

**Total Records**: ~350-500 records across all tables

### Running the Seed

```bash
cd services/finanzas-api
npm run seed:canonical-projects
```

### The 7 Canonical Projects

| Project ID | Name | Client | Duration | Budget | Margin Profile |
|------------|------|--------|----------|--------|----------------|
| P-NOC-CLARO-BOG | NOC Claro Bogotá | Claro Colombia | 60 months | $18.5M | ✅ Favorable |
| P-SOC-BANCOL-MED | SOC Bancolombia Medellín | Bancolombia | 36 months | $12.8M | ⚖️ On-target |
| P-WIFI-ELDORADO | WiFi Aeropuerto El Dorado | Avianca | 24 months | $4.2M | ⚖️ On-target |
| P-CLOUD-ECOPETROL | Cloud Ops Ecopetrol | Ecopetrol | 48 months | $22.5M | ⚠️ Challenged |
| P-SD-TIGO-CALI | Service Delivery Tigo Cali | Tigo Colombia | 36 months | $9.6M | ✅ Favorable |
| P-CONNECT-AVIANCA | Connectivity Avianca | Avianca | 48 months | $15.3M | ⚖️ On-target |
| P-DATACENTER-ETB | Datacenter ETB | ETB | 60 months | $25.0M | ✅ Favorable |

### Environment Variables

```bash
AWS_REGION=us-east-2              # AWS region
STAGE=dev                         # Environment (dev/test only, aborts on prod/stg)
TABLE_PROJECTS=finz_projects      # Projects table name
TABLE_RUBROS=finz_rubros         # Rubros catalog table
TABLE_ALLOC=finz_allocations     # Allocations table
TABLE_PAYROLL=finz_payroll_actuals # Payroll actuals table
TABLE_ADJ=finz_adjustments       # Adjustments table
```

### Safety Features

- ✅ **Environment guard**: Aborts if `STAGE` or `ENV` is `prod`, `stg`, `production`, or `staging`
- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Clear output**: Shows progress for each project and entity type

### Use Cases

**For PM (Project Manager) Testing**:
- Use `P-NOC-CLARO-BOG` for baseline creation and handoff
- Use `P-WIFI-ELDORADO` for shorter-term projects

**For SDM (Service Delivery Manager) Testing**:
- Use `P-CLOUD-ECOPETROL` for challenged margin scenarios (budget overruns)
- Use `P-NOC-CLARO-BOG` for favorable variance scenarios

**For FIN (Finance) Testing**:
- View full portfolio dashboard with all 7 projects
- Test variance reporting across different margin profiles

### Verification

After seeding, verify the projects:

```bash
# List all canonical projects
aws dynamodb scan \
  --table-name finz_projects \
  --filter-expression "begins_with(pk, :pk) AND sk = :sk" \
  --expression-attribute-values '{":pk":{"S":"PROJECT#P-"}":sk":{"S":"META"}}'

# Or use the API
GET /finanzas/projects
```

### Resetting the Environment

Before re-seeding, use the reset script to clean up non-canonical projects:

```bash
# Preview what will be deleted
npm run reset:dev-projects -- --dry-run

# Actually delete (with confirmation)
npm run reset:dev-projects

# Re-seed canonical projects
npm run seed:canonical-projects
```

---

## 📦 Golden Project Seed (LEGACY)

### Overview

The `seed_finanzas_golden_project.ts` script creates a complete project (`P-GOLDEN-1`) with all related entities for testing, QA, and development purposes.

### What Gets Seeded

- **Project Record**: P-GOLDEN-1 ("IA plataforma")
- **Handoff Data**: Budget handoff details ($12.24M, 48 months)
- **Catalog Rubros**: 3 curated budget line items (RB0001, RB0002, RB0003)
- **Project Rubro Attachments**: Links rubros to the project
- **Estimator Items**: 3 baseline items (Gold/Premium tiers)
- **Allocations**: 6 records (2 months × 3 rubros)
- **Payroll Actuals**: 6 records (2 months × 3 rubros)
- **Adjustments**: 2 records (1 positive, 1 negative)

### Running the Seed

```bash
cd services/finanzas-api
npm run seed:finanzas:golden
```

### Environment Variables

The script uses the following environment variables (with defaults):

```bash
AWS_REGION=us-east-2              # AWS region
TABLE_PROJECTS=finz_projects       # Projects table name
TABLE_RUBROS=finz_rubros          # Rubros catalog table
TABLE_ALLOC=finz_allocations      # Allocations table
TABLE_PAYROLL=finz_payroll_actuals # Payroll actuals table
TABLE_ADJ=finz_adjustments        # Adjustments table
```

### Idempotency

The seed script is **idempotent**:
- Running it multiple times is safe
- Existing records are updated (not duplicated)
- Uses DynamoDB primary keys (pk, sk) to check for existing records

### Golden Project Details

**Project ID**: P-GOLDEN-1  
**Baseline ID**: BL-1763192300497  
**Period**: 48 months starting 2025-01  
**Total Estimated Value**: $22.56M

#### Seeded Data Summary

| Entity | Count | Details |
|--------|-------|---------|
| Project | 1 | IA plataforma, 48 months |
| Handoff | 1 | $12.24M budget, 85% eng / 15% SDM |
| Catalog Rubros | 3 | RB0001, RB0002, RB0003 |
| Project Rubros | 3 | Attached to P-GOLDEN-1 |
| Estimator Items | 3 | 3 Gold engineers + 1 Premium lead + 1 Gold manager |
| Allocations | 6 | Jan & Feb 2025, total $940K |
| Payroll Actuals | 6 | Jan: $459K (under), Feb: $470K (on target) |
| Adjustments | 2 | Mar 2025: +$15K, -$8K |

#### Monthly Financial Summary

**January 2025**
- Allocated: $470,000
- Actual: $459,000
- Variance: -$11,000 (-2.34% favorable)

**February 2025**
- Allocated: $470,000
- Actual: $470,000
- Variance: $0 (0% on target)

### Verification

After seeding, verify the data:

```bash
# Check project
aws dynamodb get-item \
  --table-name finz_projects \
  --key '{"pk":{"S":"PROJECT#P-GOLDEN-1"},"sk":{"S":"META"}}'

# Check handoff
aws dynamodb get-item \
  --table-name finz_projects \
  --key '{"pk":{"S":"PROJECT#P-GOLDEN-1"},"sk":{"S":"HANDOFF"}}'

# Check allocations for Jan 2025
aws dynamodb query \
  --table-name finz_allocations \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values '{":pk":{"S":"PROJECT#P-GOLDEN-1#MONTH#2025-01"}}'
```

Or use the API endpoints (once deployed):

```bash
GET /finanzas/health
GET /finanzas/projects/P-GOLDEN-1/handoff
GET /finanzas/projects/P-GOLDEN-1/rubros
```

## Development

### Adding New Seeds

1. Create a new TypeScript file in this directory
2. Use the golden project seed as a template
3. Make it idempotent (check for existing records)
4. Add an npm script in `package.json`
5. Document in this README

### Best Practices

- ✅ Use environment variables for table names
- ✅ Make scripts idempotent
- ✅ Provide clear console output
- ✅ Use realistic data (no "test" or "sample" values)
- ✅ Include error handling
- ✅ Document what gets seeded

## Related Scripts

### Reset Dev Projects

The reset script (`../scripts/reset-dev-projects.ts`) provides safe cleanup of dev/test environments:

```bash
# Preview deletions
npm run reset:dev-projects -- --dry-run

# Delete non-canonical projects (with confirmation)
npm run reset:dev-projects

# Delete without confirmation (CI/CD use)
npm run reset:dev-projects -- --force
```

**Features**:
- ✅ Never deletes canonical projects (protected)
- ✅ Environment guard (aborts on prod/stg)
- ✅ Dry-run mode for safety
- ✅ Confirmation prompt
- ✅ Deletes all related records (rubros, allocations, payroll, adjustments)

## References

- **Documentation**: `docs/data/finanzas-schemas-and-seeds.md`
- **Test Fixtures**: `tests/fixtures/canonical-projects.ts`
- **Validation Schemas**: `src/validation/`
- **OpenAPI Spec**: `openapi/finanzas.yaml`

## Quick Start

### First Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
export AWS_REGION=us-east-2
export STAGE=dev

# 3. Seed canonical projects
npm run seed:canonical-projects
```

### Regular Development Workflow

```bash
# Reset environment (removes test noise)
npm run reset:dev-projects

# Re-seed canonical projects
npm run seed:canonical-projects

# Run tests with consistent data
npm test
```

### CI/CD Pipeline

```yaml
- name: Setup test data
  run: |
    cd services/finanzas-api
    npm run reset:dev-projects -- --force
    npm run seed:canonical-projects
  env:
    AWS_REGION: us-east-2
    STAGE: dev
```
