# Finanzas SD Seed Scripts

This directory contains seed scripts for populating DynamoDB tables with test and development data.

## Golden Project Seed

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

## References

- **Documentation**: `docs/data/finanzas-schemas-and-seeds.md`
- **Validation Schemas**: `src/validation/`
- **OpenAPI Spec**: `openapi/finanzas.yaml`
