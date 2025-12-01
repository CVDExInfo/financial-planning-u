# Finanzas UI Component Diagnostics

This directory contains the UI component smoke tests for the Finanzas AWS Diagnostic workflow.

## Purpose

These tests validate that every major Finanzas UI component and route is:
- ✅ Deployed correctly to CloudFront
- ✅ Returning HTTP 200 responses
- ✅ Serving valid HTML documents
- ✅ Containing expected UI fingerprints (root div, bundle references)

**This is NOT a full E2E test suite.** It's a lightweight diagnostic to detect deployment issues and broken routes.

## Test Layers

The diagnostic system operates in two complementary layers:

### Layer 1: HTTP Smoke Test (Fast)
- **What:** Basic HTTP-based validation
- **Tool:** Node.js fetch API (`smoke-test.mjs`)
- **Validates:**
  - HTTP 200 status code
  - HTML content type
  - React root div present
  - JS bundle reference present
- **Speed:** ~1-2 seconds
- **Use case:** Quick deployment verification

### Layer 2: Browser E2E Test (Comprehensive)
- **What:** Full browser-based validation  
- **Tool:** Playwright (`tests/e2e/finanzas/ui-component-diagnostic.spec.ts`)
- **Validates:**
  - React components render correctly
  - Page titles and headings are present
  - Component-specific UI elements are visible
  - No critical rendering errors
- **Speed:** ~2-3 minutes
- **Use case:** Full UI functionality verification

Both layers are automatically run in the `finanzas-aws-diagnostic.yml` workflow.

## Files

- **`components.json`** - Configuration file listing all Finanzas UI components and routes to test (used by HTTP smoke test)
- **`smoke-test.mjs`** - Node.js script that performs HTTP-based validation of each component
- **`../e2e/finanzas/ui-component-diagnostic.spec.ts`** - Playwright E2E tests that validate rendered content

## Usage

### Run HTTP smoke test locally:

```bash
# Test against production CloudFront
npm run test:finanzas-ui-diagnostic

# Test against a different base URL
FINZ_UI_BASE_URL=https://example.cloudfront.net npm run test:finanzas-ui-diagnostic
```

### Run Browser E2E test locally:

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Run the E2E diagnostic
FINZ_UI_BASE_URL=https://d7t9x3j66yd8k.cloudfront.net/finanzas/ npx playwright test tests/e2e/finanzas/ui-component-diagnostic.spec.ts --reporter=list
```

### Run in CI/CD:

Both tests are automatically run as part of the `finanzas-aws-diagnostic.yml` GitHub Actions workflow.

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

### HTTP Smoke Test Logic

For each component:

1. **HTTP Request** - Makes a GET request to the component route
2. **Status Check** - Validates HTTP 200 response
3. **Content Type** - Ensures response is HTML
4. **Fingerprint Check** - Looks for expected strings in the HTML:
   - `root` - The root React div
   - `/finanzas/assets/index-` - The bundled JS file reference
   - Component-specific markers (e.g., "callback" for auth callback page)

### Browser E2E Test Logic

For each component:

1. **Navigate** - Opens the route in a real browser (Playwright/Chromium)
2. **Wait for React** - Waits for the `#root` element to be present
3. **Wait for Render** - Gives React time to render content (2 seconds)
4. **Content Validation** - Checks for component-specific text:
   - Page titles (e.g., "Forecast Management", "Change Management")
   - Section headings (e.g., "Gestión de Proyectos", "Catálogo de Rubros")
   - Key UI labels and markers
5. **Critical Check** - For critical components, test fails if validation fails

## Exit Codes

- **0** - All tests passed or only non-critical failures
- **1** - One or more critical components failed

## Adding New Components

### For HTTP Smoke Test

Edit `components.json` and add a new entry:

```json
{
  "name": "My New Component",
  "route": "/finanzas/my-route",
  "fingerprints": ["root", "/finanzas/assets/index-"],
  "category": "Budget Management",
  "critical": true
}
```

### For Browser E2E Test

Edit `tests/e2e/finanzas/ui-component-diagnostic.spec.ts` and add to the `COMPONENT_TESTS` array:

```typescript
{
  name: 'My New Component',
  route: '/my-route',
  critical: true,
  category: 'Budget Management',
  validations: [
    { type: 'text', value: 'My Component Title', description: 'Page contains title' },
  ],
}
```

## Maintenance

- Update `components.json` when routes change or new components are added
- Update the Playwright test when component text/headings change
- Keep fingerprints simple and stable (avoid checking for dynamic content in HTTP smoke test)
- Use the Playwright test for checking rendered React content

## See Also

- [UI_COMPONENT_VALIDATION_MATRIX.md](../../UI_COMPONENT_VALIDATION_MATRIX.md) - Detailed component validation matrix
- [.github/workflows/finanzas-aws-diagnostic.yml](../../.github/workflows/finanzas-aws-diagnostic.yml) - The full diagnostic workflow
- [tests/e2e/finanzas/ui-component-diagnostic.spec.ts](../e2e/finanzas/ui-component-diagnostic.spec.ts) - Browser E2E validation tests

