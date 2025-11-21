import { Page, APIResponse, expect, request } from '@playwright/test';

export const uiBaseUrl = (process.env.FINZ_UI_BASE_URL || 'https://d7t9x3j66yd8k.cloudfront.net/finanzas/').replace(/\/$/, '');
export const apiBaseUrl = 'https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev';

export interface CapturedCall {
  url: string;
  method: string;
  status?: number;
}

export function requireCredentials() {
  const username = process.env.FINZ_TEST_USERNAME;
  const password = process.env.FINZ_TEST_PASSWORD;
  if (!username || !password) {
    throw new Error('FINZ_TEST_USERNAME and FINZ_TEST_PASSWORD must be set for E2E tests');
  }
  return { username, password };
}

export async function login(page: Page) {
  const { username, password } = requireCredentials();
  await page.goto('./');

  const hostedLoginPattern = /amazoncognito\.com\/.*login/;

  const hostedRedirected = await Promise.race([
    page.waitForURL(hostedLoginPattern, { timeout: 5_000 }).then(() => true).catch(() => false),
    page
      .getByRole('button', { name: /Hosted UI/i })
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => false)
      .catch(() => false),
  ]);

  if (!hostedRedirected) {
    // If the Hosted UI isn't triggered automatically (e.g., local dev), fall back to the form.
    const emailField = page.getByPlaceholder('Email');
    const formVisible = await emailField
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (formVisible) {
      await emailField.fill(username);
      await page.getByPlaceholder('Password').fill(password);
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    }
  }

  if (!page.url().match(hostedLoginPattern)) {
    // Trigger Hosted UI manually if we're still on the SPA shell
    const hostedButton = page.getByRole('button', { name: /Hosted UI/i });
    const hostedVisible = await hostedButton
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (hostedVisible) {
      await hostedButton.click();
      await page.waitForURL(hostedLoginPattern, { timeout: 15_000 });
    }
  }

  if (page.url().match(hostedLoginPattern)) {
    const usernameField = page.locator('input[name="username"], input#signInFormUsername, input#username').first();
    const passwordField = page.locator('input[name="password"], input#signInFormPassword, input#password').first();
    await expect(usernameField).toBeVisible({ timeout: 15_000 });
    await usernameField.fill(username);
    await passwordField.fill(password);
    await page.locator('button[type="submit"], button[name="signIn"], button:has-text("Sign in")').first().click();
  }

  await page.waitForURL(new RegExp(`^${uiBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), {
    timeout: 30_000,
  });
  await page.waitForLoadState('networkidle');

  const navbar = page.getByRole('navigation');
  const finzTab = page.getByRole('link', { name: /Proyectos|Catálogo|Catalogo/i });

  const success = await Promise.race([
    navbar.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true),
    finzTab.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true),
  ]).catch(() => false);

  if (!success) {
    const alert = page.getByRole('alert');
    const alertText = (await alert.first().isVisible())
      ? await alert.first().innerText()
      : 'No error alert rendered';
    throw new Error(`Login did not reach Finanzas shell. Alert state: ${alertText}`);
  }
}

export function collectApiCalls(page: Page) {
  const calls: CapturedCall[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('execute-api')) {
      calls.push({ url, method: response.request().method(), status: response.status() });
    }
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      calls.push({ url, method: response.request().method(), status: response.status() });
    }
  });
  return calls;
}

export async function waitForApiResponse(page: Page, pathFragment: string) {
  const response = await page.waitForResponse((res) => res.url().includes(pathFragment), { timeout: 20_000 });
  return response;
}

export async function verifyEndpoint(path: string) {
  const apiContext = await request.newContext();
  const response = await apiContext.get(`${apiBaseUrl}${path}`);
  await expect(response.ok() || response.status() === 501).toBeTruthy();
  return response;
}
