/**
 * AWS Cognito and API configuration for Finanzas module
 * 
 * This configuration enables Cognito authentication for the Finanzas (SDT) module
 * and ensures proper separation from the PMO module authentication flow.
 * 
 * NOTE: This file should be imported and used only by the Finanzas module.
 * Do NOT create a global aws-exports.js in the root to avoid cross-app confusion.
 */

const aws = {
  aws_project_region: 'us-east-2',
  aws_cognito_region: 'us-east-2',

  aws_user_pools_id: 'us-east-2_FyHLtOhiY',
  aws_user_pools_web_client_id: 'dshos5iou44tuach7ta3ici5m',

  // Identity Pool is optional; include only if the browser must call AWS services directly
  aws_cognito_identity_pool_id: 'us-east-2:1d50fa9e-c72f-4a3d-acfd-7b36ea065f35',

  Auth: {
    region: 'us-east-2',
    userPoolId: 'us-east-2_FyHLtOhiY',
    userPoolWebClientId: 'dshos5iou44tuach7ta3ici5m',
    identityPoolId: 'us-east-2:1d50fa9e-c72f-4a3d-acfd-7b36ea065f35',
    authenticationFlowType: 'USER_SRP_AUTH',
    mandatorySignIn: true
  },

  oauth: {
    domain: 'us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com',
    scope: ['email', 'openid', 'profile'],
    // Redirects to FINANZAS module (not the PMO root)
    redirectSignIn: 'https://d7t9x3j66yd8k.cloudfront.net/finanzas/',
    redirectSignOut: 'https://d7t9x3j66yd8k.cloudfront.net/finanzas/',
    responseType: 'code'
  },

  API: {
    REST: {
      FinanzasAPI: {
        endpoint: 'https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev',
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

export default aws;
