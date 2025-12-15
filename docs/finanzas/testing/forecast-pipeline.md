# Forecast Pipeline Testing & Validation

**Date**: December 11, 2025  
**Status**: Fixed - Ready for Testing  

## Executive Summary

Fixed critical data structure mismatch causing forecast, portfolio, and cost catalog screens to show "all zeros". The issue was seed scripts creating DynamoDB records with pk `PROJECT#{id}#MONTH#{month}` while handlers queried with `PROJECT#{id}`.

## Root Cause

**Problem**: Partition key mismatch
- Seed: `pk = PROJECT#P-CLOUD-ECOPETROL#MONTH#2025-01`
- Query: `pk = PROJECT#P-CLOUD-ECOPETROL`
- Result: Query returns 0 items

**Fix**: Changed seed scripts to use `pk = PROJECT#{id}`, `sk = ALLOC#{month}#{id}`

## Testing Instructions

```bash
cd services/finanzas-api

# Reset and reseed
npm run reset:dev-projects -- --force
# TODO: seed:canonical-projects script has been removed.
# Create test projects through the application UI before validation.

# Validate
npm run verify:allocations
npm run verify:payroll
npm run verify:forecast-pipeline P-CLOUD-ECOPETROL
```

## Expected Outcomes

All 5 critical screens should show non-zero data:
1. Forecast: 12-month grid with data
2. Cost Catalog: Rubros with costs
3. Portfolio: MOD charts
4. Reconciliation: Invoices load
5. Changes: Line items work

## Test Projects

- P-CLOUD-ECOPETROL ($22.5M, 48mo)
- P-DATACENTER-ETB ($25M, 60mo)
- P-NOC-CLARO-BOG ($18.5M, 60mo)
- P-WIFI-ELDORADO ($4.2M, 24mo)
