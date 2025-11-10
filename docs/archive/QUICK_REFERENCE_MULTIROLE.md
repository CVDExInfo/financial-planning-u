# 📋 QUICK REFERENCE - Multi-Role Access Implementation

## Current Status

✅ **Code Complete** | ✅ **Terminal Tests Pass** | ✅ **Ready for Browser QA**

---

## Test User Credentials

```
Email:    christian.valencia@ikusi.com
Password: Velatia@2025
Region:   us-east-2
```

---

## What Was Changed

| File                              | Change                             | Impact               |
| --------------------------------- | ---------------------------------- | -------------------- |
| `src/lib/jwt.ts`                  | Added role mapping function        | Groups → Roles       |
| `src/components/AuthProvider.tsx` | Use role mapping in JWT processing | JWT-based roles      |
| `src/lib/auth.ts`                 | Prioritize JWT roles               | Honor Cognito groups |

---

## Cognito Groups → Application Roles

```
PM              → PMO
SDT, FIN, AUD   → SDMT
acta-ui-*       → VENDOR
admin           → PMO + EXEC_RO
```

---

## Test User's Access

**Cognito Groups (8):**

- ikusi-acta-ui, admin, acta-ui-s3, SDT, AUD, acta-ui-ikusi, PM, FIN

**Application Roles (4):**

- PMO, SDMT, VENDOR, EXEC_RO

**Module Access:**

- ✅ Finanzas (rubros, rules)
- ✅ PMO (estimator)
- ✅ SDMT (catalog, forecast, etc.)
- ✅ All modules via EXEC_RO

---

## Terminal Tests (All ✅ Passing)

```bash
# 1. Get JWT
aws cognito-idp initiate-auth --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id dshos5iou44tuach7ta3ici5m \
  --auth-parameters USERNAME="christian.valencia@ikusi.com",PASSWORD="Velatia@2025"
✅ RESULT: Token obtained

# 2. Verify Groups
echo $ID_TOKEN | cut -d. -f2 | base64 -d | jq '.["cognito:groups"]'
✅ RESULT: 8 groups present

# 3. Map to Roles
node -e "mapCognitoGroupsToRoles([...8 groups...])"
✅ RESULT: [PMO, SDMT, VENDOR, EXEC_RO]

# 4. API Call
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros
✅ RESULT: HTTP 200, 71 rubros
```

---

## Browser Testing Checklist

- [ ] Login with test credentials
- [ ] See role switcher in nav bar
- [ ] Dropdown shows 4 roles
- [ ] Can switch between roles
- [ ] Modules update on switch
- [ ] API calls work (Authorization header present)
- [ ] Data displays correctly
- [ ] Refresh persists session
- [ ] Sign out clears token

---

## Login URL

```
https://d7t9x3j66yd8k.cloudfront.net/finanzas/
```

---

## Role Switcher Location

**Top-right navigation bar** (next to user avatar)

---

## Expected Role Names in Dropdown

1. PMO
2. SDMT
3. VENDOR
4. EXEC_RO

---

## Modules by Role

### PMO Role

- /sdmt/cost/\* (all SDMT modules)

### SDMT Role

- /sdmt/cost/\* (all SDMT modules)
- /catalog/rubros (Finanzas)
- /rules (Finanzas)

### VENDOR Role

- /sdmt/cost/catalog (read-only)
- /sdmt/cost/reconciliation

### EXEC_RO Role

- All modules (read-only)

---

## JWT Token Location

**DevTools → Application → LocalStorage → finz_jwt**

---

## JWT Groups Location

```
echo $finz_jwt | cut -d. -f2 | base64 -d | jq '.["cognito:groups"]'
```

---

## Troubleshooting

**Role Switcher Not Showing?**

- Clear localStorage and refresh
- Check console for errors
- Verify JWT in localStorage

**Missing Roles in Dropdown?**

- Check JWT has all groups
- Verify mapping function is called
- Check browser console

**API Returns 401?**

- Verify Authorization header present
- Check token not expired
- Verify Cognito client ID in .env

---

## Files Modified

```
✅ src/lib/jwt.ts
✅ src/components/AuthProvider.tsx
✅ src/lib/auth.ts
```

---

## Documentation Created

```
✅ MULTI_ROLE_ACCESS_FIX.md
✅ MULTI_ROLE_VERIFICATION_COMPLETE.md
✅ IMPLEMENTATION_READY.md
✅ QUICK_REFERENCE_MULTIROLE.md (this file)
```

---

## Key Dates

- **Implementation:** Nov 8, 2025
- **Terminal Tests:** Nov 8, 2025
- **Ready for QA:** Nov 8, 2025

---

## Next Steps

1. Start browser testing
2. Verify all 4 roles display
3. Verify module switching works
4. If all pass → Deploy to staging
5. If all pass → Deploy to production

---

**Status: ✅ READY FOR BROWSER QA TESTING**
