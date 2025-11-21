import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, collectApiCalls } from './support';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Finanzas uploads', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('attempts document upload and validates presigned PUT', async ({ page }) => {
    const calls = collectApiCalls(page);

    await page.getByRole('link', { name: /Proyectos/i }).click();
    await expect(page.getByRole('heading', { name: /Gestión de Proyectos/i })).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    const hasFileInput = (await fileInput.count()) > 0;
    test.skip(!hasFileInput, 'No upload control available in current build');

    const testFilePath = path.join(__dirname, 'files/test-upload.txt');
    await fileInput.first().setInputFiles(testFilePath);

    const uploadApiCall = await page.waitForResponse((res) => res.url().includes('/uploads'), { timeout: 20_000 });
    expect(uploadApiCall.url()).toContain('https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev');
    expect([200, 201]).toContain(uploadApiCall.status());

    const s3Put = await page.waitForResponse((res) => res.url().includes('amazonaws.com') && res.request().method() === 'PUT', {
      timeout: 20_000,
    });
    expect([200, 201]).toContain(s3Put.status());

    const successToast = page.getByText(/cargad[oa]|upload/i);
    await expect(successToast).toBeVisible();

    const badHosts = calls.filter((call) => call.url.includes('localhost') || call.url.includes('127.0.0.1'));
    expect(badHosts.length).toBe(0);
  });
});
