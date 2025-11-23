import { Page, APIResponse, expect, request } from "@playwright/test";

export const uiBaseUrl = (
  process.env.FINZ_UI_BASE_URL ||
  "https://d7t9x3j66yd8k.cloudfront.net/finanzas/"
).replace(/\/$/, "");
export const apiBaseUrl =
  "https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev";
const cognitoClientId =
  process.env.FINZ_COGNITO_CLIENT_ID ||
  process.env.VITE_COGNITO_CLIENT_ID ||
  "dshos5iou44tuach7ta3ici5m";
const cognitoRegion =
  process.env.FINZ_COGNITO_REGION ||
  process.env.VITE_COGNITO_REGION ||
  "us-east-2";
const cognitoAuthEndpoint = `https://cognito-idp.${cognitoRegion}.amazonaws.com/`;
const allowPasswordFallback =
  process.env.FINZ_E2E_ALLOW_COGNITO_FALLBACK === "true";

export interface CapturedCall {
  url: string;
  method: string;
  status?: number;
}

export function requireCredentials() {
  const username = process.env.FINZ_TEST_USERNAME;
  const password = process.env.FINZ_TEST_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "FINZ_TEST_USERNAME and FINZ_TEST_PASSWORD must be set for E2E tests"
    );
  }
  return { username, password };
}

export async function login(page: Page) {
  const { username, password } = requireCredentials();
  await page.goto("./");

  if (await isFinanzasShellVisible(page, 3_000)) {
    return;
  }

  const hostedSuccess = await tryHostedLogin(page, username, password);

  if (!hostedSuccess) {
    if (!allowPasswordFallback) {
      throw new Error(
        "Hosted UI login failed and FINZ_E2E_ALLOW_COGNITO_FALLBACK is not 'true'. Enable the flag to use direct Cognito auth or restore the Hosted UI."
      );
    }

    await fallbackLoginWithUserPassword(page, username, password);
  }

  await waitForFinanzasShell(page);
}

export function collectApiCalls(page: Page) {
  const calls: CapturedCall[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("execute-api")) {
      calls.push({
        url,
        method: response.request().method(),
        status: response.status(),
      });
    }
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      calls.push({
        url,
        method: response.request().method(),
        status: response.status(),
      });
    }
  });
  return calls;
}

export async function waitForApiResponse(page: Page, pathFragment: string) {
  const response = await page.waitForResponse(
    (res) => res.url().includes(pathFragment),
    { timeout: 20_000 }
  );
  return response;
}

export async function verifyEndpoint(path: string) {
  const apiContext = await request.newContext();
  const response = await apiContext.get(`${apiBaseUrl}${path}`);
  await expect(response.ok() || response.status() === 501).toBeTruthy();
  return response;
}

function escapeRegex(source: string) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function isFinanzasShellVisible(page: Page, timeout: number) {
  const deadline = Date.now() + timeout;
  const checks = [
    () => page.getByRole("navigation"),
    () => page.getByRole("link", { name: /Proyectos|Catálogo|Catalogo/i }),
    () => page.getByRole("heading", { name: /Finanzas/i }),
  ];

  while (Date.now() < deadline) {
    for (const getLocator of checks) {
      const locator = getLocator();
      // `isVisible` throws if the element is detached; swallow and keep polling.
      const visible = await locator.isVisible().catch(() => false);
      if (visible) {
        return true;
      }
    }
    await page.waitForTimeout(200);
  }

  return false;
}

async function waitForFinanzasShell(page: Page) {
  const landingPattern = new RegExp(`^${escapeRegex(uiBaseUrl)}\\/?`);
  await page
    .waitForURL(landingPattern, { timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle");

  if (await isFinanzasShellVisible(page, 30_000)) {
    return;
  }

  const alert = page.getByRole("alert");
  const alertText = (await alert
    .first()
    .isVisible()
    .catch(() => false))
    ? await alert.first().innerText()
    : "No error alert rendered";
  throw new Error(
    `Login did not reach Finanzas shell. Alert state: ${alertText}`
  );
}

async function tryHostedLogin(page: Page, username: string, password: string) {
  const hostedLoginPattern = /amazoncognito\.com\/.*login/;
  let usedEmbeddedForm = false;

  try {
    const hostedRedirected = await Promise.race([
      page
        .waitForURL(hostedLoginPattern, { timeout: 5_000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByRole("button", { name: /Hosted UI/i })
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => false)
        .catch(() => false),
    ]);

    if (!hostedRedirected) {
      const emailField = page.getByPlaceholder("Email");
      const formVisible = await emailField
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);

      if (formVisible) {
        usedEmbeddedForm = true;
        await emailField.fill(username);
        await page.getByPlaceholder("Password").fill(password);
        await page
          .getByRole("button", { name: "Sign In", exact: true })
          .click();
      }
    }

    if (!usedEmbeddedForm && !page.url().match(hostedLoginPattern)) {
      const hostedButton = page.getByRole("button", { name: /Hosted UI/i });
      const hostedVisible = await hostedButton
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);

      if (hostedVisible) {
        await hostedButton.click();
        await page
          .waitForURL(hostedLoginPattern, { timeout: 15_000 })
          .catch(() => undefined);
      }
    }

    if (usedEmbeddedForm) {
      return true;
    }

    if (!page.url().match(hostedLoginPattern)) {
      return false;
    }

    const loginUnavailable = await page
      .getByText(/Login pages unavailable/i)
      .waitFor({ state: "visible", timeout: 1_000 })
      .then(() => true)
      .catch(() => false);

    if (loginUnavailable) {
      if (!allowPasswordFallback) {
        throw new Error(
          "Hosted UI rendered 'Login pages unavailable'. Set FINZ_E2E_ALLOW_COGNITO_FALLBACK=true to bypass while investigating."
        );
      }
      return false;
    }

    const usernameField = page
      .locator(
        'input[name="username"], input#signInFormUsername, input#username'
      )
      .first();
    const passwordField = page
      .locator(
        'input[name="password"], input#signInFormPassword, input#password'
      )
      .first();

    try {
      await expect(usernameField).toBeVisible({ timeout: 15_000 });
    } catch (error) {
      return false;
    }

    await usernameField.fill(username);
    await passwordField.fill(password);
    await page
      .locator(
        'button[type="submit"], button[name="signIn"], button:has-text("Sign in")'
      )
      .first()
      .click();

    return true;
  } catch (error) {
    console.warn(
      "[E2E] Hosted UI login attempt failed; password fallback permitted?",
      allowPasswordFallback,
      error
    );
    return false;
  }
}

async function fallbackLoginWithUserPassword(
  page: Page,
  username: string,
  password: string
) {
  const apiContext = await request.newContext();
  try {
    const response = await apiContext.post(cognitoAuthEndpoint, {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      data: {
        ClientId: cognitoClientId,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Cognito fallback login failed (${response.status()}): ${body}`
      );
    }

    const payload = await response.json();
    const authResult = payload?.AuthenticationResult ?? {};
    const idToken = authResult.IdToken as string | undefined;

    if (!idToken) {
      throw new Error("Cognito fallback login did not return an IdToken");
    }

    const accessToken = authResult.AccessToken as string | undefined;
    const refreshToken = authResult.RefreshToken as string | undefined;

    await page.context().clearCookies();
    await page.addInitScript(
      ({ idToken: token, accessToken: at, refreshToken: rt }) => {
        const setItem = (key: string, value: string | undefined) => {
          if (value) {
            window.localStorage.setItem(key, value);
          } else {
            window.localStorage.removeItem(key);
          }
        };

        setItem("cv.jwt", token);
        setItem("finz_jwt", token);
        setItem("idToken", token);
        setItem("cognitoIdToken", token);
        setItem("finz_access_token", at);
        setItem("finz_refresh_token", rt);
        window.localStorage.setItem("cv.module", "finanzas");
      },
      { idToken, accessToken, refreshToken }
    );

    await page.goto("./");
  } finally {
    await apiContext.dispose();
  }
}
