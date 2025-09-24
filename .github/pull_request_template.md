## Self-QC Checklist

Please verify all items before requesting review:

### 🖼️ Screenshots & Documentation
- [ ] Screenshots/GIFs included (both light/dark modes) for key changes
- [ ] Estimator wizard screenshots (if PMO changes)
- [ ] SDMT tab screenshots with Project Context Bar visible (if SDMT changes)
- [ ] Charts render correctly and include export functionality
- [ ] Mobile responsiveness verified

### ✅ Functionality
- [ ] Charts render with real data and PNG/PDF export works
- [ ] Designed Excel exports open correctly with pivots/charts and protected formulas
- [ ] Import functionality maps ≥95% of rows with validation report
- [ ] Drill-down from charts to tables functions properly
- [ ] All form validation works as expected

### 🎨 Design & Accessibility  
- [ ] No hard-coded hex colors in components - uses design tokens only
- [ ] WCAG 2.2 AA compliance (contrast ≥4.5:1, focus states, labels)
- [ ] Enhanced focus rings visible and functional
- [ ] Glass morphism effects applied to cards where appropriate

### 🏗️ Code Quality
- [ ] TypeScript types added for all new data structures
- [ ] No ITSM/SLAs/tickets functionality (out of scope)
- [ ] Error boundaries handle failures gracefully
- [ ] Loading states implemented for async operations
- [ ] Console errors/warnings addressed

### 🧪 Testing
- [ ] Manual testing completed for modified features
- [ ] Edge cases considered (empty states, failed imports, network errors)
- [ ] Cross-browser compatibility verified (Chrome, Firefox, Safari)

## Description

Brief description of changes and their impact on user experience.

## Impact

- [ ] Breaking change
- [ ] New feature
- [ ] Bug fix
- [ ] Performance improvement
- [ ] Accessibility improvement

## Testing Notes

Describe your testing approach and any specific scenarios tested.