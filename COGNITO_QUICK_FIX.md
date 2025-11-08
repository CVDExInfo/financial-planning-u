# Cognito Configuration – Quick Checklist

**Problem:** "Login pages unavailable" when accessing Hosted UI link

**Solution:** Enable these settings in AWS Cognito Console

---

## 5-Minute Checklist

Go to: https://console.aws.amazon.com/cognito/ → User pools → `us-east-2_FyHLtOhiY` → App clients → `dshos5iou44tuach7ta3ici5m`

### Authentication Flows Configuration

- [ ] ✅ User password-based authentication (ALLOW_USER_PASSWORD_AUTH)
- [ ] ✅ Allow refresh token based authentication (ALLOW_REFRESH_TOKEN_AUTH)
- [ ] ✅ Allow implicit OAuth authFlow (ALLOW_IMPLICIT_OAUTH_AUTH_FLOW)

### Hosted UI Settings – Callback URLs

Add all three:

- [ ] `https://d7t9x3j66yd8k.cloudfront.net/auth/callback.html`
- [ ] `https://d7t9x3j66yd8k.cloudfront.net/finanzas/`
- [ ] `https://d7t9x3j66yd8k.cloudfront.net/`

### OAuth 2.0 Settings – Flows

- [ ] ✅ Implicit code
- [ ] ✅ Authorization code

### OAuth 2.0 Settings – Scopes

- [ ] ✅ openid
- [ ] ✅ email
- [ ] ✅ profile

### Save

- [ ] Click **"Save changes"** button at bottom
- [ ] Wait 1–2 minutes for propagation

---

## Test the Hosted UI

Paste this into browser (incognito window recommended):

```
https://us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com/login?client_id=dshos5iou44tuach7ta3ici5m&response_type=token&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fd7t9x3j66yd8k.cloudfront.net%2Fauth%2Fcallback.html
```

**Expected:** Login form appears → Enter credentials → Redirected to Finanzas app

---

## If Still Failing

1. Clear browser cache (`Cmd+Shift+Delete`)
2. Wait 2 minutes
3. Try again
4. Check troubleshooting in `COGNITO_HOSTED_UI_CONFIG.md`
