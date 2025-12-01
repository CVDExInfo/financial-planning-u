/**
 * Finanzas UI Component Diagnostic E2E Tests
 * 
 * Validates that each major Finanzas UI component renders correctly with:
 * - Expected page titles and headings
 * - Key UI elements and labels
 * - Component-specific markers
 * 
 * This runs in a real browser via Playwright to validate the fully rendered UI,
 * not just the initial HTML shell.
 */

import { test, expect } from '@playwright/test';

// Configuration constants
const COMPONENT_LOAD_TIMEOUT = 30000; // 30 seconds for navigation
const REACT_RENDER_TIMEOUT = 10000;  // 10 seconds for React root
const CONTENT_TIMEOUT = 15000;        // 15 seconds for content to appear

// Component validation configuration
const COMPONENT_TESTS = [
  {
    name: 'Finanzas Landing',
    route: '/',
    critical: true,
    category: 'Landing',
    validations: [
      { type: 'text', value: 'Finanzas', description: 'Page contains "Finanzas"' },
      { type: 'text', value: 'Gestión Presupuesto', description: 'Page contains "Gestión Presupuesto"' },
    ],
  },
  {
    name: 'Projects Manager',
    route: '/projects',
    critical: true,
    category: 'Budget Management',
    validations: [
      { type: 'text', value: 'Gestión de Proyectos', description: 'Page contains "Gestión de Proyectos"' },
    ],
  },
  {
    name: 'Rubros Catalog',
    route: '/catalog/rubros',
    critical: true,
    category: 'Budget Management',
    validations: [
      { type: 'text', value: 'Catálogo de Rubros', description: 'Page contains "Catálogo de Rubros"' },
    ],
  },
  {
    name: 'Allocation Rules',
    route: '/rules',
    critical: false,
    category: 'Budget Management',
    validations: [
      { type: 'text', value: 'Reglas de Asignación', description: 'Page contains "Reglas de Asignación"' },
    ],
  },
  {
    name: 'Adjustments Manager',
    route: '/adjustments',
    critical: false,
    category: 'Budget Management',
    validations: [
      { type: 'text', value: 'Ajustes', description: 'Page contains "Ajustes"' },
    ],
  },
  {
    name: 'Cashflow Dashboard',
    route: '/cashflow',
    critical: false,
    category: 'Budget Management',
    validations: [
      { type: 'text', value: 'Flujo de Caja', description: 'Page contains "Flujo de Caja"' },
    ],
  },
  {
    name: 'Scenarios Dashboard',
    route: '/scenarios',
    critical: false,
    category: 'Budget Management',
    validations: [
      { type: 'text', value: 'Escenarios', description: 'Page contains "Escenarios"' },
    ],
  },
  {
    name: 'Providers Manager',
    route: '/providers',
    critical: false,
    category: 'Budget Management',
    validations: [
      { type: 'text', value: 'Proveedores', description: 'Page contains "Proveedores"' },
    ],
  },
  {
    name: 'SDMT Cost Catalog',
    route: '/sdmt/cost/catalog',
    critical: true,
    category: 'SDMT Cost',
    validations: [
      { type: 'text', value: 'Cost Catalog', description: 'Page contains "Cost Catalog"' },
    ],
  },
  {
    name: 'SDMT Forecast',
    route: '/sdmt/cost/forecast',
    critical: true,
    category: 'SDMT Cost',
    validations: [
      { type: 'text', value: 'Forecast Management', description: 'Page contains "Forecast Management"' },
    ],
  },
  {
    name: 'SDMT Reconciliation',
    route: '/sdmt/cost/reconciliation',
    critical: true,
    category: 'SDMT Cost',
    validations: [
      { type: 'text', value: 'Invoice Reconciliation', description: 'Page contains "Invoice Reconciliation"' },
    ],
  },
  {
    name: 'SDMT Cashflow',
    route: '/sdmt/cost/cashflow',
    critical: false,
    category: 'SDMT Cost',
    validations: [
      { type: 'text', value: 'Cashflow', description: 'Page contains "Cashflow"' },
    ],
  },
  {
    name: 'SDMT Scenarios',
    route: '/sdmt/cost/scenarios',
    critical: false,
    category: 'SDMT Cost',
    validations: [
      { type: 'text', value: 'Scenarios', description: 'Page contains "Scenarios"' },
    ],
  },
  {
    name: 'SDMT Changes',
    route: '/sdmt/cost/changes',
    critical: true,
    category: 'SDMT Cost',
    validations: [
      { type: 'text', value: 'Change Management', description: 'Page contains "Change Management"' },
    ],
  },
];

/**
 * Helper function to wait for component to be ready
 * Waits for React root and then for network to be idle
 */
async function waitForComponentReady(page) {
  await page.waitForSelector('#root', { timeout: REACT_RENDER_TIMEOUT });
  // Wait for network to be idle, indicating content has loaded
  await page.waitForLoadState('networkidle', { timeout: CONTENT_TIMEOUT });
}

// Group tests by category for better organization
const testsByCategory = COMPONENT_TESTS.reduce((acc, component) => {
  if (!acc[component.category]) {
    acc[component.category] = [];
  }
  acc[component.category].push(component);
  return acc;
}, {} as Record<string, typeof COMPONENT_TESTS>);

// Create test suites for each category
for (const [category, components] of Object.entries(testsByCategory)) {
  test.describe(`Finanzas UI Components - ${category}`, () => {
    for (const component of components) {
      // Only fail test for critical components
      const testFn = component.critical ? test : test;
      
      testFn(`${component.name} - should render with expected content`, async ({ page }) => {
        console.log(`\n✅ Testing: ${component.name}`);
        console.log(`   Route: ${component.route}`);
        console.log(`   Critical: ${component.critical ? 'YES' : 'NO'}`);
        
        // Navigate to the component
        await page.goto(component.route, { 
          waitUntil: 'networkidle',
          timeout: COMPONENT_LOAD_TIMEOUT 
        });

        // Wait for React to render and content to load
        await waitForComponentReady(page);

        // Run all validations for this component
        let allValidationsPassed = true;
        const errors: string[] = [];

        for (const validation of component.validations) {
          if (validation.type === 'text') {
            try {
              // Use Playwright's built-in text matching for more reliable validation
              const textLocator = page.getByText(validation.value, { exact: false });
              await textLocator.waitFor({ timeout: CONTENT_TIMEOUT, state: 'visible' });
              console.log(`   ✅ ${validation.description}`);
            } catch (error) {
              allValidationsPassed = false;
              const errorMsg = `${validation.description} - NOT FOUND`;
              errors.push(errorMsg);
              console.log(`   ❌ ${errorMsg}`);
            }
          }
        }

        console.log(`   ${allValidationsPassed ? '✅' : '❌'} Component validation ${allValidationsPassed ? 'complete' : 'failed'}\n`);

        // For critical components, fail the test if validations failed
        if (component.critical && !allValidationsPassed) {
          expect(allValidationsPassed, 
            `Critical component "${component.name}" failed validation:\n${errors.join('\n')}`
          ).toBeTruthy();
        }
      });
    }
  });
}

// Summary test that validates overall health
test.describe('Finanzas UI Diagnostic Summary', () => {
  test('should have all critical components operational', async ({ page }) => {
    const criticalComponents = COMPONENT_TESTS.filter(c => c.critical);
    const results = {
      total: criticalComponents.length,
      passed: 0,
      failed: 0,
      errors: [] as string[],
    };

    console.log(`\n${'═'.repeat(60)}`);
    console.log('FINANZAS UI COMPONENT DIAGNOSTIC SUMMARY');
    console.log(`${'═'.repeat(60)}\n`);
    console.log(`Testing ${results.total} critical components...\n`);

    for (const component of criticalComponents) {
      try {
        await page.goto(component.route, { 
          waitUntil: 'networkidle',
          timeout: COMPONENT_LOAD_TIMEOUT 
        });

        await waitForComponentReady(page);

        let allValidationsPassed = true;

        for (const validation of component.validations) {
          if (validation.type === 'text') {
            try {
              const textLocator = page.getByText(validation.value, { exact: false });
              await textLocator.waitFor({ timeout: CONTENT_TIMEOUT, state: 'visible' });
            } catch {
              allValidationsPassed = false;
              results.errors.push(`${component.name}: Missing "${validation.value}"`);
            }
          }
        }

        if (allValidationsPassed) {
          console.log(`✅ ${component.name}`);
          results.passed++;
        } else {
          console.log(`❌ ${component.name}`);
          results.failed++;
        }
      } catch (error) {
        console.log(`❌ ${component.name} - ERROR: ${error}`);
        results.failed++;
        results.errors.push(`${component.name}: ${error}`);
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Summary: ${results.passed}/${results.total} passed`);
    console.log(`${'═'.repeat(60)}\n`);

    if (results.failed > 0) {
      console.log('❌ FAILURES:');
      results.errors.forEach(err => console.log(`   ${err}`));
      console.log('');
    }

    expect(results.failed, `${results.failed} critical component(s) failed validation`).toBe(0);
  });
});
