# Finanzas UI Button & Interaction Test Plan

Generated: 2025-11-15T06:58:14.819Z

## Test Coverage

- ServiceTierSelector (recommendation calculator, tier selection)
- PMO Estimator Wizard (navigation, form submission, digital signature)
- Project Context (project selection, period changes)
- API Integration (getProjects, createBaseline)
- DynamoDB Verification (data persistence, audit trail)
- Error Handling (network failures, fallback behavior)

## Test Cases

### 1. ServiceTierSelector - Budget Input Change

**Action:** Change budget value from 10000 to 0 in "Get Recommendation" tab

**Expected Behavior:**
- [ ] Recommendation card should update immediately
- [ ] Tier should change from "Ikusi Gold" to "Ikusi Go" or lower
- [ ] Monthly cost should update to reflect budget change
- [ ] No page refresh required
- [ ] Console should show budget change log

**Status:** ⏳ Pending

**Notes:**

---

### 2. ServiceTierSelector - SLA Dropdown Change

**Action:** Change SLA from 99% to 95% in "Get Recommendation" tab

**Expected Behavior:**
- [ ] Recommendation should recalculate
- [ ] Tier may change based on SLA requirements
- [ ] State update should be instant (React state)
- [ ] Console should log SLA change

**Status:** ⏳ Pending

**Notes:**

---

### 3. ServiceTierSelector - Complexity Selection

**Action:** Change complexity from "medium" to "high" in "Get Recommendation" tab

**Expected Behavior:**
- [ ] Recommendation tier may upgrade to higher tier
- [ ] Monthly cost should increase
- [ ] UI should update without manual refresh
- [ ] Calculator memoization should prevent infinite re-renders

**Status:** ⏳ Pending

**Notes:**

---

### 4. ServiceTierSelector - Select Tier Button Click

**Action:** Click "Select Ikusi Gold" button in "Service Tiers" tab

**Expected Behavior:**
- [ ] Toast notification should appear: "Ikusi Gold added to catalog"
- [ ] onTierSelected callback should be triggered
- [ ] Selected tier should be highlighted or show visual feedback
- [ ] Tier should be added to user's project catalog

**Status:** ⏳ Pending

**Notes:**

---

### 5. PMOEstimatorWizard - Next Button Click

**Action:** Click "Next" button in Deal Inputs step

**Expected Behavior:**
- [ ] Form validation should run
- [ ] If valid, progress to "Labor Costs" step
- [ ] Progress bar should update from 20% to 40%
- [ ] Step indicator should highlight "Labor Costs"
- [ ] Data should be saved to localStorage
- [ ] Console should log: "📅 Step changing from: deal-inputs to: labor"

**Status:** ⏳ Pending

**Notes:**

---

### 6. PMOEstimatorWizard - Previous Button Click

**Action:** Click "Previous" button in Labor Costs step

**Expected Behavior:**
- [ ] Navigate back to Deal Inputs step
- [ ] Progress bar should decrease from 40% to 20%
- [ ] Previously entered data should still be present (localStorage)
- [ ] No data loss during navigation

**Status:** ⏳ Pending

**Notes:**

---

### 7. ReviewSignStep - Digital Sign Button Click

**Action:** Click "Digital Sign" button in Review & Sign step

**Expected Behavior:**
- [ ] Review checkbox must be checked first
- [ ] Loading spinner should appear
- [ ] API call to POST /baseline should be triggered
- [ ] Network tab should show request to m3g6am67aj.execute-api.us-east-2.amazonaws.com
- [ ] Success: baseline_id and signature_hash returned
- [ ] Toast notification: "Baseline signed successfully"
- [ ] Button changes to "Complete & Handoff to SDMT"
- [ ] Console should log: "✅ Baseline created via API: {baseline_id, ...}"

**Status:** ⏳ Pending

**Notes:**

---

### 8. ProjectContextBar - Project Selection

**Action:** Select different project from dropdown in top navigation

**Expected Behavior:**
- [ ] ProjectContext state should update
- [ ] selectedProjectId should change
- [ ] Console should log: "📂 Project selected: {project_id}"
- [ ] Financial views should refresh with new project data
- [ ] Period selector should show selected project's periods
- [ ] localStorage should persist selected project

**Status:** ⏳ Pending

**Notes:**

---

### 9. ProjectContextBar - Period Selection

**Action:** Change period from "12 months" to "24 months" in dropdown

**Expected Behavior:**
- [ ] ProjectContext state should update
- [ ] selectedPeriod should change from "12" to "24"
- [ ] periodChangeCount should increment
- [ ] Console should log: "📅 Period changing from: 12 to: 24"
- [ ] Financial calculations should recalculate for 24 months
- [ ] Charts and graphs should update with new period data
- [ ] localStorage should save selected period

**Status:** ⏳ Pending

**Notes:**

---

### 10. LaborStep - Add Labor Resource Button

**Action:** Click "Add Labor Resource" button in Labor Costs step

**Expected Behavior:**
- [ ] New row should appear in labor table
- [ ] All fields should be empty/default values
- [ ] Table should scroll to new row
- [ ] State should update with new labor estimate object
- [ ] Total cost should recalculate

**Status:** ⏳ Pending

**Notes:**

---

### 11. LaborStep - Remove Labor Resource Button

**Action:** Click trash icon next to labor resource row

**Expected Behavior:**
- [ ] Row should be removed from table
- [ ] State should update (array filter)
- [ ] Total cost should recalculate
- [ ] No error if removing last item

**Status:** ⏳ Pending

**Notes:**

---

### 12. Navigation - Profile & Roles Button Click

**Action:** Click user profile button showing email in top right

**Expected Behavior:**
- [ ] Dropdown menu should open
- [ ] Should display: "christian.valencia@ikusi.com"
- [ ] Should show: "1 role available"
- [ ] Should NOT navigate away from current page
- [ ] Should NOT cause page reload

**Status:** ⏳ Pending

**Notes:**

---

### 13. ApiService.getProjects() - Load Projects on Page Load

**Action:** Open Cost Catalog page or refresh page

**Expected Behavior:**
- [ ] Network tab should show GET request to /projects
- [ ] Console should log: "✅ Projects loaded from API: [...]"
- [ ] If API fails, fallback to mock data
- [ ] Project dropdown should populate with real projects from DynamoDB
- [ ] Projects should include: P-001 IKUSI, P-002 VELATIA, P-d8b91982

**Status:** ⏳ Pending

**Notes:**

---

### 14. ApiService.createBaseline() - Create Baseline via API

**Action:** Complete PMO Estimator wizard and click Digital Sign

**Expected Behavior:**
- [ ] Network tab should show POST request to /baseline
- [ ] Request body should include: project_name, labor_estimates, non_labor_estimates
- [ ] Authorization header should include Bearer token
- [ ] Response should include: baseline_id, project_id, signature_hash
- [ ] Console should log: "✅ Baseline created via API"
- [ ] If API fails, fallback to mock baseline_id

**Status:** ⏳ Pending

**Notes:**

---

### 15. DynamoDB Integration - Verify Data Written to finz_projects

**Action:** After creating baseline, check DynamoDB table

**Expected Behavior:**
- [ ] Run: aws dynamodb scan --table-name finz_projects --limit 5
- [ ] New project record should appear with today's timestamp
- [ ] project_id should match response from API
- [ ] baseline_id should be present
- [ ] labor_estimates and non_labor_estimates should be stored
- [ ] signature_hash should be populated
- [ ] created_at timestamp should be recent

**Status:** ⏳ Pending

**Notes:**

---

### 16. Audit Trail - Verify Audit Log Entry Created

**Action:** After creating baseline, check finz_audit_log table

**Expected Behavior:**
- [ ] Run: aws dynamodb scan --table-name finz_audit_log --limit 10
- [ ] New audit entry should exist with action: "baseline_created"
- [ ] actor field should show user email (from JWT token)
- [ ] project_id should match created project
- [ ] timestamp should match creation time
- [ ] details should include baseline_id and signature_hash

**Status:** ⏳ Pending

**Notes:**

---

### 17. ServiceTierSelector - Calculator Memoization Fix

**Action:** Open browser DevTools > React DevTools > Profiler

**Expected Behavior:**
- [ ] Change budget input value multiple times
- [ ] ServiceTierSelector should NOT re-render infinitely
- [ ] Profiler should show controlled number of renders
- [ ] calculator object should maintain same reference (memoized)
- [ ] recommendation should only recalculate when selectedRequirements changes
- [ ] No console errors about "Maximum update depth exceeded"

**Status:** ⏳ Pending

**Notes:**

---

### 18. PMOEstimatorWizard - localStorage Data Persistence

**Action:** Fill out PMO Estimator steps, refresh page

**Expected Behavior:**
- [ ] Check localStorage keys: estimator-deal-inputs, estimator-labor, estimator-non-labor
- [ ] Data should persist after page refresh
- [ ] Wizard should resume from last step
- [ ] No data loss during browser session
- [ ] localStorage.getItem("estimator-deal-inputs") should return JSON string

**Status:** ⏳ Pending

**Notes:**

---

### 19. Error Handling - API Request Failure

**Action:** Disconnect from internet or block API domain, then try to load projects

**Expected Behavior:**
- [ ] Network request should fail gracefully
- [ ] Console should log: "Failed to fetch projects from API: [error]"
- [ ] UI should fall back to empty array (not crash)
- [ ] User should see empty project dropdown or error message
- [ ] No uncaught exceptions in console
- [ ] App should remain functional

**Status:** ⏳ Pending

**Notes:**

---

### 20. CORS Configuration - Cross-Origin Resource Sharing

**Action:** Open Network tab, make API request from CloudFront domain

**Expected Behavior:**
- [ ] Response headers should include: Access-Control-Allow-Origin: *
- [ ] No CORS errors in console
- [ ] Preflight OPTIONS request should succeed (if applicable)
- [ ] API should be callable from https://d7t9x3j66yd8k.cloudfront.net

**Status:** ⏳ Pending

**Notes:**

---

