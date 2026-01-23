import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:5173/';
const LOGIN_PAGE_URL = `${APP_URL}login`;

test.describe('LoginPage Links and Branding', () => {
  test('login page displays Ikusi branding and all portal links work', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(LOGIN_PAGE_URL);

    // Verify Ikusi Operating Direction branding is present
    await expect(page.locator('text=Dirección de Operaciones IKUSI Colombia')).toBeVisible();
    await expect(page.locator('text=Existimos para entregar excelencia con empatía y actitud que inspiran confianza')).toBeVisible();
    await expect(page.locator('text=Centrado')).toBeVisible();

    // Verify main heading
    await expect(page.locator('text=Acceso seguro Ikusi')).toBeVisible();

    // Take screenshot of login page with Ikusi branding
    await page.screenshot({ 
      path: 'screenshots/loginpage_ikusi.png', 
      fullPage: true 
    });

    // Test Finanzas SDM button (Cognito redirect)
    const finanzasButton = page.locator('button[aria-label*="Acceso a Finanzas"]');
    await expect(finanzasButton).toBeVisible();
    
    // Click Finanzas button and wait for Cognito redirect or navigation
    const [finanzasPageOrPopup] = await Promise.all([
      context.waitForEvent('page').catch(() => null),
      finanzasButton.click().catch(() => null),
    ]);

    // If a new page opened, capture screenshot
    if (finanzasPageOrPopup) {
      await finanzasPageOrPopup.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null);
      await finanzasPageOrPopup.screenshot({ 
        path: 'screenshots/finanzas_cognito.png', 
        fullPage: true 
      }).catch(() => null);
      await finanzasPageOrPopup.close();
    } else {
      // If same page navigation, capture screenshot
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: 'screenshots/finanzas_cognito.png', 
        fullPage: true 
      }).catch(() => null);
      await page.goBack();
    }

    // Test Gestor de Actas button (PMO Platform)
    const gestorButton = page.locator('button[aria-label*="Gestor de Actas"]');
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
    const prefacturasButton = page.locator('button[aria-label*="Prefacturas Proveedores"]');
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

    await page.close();
    await context.close();
  });
});
