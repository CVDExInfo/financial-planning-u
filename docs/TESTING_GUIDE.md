# Finanzas Manual Testing Tools

This directory contains comprehensive testing tools for the Finanzas SD module, designed to help QA engineers test every API endpoint, UI component, and user interaction.

## 🛠️ Available Tools

### 1. Bash Testing Script

**Location**: `scripts/manual-test-finanzas.sh`

Automated command-line tool for testing all Finanzas API endpoints with Cognito authentication.

**Features**:

- ✅ Automatic Cognito authentication using GitHub secrets
- ✅ Tests all GET/POST endpoints with proper auth headers
- ✅ Generates detailed test reports in Markdown
- ✅ Color-coded console output
- ✅ Tracks pass/fail/skip statistics
- ✅ Includes comprehensive UI testing checklist

**Usage**:

```bash
# From GitHub Actions (automatic):
./scripts/manual-test-finanzas.sh

# Local testing with environment variables:
export TEST_USERNAME="finanzas-test-user"
export TEST_PASSWORD="YourPassword123!"
export API_BASE_URL="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
./scripts/manual-test-finanzas.sh

# Or inline:
TEST_USERNAME=finanzas-test-user \
TEST_PASSWORD=YourPassword123! \
./scripts/manual-test-finanzas.sh
```

**Output**:

- Creates timestamped report: `test-results-YYYYMMDD-HHMMSS.md`
- Console output with color-coded results
- Detailed API response samples
- UI testing checklist for manual verification

---

### 2. Interactive Browser Test Helper

**Location**: `public/test-helper.html`

Web-based interactive testing dashboard for manual UI and API testing.

**Features**:

- 🎨 Beautiful, intuitive interface
- 🔧 Run API tests directly from browser
- 📊 Real-time statistics dashboard
- 🔐 Automatic JWT loading from localStorage
- 📝 Detailed test log with timestamps
- 💾 Export results to Markdown
- 🚀 Quick navigation to all UI routes

**Usage**:

1. Start dev server: `npm run dev`
2. Navigate to: `http://localhost:5173/test-helper.html`
3. Click "Load from LocalStorage" to auto-load JWT token
4. Click "Test Connection" to verify API access
5. Run individual tests or click "Run All API Tests"
6. Use navigation buttons to test UI routes
7. Export results when done

**Sections**:

- **Configuration**: Set API URL and JWT token
- **Statistics**: Visual dashboard of test results
- **API Tests**: Run automated API endpoint tests
- **UI Navigation**: Quick links to all Finanzas routes
- **Test Log**: Detailed output with timestamps

---

## 🔐 Authentication Setup

Both tools support multiple authentication methods:

### Method 1: GitHub Secrets (CI/CD)

```yaml
# In GitHub Actions workflow
env:
  TEST_USERNAME: ${{ secrets.USERNAME }}
  TEST_PASSWORD: ${{ secrets.PASSWORD }}
  COGNITO_USER_POOL_ID: ${{ vars.COGNITO_USER_POOL_ID }}
  COGNITO_CLIENT_ID: ${{ vars.COGNITO_WEB_CLIENT }}
```

### Method 2: Environment Variables (Local)

```bash
export TEST_USERNAME="finanzas-test-user"
export TEST_PASSWORD="YourPassword123!"
export COGNITO_USER_POOL_ID="us-east-2_FyHLtOhiY"
export COGNITO_CLIENT_ID="dshos5iou44tuach7ta3ici5m"
export COGNITO_REGION="us-east-2"
export API_BASE_URL="https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev"
```

### Method 3: .env File (Local)

Create `.env.local`:

```env
VITE_API_BASE_URL=https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev
VITE_COGNITO_USER_POOL_ID=us-east-2_FyHLtOhiY
VITE_COGNITO_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_FINZ_ENABLED=true
```

---

## 📋 Test Coverage

### API Endpoints Tested

#### Public Endpoints (No Auth)

- ✅ `GET /health` - API health check
- ✅ `GET /catalog/rubros` - Rubros catalog (71 items)

#### Protected Endpoints (Requires Auth)

- ✅ `GET /allocation-rules` - Allocation rules
- ✅ `GET /projects` - Projects list
- ✅ `POST /projects` - Create new project
- ✅ `POST /projects/{id}/rubros` - Add rubro to project
- ✅ `PUT /projects/{id}/allocations:bulk` - Bulk allocations
- ✅ `POST /adjustments` - Create adjustment
- ✅ `POST /providers` - Create provider

### UI Routes Tested

#### Main Navigation

- `/finanzas/` - Home page with module cards
- `/finanzas/catalog/rubros` - Rubros catalog table
- `/finanzas/rules` - Allocation rules manager
- `/finanzas/projects` - Projects manager
- `/finanzas/adjustments` - Adjustments manager
- `/finanzas/providers` - Providers manager

#### Additional Routes

- `/finanzas/profile` - User profile
- Authentication flow (Cognito Hosted UI)

### UI Components Tested

- ✅ Navigation bar with role-based menu items
- ✅ Module cards on home page
- ✅ Data tables with search/filter/sort
- ✅ Create/Edit forms with validation
- ✅ Toast notifications
- ✅ Error handling and user feedback
- ✅ Loading states
- ✅ Responsive design (mobile/tablet/desktop)

---

## 🎯 Testing Workflow

### Complete Test Cycle

1. **Setup Environment**

   ```bash
   # Install dependencies
   npm install

   # Configure environment
   cp .env.local.example .env.local
   # Edit .env.local with correct values

   # Start dev server
   npm run dev
   ```

2. **Run Automated API Tests**

   ```bash
   # Set credentials
   export TEST_USERNAME="your-username"
   export TEST_PASSWORD="your-password"

   # Run test script
   ./scripts/manual-test-finanzas.sh

   # Review generated report
   cat test-results-*.md
   ```

3. **Run Interactive Browser Tests**

   - Open: `http://localhost:5173/test-helper.html`
   - Load JWT from localStorage
   - Run all API tests
   - Review results and export report

4. **Manual UI Testing**

   - Follow checklist in generated report
   - Test each route systematically
   - Verify DevTools Console (no errors)
   - Verify DevTools Network (correct API calls)
   - Test all interactive elements
   - Document any issues found

5. **Production Testing**
   - Repeat steps 3-4 on production URL
   - Compare local vs production behavior
   - Note any CloudFront issues

---

## 📊 Test Report Format

### Bash Script Output

```markdown
# Finanzas E2E Test Results

**Date**: 2025-11-14
**Tester**: qa-engineer
**API Base**: https://...

## Automated API Tests

✅ **PASS**: Health endpoint returned 200 OK
✅ **PASS**: Rubros catalog returned 71 items
✅ **PASS**: Allocation rules returned 5 rules
⊘ **SKIP**: Projects endpoint returned 501 Not Implemented

## UI Manual Test Checklist

### Test 1: Authentication Flow

- [ ] Navigate to /finanzas/
- [ ] Redirect to Cognito
- [ ] Login successful
- [ ] JWT in localStorage
      **Status**: ☐ PASS ☐ FAIL

### Test 2: Home Page

...
```

### Browser Test Helper Output

- Real-time statistics dashboard
- Color-coded test results
- Detailed log with timestamps
- Exportable Markdown report

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Missing TEST_USERNAME or TEST_PASSWORD"

```bash
# Solution: Set environment variables
export TEST_USERNAME="finanzas-test-user"
export TEST_PASSWORD="YourPassword123!"
```

**Issue**: "Cognito authentication failed"

```bash
# Check AWS CLI credentials
aws sts get-caller-identity

# Verify Cognito user exists
aws cognito-idp admin-get-user \
  --user-pool-id us-east-2_FyHLtOhiY \
  --username finanzas-test-user
```

**Issue**: "401 Unauthorized on API calls"

```bash
# JWT may be expired (expires after 1 hour)
# Re-authenticate to get fresh token
./scripts/manual-test-finanzas.sh

# Or in browser: Logout and login again
```

**Issue**: "No JWT found in localStorage"

```bash
# In browser console:
localStorage.getItem('cv.jwt')

# If null, login via Cognito Hosted UI first
# Then reload test helper page
```

**Issue**: "CloudFront returns x-cache: Error"

```bash
# Check CloudFront distribution
aws cloudfront get-distribution --id E1234567890ABC

# Review CloudFront function logs
# Check S3 bucket permissions
# Verify cache behaviors
```

---

## 🔍 Advanced Testing

### Load Testing

```bash
# Use Apache Bench
ab -n 1000 -c 10 \
  -H "Authorization: Bearer $JWT_TOKEN" \
  https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev/catalog/rubros

# Or use k6
k6 run load-test-finanzas.js
```

### Security Testing

```bash
# Test without JWT (should return 401)
curl -v https://.../allocation-rules

# Test with invalid JWT
curl -v -H "Authorization: Bearer invalid-token" \
  https://.../allocation-rules

# Test with expired JWT
# (forge JWT with old exp claim)
```

### Performance Testing

```bash
# Measure API response times
time curl -s https://.../catalog/rubros

# Use Chrome DevTools Lighthouse
# Open: http://localhost:5173/finanzas/
# DevTools → Lighthouse → Run Audit
```

---

## 📚 Additional Resources

- [Finanzas E2E Results](../docs/FINANZAS_E2E_RESULTS.md) - Detailed test results
- [Authentication Flow](../AUTHENTICATION_FLOW.md) - Cognito setup
- [API Documentation](../openapi/finanzas.yaml) - OpenAPI spec
- [Postman Collection](../postman/Finanzas.postman_collection.json) - API tests

---

## 🤝 Contributing

To add new tests:

1. **Add to Bash Script**: Edit `scripts/manual-test-finanzas.sh`

   ```bash
   test_api_new_endpoint() {
       print_header "API Test: New Endpoint"
       # Test implementation
   }
   ```

2. **Add to Browser Helper**: Edit `public/test-helper.html`

   ```javascript
   const tests = {
     newTest: async () => {
       // Test implementation
     },
   };
   ```

3. **Update Documentation**: Add to this README

---

## 📝 License

Part of the financial-planning-u project. See [LICENSE](../LICENSE) for details.
