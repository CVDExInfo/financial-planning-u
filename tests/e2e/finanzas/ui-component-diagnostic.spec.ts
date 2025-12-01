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
      test(`${component.name} - should render with expected content`, async ({ page }) => {
        // Navigate to the component
        console.log(`\n✅ Testing: ${component.name}`);
        console.log(`   Route: ${component.route}`);
        console.log(`   Critical: ${component.critical ? 'YES' : 'NO'}`);
        
        await page.goto(component.route, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });

        // Wait for React to render
        await page.waitForSelector('#root', { timeout: 10000 });

        // Give a bit more time for content to render
        await page.waitForTimeout(2000);

        // Run all validations for this component
        for (const validation of component.validations) {
          if (validation.type === 'text') {
            // Check if the text is present on the page
            const content = await page.content();
            const hasText = content.includes(validation.value);
            
            if (hasText) {
              console.log(`   ✅ ${validation.description}`);
            } else {
              console.log(`   ❌ ${validation.description} - NOT FOUND`);
              
              // For critical components, fail the test
              if (component.critical) {
                expect(hasText, `Critical component "${component.name}" missing expected text: "${validation.value}"`).toBeTruthy();
              } else {
                // For non-critical, just log the warning but don't fail
                console.log(`   ⚠️  Non-critical component - continuing`);
              }
            }
          }
        }

        console.log(`   ✅ Component validation complete\n`);
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
          timeout: 30000 
        });

        await page.waitForSelector('#root', { timeout: 10000 });
        await page.waitForTimeout(2000);

        const content = await page.content();
        let allValidationsPassed = true;

        for (const validation of component.validations) {
          if (validation.type === 'text') {
            if (!content.includes(validation.value)) {
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
