/**
 * Playwright Authentication Helper
 * 
 * Helper for injecting Cognito tokens into browser localStorage
 */

import { Page } from "@playwright/test";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";

const COGNITO_REGION = process.env.AWS_REGION || process.env.COGNITO_REGION || "us-east-2";
const COGNITO_CLIENT_ID =
  process.env.COGNITO_WEB_CLIENT || process.env.COGNITO_CLIENT_ID;

interface AuthResult {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
}

/**
 * Authenticate with Cognito USER_PASSWORD_AUTH flow
 */
export async function authenticateWithCognito(
  username: string,
  password: string
): Promise<AuthResult> {
  if (!COGNITO_CLIENT_ID) {
    throw new Error("COGNITO_WEB_CLIENT or COGNITO_CLIENT_ID environment variable must be set");
  }

  const client = new CognitoIdentityProviderClient({ region: COGNITO_REGION });

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const response = await client.send(command);

    if (!response.AuthenticationResult?.IdToken) {
      throw new Error("Authentication failed: No ID token in response");
    }

    return {
      idToken: response.AuthenticationResult.IdToken,
      accessToken: response.AuthenticationResult.AccessToken || "",
      refreshToken: response.AuthenticationResult.RefreshToken,
    };
  } catch (error) {
    throw new Error(
      `Failed to authenticate: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Inject authentication tokens into browser localStorage
 * Mimics the app's auth storage pattern
 */
export async function injectAuthToken(page: Page, tokens: AuthResult): Promise<void> {
  await page.addInitScript((authData) => {
    // Store tokens in all the keys the app checks
    localStorage.setItem("cv.jwt", authData.idToken);
    localStorage.setItem("finz_jwt", authData.idToken);
    localStorage.setItem("idToken", authData.idToken);
    localStorage.setItem("cognitoIdToken", authData.idToken);

    if (authData.accessToken) {
      localStorage.setItem("finz_access_token", authData.accessToken);
    }

    if (authData.refreshToken) {
      localStorage.setItem("finz_refresh_token", authData.refreshToken);
    }
  }, tokens);
}

/**
 * Setup authenticated page for testing
 * 
 * @param page - Playwright page
 * @param username - Cognito username
 * @param password - Cognito password
 */
export async function setupAuthenticatedPage(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  // Authenticate with Cognito
  const tokens = await authenticateWithCognito(username, password);

  // Inject tokens into page
  await injectAuthToken(page, tokens);
}

/**
 * Get role credentials from environment
 */
export function getRoleCredentials(role: string): { username: string; password: string } | null {
  const envPrefix = `E2E_${role.toUpperCase().replace(/-/g, "_")}`;
  const username = process.env[`${envPrefix}_EMAIL`] || process.env[`${envPrefix}_USERNAME`];
  const password = process.env[`${envPrefix}_PASSWORD`];

  if (!username || !password) {
    console.warn(`⚠️  Credentials not configured for role: ${role}`);
    return null;
  }

  return { username, password };
}
