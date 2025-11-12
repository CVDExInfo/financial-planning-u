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

const getEnv = (key: string, fallback: string) =>
  import.meta.env[key] || fallback;

const aws = {
  aws_project_region: 'us-east-2',
  aws_cognito_region: getEnv('VITE_COGNITO_REGION', 'us-east-2'),

  aws_user_pools_id: getEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-2_FyHLtOhiY'),
  aws_user_pools_web_client_id: getEnv('VITE_COGNITO_CLIENT_ID', 'dshos5iou44tuach7ta3ici5m'),

  // Identity Pool is optional; include only if the browser must call AWS services directly
  aws_cognito_identity_pool_id: 'us-east-2:1d50fa9e-c72f-4a3d-acfd-7b36ea065f35',

  Auth: {
    region: getEnv('VITE_COGNITO_REGION', 'us-east-2'),
    userPoolId: getEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-2_FyHLtOhiY'),
    userPoolWebClientId: getEnv('VITE_COGNITO_CLIENT_ID', 'dshos5iou44tuach7ta3ici5m'),
    identityPoolId: 'us-east-2:1d50fa9e-c72f-4a3d-acfd-7b36ea065f35',
    authenticationFlowType: 'USER_SRP_AUTH',
    mandatorySignIn: true
  },

  oauth: {
    // FIXED: Added missing hyphen in domain (us-east-2-fyhltohiy)
    domain: getEnv('VITE_COGNITO_DOMAIN', 'us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com'),
    scope: ['email', 'openid', 'profile'],
    // Redirects to FINANZAS module callback (not the PMO root)
    // For implicit flow: /finanzas/auth/callback.html
    // For code flow: /finanzas/ (or /finanzas/auth/callback for React route)
    redirectSignIn: getEnv('VITE_CLOUDFRONT_URL', 'https://d7t9x3j66yd8k.cloudfront.net') + '/finanzas/auth/callback.html',
    redirectSignOut: getEnv('VITE_CLOUDFRONT_URL', 'https://d7t9x3j66yd8k.cloudfront.net') + '/finanzas/',
    responseType: 'token', // Use implicit flow for simplicity (token in hash fragment)
  },

  API: {
    REST: {
      FinanzasAPI: {
        endpoint: getEnv('VITE_API_BASE_URL', 'https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev'),
        region: 'us-east-2'
      }
    }
  },

  // Only needed if the finance UI uploads to S3 directly
  Storage: {
    S3: {
      bucket: 'ukusi-ui-finanzas-prod',
      region: 'us-east-2'
    }
  }
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
    scope: scope.join(' '),
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
  console.log('[Cognito Config] Pre-flight check:');
  console.log('  Region:', aws.Auth.region);
  console.log('  User Pool ID:', aws.Auth.userPoolId);
  console.log('  App Client ID:', aws.Auth.userPoolWebClientId);
  console.log('  Cognito Domain:', aws.oauth.domain);
  console.log('  Redirect Sign In:', aws.oauth.redirectSignIn);
  console.log('  Redirect Sign Out:', aws.oauth.redirectSignOut);
  console.log('  Response Type:', aws.oauth.responseType);
  console.log('  Auth Flow:', aws.Auth.authenticationFlowType);
  
  // Validation warnings
  if (!aws.oauth.domain || aws.oauth.domain.includes('_')) {
    console.warn('⚠️  Cognito domain appears malformed. Should be: <domain-prefix>.auth.<region>.amazoncognito.com');
  }
  if (!aws.Auth.userPoolWebClientId || aws.Auth.userPoolWebClientId.length < 20) {
    console.warn('⚠️  App Client ID appears malformed. Should be 26 characters.');
  }
  if (!aws.oauth.redirectSignIn.includes('/finanzas/auth/callback.html')) {
    console.warn('⚠️  Redirect Sign In should point to /finanzas/auth/callback.html');
  }
}

export default aws;
