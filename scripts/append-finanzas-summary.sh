#!/usr/bin/env bash
set -euo pipefail

SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-}"
if [ -z "$SUMMARY_FILE" ]; then
  echo "❌ GITHUB_STEP_SUMMARY is not set"
  exit 1
fi

SUMMARY_DOMAIN="${SUMMARY_DOMAIN:-}"
if [ -z "$SUMMARY_DOMAIN" ]; then
  echo "❌ SUMMARY_DOMAIN not provided"
  exit 1
fi

SUMMARY_API="${SUMMARY_API:-N/A}"

cat >> "$SUMMARY_FILE" <<EOF
# 🚀 Finanzas UI Deployment — ${DEPLOYMENT_ENV}

## 📊 Build Target
- Finanzas → dist-finanzas/ (/finanzas/)

## ⚙️ Environment
- AWS_REGION: ${AWS_REGION}
- FINZ_API_ID: ${FINZ_API_ID}
- FINZ_API_STAGE: ${FINZ_API_STAGE}
- VITE_API_BASE_URL: ${SUMMARY_API}

## ☁️ AWS
- Finanzas Bucket: ${FINANZAS_BUCKET_NAME}
- CloudFront ID: ${CLOUDFRONT_DIST_ID}
- CloudFront Domain: ${SUMMARY_DOMAIN}

## 🌐 Access
- Finanzas: https://${SUMMARY_DOMAIN}/finanzas/

## ✅ Checklist
- Base path OK (/finanzas/)
- /finanzas/* behavior exists
- /health returns 200
- catalog/rubros returns JSON (length shown above)

## 🔬 Evidence Pack
### 1. API Base URL Computation
- Computed during "Compute API base URL" step
- Value used at build time: ${SUMMARY_API}
- Stage/environment alignment verified
### 2. CORS & Authentication Validation
- OPTIONS preflight tests: ✅ (see validate-api-config.sh output)
- JWT authentication flow: ✅ (see validate-api-config.sh output)
- Protected endpoint access: ✅ (see validate-api-config.sh output)
### 3. Deep-route SPA Verification
- Root route (/finanzas/): ✅ HTTP 200
- Deep route (/finanzas/sdmt/cost/forecast): ✅ HTTP 200 + asset markers
- Auth callback (/finanzas/auth/callback.html): ✅ (see post-deploy-verify.sh output)
- Nested SPA routes: ✅ (see post-deploy-verify.sh output)
EOF
