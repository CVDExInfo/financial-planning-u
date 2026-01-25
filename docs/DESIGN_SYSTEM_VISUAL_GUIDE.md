# Design System Visual Documentation

This document provides visual examples and usage patterns for the Tier 3 design system components.

## DashboardLayout

The `DashboardLayout` component provides a 12-column responsive grid system.

### Basic Usage

```tsx
import { DashboardLayout, DashboardSection } from '@/components/ui/design-system';

function MyDashboard() {
  return (
    <DashboardLayout maxWidth="2xl">
      <DashboardSection colSpan={12}>
        {/* Full width content */}
      </DashboardSection>
      
      <DashboardSection colSpan={6}>
        {/* Half width - left side */}
      </DashboardSection>
      <DashboardSection colSpan={6}>
        {/* Half width - right side */}
      </DashboardSection>
    </DashboardLayout>
  );
}
```

### Responsive Layout

```tsx
<DashboardLayout>
  <DashboardSection 
    colSpan={12} 
    responsive={{ md: 6, lg: 4 }}
  >
    {/* Mobile: full width, Tablet: 6 cols, Desktop: 4 cols */}
  </DashboardSection>
</DashboardLayout>
```

### Helper Components

```tsx
import { 
  DashboardHalf,    // 6 columns (responsive)
  DashboardThird,   // 4 columns (responsive)
  DashboardQuarter  // 3 columns (responsive)
} from '@/components/ui/design-system';

<DashboardLayout>
  <DashboardHalf>{/* Content */}</DashboardHalf>
  <DashboardHalf>{/* Content */}</DashboardHalf>
</DashboardLayout>
```

## StandardTable

Enhanced table with density controls and sticky headers.

### Basic Usage

```tsx
import { 
  StandardTable,
  StandardTableHeader,
  StandardTableHead,
  StandardTableBody,
  StandardTableRow,
  StandardTableCell
} from '@/components/ui/design-system';

function MyTable() {
  return (
    <StandardTable 
      density="comfortable" 
      stickyHeader={true}
      showDensityToggle={true}
    >
      <StandardTableHeader>
        <tr>
          <StandardTableHead>Column 1</StandardTableHead>
          <StandardTableHead>Column 2</StandardTableHead>
        </tr>
      </StandardTableHeader>
      <StandardTableBody>
        <StandardTableRow>
          <StandardTableCell>Data 1</StandardTableCell>
          <StandardTableCell>Data 2</StandardTableCell>
        </StandardTableRow>
      </StandardTableBody>
    </StandardTable>
  );
}
```

### Density Options

- **Compact**: Smaller padding (px-2 py-1.5)
- **Comfortable**: Default padding (px-3 py-3)

## Chip Components

### Status Chips

Color-coded chips for success/warning/error states with auto-icons.

```tsx
import { StatusChip } from '@/components/ui/design-system';

<StatusChip status="success">Completed</StatusChip>
<StatusChip status="warning">Pending</StatusChip>
<StatusChip status="error">Failed</StatusChip>
<StatusChip status="info">In Progress</StatusChip>
```

**Visual Guide:**
- 🟢 Success: Green background with checkmark icon
- 🟡 Warning: Yellow background with alert icon
- 🔴 Error: Red background with alert icon
- 🔵 Info: Blue background with info icon

### Category Chips

Neutral grey chips for categorization.

```tsx
import { CategoryChip } from '@/components/ui/design-system';

<CategoryChip>MOD</CategoryChip>
<CategoryChip>OPEX</CategoryChip>
<CategoryChip>CAPEX</CategoryChip>
```

### Tag Chips

Outlined style for lightweight labels.

```tsx
import { TagChip } from '@/components/ui/design-system';

<TagChip>En Meta</TagChip>
<TagChip>Sobre presupuesto</TagChip>
```

### VarianceChip

Specialized chip for financial variances with automatic threshold colors.

```tsx
import { VarianceChip } from '@/components/ui/design-system';

// Automatic variant selection based on thresholds
<VarianceChip 
  variance={1000} 
  percentage={5}
  formatValue={(v) => formatCurrency(v)}
  warningThreshold={10}  // Yellow at 10%
  errorThreshold={20}    // Red at 20%
/>
```

**Threshold Logic:**
- variance = 0 → Success (green)
- |percentage| < 10% → Info (blue)
- 10% ≤ |percentage| < 20% → Warning (yellow)
- |percentage| ≥ 20% → Error (red)

## Theme Tokens

### Spacing Scale

```tsx
import { spacing } from '@/lib/design-system/theme';

// spacing.xs   = '0.5rem'   // 8px
// spacing.sm   = '0.75rem'  // 12px
// spacing.md   = '1rem'     // 16px
// spacing.lg   = '1.5rem'   // 24px
// spacing.xl   = '2rem'     // 32px
// spacing['2xl'] = '3rem'   // 48px
```

### Grid Configuration

```tsx
import { grid } from '@/lib/design-system/theme';

// grid.columns = 12
// grid.gutter  = '1rem'    // 16px
// grid.margin  = '1.5rem'  // 24px
```

### Color Palette

```tsx
import { colors } from '@/lib/design-system/theme';

// Status colors
colors.status.success  // Green
colors.status.warning  // Yellow
colors.status.error    // Red
colors.status.info     // Blue

// Neutral scale (50-900)
colors.neutral[50]  // Lightest
colors.neutral[500] // Middle
colors.neutral[900] // Darkest
```

## Taxonomy Helpers

Utility functions for working with rubros taxonomy.

```tsx
import { 
  getFuenteReferenciaLabel,
  getAllCategories,
  searchTaxonomy,
  getCategoryColor
} from '@/lib/rubros/taxonomyHelpers';

// Map codes to user-friendly labels
const label = getFuenteReferenciaLabel('PMO');  // "PMO"
const label2 = getFuenteReferenciaLabel('SAP'); // "ERP / Contabilidad (SAP)"

// Get all categories
const categories = getAllCategories();
// Returns: [{ codigo: 'QLT', nombre: 'Calidad y Mejora Continua' }, ...]

// Search taxonomy
const results = searchTaxonomy('ISO');
// Returns matching RubroTaxonomyItem[]

// Get color for category
const color = getCategoryColor('PMO');  // "purple"
const color2 = getCategoryColor('QLT'); // "emerald"
```

## Feature Flag

All design system components are behind the `VITE_FINZ_NEW_DESIGN_SYSTEM` feature flag.

```bash
# Enable new design system
VITE_FINZ_NEW_DESIGN_SYSTEM=true npm run dev

# Disable (default)
VITE_FINZ_NEW_DESIGN_SYSTEM=false npm run dev
```

## Migration Guide

### Migrating to DashboardLayout

**Before:**
```tsx
<div className="max-w-7xl mx-auto p-6">
  <div className="grid grid-cols-12 gap-4">
    <div className="col-span-6">Content</div>
  </div>
</div>
```

**After:**
```tsx
<DashboardLayout maxWidth="2xl">
  <DashboardSection colSpan={6}>Content</DashboardSection>
</DashboardLayout>
```

### Migrating to VarianceChip

**Before (old VarianceChip):**
```tsx
<VarianceChip 
  value={1000} 
  percent={15} 
  ariaLabel="Budget variance"
/>
```

**After (new design system VarianceChip):**
```tsx
<VarianceChip 
  variance={1000} 
  percentage={15}
  formatValue={(v) => formatCurrency(v)}
/>
```

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid support required
- CSS custom properties support required

## Accessibility

All components follow WCAG 2.1 AA guidelines:
- Color contrast ratios meet minimum requirements
- All interactive elements have focus states
- ARIA labels provided where appropriate
- Semantic HTML structure
