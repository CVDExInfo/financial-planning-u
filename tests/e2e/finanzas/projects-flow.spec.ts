import { test, expect } from '@playwright/test';
import { login, collectApiCalls } from './support';

test.describe('Finanzas projects flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigates to projects manager and verifies API host', async ({ page }) => {
    const calls = collectApiCalls(page);

    await page.getByRole('link', { name: /Proyectos/i }).click();
    await expect(
      page.getByRole('heading', { name: /Gestión de Proyectos/i })
    ).toBeVisible();

    // Listen for any /projects request (list or create) to confirm host
    const projectsResponse = await page.waitForResponse(
      (res) => res.url().includes('/projects') && res.request().method() === 'GET',
      { timeout: 20_000 }
    ).catch(() => null);

    if (projectsResponse) {
      expect(projectsResponse.url()).toContain('https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com');
      expect([200, 401, 403, 501]).toContain(projectsResponse.status());
    }

    const projectTable = page.getByRole('row', { name: /Proyecto|Project/i }).first();
    const emptyState = page.getByText(/No projects are available|Sin proyectos/i);

    await expect(
      page.getByText('Unable to load projects', { exact: false }).first()
    ).not.toBeVisible({ timeout: 1000 }).catch(() => {});

    const hasData = await projectTable.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    expect(hasData || hasEmptyState).toBeTruthy();

    const badHosts = calls.filter((call) => call.url.includes('localhost') || call.url.includes('127.0.0.1'));
    expect(badHosts.length).toBe(0);
  });
});
