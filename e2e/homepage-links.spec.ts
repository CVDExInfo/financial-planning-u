import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:5173/';

test.describe('HomePage Links', () => {
  test('home page displays correct branding and all links work', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(APP_URL);

    // Verify new branding is present
    await expect(page.locator('text=Ikusi - Central de Operaciones')).toBeVisible();
    await expect(page.locator('h1:has-text("Ikusi · Central de Operaciones")')).toBeVisible();

    // Test Finance button (Cognito redirect)
    const financeButton = page.locator('button:has-text("Acceso a Finanzas")');
    await expect(financeButton).toBeVisible();
    
    // Click Finance button and wait for Cognito redirect or navigation
    const [financePageOrPopup] = await Promise.all([
      context.waitForEvent('page').catch(() => null),
      financeButton.click().catch(() => null),
    ]);

    // If a new page opened, capture screenshot
    if (financePageOrPopup) {
      await financePageOrPopup.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null);
      await financePageOrPopup.screenshot({ 
        path: 'screenshots/finance_redirect.png', 
        fullPage: true 
      }).catch(() => null);
      await financePageOrPopup.close();
    } else {
      // If same page navigation, capture screenshot
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: 'screenshots/finance_redirect.png', 
        fullPage: true 
      }).catch(() => null);
      await page.goBack();
    }

    // Test Gestor de Actas button
    const gestorButton = page.locator('button:has-text("Gestor de Actas")');
    await expect(gestorButton).toBeVisible();
    
    const [gestorPage] = await Promise.all([
      context.waitForEvent('page'),
      gestorButton.click(),
    ]);
    
    await gestorPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null);
    await gestorPage.screenshot({ 
      path: 'screenshots/gestor_de_actas.png', 
      fullPage: true 
    });
    expect(gestorPage.url()).toContain('d7t9x3j66yd8k.cloudfront.net');
    await gestorPage.close();

    // Test Prefacturas Proveedores button
    const prefacturasButton = page.locator('button:has-text("Prefacturas Proveedores")');
    await expect(prefacturasButton).toBeVisible();
    
    const [prefPage] = await Promise.all([
      context.waitForEvent('page'),
      prefacturasButton.click(),
    ]);
    
    await prefPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null);
    await prefPage.screenshot({ 
      path: 'screenshots/prefacturas_proveedores.png', 
      fullPage: true 
    });
    expect(prefPage.url()).toContain('df7rl707jhpas.cloudfront.net');
    await prefPage.close();

    // Test Resources section links
    const resources = [
      { label: 'Login | Salesforce', expectUrl: 'ikusi.my.salesforce.com', file: 'screenshots/salesforce.png' },
      { label: 'SERVICENOW', expectUrl: 'ikusi.service-now.com', file: 'screenshots/servicenow.png' },
      { label: 'Horas Extras', expectUrl: 'login.microsoftonline.com', file: 'screenshots/horas_extras.png' },
      { label: 'CISCO CCW', expectUrl: 'id.cisco.com', file: 'screenshots/cisco_ccw.png' },
    ];

    for (const resource of resources) {
      const resourceLink = page.locator(`a:has-text("${resource.label}")`);
      await expect(resourceLink).toBeVisible();
      
      const [resourcePage] = await Promise.all([
        context.waitForEvent('page'),
        resourceLink.click(),
      ]);
      
      await resourcePage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null);
      await resourcePage.screenshot({ 
        path: resource.file, 
        fullPage: true 
      }).catch(() => null);
      expect(resourcePage.url()).toContain(resource.expectUrl);
      await resourcePage.close();
    }

    await page.close();
    await context.close();
  });
});
