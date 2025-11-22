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
    "⚠️ VITE_API_BASE_URL is not configured. Please set it in your .env file. See .env.example for reference."
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
    domain: getEnv("VITE_COGNITO_DOMAIN"),

    scope: ["openid", "email", "profile"], // Order as per R1 requirements
    // Redirects to FINANZAS module callback (not the PMO root)
    // For implicit flow: /finanzas/auth/callback.html
    // For code flow: /finanzas/ (or /finanzas/auth/callback for React route)
    redirectSignIn:
      (getEnv("VITE_CLOUDFRONT_URL") || "") + "/finanzas/auth/callback.html",
    redirectSignOut: (getEnv("VITE_CLOUDFRONT_URL") || "") + "/finanzas/",
    responseType: "token", // Use implicit flow for simplicity (token in hash fragment)
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

/**
 * Helper function to initiate Cognito Hosted UI login
 * Redirects user to Cognito login page, which redirects back to callback URL after auth
 */
export function loginWithHostedUI(): void {
  const { domain, scope, redirectSignIn, responseType } = aws.oauth;
  const { userPoolWebClientId } = aws.Auth;

  const params = new URLSearchParams({
    client_id: userPoolWebClientId,
    response_type: responseType,
    scope: scope.join(" "),
    redirect_uri: redirectSignIn,
  });

  const hostedUIUrl = `https://${domain}/login?${params.toString()}`;
  window.location.href = hostedUIUrl;
}

/**
 * Helper function to initiate Cognito Hosted UI logout
 * Clears tokens and redirects to Cognito logout endpoint
 */
export function logoutWithHostedUI(): void {
  const { domain, redirectSignOut } = aws.oauth;
  const { userPoolWebClientId } = aws.Auth;

  // Clear local tokens first
  localStorage.removeItem("cv.jwt");
  localStorage.removeItem("finz_jwt");
  localStorage.removeItem("finz_refresh_token");
  localStorage.removeItem("cv.module");

  const params = new URLSearchParams({
    client_id: userPoolWebClientId,
    logout_uri: redirectSignOut,
  });

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
      "⚠️  VITE_COGNITO_USER_POOL_ID is not set. Please configure in .env file. See .env.example for reference."
    );
  }
  if (!aws.Auth.userPoolWebClientId) {
    console.warn(
      "⚠️  VITE_COGNITO_CLIENT_ID is not set. Please configure in .env file. See .env.example for reference."
    );
  } else if (aws.Auth.userPoolWebClientId.length < 20) {
    console.warn(
      "⚠️  App Client ID appears malformed. Should be 26 characters."
    );
  }
  if (!aws.oauth.domain) {
    console.warn(
      "⚠️  VITE_COGNITO_DOMAIN is not set. Should be: <domain-prefix>.auth.<region>.amazoncognito.com. See .env.example for reference."
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
      "⚠️  VITE_CLOUDFRONT_URL is not set. OAuth redirects may not work correctly. See .env.example for reference."
    );
  }
}

export default aws;
