# DashboardV2 QA Checklist

## Pre-Deployment Verification

### Build & Deployment
- [ ] `yarn build` completes without errors
- [ ] `yarn lint` passes with zero errors
- [ ] `yarn typecheck` passes
- [ ] SAM template validates: `sam validate -t infra/template-portfolio-forecast.yaml`
- [ ] OpenAPI spec validates: `npx @stoplight/spectral lint openapi/portfolio-forecast.yaml`

### Environment Configuration
- [ ] Feature flags set correctly in `.env.development`
- [ ] Feature flags set correctly in `.env.production`
- [ ] API base URL configured for target environment
- [ ] Cognito auth configured correctly

## Automated Test Results

### Unit Tests
- [ ] All unit tests pass: `yarn test:unit`
- [ ] Coverage ≥80% for `src/lib/forecast/`
- [ ] Coverage ≥80% for `src/lib/rubros/`
- [ ] Test report artifact attached

### Integration Tests
- [ ] `useDashboardData` hook tests pass
- [ ] MSW mocks working correctly
- [ ] Data transformation tests pass
- [ ] Totals parity verified

### Contract Tests
- [ ] OpenAPI schema validation passes
- [ ] Prism mock server tests pass
- [ ] Pact/Postman tests pass (if staging API available)
- [ ] Contract test report attached

### E2E Tests
- [ ] Portfolio view loads successfully
- [ ] Executive summary displays correct KPIs
- [ ] Grid renders with virtualization
- [ ] Edit → Save → Verify workflow works
- [ ] 60-month dataset loads without crash
- [ ] E2E test videos/screenshots attached

### Performance Tests
- [ ] k6 load test results: p95 < 800ms
- [ ] Lighthouse report: visible area render ≤2s
- [ ] No memory leaks during extended scrolling
- [ ] Performance report attached

## Manual Testing Checklist

### Functional Testing

#### Dashboard Load (Portfolio Mode)
- [ ] Dashboard loads with default settings (12 months, current year)
- [ ] Executive summary shows correct totals
- [ ] Monthly budget panel is collapsed by default
- [ ] Forecast grid is visible and scrollable
- [ ] Charts panel renders without errors
- [ ] No console errors or warnings

#### View Mode Switching
- [ ] Switch from portfolio → project mode
- [ ] Project selector appears when in project mode
- [ ] Selected project loads correctly
- [ ] Totals update to reflect selected project
- [ ] Switch back to portfolio mode works

#### Period Selector
- [ ] Select 12 months - grid updates
- [ ] Select 24 months - grid updates
- [ ] Select 36 months - grid updates
- [ ] Select 60 months - grid loads and scrolls smoothly
- [ ] Year selector changes fiscal year correctly

#### Monthly Budget Panel
- [ ] Expand budget panel - shows 12 month inputs
- [ ] Enter annual budget - auto-distributes to months
- [ ] Edit individual month budget
- [ ] Save budget - success message shown
- [ ] Refresh - budget persists
- [ ] Variance indicators update

#### Forecast Grid
- [ ] Grid displays all rubros with canonical IDs
- [ ] Sticky header stays visible on vertical scroll
- [ ] Horizontal scroll works smoothly
- [ ] Rows virtualize (not all rendered at once)
- [ ] Columns virtualize (when >12 months)

#### Grid Editing (if VITE_DASHBOARD_V2_EDIT=true)
- [ ] Click cell to edit
- [ ] Enter forecast value
- [ ] Cell shows "dirty" indicator
- [ ] Save button shows count of dirty cells
- [ ] Save changes - bulk upsert succeeds
- [ ] Grid updates with server values
- [ ] `last_updated` timestamp refreshes
- [ ] Dirty indicators clear

#### Conflict Resolution
- [ ] Simulate conflict: edit same cell in two tabs
- [ ] Save in first tab - succeeds
- [ ] Save in second tab - conflict detected
- [ ] Error message shows current timestamp
- [ ] Refresh grid to get latest values
- [ ] Retry save - succeeds with new timestamp

#### Charts
- [ ] Trend chart displays planned/forecast/actual lines
- [ ] Variance chart shows monthly variances
- [ ] Chart tooltips work on hover
- [ ] Charts update when period changes
- [ ] No rendering glitches

#### Export
- [ ] Export to Excel works
- [ ] Excel file contains all visible data
- [ ] Export to PDF works
- [ ] PDF matches screen layout

### Non-Functional Testing

#### Performance
- [ ] Initial load completes in <3 seconds
- [ ] Switching period completes in <1 second
- [ ] Scrolling grid maintains 60 FPS
- [ ] Large dataset (60 months) loads without freezing
- [ ] Memory usage stable during extended use
- [ ] No performance degradation after 30 minutes

#### Accessibility
- [ ] Keyboard navigation works (Tab, Arrow keys)
- [ ] Screen reader announces grid updates
- [ ] Focus visible on all interactive elements
- [ ] Color contrast meets WCAG AA
- [ ] No critical Axe violations
- [ ] Axe report attached

#### Responsiveness
- [ ] Dashboard usable on tablet (1024×768)
- [ ] Grid scrolls horizontally on narrow screens
- [ ] Charts resize appropriately
- [ ] No layout breaks at various breakpoints

#### Error Handling
- [ ] Network error - shows friendly message
- [ ] Auth expired - redirects to login
- [ ] 404 on API - shows error boundary
- [ ] Partial save failure - shows per-item status
- [ ] Conflict - shows actionable error message

#### Data Integrity
- [ ] Server totals match UI-calculated totals (parity check)
- [ ] Rubro IDs are all canonical (no legacy IDs displayed)
- [ ] Variance calculations correct
- [ ] Budget allocation matches expectations
- [ ] Audit log created for all edits

### Browser Compatibility
- [ ] Chrome (latest) - all tests pass
- [ ] Firefox (latest) - all tests pass
- [ ] Safari (latest) - all tests pass
- [ ] Edge (latest) - all tests pass

### Security Testing
- [ ] Non-PMO user cannot edit (VITE_DASHBOARD_V2_EDIT enforced)
- [ ] Read-only mode works (VITE_DASHBOARD_V2_READONLY)
- [ ] Bulk upsert requires valid auth token
- [ ] SQL injection attempts rejected
- [ ] XSS attempts sanitized
- [ ] CSRF token validated

## Regression Testing

### Legacy Dashboard (SDMTForecast)
- [ ] Legacy dashboard still loads when flag disabled
- [ ] All existing features work in legacy dashboard
- [ ] No visual regressions
- [ ] No functional regressions

## Monitoring Setup

### CloudWatch Alarms
- [ ] `GetPortfolioForecastErrors` alarm configured
- [ ] `GetPortfolioForecastLatency` alarm configured
- [ ] `BulkUpsertErrors` alarm configured
- [ ] SNS topic subscribed for alerts

### Dashboard
- [ ] CloudWatch dashboard created
- [ ] Metrics visible for API invocations
- [ ] Metrics visible for errors
- [ ] Metrics visible for latency

### Logging
- [ ] Lambda function logs visible in CloudWatch
- [ ] Structured logging in place
- [ ] Log retention set to 30 days

## Documentation
- [ ] `DASHBOARD_V2_MIGRATION.md` complete and reviewed
- [ ] API documentation updated
- [ ] Component README files created
- [ ] Storybook deployed and accessible
- [ ] Runbook for operators created

## Artifacts Checklist

Attach the following to PR:

### Test Reports
- [ ] Unit test coverage report (lcov HTML)
- [ ] Contract test report (PDF/HTML)
- [ ] Integration test logs
- [ ] E2E test report with videos/screenshots
- [ ] Performance report (k6 summary + Lighthouse)
- [ ] Accessibility report (Axe scan results)

### Evidence
- [ ] Parity script output (server totals vs UI totals)
- [ ] Storybook screenshot gallery
  - [ ] ExecutiveSummary (default state)
  - [ ] MonthlyBudgetPanel (collapsed/expanded)
  - [ ] ForecastGrid (small: 20×12)
  - [ ] ForecastGrid (medium: 500×12)
  - [ ] ForecastGrid (large: 10K×60)
- [ ] CloudWatch dashboard screenshot
- [ ] Monitoring alarm configuration screenshots

## Sign-Off

### Development Team
- [ ] Lead Developer: _____________________ Date: __________
- [ ] QA Engineer: ______________________ Date: __________

### Stakeholders
- [ ] PMO Manager: ______________________ Date: __________
- [ ] Product Owner: ____________________ Date: __________

### Deployment Authorization
- [ ] DevOps Lead: ______________________ Date: __________
- [ ] Engineering Manager: _______________ Date: __________

## Post-Deployment Verification

### Smoke Tests (within 1 hour of deployment)
- [ ] Dashboard loads in production
- [ ] API endpoints responding
- [ ] No error spikes in CloudWatch
- [ ] Sample edits save successfully
- [ ] Audit logs being created

### Monitoring (first 24 hours)
- [ ] Error rate <1%
- [ ] p95 latency <800ms
- [ ] No critical alerts triggered
- [ ] User feedback collected

### Rollback Criteria
If any of these occur, initiate rollback:
- [ ] Error rate >5%
- [ ] p95 latency >2 seconds
- [ ] Critical data integrity issue
- [ ] Security vulnerability discovered

## Notes

**Date of QA:** ______________

**Environment:** [ ] Dev [ ] Staging [ ] Production

**Tested by:** ____________________

**Additional observations:**

_______________________________________________________

_______________________________________________________

_______________________________________________________
