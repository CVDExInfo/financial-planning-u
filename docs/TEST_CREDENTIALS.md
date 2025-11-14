# Getting Test Credentials for Finanzas

This guide explains how to obtain and use test credentials for the Finanzas SD module testing.

## 🔐 Credential Sources

### 1. GitHub Secrets (For CI/CD)

The repository has test credentials stored as GitHub secrets:

- `secrets.USERNAME` - Cognito test user username
- `secrets.PASSWORD` - Cognito test user password

**Access**: Only available to repository maintainers and GitHub Actions workflows.

**Usage in GitHub Actions**:

```yaml
- name: Run tests
  env:
    USERNAME: ${{ secrets.USERNAME }}
    PASSWORD: ${{ secrets.PASSWORD }}
  run: ./scripts/manual-test-finanzas.sh
```

---

### 2. Local Development (Request from Team Lead)

If you need to run tests locally, request credentials from your team lead or DevOps engineer.

**How to request**:

1. Contact repository maintainer
2. Explain you need test credentials for local Finanzas testing
3. They will provide:
   - Cognito username
   - Temporary password
   - Cognito Pool ID
   - Cognito Client ID

**Store securely**:

```bash
# Option A: In your shell profile (~/.bashrc or ~/.zshrc)
export FINANZAS_TEST_USER="provided-username"
export FINANZAS_TEST_PASS="provided-password"

# Option B: In a local .env file (NOT committed to git)
echo "USERNAME=provided-username" >> .env.local.secret
echo "PASSWORD=provided-password" >> .env.local.secret
```

---

### 3. Create Your Own Test User (AWS Admin)

If you have AWS Cognito admin access, create a test user:

**Step 1: Create User in Cognito**

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username finanzas-test-$(whoami) \
  --user-attributes \
    Name=email,Value=your-email@example.com \
    Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

**Step 2: Set Permanent Password**

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username finanzas-test-$(whoami) \
  --password "YourSecurePassword123!" \
  --permanent
```

**Step 3: Add User to Finanzas Group**

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username finanzas-test-$(whoami) \
  --group-name Finanzas
```

**Step 4: Verify User**

```bash
aws cognito-idp admin-get-user \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username finanzas-test-$(whoami)
```

---

## 🚀 Using Credentials for Testing

### Method 1: Quick Test Runner (Recommended)

```bash
# Set credentials once
export USERNAME="your-cognito-username"
export PASSWORD="your-password"

# Run interactive test menu
./scripts/run-tests.sh
```

The interactive menu will:

- Verify credentials are set
- Let you choose what to test
- Run tests automatically

---

### Method 2: Direct Script Execution

```bash
# Run full test suite
USERNAME="your-username" \
PASSWORD="your-password" \
./scripts/manual-test-finanzas.sh
```

---

### Method 3: Browser Test Helper

```bash
# Start dev server
npm run dev

# In another terminal, get a JWT token
TOKEN=$(aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id dshos5iou44tuach7ta3ici5m \
  --auth-parameters "USERNAME=your-username,PASSWORD=your-password" \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Open browser test helper
# http://localhost:5173/test-helper.html

# In browser console:
localStorage.setItem('cv.jwt', 'paste-token-here')

# Then use the interactive test interface
```

---

## 🔍 Verifying Credentials

Test if your credentials work:

```bash
# Quick test
aws cognito-idp initiate-auth \
  --region us-east-2 \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id dshos5iou44tuach7ta3ici5m \
  --auth-parameters "USERNAME=your-username,PASSWORD=your-password" \
  --query 'AuthenticationResult.IdToken' \
  --output text
```

**Expected**: Should output a long JWT token string.

**If it fails**:

- ❌ "Incorrect username or password" - Wrong credentials
- ❌ "User does not exist" - User not created in pool
- ❌ "NotAuthorizedException" - Check user status and password

---

## 🐛 Troubleshooting

### "NotAuthorizedException: Incorrect username or password"

**Causes**:

1. Wrong username or password
2. User doesn't exist in the pool
3. User is in FORCE_CHANGE_PASSWORD status

**Solutions**:

```bash
# Check if user exists
aws cognito-idp admin-get-user \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username your-username

# Reset password if needed
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username your-username \
  --password "NewPassword123!" \
  --permanent
```

---

### "User is not authorized to access this resource"

**Cause**: User is not in the correct Cognito group.

**Solution**:

```bash
# Add user to Finanzas group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username your-username \
  --group-name Finanzas

# Verify group membership
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username your-username
```

---

### "AccessDeniedException" when calling Cognito

**Cause**: Your AWS CLI credentials don't have Cognito permissions.

**Solution**:

```bash
# Check your AWS identity
aws sts get-caller-identity

# Verify you have Cognito permissions
aws cognito-idp list-user-pools --max-results 1

# If access denied, contact AWS admin to grant permissions
```

---

## 🔒 Security Best Practices

### DO:

- ✅ Use unique passwords for test users
- ✅ Store credentials in environment variables or secure vaults
- ✅ Rotate test passwords regularly
- ✅ Use separate test users for each team member
- ✅ Request credentials through official channels

### DON'T:

- ❌ Commit credentials to Git (even in examples)
- ❌ Share credentials via insecure channels (email, Slack)
- ❌ Use production user accounts for testing
- ❌ Hardcode credentials in scripts
- ❌ Leave credentials in shell history

---

## 📋 Quick Reference

### Configuration Values

```bash
# Cognito Configuration
COGNITO_USER_POOL_ID="us-east-2_FyHLtOhiY"
COGNITO_CLIENT_ID="dshos5iou44tuach7ta3ici5m"
COGNITO_REGION="us-east-2"
COGNITO_HOSTED_UI="https://us-east-2-fyhltohiy.auth.us-east-2.amazoncognito.com"

# API Configuration
API_BASE_URL_DEV="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
API_BASE_URL_PROD="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/prod"

# CloudFront
CLOUDFRONT_URL="https://d7t9x3j66yd8k.cloudfront.net/finanzas/"
```

### Required Cognito Groups

Test users need to be in one or more of these groups:

- `Finanzas` - Access to Finanzas module
- `SDMT` - Access to SDMT features (optional)
- `Admin` - Full access (optional)

---

## 📞 Getting Help

**Need credentials?**

1. Check with team lead or DevOps
2. Review GitHub secrets (if you have access)
3. Create your own test user (if you have AWS admin)

**Still having issues?**

- Check AWS CloudWatch logs for API Gateway
- Review Cognito user pool settings
- Verify user groups and permissions
- Contact platform team

---

## 📚 Related Documentation

- [Testing Guide](./TESTING_GUIDE.md) - Complete testing documentation
- [Authentication Flow](../AUTHENTICATION_FLOW.md) - Cognito setup details
- [E2E Test Results](./FINANZAS_E2E_RESULTS.md) - Test result templates

---

**Last Updated**: November 14, 2025
