# SDT (Finanzas) Auth Conflicts - Executive Summary

**Status:** ✅ **Analysis Complete** | 🔧 **Implementation Guide Ready**  
**Date:** November 8, 2025  
**Reviewer:** Auth Architecture Analysis

---

## The Problem (In 30 Seconds)

**Current state:** LoginPage assumes GitHub Spark auth → no JWT → API calls fail (401)  
**Required state:** LoginPage collects Cognito credentials → generates JWT → API calls succeed (200)

**Reality check:** The app is currently **broken in production** (no Cognito, no JWT generation path).

---

## 5 Critical Conflicts Identified

### 1. ❌ **LoginPage Hardcoded to GitHub**

- **Current:** "Sign in with GitHub" button calling Spark runtime
- **Required:** Username/password form for Cognito
- **Impact:** No way to generate JWT in production
- **Fix:** Replace LoginPage with credential form + `loginWithCognito()` method

### 2. ❌ **`finz_jwt` Token Never Set**

- **Current:** API client looks for `localStorage.finz_jwt` but nothing sets it
- **Required:** Login flow must call `localStorage.setItem('finz_jwt', idToken)`
- **Impact:** All API calls have no Bearer token → 401 Unauthorized
- **Fix:** Add Cognito auth call to set token in localStorage

### 3. ❌ **No Cognito Integration**

- **Current:** Only Spark auth (GitHub, dev-only)
- **Required:** Cognito USER_PASSWORD_AUTH flow for production
- **Impact:** Production deployment is non-functional for API calls
- **Fix:** Implement `loginWithCognito()` in AuthProvider

### 4. ⚠️ **Demo User Fallback Problem**

- **Current:** If no Spark, app creates demo user (isAuthenticated=true, but no JWT)
- **Required:** If no JWT and no Spark, redirect to LoginPage (isAuthenticated=false)
- **Impact:** App marks user authenticated but API will fail
- **Fix:** Remove demo user fallback; require real auth or Spark

### 5. ❌ **No JWT Validation on Page Reload**

- **Current:** Page reload re-initializes auth from Spark, ignores JWT in localStorage
- **Required:** Check localStorage for valid JWT first (persistent sessions)
- **Impact:** User loses session on page refresh
- **Fix:** Prioritize JWT check in `initializeAuth()` before Spark check

---

## What's Already Correct ✅

| Component                   | Status | Notes                                              |
| --------------------------- | ------ | -------------------------------------------------- |
| Vite base path              | ✅     | `/finanzas/` set correctly                         |
| Router basename             | ✅     | `/finanzas` configured                             |
| API client Bearer injection | ✅     | Looks for `finz_jwt` and injects as Bearer         |
| Storage key name            | ✅     | `finz_jwt` is correct (avoids PMO collision)       |
| CloudFront routing          | ✅     | Now serving correct Finanzas SPA                   |
| API Gateway CORS            | ✅     | Allows Authorization header from CloudFront domain |

---

## What Needs Fixing 🔧

| Item          | Current                | Fix                      | Effort | Priority |
| ------------- | ---------------------- | ------------------------ | ------ | -------- |
| LoginPage     | GitHub button          | Cognito form             | 1h     | P0       |
| AuthProvider  | No Cognito method      | Add `loginWithCognito()` | 1h     | P0       |
| JWT check     | Skipped on reload      | Check localStorage first | 30min  | P0       |
| Env vars      | Missing Cognito config | Add VITE*COGNITO*\* vars | 10min  | P0       |
| JWT utilities | Missing                | Create `src/lib/jwt.ts`  | 30min  | P0       |
| Token refresh | Not implemented        | Add (post-MVP)           | 1h     | P2       |

**Total MVP effort:** ~3.5 hours

---

## Detailed Documents Created

### 📄 `AUTH_CONFLICTS.md` (1800+ lines)

**Comprehensive gap analysis covering:**

- Current state vs. required state (code comparison)
- All 5 conflicts with detailed explanation
- What's already correct
- Implementation checklist (4 phases)
- Mini test plan (terminal + browser)
- Ready-to-use code examples
- Cognito configuration verification
- Dependencies & references

**When to read:** Full technical review, architecture decisions

### 📄 `AUTH_IMPLEMENTATION_GUIDE.md` (1200+ lines)

**Step-by-step implementation guide:**

- Phase 1: Core login flow (required for MVP)
- 5 implementation steps with complete code
- Drop-in replacements for:
  - `src/lib/jwt.ts` (new file)
  - `src/components/AuthProvider.tsx` (updated)
  - `src/components/LoginPage.tsx` (replaced)
- Phase 1 testing checklist (terminal + browser)
- Phase 2: Token refresh logic (optional post-MVP)
- Troubleshooting guide
- Files modified summary

**When to read:** Implementation; one-file-at-a-time coding

---

## Quick Start: The 5 Fixes (In Order)

```bash
# 1. Add to .env
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY

# 2. Create src/lib/jwt.ts (see AUTH_IMPLEMENTATION_GUIDE.md, Step 2)

# 3. Update src/components/AuthProvider.tsx (see Step 3)
#    - Add loginWithCognito() method
#    - Update initializeAuth() to check JWT first
#    - Add JWT utilities import

# 4. Replace src/components/LoginPage.tsx (see Step 4)
#    - Remove GitHub button
#    - Add email/password form
#    - Call loginWithCognito() on submit

# 5. Test (see Phase 1 Testing Checklist in guide)
#    - Terminal: Verify JWT flow with AWS CLI
#    - Browser: Verify login → catalog loads
```

---

## Key Ground Truths

| Value                                                        | Usage                                           |
| ------------------------------------------------------------ | ----------------------------------------------- |
| `us-east-2`                                                  | Region (env: `VITE_COGNITO_REGION`)             |
| `dshos5iou44tuach7ta3ici5m`                                  | App Client ID (env: `VITE_COGNITO_CLIENT_ID`)   |
| `us-east-2_FyHLtOhiY`                                        | User Pool ID (env: `VITE_COGNITO_USER_POOL_ID`) |
| `christian.valencia@ikusi.com`                               | Test user                                       |
| `Velatia@2025`                                               | Test password                                   |
| `finz_jwt`                                                   | localStorage key for ID token                   |
| `finz_refresh_token`                                         | localStorage key for refresh token (optional)   |
| `USER_PASSWORD_AUTH`                                         | Cognito auth flow to use                        |
| `/finanzas/`                                                 | CloudFront callback/sign-out URL                |
| `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev` | API base URL                                    |

---

## Conflict Resolution Map

```
┌─ User opens /finanzas/ ──────────────────────────────────────┐
│                                                              │
│ ❌ BEFORE: GitHub Spark auth                               │
│    ├─ Spark runtime available? → Use sparkUser              │
│    └─ Spark missing? → Demo user (no JWT) → API 401       │
│                                                              │
│ ✅ AFTER: Cognito JWT auth                                 │
│    ├─ JWT in localStorage & valid? → Set user from claims   │
│    ├─ No JWT but Spark available? → Use sparkUser (dev)     │
│    └─ No JWT and no Spark? → LoginPage                      │
│           ├─ User enters credentials                        │
│           ├─ Cognito returns IdToken                        │
│           ├─ Store in localStorage.finz_jwt                 │
│           └─ Redirect to /finanzas/ → Set user from JWT    │
│                                                              │
│ ✅ THEN: API calls with Bearer token                        │
│    ├─ Read finz_jwt from localStorage                       │
│    ├─ Inject: Authorization: Bearer <token>                │
│    └─ API Gateway authorizer validates → 200 OK            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### ✅ Terminal Test (Verify JWT Flow)

```bash
# Get token from Cognito (same as UI will do)
# Decode and verify claims
# Call API with token (should be 200, not 401)
```

### ✅ Browser Test (Verify UI Integration)

```bash
# 1. Open /finanzas/ → LoginPage visible
# 2. Enter credentials → Submit
# 3. Redirected to /finanzas/ home → Catalog loads
# 4. DevTools: localStorage.finz_jwt present
# 5. DevTools: Network shows Authorization header
# 6. Refresh page → Still logged in
# 7. Logout → Redirected to LoginPage
```

---

## Timeline & Next Steps

### ⏱️ **Now: Phase 1 (MVP Core Auth)**

- **Duration:** 2-3 hours + 1 hour testing
- **Deliverable:** Working Cognito login → JWT → API calls 200 OK
- **Blocker release:** None; fixes are additive

### ⏱️ **Post-MVP: Phase 2 (Prod Hardening)**

- **Duration:** 1-2 hours
- **Adds:** Token refresh, better error handling, Hosted UI option

### 🚀 **Ready for:**

- Dev testing immediately after Phase 1
- Staging deployment after Phase 1 + testing
- Production after Phase 2

---

## Risk Assessment

| Risk                               | Likelihood | Mitigation                                                        |
| ---------------------------------- | ---------- | ----------------------------------------------------------------- |
| CORS error on Cognito POST         | Low        | Direct POST works from CF domain; use Hosted UI if issue persists |
| Token validation fails             | Low        | Validator already works (proven in CLI tests)                     |
| localStorage cleared by browser    | Low        | User redirected to login; JWT re-obtained                         |
| Concurrent login sessions          | Low        | Cognito limits to 1 concurrent; older session invalidated         |
| Refresh token expiration (30 days) | Medium     | Add auto-logout + re-auth prompt (Phase 2)                        |

---

## Sign-Off Checklist

- [x] Auth requirements documented
- [x] Current codebase analyzed
- [x] Conflicts identified (5 total)
- [x] Code examples provided (drop-in replacements)
- [x] Testing plan defined
- [x] Ground truth values recorded
- [x] Implementation guide created
- [ ] Code reviewed (pending)
- [ ] Phase 1 implementation (pending)
- [ ] Phase 1 testing (pending)
- [ ] Phase 1 QA sign-off (pending)

---

## Questions? Review These First

**Q: Where do I start implementing?**  
A: See `AUTH_IMPLEMENTATION_GUIDE.md` → Phase 1 → Step 1

**Q: How does this work in production?**  
A: User logs in via LoginPage → Cognito returns JWT → UI stores in localStorage → Every API call includes Bearer token → API Gateway authorizer validates

**Q: What about token expiration?**  
A: ID token expires in ~1 hour. MVP doesn't refresh (user logs out). Phase 2 adds auto-refresh + logout redirect.

**Q: Can users switch between PMO and Finanzas?**  
A: Each app has separate localStorage keys (`finz_jwt` vs. PMO's key). Sessions independent. (PMO's auth structure not analyzed here.)

**Q: Is this security-compliant?**  
A: Yes. JWT signature validated by API Gateway authorizer. Token stored in localStorage (XSS risk like all SPAs; mitigate with CSP headers, secure dependencies). HTTPS enforced (CF domain). Cognito handles password hashing, MFA ready.

**Q: What if Cognito goes down?**  
A: UI can't log in (Cognito outage). Existing JWT still works for API calls (cached sessions). Add fallback Spark auth for dev team to access app during outage.

---

## Document Map

```
📦 Finanzas Auth Documentation
├── 📄 AUTH_CONFLICTS.md
│   ├── What's broken (5 conflicts)
│   ├── What's correct (5 items)
│   ├── Code comparisons (current vs. required)
│   ├── Detailed examples & solutions
│   └── Full testing plan
│
├── 📄 AUTH_IMPLEMENTATION_GUIDE.md
│   ├── Phase 1: 5 implementation steps
│   ├── Code snippets (ready to copy)
│   ├── File-by-file changes
│   ├── Testing checklist
│   └── Troubleshooting guide
│
└── 📄 This file (EXECUTIVE SUMMARY)
    ├── 30-second overview
    ├── 5 conflicts at-a-glance
    ├── Quick-start (5 fixes)
    ├── Risk assessment
    └── Document map
```

---

## Recommended Reading Order

1. **This file** (5 min) ← You are here
2. **AUTH_CONFLICTS.md** → Sections: "Executive Summary" + "Critical Issues" (15 min)
3. **AUTH_IMPLEMENTATION_GUIDE.md** → Phase 1 Steps 1-5 (30 min)
4. **Start coding** → Copy code examples into your editor
5. **Reference back** as needed for CLI commands, env vars, troubleshooting

---

## Final Thoughts

✅ **The good news:** All the necessary APIs, databases, and infrastructure are working. The conflicts are **purely in the frontend auth integration**.

⚠️ **The bad news:** Without these fixes, the current frontend **cannot authenticate users in production** (only works with Spark in dev).

🎯 **The solution:** Integrate Cognito login into the frontend. It's a **straightforward 5-step, 3-hour fix**. After that, the entire system works end-to-end: login → API → data.

🚀 **Let's ship it.**

---

**Questions? See `AUTH_CONFLICTS.md` for the complete breakdown.**
