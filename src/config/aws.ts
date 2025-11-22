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

/**
 * Get environment variable value without fallback
 * Returns empty string if not set, allowing calling code to handle missing values
 */
const getEnv = (key: string): string => import.meta.env[key] || "";

/**
 * Get environment variable with regional fallback (safe for non-sensitive defaults)
 */
const getEnvWithRegionFallback = (key: string, defaultRegion: string = "us-east-2"): string =>
  import.meta.env[key] || defaultRegion;

const RESOLVED_API_BASE = HAS_API_BASE ? API_BASE : "";
if (!HAS_API_BASE) {
  console.error(
    "⚠️ VITE_API_BASE_URL is not configured."
  );
}

const aws = {
  aws_project_region: getEnvWithRegionFallback("VITE_AWS_REGION"),
  aws_cognito_region: getEnvWithRegionFallback("VITE_COGNITO_REGION"),

  aws_user_pools_id: getEnv("VITE_COGNITO_USER_POOL_ID"),
  aws_user_pools_web_client_id: getEnv("VITE_COGNITO_CLIENT_ID"),

  // Identity Pool is optional; include only if the browser must call AWS services directly
  // Set via VITE_COGNITO_IDENTITY_POOL_ID environment variable if needed
  aws_cognito_identity_pool_id: getEnv("VITE_COGNITO_IDENTITY_POOL_ID"),

  Auth: {
    region: getEnvWithRegionFallback("VITE_COGNITO_REGION"),
    userPoolId: getEnv("VITE_COGNITO_USER_POOL_ID"),
    userPoolWebClientId: getEnv("VITE_COGNITO_CLIENT_ID"),
    identityPoolId: getEnv("VITE_COGNITO_IDENTITY_POOL_ID"),
    authenticationFlowType: "USER_SRP_AUTH",
    mandatorySignIn: true,
  },

  oauth: {
    // Cognito domain should be set via VITE_COGNITO_DOMAIN environment variable
    // Format: <domain-prefix>.auth.<region>.amazoncognito.com
    // NOTE: The domain prefix is a free-form string (not auto-generated)
    // For this User Pool: us-east-2fyhltohiy (NO hyphen after region)
    domain: getEnv("VITE_COGNITO_DOMAIN"),

    // ✅ Scope configuration for OAuth 2.0 Implicit Grant
    // MUST include "openid" for Cognito to return id_token in the hash
    scope: ["openid", "email", "profile"],
    
    // Redirects to FINANZAS module callback (not the PMO root)
    redirectSignIn:
      (getEnv("VITE_CLOUDFRONT_URL") || "") + "/finanzas/auth/callback.html",
    redirectSignOut: (getEnv("VITE_CLOUDFRONT_URL") || "") + "/finanzas/",

    // ✅ CRITICAL: Implicit grant configuration (response_type=token)
    // 
    // Per AWS Cognito OAuth 2.0 docs:
    // https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
    //
    // When using response_type=token (Implicit Flow) with scope containing "openid":
    // - Cognito returns BOTH id_token AND access_token in the URL hash fragment
    // - Format: #id_token=...&access_token=...&token_type=Bearer&expires_in=...
    // - No backend token exchange needed (tokens delivered directly to browser)
    //
    // ⚠️ IMPORTANT: Do NOT use response_type="token id_token" - this is INVALID for Cognito
    // - Cognito only accepts "token" or "code" as valid response_type values
    // - Using "token id_token" will result in NO id_token being returned
    //
    // Current configuration (VALIDATED):
    // - response_type: "token" ✅
    // - scope: includes "openid" ✅
    // - Result: Both id_token and access_token delivered in hash ✅
    //
    // FUTURE: When we implement Authorization Code Flow with PKCE:
    // - Change to response_type="code"
    // - Implement token exchange endpoint (backend or client-side PKCE)
    // - Update callback.html to handle code instead of tokens
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

  // Only needed if the finance UI uploads to S3 directly
  // Set via VITE_S3_BUCKET environment variable
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
};

/**
 * Helper function to initiate Cognito Hosted UI login.
 * Uses implicit grant flow (response_type=token) which delivers both
 * access_token and id_token directly in the URL hash fragment. The callback.html
 * page extracts and stores these tokens.
 */
export function loginWithHostedUI(): void {
  const { domain, scope, redirectSignIn, responseType } = aws.oauth;
  const { userPoolWebClientId } = aws.Auth;

  if (!domain) {
    console.error("VITE_COGNITO_DOMAIN not configured. Cannot initiate Hosted UI login.");
    return;
  }

  if (!userPoolWebClientId) {
    console.error("VITE_COGNITO_CLIENT_ID not configured. Cannot initiate Hosted UI login.");
    return;
  }

  const params = new URLSearchParams({
    client_id: userPoolWebClientId,
    response_type: responseType,
    scope: scope.join(" "),
    redirect_uri: redirectSignIn,
  });

  // Use /oauth2/authorize endpoint (standard OAuth 2.0 endpoint)
  const hostedUIUrl = `https://${domain}/oauth2/authorize?${params.toString()}`;
  window.location.href = hostedUIUrl;
}

/**
 * Helper function to initiate Cognito Hosted UI logout
 * Clears local tokens and redirects to Cognito logout endpoint
 * This also clears the Cognito session server-side
 */
export function logoutWithHostedUI(): void {
  const { domain, redirectSignOut } = aws.oauth;
  const { userPoolWebClientId } = aws.Auth;

  // Clear local tokens first (always do this even if redirect fails)
  localStorage.removeItem("cv.jwt");
  localStorage.removeItem("finz_jwt");
  localStorage.removeItem("finz_refresh_token");
  localStorage.removeItem("cv.module");
  localStorage.removeItem("idToken");
  localStorage.removeItem("cognitoIdToken");

  // If domain or client ID not configured, fall back to local logout only
  if (!domain || !userPoolWebClientId) {
    console.warn(
      "Cognito domain or client ID not configured. " +
      "Performing local logout only (Cognito session not cleared)."
    );
    // Redirect to login page as fallback
    window.location.href = "/finanzas/login";
    return;
  }

  const params = new URLSearchParams({
    client_id: userPoolWebClientId,
    logout_uri: redirectSignOut,
  });

  // Use /logout endpoint to clear Cognito session
  const logoutUrl = `https://${domain}/logout?${params.toString()}`;
  window.location.href = logoutUrl;
}

/**
 * Pre-flight configuration logging (dev mode only)
 * Logs Cognito configuration to console for debugging
 */
if (import.meta.env.DEV) {
  console.log("[Cognito Config] Pre-flight check:");
  console.log("  Region:", aws.Auth.region);
  console.log("  User Pool ID:", aws.Auth.userPoolId || "⚠️ NOT SET");
  console.log("  App Client ID:", aws.Auth.userPoolWebClientId || "⚠️ NOT SET");
  console.log("  Cognito Domain:", aws.oauth.domain || "⚠️ NOT SET");
  console.log("  Redirect Sign In:", aws.oauth.redirectSignIn);
  console.log("  Redirect Sign Out:", aws.oauth.redirectSignOut);
  console.log("  Response Type:", aws.oauth.responseType);
  console.log("  Auth Flow:", aws.Auth.authenticationFlowType);

  // Validation warnings
  if (!aws.Auth.userPoolId) {
    console.warn(
      "⚠️  VITE_COGNITO_USER_POOL_ID is not set."
    );
  }
  if (!aws.Auth.userPoolWebClientId) {
    console.warn(
      "⚠️  VITE_COGNITO_CLIENT_ID is not set."
    );
  } else if (aws.Auth.userPoolWebClientId.length < 20) {
    console.warn(
      "⚠️  App Client ID appears malformed. Should be 26 characters."
    );
  }
  if (!aws.oauth.domain) {
    console.warn(
      "⚠️  VITE_COGNITO_DOMAIN is not set. Should be: <domain-prefix>.auth.<region>.amazoncognito.com"
    );
  } else if (aws.oauth.domain.includes("_")) {
    console.warn(
      "⚠️  Cognito domain appears malformed. Should be: <domain-prefix>.auth.<region>.amazoncognito.com"
    );
  }
  if (aws.oauth.redirectSignIn && !aws.oauth.redirectSignIn.includes("/finanzas/auth/callback.html")) {
    console.warn(
      "⚠️  Redirect Sign In should point to /finanzas/auth/callback.html"
    );
  }
  if (!getEnv("VITE_CLOUDFRONT_URL")) {
    console.warn(
      "⚠️  VITE_CLOUDFRONT_URL is not set. OAuth redirects may not work correctly."
    );
  }
  if (aws.oauth.responseType !== "token") {
    console.error(
      "❌ oauth.responseType must be 'token' for implicit flow. Current:",
      aws.oauth.responseType
    );
  }
  if (!aws.oauth.scope.includes("openid")) {
    console.error(
      "❌ oauth.scope must include 'openid' for Cognito to return id_token. Current scope:",
      aws.oauth.scope
    );
  }
}

export default aws;
