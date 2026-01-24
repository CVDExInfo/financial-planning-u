# UI Consistency Guidelines - Financial Planning Dashboard

**Version:** 1.0  
**Last Updated:** January 24, 2026  
**Purpose:** Enforce consistent design patterns across the Finanzas SD (Service Delivery) module

---

## Table of Contents

1. [Spacing System](#spacing-system)
2. [Typography](#typography)
3. [Color System](#color-system)
4. [Component Patterns](#component-patterns)
5. [Border & Elevation](#border--elevation)
6. [Layout Grid](#layout-grid)
7. [Interactive States](#interactive-states)
8. [Accessibility](#accessibility)

---

## Spacing System

### 8-Point Grid System

All spacing must conform to multiples of 4px, preferably 8px for consistency:

```css
/* Tailwind Classes Reference */
gap-1    →  4px    (0.25rem)  // Minimal spacing, use sparingly
gap-2    →  8px    (0.5rem)   // ✅ Standard element gap
gap-3    →  12px   (0.75rem)  // ✅ Card padding, compact spacing
gap-4    →  16px   (1rem)     // ✅ Section spacing, normal gaps
gap-6    →  24px   (1.5rem)   // Large sections
gap-8    →  32px   (2rem)     // Page sections

/* Padding Classes */
p-2      →  8px    // Compact padding (table cells, buttons)
p-3      →  12px   // ✅ Standard card padding
p-4      →  16px   // Comfortable card padding
p-6      →  24px   // Large card padding (modals, hero sections)

/* Vertical Spacing */
space-y-2  →  8px gap between children   // ✅ Element groups
space-y-3  →  12px gap                   // ✅ Form fields
space-y-4  →  16px gap                   // ✅ Card sections
space-y-6  →  24px gap                   // Major sections
space-y-8  →  32px gap                   // Page sections
```

### Component-Specific Spacing Rules

#### Cards
```tsx
// ✅ DO: Standard card
<Card className="border">
  <CardHeader className="pb-3">    // Reduced bottom padding
    <CardTitle>Section Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4 pt-0">  // No top padding to avoid double spacing
    {/* Content */}
  </CardContent>
</Card>

// ❌ DON'T: Inconsistent padding
<Card>
  <CardHeader className="p-6 pb-2">  // Avoid custom padding
    ...
  </CardHeader>
</Card>
```

#### Tables
```tsx
// Row padding based on density
<TableCell className="p-2">      // Compact density (>50 rows)
<TableCell className="py-2 px-3">  // Normal density (default)
<TableCell className="py-3 px-4">  // Comfortable density (<20 rows)
```

#### Forms
```tsx
// Form field groups
<div className="space-y-3">  // ✅ Between fields
  <div className="space-y-1">  // ✅ Label + Input
    <Label>Field Name</Label>
    <Input />
  </div>
</div>
```

---

## Typography

### Type Scale

```css
text-xs    →  12px   // Labels, captions, metadata
text-sm    →  14px   // ✅ Body text, table cells, form inputs
text-base  →  16px   // Default body text
text-lg    →  18px   // ✅ Card titles, section headings
text-xl    →  20px   // ✅ Page titles, modal titles
text-2xl   →  24px   // Hero headings

/* Line Heights */
leading-tight   →  1.25    // Headings
leading-snug    →  1.375   // Compact text
leading-normal  →  1.5     // ✅ Body text default
leading-relaxed →  1.625   // Long-form content
```

### Font Weights

```css
font-normal   →  400  // Body text
font-medium   →  500  // ✅ Labels, emphasized text
font-semibold →  600  // ✅ Section headings, card titles
font-bold     →  700  // Page titles, KPIs
```

### Heading Hierarchy

```tsx
// ✅ Page Title (H1)
<h1 className="text-2xl font-bold text-foreground">
  Gestión de Pronóstico
</h1>

// ✅ Major Section (H2)
<h2 className="text-lg font-semibold text-foreground">
  Resumen Ejecutivo
</h2>

// ✅ Sub-section (H3)
<h3 className="text-base font-medium text-foreground">
  Detalles Mensuales
</h3>

// ✅ Label / Small Heading (H4)
<h4 className="text-sm font-medium text-muted-foreground">
  Last Updated
</h4>
```

---

## Color System

### Semantic Colors

```tsx
// Status Colors
bg-green-50 text-green-700 border-green-200   // Success, On-budget
bg-yellow-50 text-yellow-700 border-yellow-200 // Warning, At-risk
bg-red-50 text-red-700 border-red-200          // Error, Over-budget
bg-blue-50 text-blue-700 border-blue-200       // Info, Neutral

// Text Colors
text-foreground          // ✅ Primary text (dark mode aware)
text-muted-foreground    // ✅ Secondary text, labels
text-destructive         // Error messages
text-primary             // Brand color highlights

// Background Colors
bg-background            // ✅ Main background
bg-card                  // ✅ Card background
bg-muted                 // ✅ Subtle backgrounds
bg-accent                // Highlighted backgrounds
```

### Color Usage Rules

```tsx
// ✅ DO: Use semantic colors
<Badge className="bg-green-50 text-green-700 border-green-200">
  En Meta
</Badge>

// ❌ DON'T: Hardcode hex colors
<div style={{ backgroundColor: '#f0fdf4' }}>  // Use bg-green-50 instead
```

### Budget/Financial Color Conventions

```tsx
// Variance Colors
negative variance (under budget)  → text-green-600  ✓ Good
positive variance (over budget)   → text-red-600    ✗ Bad
neutral (within tolerance)        → text-blue-600   —

// Trend Colors
trending up   → TrendingUp icon + text-red-600 (if bad)
trending down → TrendingDown icon + text-green-600 (if good)
```

---

## Component Patterns

### Cards

```tsx
// ✅ Standard Card (most common)
<Card className="border">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg">Section Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4 pt-0">
    {/* Content */}
  </CardContent>
</Card>

// ✅ Collapsible Card
<Collapsible defaultOpen={false}>
  <Card className="border">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg">Analytics & Trends</CardTitle>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
    </CardHeader>
    <CollapsibleContent>
      <CardContent className="pt-0">
        {/* Content */}
      </CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>

// ✅ Highlighted/Priority Card (use sparingly)
<Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-background">
  <CardContent className="p-4">
    {/* Priority content */}
  </CardContent>
</Card>

// ❌ DON'T: Over-nest cards
<Card>
  <Card>  // Avoid card-in-card, use dividers instead
    <Card>  // Definitely don't do 3+ levels
```

### Badges & Chips

```tsx
// Status Badges (bold, action-oriented)
<Badge className="bg-green-50 text-green-700 border-green-200 px-3 py-1 font-medium">
  ✓ Approved
</Badge>

// Category Chips (subtle, read-only)
<Badge variant="outline" className="text-xs bg-muted/20">
  Category Name
</Badge>

// Tags (minimal, metadata)
<Badge variant="ghost" className="text-xs">
  tag-name
</Badge>

// Count Badges (small, inline)
<Badge variant="secondary" className="text-[10px] h-4 px-1">
  5
</Badge>
```

### Buttons

```tsx
// ✅ Primary Action (one per section)
<Button className="gap-2">
  <Save className="h-4 w-4" />
  Guardar Pronóstico
</Button>

// ✅ Secondary Action
<Button variant="outline" className="gap-2">
  <FileSpreadsheet className="h-4 w-4" />
  Exportar
</Button>

// ✅ Tertiary/Ghost Action
<Button variant="ghost" size="sm">
  Ver Detalles
</Button>

// ✅ Icon-only Button (with aria-label)
<Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Expandir">
  <ChevronDown className="h-4 w-4" />
</Button>

// ❌ DON'T: Multiple primary buttons side-by-side
<div className="flex gap-2">
  <Button>Save</Button>  // Primary
  <Button>Submit</Button>  // Also primary - confusing!
</div>
```

### Tables

```tsx
// ✅ Standard Table Structure
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[200px]">Descripción</TableHead>
      <TableHead className="text-right">Planned</TableHead>
      <TableHead className="text-right">Forecast</TableHead>
      <TableHead className="text-right">Actual</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="hover:bg-muted/50">  // Add hover state
      <TableCell className="font-medium">Item Name</TableCell>
      <TableCell className="text-right">$10,000</TableCell>
      ...
    </TableRow>
  </TableBody>
</Table>

// ✅ Sticky First Column (for wide tables)
<TableCell className="sticky left-0 bg-background">
  Description (always visible)
</TableCell>

// ✅ Zebra Striping (for tables > 20 rows)
<TableRow className="even:bg-muted/20">
  ...
</TableRow>
```

### Tooltips

```tsx
// ✅ Standard Tooltip
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-xs max-w-xs">
        Explanatory text here. Keep it concise.
      </p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>

// ❌ DON'T: Put tooltips on text (use aria-label instead)
<TooltipTrigger>
  <p>Some very long text...</p>  // Wrong
</TooltipTrigger>
```

---

## Border & Elevation

### Border Weight

```tsx
// ✅ Standard cards, sections
border        →  1px solid (default for most content)

// ✅ Highlighted/active elements (use sparingly)
border-2      →  2px solid (priority cards, errors, focused inputs)

// ✅ Placeholder/empty states
border-2 border-dashed  →  2px dashed (drag-drop zones, empty state cards)

// ❌ DON'T: Use border-2 everywhere
<Card className="border-2">  // Only if intentionally highlighting this card
```

### Border Colors

```tsx
// ✅ Standard borders
border                  // Uses theme border color (muted)
border-muted            // Explicit muted border
border-primary/20       // Subtle brand color accent

// ✅ Status borders
border-green-200        // Success
border-yellow-200       // Warning
border-red-200          // Error
border-blue-200         // Info

// ❌ DON'T: Use dark borders on light backgrounds
border-gray-900         // Too harsh, use border-muted instead
```

### Shadows (Elevation)

```tsx
// ✅ Cards (default, flat)
<Card>  // No shadow by default, relies on border

// ✅ Floating elements (modals, dropdowns)
<Dialog>  // Built-in shadow
<Select>  // Built-in shadow

// ✅ Custom elevation (use sparingly)
className="shadow-sm"   // Subtle: 0 1px 2px
className="shadow"      // Normal: 0 1px 3px
className="shadow-md"   // Medium: 0 4px 6px
className="shadow-lg"   // Large: 0 10px 15px

// ❌ DON'T: Mix shadows and heavy borders
<Card className="border-2 shadow-lg">  // Visual overkill
```

---

## Layout Grid

### Responsive Grid

```tsx
// ✅ Responsive KPI Grid
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
  <div>KPI 1</div>
  <div>KPI 2</div>
  <div>KPI 3</div>
  ...
</div>

// ✅ Dashboard Layout
<div className="max-w-full mx-auto p-6 space-y-4">
  {/* Page content with consistent max-width and padding */}
</div>

// ✅ Two-Column Layout
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <div>Left Column</div>
  <div>Right Column</div>
</div>
```

### Breakpoints (Tailwind Defaults)

```
sm:  640px   // Small devices
md:  768px   // Tablets
lg:  1024px  // Laptops
xl:  1280px  // Desktops
2xl: 1536px  // Large screens
```

### Max-Width Constraints

```tsx
// ✅ Dashboard pages
max-w-full         // Full width (default for data tables)
max-w-7xl          // 1280px (comfortable for most content)
max-w-4xl          // 896px (for forms, modals)

// ✅ Text content
max-w-xs   max-w-sm   max-w-md   max-w-lg   max-w-xl
 320px      384px      448px      512px      576px
```

---

## Interactive States

### Hover States

```tsx
// ✅ Table rows
<TableRow className="hover:bg-muted/50">

// ✅ Clickable cards
<Card className="cursor-pointer hover:bg-accent/50 transition-colors">

// ✅ Icon buttons
<Button variant="ghost" className="hover:bg-muted">

// ❌ DON'T: Forget hover states on interactive elements
<div onClick={handleClick}>  // Missing hover feedback
```

### Focus States

```tsx
// ✅ Keyboard navigation (built into shadcn components)
<Button>  // Automatically has focus-visible:ring-2

// ✅ Custom focusable elements
<div
  tabIndex={0}
  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  Custom Element
</div>
```

### Loading States

```tsx
// ✅ Button loading
<Button disabled={loading}>
  {loading && <LoadingSpinner size="sm" className="mr-2" />}
  {loading ? "Guardando..." : "Guardar"}
</Button>

// ✅ Full page loading
{loading ? (
  <div className="flex items-center justify-center h-64">
    <LoadingSpinner />
  </div>
) : (
  <Content />
)}
```

### Disabled States

```tsx
// ✅ Disabled inputs (automatic with disabled prop)
<Input disabled={!canEdit} />  // Automatically gets opacity-50 cursor-not-allowed

// ✅ Disabled with explanation
<div>
  <Input disabled={!canEdit} />
  {!canEdit && (
    <p className="text-xs text-muted-foreground mt-1">
      Solo usuarios PMO pueden editar
    </p>
  )}
</div>
```

---

## Accessibility

### ARIA Labels

```tsx
// ✅ Icon-only buttons
<Button
  variant="ghost"
  size="sm"
  className="h-8 w-8 p-0"
  aria-label="Expandir sección"
>
  <ChevronDown className="h-4 w-4" />
</Button>

// ✅ Form inputs with invisible labels
<Label htmlFor="budget-amount" className="sr-only">
  Monto del presupuesto
</Label>
<Input id="budget-amount" aria-label="Monto del presupuesto" />
```

### Keyboard Navigation

```tsx
// ✅ Ensure all interactive elements are keyboard accessible
<Collapsible>
  <CollapsibleTrigger asChild>
    <Button>  // Natively keyboard accessible
      Expand
    </Button>
  </CollapsibleTrigger>
</Collapsible>

// ✅ Custom keyboard shortcuts (document them)
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();  // Ctrl+S to save
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

### Color Contrast

```tsx
// ✅ Minimum contrast ratios (WCAG AA)
text-foreground on bg-background  →  4.5:1 minimum
text-muted-foreground            →  3:1 minimum (large text)

// ❌ DON'T: Use low-contrast combinations
<div className="text-gray-400 bg-gray-300">  // Fails WCAG
```

### Screen Reader Support

```tsx
// ✅ Semantic HTML
<nav>
  <ul>
    <li><a href="/forecast">Pronóstico</a></li>
  </ul>
</nav>

// ✅ ARIA roles when semantic HTML isn't enough
<div role="alert" aria-live="polite">
  Forecast saved successfully
</div>

// ✅ Hidden decorative elements
<Icon className="mr-2" aria-hidden="true" />
```

---

## Progressive Disclosure

### Collapsible Sections

```tsx
// ✅ Secondary information collapsed by default
<Collapsible defaultOpen={false}>
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Analytics & Trends</CardTitle>
          <Badge variant="outline" className="text-xs">Optional</Badge>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
    </CardHeader>
    <CollapsibleContent>
      <CardContent>{/* Details */}</CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>

// ✅ Primary information expanded by default
<Collapsible defaultOpen={true}>
  {/* Essential content */}
</Collapsible>
```

### Modal Dialogs

```tsx
// ✅ Use modals for focused tasks
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">View Details</Button>
  </DialogTrigger>
  <DialogContent className="max-w-4xl">
    <DialogHeader>
      <DialogTitle>Detailed Analytics</DialogTitle>
      <DialogDescription>
        In-depth analysis of forecast variance
      </DialogDescription>
    </DialogHeader>
    {/* Detailed content */}
  </DialogContent>
</Dialog>
```

### Tabs

```tsx
// ✅ Use tabs to group related content
<Tabs defaultValue="forecast">
  <TabsList>
    <TabsTrigger value="forecast">Forecast</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  <TabsContent value="forecast">
    {/* Forecast view */}
  </TabsContent>
  <TabsContent value="analytics">
    {/* Analytics view */}
  </TabsContent>
</Tabs>
```

---

## Anti-Patterns (DON'T)

### ❌ Visual Overload
```tsx
// DON'T: Show everything at once
<Page>
  <KPICards />         // 6 cards
  <SummaryBar />       // More KPIs
  <BigChart />         // Full-width chart
  <Table />            // Data grid
  <AnalyticsPanel />   // More charts
  <VarianceTable1 />   // Another table
  <VarianceTable2 />   // Yet another table
</Page>

// DO: Use progressive disclosure
<Page>
  <SummaryBar />       // Top 3 KPIs only
  <Table />            // Main content
  <Collapsible defaultOpen={false}>
    <AnalyticsPanel /> // Hidden by default
  </Collapsible>
</Page>
```

### ❌ Inconsistent Spacing
```tsx
// DON'T: Mix spacing values randomly
<div className="space-y-2">
  <Card className="p-6">
    <div className="space-y-5">
      <div className="gap-3">...</div>
    </div>
  </Card>
</div>

// DO: Use systematic spacing
<div className="space-y-4">
  <Card className="p-3">
    <div className="space-y-3">
      <div className="gap-2">...</div>
    </div>
  </Card>
</div>
```

### ❌ Border Overuse
```tsx
// DON'T: Too many borders
<Card className="border-2">
  <div className="border-2 rounded p-4">
    <div className="border-2 rounded p-2">
      Content
    </div>
  </div>
</Card>

// DO: Minimal borders
<Card className="border">
  <CardContent className="p-4">
    <div className="bg-muted/20 rounded p-2">  // Use background instead
      Content
    </div>
  </CardContent>
</Card>
```

### ❌ Poor Color Contrast
```tsx
// DON'T: Low contrast text
<div className="text-gray-400">
  Important information  // Fails WCAG
</div>

// DO: Accessible contrast
<div className="text-muted-foreground">  // WCAG AA compliant
  Important information
</div>
```

---

## Checklist: Before Committing UI Changes

- [ ] Spacing follows 8pt grid (p-2, p-3, p-4, gap-2, gap-4, space-y-4)
- [ ] Typography uses defined scale (text-sm, text-lg, text-xl)
- [ ] Colors use semantic classes (text-muted-foreground, bg-card, etc.)
- [ ] Borders are `border` (1px) unless intentionally highlighted (`border-2`)
- [ ] Cards have consistent padding (p-3 for headers, pt-0 for content)
- [ ] Collapsible sections for secondary content (defaultOpen={false})
- [ ] Hover states on interactive elements
- [ ] ARIA labels on icon-only buttons
- [ ] Focus states for keyboard navigation
- [ ] Responsive grid (grid-cols-1 md:grid-cols-3)
- [ ] No duplicate primary buttons in same section
- [ ] Status badges use appropriate colors (green/yellow/red)
- [ ] Tables have row hover states
- [ ] Long content has max-width constraints
- [ ] Loading and disabled states handled

---

## Resources

- **Tailwind CSS Docs:** https://tailwindcss.com/docs
- **shadcn/ui Components:** https://ui.shadcn.com/
- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **Material Design Spacing:** https://m3.material.io/foundations/layout/applying-layout/spacing

---

**Enforcement:** This guide should be referenced during code reviews. Any new UI components must follow these patterns. Legacy components should be refactored incrementally to match these standards.

**Questions?** Open a discussion in the #design-system channel.
