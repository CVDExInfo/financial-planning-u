import { test, expect } from '@playwright/test';
import { setupAuthenticatedPage, getRoleCredentials } from '../behavioral/auth-helper';

test.describe('Finanzas 12m smoke', () => {
  test.beforeEach(async ({}, testInfo) => {
    // Skip if no SDMT or PMO credentials are configured
    if (!process.env.E2E_SDMT_EMAIL && !process.env.E2E_PMO_EMAIL) {
      test.skip('No SDMT/PMO credentials configured - skipping smoke tests');
    }
  });

  test('toggle Rubro -> Proyecto and expand project, filter MOD updates totals', async ({ page }) => {
    // Use SDMT credentials (preferred) or PMO as fallback
    const credentials = getRoleCredentials('SDMT') || getRoleCredentials('PMO');
    
    if (!credentials) {
      test.skip('No SDMT or PMO credentials available');
      return;
    }

    // Setup authentication
    await setupAuthenticatedPage(page, credentials.username, credentials.password);

    const base = process.env.FINZ_UI_BASE_URL || 'https://d7t9x3j66yd8k.cloudfront.net/finanzas';
    await page.goto(`${base}/sdmt/cost/forecast`);
    await page.waitForLoadState('domcontentloaded');

    // Expand the 12-month tile if collapsed (find card by title)
    const tileTitle = page.locator('text=Cuadrícula de Pronóstico (12 meses)').first();
    if (await tileTitle.count()) {
      // if it's collapsed, click to open; tolerant check for a collapse button
      const parent = tileTitle.locator('..');
      const toggle = parent.locator('button', { hasText: /mostrar|expand|ver/i }).first();
      if (await toggle.count()) {
        await toggle.click().catch(()=>{});
      }
    }

    // Ensure default Rubro view is visible
    await expect(page.locator('text=Rubros por Categoría').first()).toBeVisible();

    // Click the 'Ver por: Proyecto' toggle/tab
    // Prefer role=tab selector, fallback to text
    const projectTab = page.locator('role=tab[name="Proyecto"]');
    if (await projectTab.count()) {
      await projectTab.click();
    } else {
      await page.locator('text=Proyecto').first().click();
    }

    // Wait for project rows
    const projectRow = page.locator('tr.project-row').first();
    await expect(projectRow).toBeVisible({ timeout: 15000 });

    // Expand the first project row (button with aria-expanded)
    const toggleBtn = projectRow.locator('button[aria-expanded]');
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Ensure nested rubros exist
    await expect(page.locator('table.nested-rubros tr.rubro-row')).toHaveCountGreaterThan(0);

    // Capture project subtotal before filter
    const subtotalLocator = projectRow.locator('.project-month-total').first();
    const beforeText = await subtotalLocator.textContent() || '0';
    const before = parseFloat(beforeText.replace(/[^0-9.-]+/g, '')) || 0;

    // Click MANO DE OBRA (MOD) filter
    const modFilter = page.locator('text=Mano de Obra (MOD)');
    await modFilter.click();
    // Allow time for totals to recalc
    await page.waitForTimeout(800);

    const afterText = await subtotalLocator.textContent() || '0';
    const after = parseFloat(afterText.replace(/[^0-9.-]+/g, '')) || 0;

    expect(after).not.toEqual(before);

    // Assert no console errors like "React is not defined"
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    // small interaction to flush console
    await page.waitForTimeout(250);
    expect(errors.find(e => e.includes('React is not defined'))).toBeUndefined();
    expect(errors.length).toBeLessThanOrEqual(2); // allow minor warnings
  });
});
