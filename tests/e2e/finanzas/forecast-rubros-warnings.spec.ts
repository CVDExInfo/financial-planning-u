/**
 * E2E Smoke Test: Forecast Page - No Rubros Taxonomy Warnings
 * 
 * This test verifies that the SDMT forecast page does not log any
 * "[rubros-taxonomy] Unknown rubro_id" warnings to the console.
 * 
 * The test validates the fix for missing canonical aliases by ensuring
 * that all rubro IDs used in allocations are recognized by the taxonomy
 * lookup system.
 */

import { test, expect, Page } from '@playwright/test';
import { login } from './support';

interface ConsoleMessage {
  type: string;
  text: string;
  location?: string;
}

test.describe('SDMT Forecast - Rubros Taxonomy Warnings', () => {
  let consoleMessages: ConsoleMessage[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture all console messages
    consoleMessages = [];
    
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()?.url,
      });
    });
  });

  test('forecast page does not log unknown rubros taxonomy warnings', async ({ page }) => {
    // Login to the application
    await login(page);

    // Navigate to SDMT forecast page
    // The exact URL might vary - adjust based on your routing
    await page.goto('./finanzas/sdmt/cost/forecast', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for the page to load and render
    // Look for a key element that indicates the page is ready
    try {
      await page.waitForSelector('text=/Gestión de Pronóstico|Pronóstico|Forecast/i', {
        timeout: 30000,
      });
    } catch (e) {
      // If the exact text isn't found, try alternative selectors
      await page.waitForLoadState('networkidle');
    }

    // Wait a few seconds for any async data loading
    await page.waitForTimeout(5000);

    // Filter console messages for rubros-taxonomy warnings
    const rubrosWarnings = consoleMessages.filter(m => 
      m.text.includes('[rubros-taxonomy]') && 
      m.text.includes('Unknown rubro_id')
    );

    // Log all console warnings for debugging
    const allWarnings = consoleMessages.filter(m => m.type === 'warning');
    if (allWarnings.length > 0) {
      console.log('\n=== Console Warnings ===');
      allWarnings.forEach((w, i) => {
        console.log(`${i + 1}. [${w.type}] ${w.text}`);
        if (w.location) {
          console.log(`   Location: ${w.location}`);
        }
      });
    }

    // Assert no rubros-taxonomy unknown messages exist
    if (rubrosWarnings.length > 0) {
      console.log('\n=== Rubros Taxonomy Warnings Found ===');
      rubrosWarnings.forEach((w, i) => {
        console.log(`${i + 1}. ${w.text}`);
      });
    }

    expect(rubrosWarnings.length).toBe(0);
  });

  test('forecast page loads allocation data without errors', async ({ page }) => {
    // Capture console errors
    const consoleErrors: ConsoleMessage[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location()?.url,
        });
      }
    });

    // Login
    await login(page);

    // Navigate to forecast page
    await page.goto('./finanzas/sdmt/cost/forecast', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Check for any console errors related to taxonomy or allocations
    const taxonomyErrors = consoleErrors.filter(e =>
      e.text.toLowerCase().includes('taxonomy') ||
      e.text.toLowerCase().includes('rubro') ||
      e.text.toLowerCase().includes('allocation')
    );

    if (taxonomyErrors.length > 0) {
      console.log('\n=== Taxonomy-related Console Errors ===');
      taxonomyErrors.forEach((e, i) => {
        console.log(`${i + 1}. ${e.text}`);
      });
    }

    // We allow other errors, but taxonomy-related errors should be 0
    expect(taxonomyErrors.length).toBe(0);
  });

  test('canonical aliases are recognized in labor classification', async ({ page }) => {
    // This test verifies that the new aliases work correctly
    // by checking that the forecast page can load and display labor data
    
    await login(page);

    await page.goto('./finanzas/sdmt/cost/forecast', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Look for labor-related content on the page
    // The exact selectors will depend on your UI structure
    // This is a generic check that the page rendered without breaking
    const bodyText = await page.textContent('body');
    
    // Assert that the page has some content (not a blank page or error page)
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);

    // Check that no taxonomy warnings appeared
    const rubrosWarnings = consoleMessages.filter(m => 
      m.text.includes('[rubros-taxonomy]') && 
      m.text.includes('Unknown rubro_id')
    );
    
    expect(rubrosWarnings.length).toBe(0);
  });
});
