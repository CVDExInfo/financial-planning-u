/**
 * AWS Cognito and API configuration for Finanzas module
 *
 * This configuration enables Cognito authentication for the Finanzas (SDT) module
 * and ensures proper separation from the PMO module authentication flow.
 *
 * Environment variables take precedence over hardcoded values for flexibility.
 *
 * NOTE: This file should be imported and used only by the Finanzas module.
 * Do NOT create a global aws-exports.js in the root to avoid cross-app confusion.
 */

import { API_BASE, HAS_API_BASE } from "./env";

const envSource =
  (typeof import.meta !== "undefined"
    ? (import.meta as { env?: Record<string, string | undefined> }).env
    : undefined) || (process.env as Record<string, string | undefined>);

const isDevEnv =
  envSource?.DEV === "true" || envSource?.MODE === "development";

const CANONICAL_COGNITO = {
  userPoolId: "us-east-2_FyHLtOhiY",
  clientId: "dshos5iou44tuach7ta3ici5m",
  domain: "us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com",
  cloudfrontUrl: "https://d7t9x3j66yd8k.cloudfront.net",
  callbackPath: "/finanzas/auth/callback.html",
  signOutPath: "/finanzas/",
};

/**
 * Default R1 Cognito + region configuration
 * (Also used so QA scripts can assert the correct pool/domain by literal text)
 */
const DEFAULT_REGION = "us-east-2";
const DEFAULT_USER_POOL_ID = "us-east-2_FyHLtOhiY";
const DEFAULT_COGNITO_DOMAIN =
  "us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com";
const DEFAULT_CLIENT_ID = "dshos5iou44tuach7ta3ici5m";
const DEFAULT_REDIRECT_SIGNIN =
  "https://d7t9x3j66yd8k.cloudfront.net/finanzas/auth/callback.html";
const DEFAULT_REDIRECT_SIGNOUT =
  "https://d7t9x3j66yd8k.cloudfront.net/finanzas/";

/**
 * Get environment variable value, with optional fallback
 * Returns fallback (or empty string) if not set, allowing calling code to handle missing values.
 */
const getEnv = (key: string, fallback = ""): string =>
  (envSource?.[key] ?? fallback) as string;

/**
 * Get environment variable with regional fallback (safe for non-sensitive defaults)
 */
const getEnvWithRegionFallback = (key: string): string =>
  (envSource?.[key] ?? DEFAULT_REGION) as string;

const RESOLVED_API_BASE = HAS_API_BASE ? API_BASE : "";
const RESOLVED_CLOUDFRONT = getEnv(
  "VITE_CLOUDFRONT_URL",
  CANONICAL_COGNITO.cloudfrontUrl
);
const RESOLVED_CALLBACK = getEnv(
  "VITE_COGNITO_REDIRECT_SIGNIN",
  `${RESOLVED_CLOUDFRONT}${CANONICAL_COGNITO.callbackPath}`
);
const RESOLVED_SIGN_OUT = getEnv(
  "VITE_COGNITO_REDIRECT_SIGNOUT",
  `${RESOLVED_CLOUDFRONT}${CANONICAL_COGNITO.signOutPath}`
);
if (!HAS_API_BASE) {
  console.error("⚠️ VITE_API_BASE_URL is not configured.");
}

const aws = {
  aws_project_region: getEnvWithRegionFallback("VITE_AWS_REGION"),
  aws_cognito_region: getEnvWithRegionFallback("VITE_COGNITO_REGION"),

  aws_user_pools_id: getEnv(
    "VITE_COGNITO_USER_POOL_ID",
    CANONICAL_COGNITO.userPoolId
  ),
  aws_user_pools_web_client_id: getEnv(
    "VITE_COGNITO_CLIENT_ID",
    CANONICAL_COGNITO.clientId
  ),

  // Identity Pool is optional; include only if the browser must call AWS services directly
  aws_cognito_identity_pool_id: getEnv("VITE_COGNITO_IDENTITY_POOL_ID"),

  Auth: {
    region:
      getEnv("VITE_COGNITO_REGION") || getEnvWithRegionFallback("VITE_AWS_REGION"),
    userPoolId: getEnv("VITE_COGNITO_USER_POOL_ID", CANONICAL_COGNITO.userPoolId),
    userPoolWebClientId: getEnv(
      "VITE_COGNITO_CLIENT_ID",
      CANONICAL_COGNITO.clientId
    ),
    identityPoolId: getEnv("VITE_COGNITO_IDENTITY_POOL_ID"),
    authenticationFlowType: "USER_SRP_AUTH",
    mandatorySignIn: true,
  },

  oauth: {
    // Cognito domain should be set via VITE_COGNITO_DOMAIN
    // Format: <domain-prefix>.auth.<region>.amazoncognito.com
    // NOTE: The domain prefix is a free-form string (not auto-generated)
    domain: getEnv("VITE_COGNITO_DOMAIN", CANONICAL_COGNITO.domain),

    // OAuth scopes; must include "openid" for id_token
    scope: ["openid", "email", "profile", "aws.cognito.signin.user.admin"],

    // Redirects to FINANZAS module callback (not the PMO root)
    redirectSignIn: RESOLVED_CALLBACK,
    redirectSignOut: RESOLVED_SIGN_OUT,

    // ✅ CRITICAL: Implicit grant configuration (response_type=token)
    // 
    // Per AWS Cognito OAuth 2.0 docs:
    // https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
    //
    // When using response_type="token" (Implicit Flow):
    // - Cognito returns BOTH id_token AND access_token in the URL hash fragment
    // - Format: #id_token=...&access_token=...&token_type=Bearer&expires_in=...
    // - No backend token exchange needed (tokens delivered directly to browser)
    // - Requires "Implicit grant" to be enabled in the Cognito app client settings
    // - Scope MUST include "openid" for id_token to be issued
    //
    // IMPORTANT: AWS Cognito accepts response_type values:
    // - "token" (implicit grant - returns access_token and id_token when scope has openid)
    // - "code" (authorization code grant - returns authorization code for exchange)
    // - DO NOT use "token id_token" - this is NOT a valid AWS Cognito response_type
    //
    // Current configuration (Implicit Flow):
    // - response_type: "token" ✅
    // - scope: includes "openid" ✅
    // - Cognito app client: Implicit grant enabled ✅
    // - Result: Both id_token and access_token delivered in hash ✅
    //
    // Future migration path: Change to "code" + implement PKCE for enhanced security
    responseType: "token",
  },

  API: {
    REST: {
      FinanzasAPI: {
        endpoint: RESOLVED_API_BASE,
        region: getEnvWithRegionFallback("VITE_AWS_REGION"),
      },
    },
  },

  // Only needed if the Finanzas UI uploads to S3 directly
  Storage: {
    S3: {
      bucket: getEnv("VITE_S3_BUCKET"),
      region: getEnvWithRegionFallback("VITE_AWS_REGION"),
    },
  },
};

export const COGNITO_INTEGRATION_CHECKLIST = {
  domain: aws.oauth.domain,
  redirectSignIn: aws.oauth.redirectSignIn,
  redirectSignOut: aws.oauth.redirectSignOut,
  responseType: aws.oauth.responseType,
  scope: aws.oauth.scope,
  hasOpenIdScope: aws.oauth.scope.includes("openid"),
  isImplicitResponseType: aws.oauth.responseType === "token",
  hasAdminScope: aws.oauth.scope.includes("aws.cognito.signin.user.admin"),
};

/**
 * Helper function to initiate Cognito Hosted UI login.
 * Uses implicit grant flow (response_type="token") which delivers both
 * access_token and id_token directly in the URL hash fragment when scope
 * includes "openid". The callback.html page extracts and stores these tokens.
 */
export function loginWithHostedUI(): void {
  const { domain, scope, redirectSignIn, responseType } = aws.oauth;
  const { userPoolWebClientId } = aws.Auth;

  if (!domain) {
    console.error(
      "VITE_COGNITO_DOMAIN not configured. Cannot initiate Hosted UI login.",
    );
    return;
  }

  if (!userPoolWebClientId) {
    console.error(
      "VITE_COGNITO_CLIENT_ID not configured. Cannot initiate Hosted UI login.",
    );
    return;
  }

  if (!redirectSignIn) {
    console.error(
      "VITE_COGNITO_REDIRECT_SIGNIN not configured. Cannot initiate Hosted UI login.",
    );
    return;
  }

  const params = new URLSearchParams({
    client_id: userPoolWebClientId,
    response_type: responseType,
    scope: scope.join(" "),
    redirect_uri: redirectSignIn,
    lang: "es",
  });

  const hostedUIUrl = `https://${domain}/oauth2/authorize?${params.toString()}`;

  if (isDevEnv) {
    console.log("[loginWithHostedUI] Redirecting to Cognito Hosted UI:");
    console.log("  Domain:", domain);
    console.log("  Client ID:", userPoolWebClientId);
    console.log("  Response Type:", responseType);
    console.log("  Scope:", scope.join(" "));
    console.log("  Redirect URI:", redirectSignIn);
    console.log("  Full URL:", hostedUIUrl);
  }

  window.location.href = hostedUIUrl;
}

const COGNITO_STORAGE_PREFIX = "CognitoIdentityServiceProvider";

function clearLocalAuthState(clientId?: string): void {
  const removePrefixedKeys = (store: Storage) => {
    for (let i = store.length - 1; i >= 0; i -= 1) {
      const key = store.key(i);
      if (!key) continue;
      if (key.includes(COGNITO_STORAGE_PREFIX)) {
        if (!clientId || key.includes(clientId)) {
          store.removeItem(key);
        }
      }
      if (key === "amplify-signin-with-hostedUI") store.removeItem(key);
      if (key.endsWith("federatedInfo")) store.removeItem(key);
    }
  };

  // Clear local tokens first
  [localStorage, sessionStorage].forEach((store) => {
    store.removeItem("cv.jwt");
    store.removeItem("finz_jwt");
    store.removeItem("finz_refresh_token");
    store.removeItem("cv.module");
    store.removeItem("idToken");
    store.removeItem("cognitoIdToken");
    removePrefixedKeys(store);
  });
}

/**
 * Helper function to initiate Cognito Hosted UI logout
 */
export function logoutWithHostedUI(): void {
  const { domain, redirectSignOut } = aws.oauth;
  const { userPoolWebClientId } = aws.Auth;

  clearLocalAuthState(userPoolWebClientId);

  if (!domain || !userPoolWebClientId) {
    console.warn(
      "Cognito domain or client ID not configured. " +
        "Performing local logout only (Cognito session not cleared).",
    );
    window.location.href = "/finanzas/login";
    return;
  }

  if (!redirectSignOut) {
    console.warn(
      "VITE_COGNITO_REDIRECT_SIGNOUT not configured. Performing local logout only.",
    );
    window.location.href = "/finanzas/login";
    return;
  }

  const params = new URLSearchParams({
    client_id: userPoolWebClientId,
    logout_uri: redirectSignOut,
  });

  const logoutUrl = `https://${domain}/logout?${params.toString()}`;
  window.location.href = logoutUrl;
}

/**
 * Pre-flight configuration logging (dev mode only)
 */
if (isDevEnv) {
  console.log("[Cognito Config] Pre-flight check:");
  console.log("  Region:", aws.Auth.region);
  console.log("  User Pool ID:", aws.Auth.userPoolId || "⚠️ NOT SET");
  console.log("  App Client ID:", aws.Auth.userPoolWebClientId || "⚠️ NOT SET");
  console.log("  Cognito Domain:", aws.oauth.domain || "⚠️ NOT SET");
  console.log("  Redirect Sign In:", aws.oauth.redirectSignIn);
  console.log("  Redirect Sign Out:", aws.oauth.redirectSignOut);
  console.log("  Response Type:", aws.oauth.responseType);
  console.log("  Auth Flow:", aws.Auth.authenticationFlowType);

  if (!aws.Auth.userPoolId) {
    console.warn("⚠️  VITE_COGNITO_USER_POOL_ID is not set.");
  }
  if (!aws.Auth.userPoolWebClientId) {
    console.warn("⚠️  VITE_COGNITO_CLIENT_ID is not set.");
  } else if (aws.Auth.userPoolWebClientId.length < 20) {
    console.warn(
      "⚠️  App Client ID appears malformed. Should be around 26 characters.",
    );
  }
  if (!aws.oauth.domain) {
    console.warn(
      "⚠️  VITE_COGNITO_DOMAIN is not set. Should be: <domain-prefix>.auth.<region>.amazoncognito.com",
    );
  } else if (aws.oauth.domain.includes("_")) {
    console.warn(
      "⚠️  Cognito domain appears malformed. Should be: <domain-prefix>.auth.<region>.amazoncognito.com",
    );
  }
  if (!aws.oauth.redirectSignIn) {
    console.warn(
      "⚠️  VITE_COGNITO_REDIRECT_SIGNIN is not set. Hosted UI redirect will fail.",
    );
  } else if (
    !aws.oauth.redirectSignIn.includes("/finanzas/auth/callback.html")
  ) {
    console.warn(
      "⚠️  Redirect Sign In should point to /finanzas/auth/callback.html",
    );
  }

  if (!aws.oauth.redirectSignOut) {
    console.warn(
      "⚠️  VITE_COGNITO_REDIRECT_SIGNOUT is not set. Hosted UI logout redirect will fail.",
    );
  }
  if (aws.oauth.responseType !== "token") {
    console.error(
      "❌ oauth.responseType must be 'token' for implicit flow. Current:",
      aws.oauth.responseType,
    );
  }
  if (!aws.oauth.scope.includes("openid")) {
    console.error(
      "❌ oauth.scope must include 'openid' for Cognito to return id_token. Current scope:",
      aws.oauth.scope,
    );
  }
  if (!aws.oauth.scope.includes("aws.cognito.signin.user.admin")) {
    console.warn(
      "⚠️  oauth.scope should include 'aws.cognito.signin.user.admin' for full user management. Current scope:",
      aws.oauth.scope,
    );
  }
}

export default aws;
