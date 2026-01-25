# Rubros Integration Guide

## Overview

This guide explains how to integrate the canonical rubros taxonomy across all modules in the application. The goal is to ensure **all modules read from the single source of truth** (`/data/rubros.taxonomy.json`) for consistent data flow from Estimator → Baseline → Rubros → Forecast.

## Single Source of Truth

**File:** `/data/rubros.taxonomy.json`

All rubros data must flow from this canonical taxonomy. No module should maintain its own hardcoded rubros list.

## Core Components & APIs

### 1. Canonical Taxonomy Library

**File:** `src/lib/rubros/canonical-taxonomy.ts`

**Key Exports:**
```typescript
// Main taxonomy array
export const CANONICAL_RUBROS_TAXONOMY: CanonicalRubroTaxonomy[];

// Helper functions
export function getCanonicalRubroById(id: string): CanonicalRubroTaxonomy | null;
export function getCanonicalRubroId(raw: string): string | null;
export function isValidRubroId(id: string): boolean;
export function getAllCanonicalIds(): string[];
export function getAllCategories(): string[];
export function getRubrosByCategory(categoryCode: string): CanonicalRubroTaxonomy[];
```

### 2. SelectRubro Component

**File:** `src/components/SelectRubro.tsx`

A reusable dropdown component that:
- ✅ Loads rubros from canonical taxonomy
- ✅ Groups rubros by category using `getAllCategories()` and `getRubrosByCategory()`
- ✅ Searchable/filterable
- ✅ Validates selected values against canonical IDs
- ✅ Prevents free-text input

**Usage Example:**
```tsx
import { SelectRubro } from '@/components/SelectRubro';

function MyForm() {
  const [rubroId, setRubroId] = useState('');
  
  return (
    <SelectRubro
      value={rubroId}
      onValueChange={setRubroId}
      label="Select Rubro"
      categoryFilter="MOD" // Optional: filter to specific category
      typeFilter="labor" // Optional: filter to labor/non-labor
      searchable={true}
      showCategories={true}
      required
    />
  );
}
```

### 3. Rubros Helper API

**File:** `src/api/helpers/rubros.ts`

Provides enriched rubros metadata for UI components:

```typescript
// Fetch all rubros with metadata
export async function fetchRubrosCatalog(): Promise<RubroMeta[]>;

// Fetch only labor rubros (MOD category)
export async function fetchLaborRubros(): Promise<RubroMeta[]>;

// Fetch only non-labor rubros (all except MOD)
export async function fetchNonLaborRubros(): Promise<RubroMeta[]>;

// Map MOD role to canonical rubro ID
export function mapModRoleToRubroId(role: MODRole): string;
```

### 4. React Hooks

**File:** `src/hooks/useRubrosCatalog.ts`

```typescript
// Fetch all rubros with loading/error states
const { rubros, loading, error } = useRubrosCatalog();

// Fetch only labor rubros
const { rubros, loading, error } = useLaborRubros();

// Fetch only non-labor rubros
const { rubros, loading, error } = useNonLaborCatalog();
```

## Integration Checklist by Module

### ✅ Already Integrated

These modules are correctly using the canonical taxonomy:

1. **`src/lib/rubros/canonical-taxonomy.ts`** - Core library, imports from JSON
2. **`services/finanzas-api/src/lib/canonical-taxonomy.ts`** - Server-side, loads from JSON
3. **`src/api/helpers/rubros.ts`** - Uses canonical taxonomy
4. **`src/features/pmo/prefactura/Estimator/steps/LaborStep.tsx`** - Uses `mapModRoleToRubroId()`
5. **`src/components/SelectRubro.tsx`** - Uses canonical helpers

### 🔧 Needs Integration

The following modules should be updated to use the canonical taxonomy:

#### Priority 1: Baseline Forms

**Files to Update:**
- `src/features/pmo/**/BaselineForm.*` (if exists)
- `src/modules/pmo/**` baseline creation components

**Action Required:**
1. Replace any free-text rubro inputs with `<SelectRubro />` component
2. Ensure `rubroId` values are stored using canonical IDs
3. Use `isValidRubroId()` for validation before submission

**Example Migration:**
```tsx
// ❌ BEFORE: Free-text input
<Input
  value={rubroId}
  onChange={(e) => setRubroId(e.target.value)}
  placeholder="Enter rubro ID"
/>

// ✅ AFTER: Canonical dropdown
<SelectRubro
  value={rubroId}
  onValueChange={setRubroId}
  label="Rubro"
  required
/>
```

#### Priority 2: Invoice/Reconciliation Forms

**Files to Update:**
- `src/features/sdmt/cost/Recon/**` - Reconciliation components
- Invoice upload/edit forms

**Action Required:**
1. Use `SelectRubro` for rubro selection
2. Validate incoming invoice rubros with `getCanonicalRubroId()`
3. Map legacy IDs to canonical IDs using the canonical-taxonomy functions

#### Priority 3: Changes/Approval Workflows

**Files to Update:**
- `src/features/sdmt/cost/Changes/**` - Change management
- Any approval workflow components

**Action Required:**
1. Ensure change requests reference canonical rubro IDs
2. Display rubro names using canonical taxonomy
3. Use `getRubrosByCategory()` for category grouping in UIs

#### Priority 4: Forecast & Budget Modules

**Files to Update:**
- `src/features/sdmt/cost/Forecast/**` - Forecast displays
- Budget management components

**Action Required:**
1. Match allocations/invoices to rubros using canonical IDs
2. Use canonical taxonomy for rubro labels and categories
3. Group by category using `getAllCategories()` and `getRubrosByCategory()`

## Migration Steps for Each Module

### Step 1: Identify Rubro Usage

Search for these patterns in your module:
```bash
# Find hardcoded rubro IDs
grep -r "MOD-\|GSV-\|TEC-\|INF-" your-module/

# Find rubro selection inputs
grep -r "rubro\|linea_codigo\|linea_gasto" your-module/
```

### Step 2: Import Canonical Taxonomy

```typescript
// For direct taxonomy access
import {
  CANONICAL_RUBROS_TAXONOMY,
  getCanonicalRubroId,
  isValidRubroId,
  getAllCategories,
  getRubrosByCategory,
} from '@/lib/rubros/canonical-taxonomy';

// For UI component
import { SelectRubro } from '@/components/SelectRubro';

// For enriched metadata
import { fetchRubrosCatalog } from '@/api/helpers/rubros';
import { useRubrosCatalog } from '@/hooks/useRubrosCatalog';
```

### Step 3: Replace Hardcoded Data

```typescript
// ❌ BEFORE: Hardcoded array
const RUBROS = ['MOD-ING', 'MOD-LEAD', 'GSV-REU'];

// ✅ AFTER: From canonical taxonomy
const rubros = CANONICAL_RUBROS_TAXONOMY.map(r => r.linea_codigo);
// OR use helper
const rubros = getAllCanonicalIds();
```

### Step 4: Validate User Input

```typescript
// Validate before saving
function handleSubmit(data: FormData) {
  const rubroId = data.rubroId;
  
  // Validate it's canonical
  if (!isValidRubroId(rubroId)) {
    throw new Error(`Invalid rubro ID: ${rubroId}`);
  }
  
  // Or map legacy to canonical
  const canonicalId = getCanonicalRubroId(rubroId);
  if (!canonicalId) {
    throw new Error(`Unknown rubro: ${rubroId}`);
  }
  
  // Save canonical ID
  await saveBaseline({ ...data, rubroId: canonicalId });
}
```

### Step 5: Use SelectRubro in Forms

```tsx
function BaselineForm() {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  
  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: crypto.randomUUID(),
      rubroId: '', // Will be set via SelectRubro
      amount: 0,
    }]);
  };
  
  const updateLineItem = (id: string, rubroId: string) => {
    setLineItems(items => 
      items.map(item => 
        item.id === id ? { ...item, rubroId } : item
      )
    );
  };
  
  return (
    <div>
      {lineItems.map(item => (
        <div key={item.id}>
          <SelectRubro
            value={item.rubroId}
            onValueChange={(rubroId) => updateLineItem(item.id, rubroId)}
            label="Rubro"
            required
          />
          <Input
            type="number"
            value={item.amount}
            onChange={(e) => updateLineItem(item.id, { amount: Number(e.target.value) })}
          />
        </div>
      ))}
      <Button onClick={addLineItem}>Add Line Item</Button>
    </div>
  );
}
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│               Single Source of Truth                        │
│          /data/rubros.taxonomy.json                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────────┐       ┌───────────────────┐
│   Client Side     │       │   Server Side     │
│  canonical-       │       │  canonical-       │
│  taxonomy.ts      │       │  taxonomy.ts      │
└───────┬───────────┘       └───────┬───────────┘
        │                           │
        ├──────────┬────────────────┤
        │          │                │
        ▼          ▼                ▼
┌──────────┐ ┌─────────┐   ┌──────────────┐
│SelectRubro│ │ Rubros  │   │ validateRubro│
│Component │ │ Helpers │   │ (API)        │
└──────────┘ └─────────┘   └──────────────┘
        │          │                │
        ▼          ▼                ▼
┌─────────────────────────────────────────┐
│         All Application Modules         │
│  - Estimator (LaborStep, etc.)         │
│  - Baseline Forms                       │
│  - Invoice/Reconciliation               │
│  - Changes/Approvals                    │
│  - Forecast/Budget                      │
└─────────────────────────────────────────┘
```

## Testing Integration

After integrating a module, verify:

1. **UI Component Test:**
   ```tsx
   // Can select canonical rubros
   const { getByRole, getByText } = render(<YourForm />);
   const select = getByRole('combobox');
   fireEvent.click(select);
   expect(getByText('MOD-ING')).toBeInTheDocument();
   ```

2. **Validation Test:**
   ```typescript
   // Rejects non-canonical IDs
   expect(isValidRubroId('MOD-INVALID')).toBe(false);
   expect(isValidRubroId('MOD-ING')).toBe(true);
   ```

3. **Data Flow Test:**
   ```typescript
   // Baseline creates with canonical IDs
   const baseline = await createBaseline({
     lineItems: [{ rubroId: 'MOD-ING', amount: 5000 }]
   });
   expect(baseline.lineItems[0].rubroId).toBe('MOD-ING');
   ```

## Common Pitfalls

### ❌ Don't: Hardcode Rubro Lists

```typescript
// Bad - will get out of sync
const LABOR_RUBROS = ['MOD-ING', 'MOD-LEAD', 'MOD-SDM'];
```

### ✅ Do: Use Canonical Helpers

```typescript
// Good - always in sync
const laborRubros = getRubrosByCategory('MOD');
```

### ❌ Don't: Accept Free-Text Rubro Input

```tsx
// Bad - users can enter invalid IDs
<Input value={rubroId} onChange={handleChange} />
```

### ✅ Do: Use SelectRubro Component

```tsx
// Good - enforces canonical IDs
<SelectRubro value={rubroId} onValueChange={setRubroId} />
```

### ❌ Don't: Skip Validation

```typescript
// Bad - assumes ID is valid
await saveInvoice({ rubroId: userInput });
```

### ✅ Do: Validate Before Saving

```typescript
// Good - validates and maps to canonical
const canonicalId = getCanonicalRubroId(userInput);
if (!canonicalId) {
  throw new Error('Invalid rubro ID');
}
await saveInvoice({ rubroId: canonicalId });
```

## Support & Questions

- **Canonical Taxonomy:** `/data/rubros.taxonomy.json`
- **Client Library:** `src/lib/rubros/canonical-taxonomy.ts`
- **Server Library:** `services/finanzas-api/src/lib/canonical-taxonomy.ts`
- **UI Component:** `src/components/SelectRubro.tsx`
- **Deployment Guide:** `DEPLOYMENT_GUIDE_STRICT_RUBROS.md`
- **Technical Details:** `IMPLEMENTATION_SUMMARY_STRICT_RUBROS.md`

## Next Steps

1. Review this guide
2. Identify modules in your area that need integration
3. Follow the migration steps for each module
4. Test thoroughly
5. Submit PR with integration changes

**Remember:** The goal is **ONE source of truth** for all rubros data across the entire application.
