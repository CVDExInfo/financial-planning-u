## 🧪 Self-QC Checklist

Please verify the following before submitting your PR:

### 🎨 Visual & UX Requirements
- [ ] Screenshots/GIFs attached showing changes in both light and dark themes
- [ ] Estimator wizard or SDMT tabs visible with Project Context Bar (if applicable)  
- [ ] No hard-coded hex colors in components - using CSS custom properties only
- [ ] All interactive elements have proper focus states and accessibility
- [ ] Mobile responsive design tested on smaller screens

### 📊 Data & Charts
- [ ] Charts render with real mock data and respond to interactions
- [ ] Chart export to PNG/PDF functionality working
- [ ] Data grids handle empty states gracefully
- [ ] Loading and error states implemented

### 📤 Excel Export & Import Features  
- [ ] Designed Excel exports open correctly with pivots/charts and protected formulas
- [ ] Import functionality maps ≥95% of rows with validation report
- [ ] CSV/XLSX upload with MappingWizard tested end-to-end

### 🔄 Navigation & Drill-downs
- [ ] Drill-down from charts to data tables works correctly with applied filters
- [ ] Deep links preserve application state (project selection, date ranges, etc.)
- [ ] Module navigation (PMO/SDMT) functions properly

### ✅ Technical Quality
- [ ] TypeScript compilation passes with no errors
- [ ] ESLint passes with no warnings  
- [ ] All components properly typed with domain interfaces
- [ ] Performance: interactions respond within 100ms
- [ ] No console errors or warnings in browser

### 🚫 Scope Compliance  
- [ ] No ITSM/SLAs/ServiceNow/tickets functionality included
- [ ] Only budget/expense management and forecasting features
- [ ] Stays within defined PMO Estimator + SDMT Cost Management scope

### 📝 Documentation
- [ ] Component documentation updated for complex logic
- [ ] API client changes documented if applicable
- [ ] README updated if new features affect setup/usage

---

## Description

Brief description of what this PR adds/changes/fixes.

## Testing

Describe how you tested these changes.

## Screenshots

Attach screenshots showing the changes in action.