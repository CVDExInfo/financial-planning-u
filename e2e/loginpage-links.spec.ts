import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:5173/';
const LOGIN_PAGE_URL = `${APP_URL}login`;

test.describe('LoginPage Links and Branding', () => {
  test('login page displays Ikusi branding and all portal links work', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(LOGIN_PAGE_URL);

    // Verify Ikusi badge and H1
    await expect(page.locator('text=Ikusi - Central de Operaciones')).toBeVisible();
    await expect(page.locator('text=Ikusi · Central de Operaciones')).toBeVisible();

    // Verify Mi Hermano copy
    await expect(page.locator('text=Dirección de Operaciones IKUSI Colombia')).toBeVisible();
    await expect(page.locator('text=Existimos para entregar excelencia con empatía y actitud que inspiran confianza')).toBeVisible();
    await expect(page.locator('text=Centrado')).toBeVisible();

    // Verify main heading
    await expect(page.locator('text=Accesos rápidos')).toBeVisible();

    // Verify info text
    await expect(page.locator('text=Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol')).toBeVisible();

    // Take screenshot of login page with Ikusi branding
    await page.screenshot({ 
      path: 'screenshots/loginpage_ikusi.png', 
      fullPage: true 
    });

    // Test Finanzas button (Cognito redirect)
    const finanzasButton = page.locator('button[aria-label*="Acceso a Finanzas"]');
    await expect(finanzasButton).toBeVisible();
    await expect(finanzasButton).toContainText('Acceso a Finanzas');
    
    // Click Finanzas button and wait for Cognito redirect or navigation
    const [finanzasPageOrPopup] = await Promise.all([
      context.waitForEvent('page').catch(() => null),
      finanzasButton.click().catch(() => null),
    ]);

    // If a new page opened, capture screenshot
    if (finanzasPageOrPopup) {
      await finanzasPageOrPopup.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null);
      await finanzasPageOrPopup.screenshot({ 
        path: 'screenshots/finance_redirect.png', 
        fullPage: true 
      }).catch(() => null);
      await finanzasPageOrPopup.close();
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
    const gestorButton = page.locator('button[aria-label*="Gestor de Actas"]');
    await expect(gestorButton).toBeVisible();
    await expect(gestorButton).toContainText('Gestor de Actas');
    
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
    await expect(prefacturasButton).toContainText('Prefacturas Proveedores');
    
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

    // Verify Resources section
    await expect(page.locator('text=Recursos')).toBeVisible();
    
    // Verify all four resource links are present
    await expect(page.locator('a[aria-label*="Login | Salesforce"]')).toBeVisible();
    await expect(page.locator('a[aria-label*="SERVICENOW"]')).toBeVisible();
    await expect(page.locator('a[aria-label*="Horas Extras"]')).toBeVisible();
    await expect(page.locator('a[aria-label*="CISCO CCW"]')).toBeVisible();

    // Verify footer note
    await expect(page.locator('text=¿Necesitas acceso? Contacta con tu administrador de sistemas.')).toBeVisible();

    // Verify rel="noopener noreferrer" on external links
    const salesforceLink = page.locator('a[href="https://ikusi.my.salesforce.com/"]');
    await expect(salesforceLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(salesforceLink).toHaveAttribute('target', '_blank');

    await page.close();
    await context.close();
  });
});
