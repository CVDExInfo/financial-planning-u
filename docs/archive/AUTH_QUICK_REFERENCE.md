# SDT Auth Conflicts - Quick Reference Card

## 🎯 TL;DR

| What      | Current                | Fix                      | Time     |
| --------- | ---------------------- | ------------------------ | -------- |
| Login     | GitHub button (broken) | Cognito form             | 1h       |
| JWT       | Never set (401 errors) | Set in localStorage      | 1h       |
| Auth      | No Cognito method      | Add `loginWithCognito()` | 1h       |
| Reload    | Loses session          | Check localStorage first | 30min    |
| Env       | Missing Cognito config | Add 3 env vars           | 10min    |
| **TOTAL** | ❌ Broken              | ✅ Working API           | **3.5h** |

---

## 🔴 5 Critical Conflicts

**1. LoginPage** → GitHub button, not Cognito form  
**2. JWT Storage** → `finz_jwt` never populated  
**3. Cognito** → No integration at all  
**4. Demo User** → Created even without JWT  
**5. Session** → Lost on page reload

---

## 🟢 5 Quick Fixes

```bash
# 1. Add env vars
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY

# 2-4. Update 3 files (see AUTH_IMPLEMENTATION_GUIDE.md)
src/lib/jwt.ts              # NEW
src/components/AuthProvider.tsx    # UPDATE
src/components/LoginPage.tsx       # REPLACE

# 5. Test
npm run dev                 # Check LoginPage shows form
curl + JWT test            # Verify API calls work
```

---

## 📋 Implementation Checklist

- [ ] Read AUTH_CONFLICTS.md (15 min)
- [ ] Read AUTH_IMPLEMENTATION_GUIDE.md Phase 1 (30 min)
- [ ] Create src/lib/jwt.ts (copy from guide)
- [ ] Update AuthProvider.tsx (copy from guide)
- [ ] Replace LoginPage.tsx (copy from guide)
- [ ] Add env vars to .env
- [ ] npm run dev → Test login form appears
- [ ] Terminal test: Verify JWT flow with AWS CLI
- [ ] Browser test: Login → Catalog loads → Refresh still logged in
- [ ] Commit & deploy

---

## 🧪 Quick Test Commands

```bash
# Terminal: Verify JWT works
USERNAME="christian.valencia@ikusi.com"
PASSWORD="Velatia@2025"
ID_TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id dshos5iou44tuach7ta3ici5m \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  --query 'AuthenticationResult.IdToken' --output text)
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/health

# Browser: Open and test UI
open https://d7t9x3j66yd8k.cloudfront.net/finanzas/
# Should see LoginPage with email/password inputs
# Enter: christian.valencia@ikusi.com / Velatia@2025
# Should redirect to catalog
# Refresh page → Should stay logged in
```

---

## 🔑 Key Values (Copy-Paste)

```
Region: us-east-2
Client ID: dshos5iou44tuach7ta3ici5m
User Pool ID: us-east-2_FyHLtOhiY

Test Email: christian.valencia@ikusi.com
Test Password: Velatia@2025

Storage Key: finz_jwt
Auth Flow: USER_PASSWORD_AUTH
Callback URL: https://d7t9x3j66yd8k.cloudfront.net/finanzas/
API Base: https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
```

---

## ✅ What's Already Right

- ✅ Vite base path: `/finanzas/`
- ✅ Router basename: `/finanzas`
- ✅ API client Bearer injection
- ✅ Storage key name
- ✅ CloudFront routing
- ✅ CORS headers

---

## 📚 Three Documents

1. **AUTH_EXECUTIVE_SUMMARY.md** ← Overview (this file)
2. **AUTH_CONFLICTS.md** ← Deep analysis (1800+ lines)
3. **AUTH_IMPLEMENTATION_GUIDE.md** ← Step-by-step code (1200+ lines)

**Start with:** #2, then #3 for coding

---

## 🚀 Success Criteria

- [ ] LoginPage shows credential form (not GitHub button)
- [ ] Can enter email/password
- [ ] Button says "Sign In"
- [ ] After sign in: redirected to home (catalog loads)
- [ ] DevTools → LocalStorage → `finz_jwt` present
- [ ] DevTools → Network → Authorization header present on API calls
- [ ] API responses: 200 OK (not 401)
- [ ] Refresh page → Still logged in
- [ ] Sign out clears token + redirects to LoginPage

---

## ⏱️ Timeline

- **Now:** Analysis complete ✅
- **Phase 1 (2-3h):** Implement core login
- **Phase 1 Test (1h):** Terminal + browser verification
- **Phase 2 (post-MVP):** Add token refresh, Hosted UI
- **Deployment:** Ready after Phase 1 + testing

---

## ❓ FAQ

**Q: Is the API working?**  
A: Yes, but only with manually obtained JWT (CLI tests pass). Frontend just never gets one.

**Q: Why was it broken in the first place?**  
A: Assumed Spark runtime would always be available. Never needed real auth before.

**Q: Can I use Hosted UI instead?**  
A: Yes, post-MVP. For now, direct API call works fine from CloudFront domain.

**Q: What about token expiration?**  
A: MVP: User logs out after 1 hour. Phase 2: Add auto-refresh.

**Q: Is this production-ready?**  
A: After Phase 1 + testing, yes. Phase 2 adds nice-to-haves (token refresh, better UX).

---

## 🔧 Troubleshooting

| Error                        | Cause                        | Fix                                  |
| ---------------------------- | ---------------------------- | ------------------------------------ |
| 401 Unauthorized             | No JWT in request            | Check `finz_jwt` in localStorage     |
| Login fails                  | Invalid credentials          | Verify user exists & password set    |
| No ID token                  | Auth flow disabled           | Enable USER_PASSWORD_AUTH in Cognito |
| Page loses session on reload | No JWT check                 | Update initializeAuth()              |
| CORS error                   | Missing Authorization header | Verify API allows it (already done)  |

---

## 📞 Get Help

1. Check **AUTH_CONFLICTS.md** → "Detailed Conflict Resolution"
2. Check **AUTH_IMPLEMENTATION_GUIDE.md** → "Troubleshooting"
3. Run terminal test to verify Cognito flow
4. Check browser DevTools → Console for errors
