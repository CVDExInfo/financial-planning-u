# Pull Request: Add "Desglose mensual vs presupuesto" by Project to TODOS Dashboard

## 📋 Summary

This PR implements a new **"Por Proyecto"** (By Project) view for the 12-month forecast grid in TODOS/ALL_PROJECTS mode. Users can now toggle between grouping rubros by category or by project, with full support for filtering, search, and persistence.

## 🎯 Objectives Met

✅ Add toggleable project view to "Cuadrícula de Pronóstico 12 Meses"  
✅ Reuse existing table UI and styles  
✅ Lightweight and performant (useMemo heavy-lifting)  
✅ Preserve existing filters (Mano de Obra / Todo / No Mano de Obra)  
✅ Persist view mode and filter to sessionStorage per user+project  
✅ Include unit tests (12 tests, all passing)  
✅ Minimal docs updated  

## 📈 Key Metrics

| Metric | Value |
|--------|-------|
| **Tests Added** | 12 (all passing ✅) |
| **Lines Added** | ~1,649 |
| **API Changes** | 0 |
| **Dependencies** | 0 |
| **Breaking Changes** | 0 |

## 🧪 Testing

**Automated**: 12/12 tests passing ✅  
**Manual QA**: Checklist in `FORECAST_PROJECT_BREAKDOWN_IMPLEMENTATION.md`

## 📚 Documentation

- ✅ `FORECAST_PROJECT_BREAKDOWN_IMPLEMENTATION.md` - Comprehensive guide
- ✅ `VISUAL_CHANGES_SUMMARY.md` - Feature description
- ✅ Code comments and JSDoc

## 👥 Reviewers

@valencia94 @aigor

---

See full PR description in this file for detailed information.
