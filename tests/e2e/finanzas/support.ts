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
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await page.getByPlaceholder('Email').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  const heading = page.getByRole('heading', { name: /Finanzas · Gestión Presupuesto/i });
  const headingVisible = await heading
    .isVisible()
    .then((visible) => visible || heading.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true))
    .catch(() => false);

  if (!headingVisible) {
    const alert = page.getByRole('alert');
    const alertText = (await alert.first().isVisible())
      ? await alert.first().innerText()
      : 'No error alert rendered';
    throw new Error(`Login did not reach Finanzas home. Alert state: ${alertText}`);
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
