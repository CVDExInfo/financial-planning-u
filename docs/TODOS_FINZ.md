# Finanzas SD – Ship List

## P0 (blockers)

- [x] FE: Centralize http client; remove silent mock fallback when `VITE_USE_MOCKS=false` ✅
- [x] FE: Atomic ProjectContext; no blank projectId; guards on all fetchers ✅
- [x] FE: Map endpoints → `/plan/forecast`, `/prefacturas`, `/projects/<id>/rubros` ✅
- [x] FE: Tier selection → POST `/projects/<id>/rubros` + invalidate line-items ✅
- [x] FE: Replace avatar with Ikusi logo; gate demo creds by `VITE_SHOW_DEMO_CREDS` ✅
- [x] API: CORS headers for success + error paths ✅
- [x] API: Implement/align forecast + prefacturas handlers ✅
- [x] API: Seeds for `P-c1d76e28`, `P-5ae50ace`, `P-75596c6c`, `P-546370be` ✅
- [x] Infra: API deploy preflight (stack status) ✅
- [x] QA: Update Postman – projects flexible shape; add forecast & prefacturas tests ✅

## P1 (should fix)

- [ ] DTO mappers (Project/Rubro/Invoice) – normalized fields
- [ ] Abort in‑flight fetches on project switch

## P2 (polish)

- [x] `/health` exposes `env` + `version` and is asserted in QA ✅
- [ ] Error banner when API fails (only when mocks=false)

## Deployment Status

**✅ PRODUCTION DEPLOYED:** November 17, 2025

- API Gateway: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`
- All endpoints deployed successfully
- CORS headers configured
- Mock data removed from production build
- Frontend using production API endpoints only
