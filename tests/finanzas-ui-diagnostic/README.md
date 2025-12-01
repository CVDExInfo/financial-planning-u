# Finanzas UI Component Diagnostics

This directory contains the UI component smoke tests for the Finanzas AWS Diagnostic workflow.

## Purpose

These tests validate that every major Finanzas UI component and route is:
- ✅ Deployed correctly to CloudFront
- ✅ Returning HTTP 200 responses
- ✅ Serving valid HTML documents
- ✅ Containing expected UI fingerprints (root div, bundle references)

**This is NOT a full E2E test suite.** It's a lightweight diagnostic to detect deployment issues and broken routes.

## Files

- **`components.json`** - Configuration file listing all Finanzas UI components and routes to test
- **`smoke-test.mjs`** - Node.js script that performs HTTP-based validation of each component

## Usage

### Run locally:

```bash
# Test against production CloudFront
npm run test:finanzas-ui-diagnostic

# Test against a different base URL
FINZ_UI_BASE_URL=https://example.cloudfront.net npm run test:finanzas-ui-diagnostic
```

### Run in CI/CD:

The tests are automatically run as part of the `finanzas-aws-diagnostic.yml` GitHub Actions workflow.

## What Gets Tested

### Auth & Landing
- `/finanzas/auth/callback.html` - Auth callback page
- `/finanzas/` - Finanzas home/landing page

### Budget Management Module
- `/finanzas/projects` - Projects Manager
- `/finanzas/catalog/rubros` - Rubros Catalog
- `/finanzas/rules` - Allocation Rules
- `/finanzas/adjustments` - Adjustments Manager
- `/finanzas/cashflow` - Cashflow Dashboard
- `/finanzas/scenarios` - Scenarios Dashboard
- `/finanzas/providers` - Providers Manager

### SDMT Cost Module
- `/finanzas/sdmt/cost/catalog` - Cost Catalog (Line Items)
- `/finanzas/sdmt/cost/forecast` - Forecast
- `/finanzas/sdmt/cost/reconciliation` - Invoice Reconciliation
- `/finanzas/sdmt/cost/cashflow` - Cashflow
- `/finanzas/sdmt/cost/scenarios` - Scenarios
- `/finanzas/sdmt/cost/changes` - Change Management

## Test Logic

For each component:

1. **HTTP Request** - Makes a GET request to the component route
2. **Status Check** - Validates HTTP 200 response
3. **Content Type** - Ensures response is HTML
4. **Fingerprint Check** - Looks for expected strings in the HTML:
   - `root` - The root React div
   - `/finanzas/assets/index-` - The bundled JS file reference
   - Component-specific markers (e.g., "callback" for auth callback page)

## Exit Codes

- **0** - All tests passed or only non-critical failures
- **1** - One or more critical components failed

## Adding New Components

To add a new component to the diagnostic:

1. Edit `components.json`
2. Add a new entry with:
   - `name` - Human-readable component name
   - `route` - The URL path relative to the base URL
   - `fingerprints` - Array of strings to look for in the HTML
   - `category` - Grouping category (e.g., "SDMT Cost", "Budget Management")
   - `critical` - Boolean indicating if failure should fail the workflow

Example:

```json
{
  "name": "My New Component",
  "route": "/finanzas/my-route",
  "fingerprints": ["root", "my-component-marker"],
  "category": "Budget Management",
  "critical": true
}
```

## Maintenance

- Update `components.json` when routes change or new components are added
- Adjust fingerprints if component rendering changes significantly
- Keep fingerprints simple and stable (avoid checking for dynamic content)

## See Also

- [UI_COMPONENT_VALIDATION_MATRIX.md](../../UI_COMPONENT_VALIDATION_MATRIX.md) - Detailed component validation matrix
- [.github/workflows/finanzas-aws-diagnostic.yml](../../.github/workflows/finanzas-aws-diagnostic.yml) - The full diagnostic workflow
