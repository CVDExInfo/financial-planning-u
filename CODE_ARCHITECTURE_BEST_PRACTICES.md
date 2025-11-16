# Code Architecture Best Practices Guide

## Financial Planning UI Application

**Version:** 1.0  
**Last Updated:** November 16, 2025  
**Author:** Architecture Review Team

---

## Table of Contents

1. [Logging Standards](#logging-standards)
2. [Component Architecture](#component-architecture)
3. [State Management](#state-management)
4. [API Integration](#api-integration)
5. [Error Handling](#error-handling)
6. [TypeScript & Type Safety](#typescript--type-safety)
7. [Performance Optimization](#performance-optimization)
8. [Accessibility (WCAG)](#accessibility-wcag)

---

## Logging Standards

### Rule: Use Logger Everywhere, Never Console

**✅ DO THIS:**

```typescript
import { logger } from "@/utils/logger";

// Descriptive logs with context
logger.debug("Catalog: Loading line items for project:", selectedProjectId);
logger.info("Projects loaded from API:", data.length, "items");
logger.warn("API call failed, falling back to mock data");
logger.error("Failed to load forecast:", error);
```

**❌ DON'T DO THIS:**

```typescript
// Never use console directly
console.log("Loading..."); // ❌ Bad
console.error("Error", error); // ❌ Bad

// Don't mix patterns in same file
console.log("One thing"); // ❌ Inconsistent
logger.info("Another"); // ❌ Inconsistent
```

### Log Levels

| Level     | Use Case                                      | Active In  |
| --------- | --------------------------------------------- | ---------- |
| **debug** | Detailed variable values, function entry/exit | DEV only   |
| **info**  | Important state changes, data loaded          | DEV only   |
| **warn**  | Fallbacks, deprecated usage, potential issues | DEV + PROD |
| **error** | Exceptions, failed operations                 | Always     |

### Log Format Convention

```typescript
// Pattern: [Context]: [Action] - [Details]
logger.debug("Catalog: Loading line items for project:", projectId);
logger.info("Catalog: Line items loaded -", items.length, "items");
logger.warn("Catalog: API failed, using mock data for project:", projectId);
logger.error("Catalog: Failed to load:", error);
```

---

## Component Architecture

### Rule: Components Must Have Three States

Every data-loading component must handle:

**✅ DO THIS:**

```typescript
export function SDMTCatalog() {
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} onRetry={loadItems} />;
  if (items.length === 0) return <EmptyState onAdd={handleAdd} />;

  return <CatalogContent items={items} />;
}
```

**❌ DON'T DO THIS:**

```typescript
// Missing loading state
if (error) return <ErrorState />;
return <CatalogContent items={items} />;  // Shows undefined items

// Silent failures
try {
  const data = await fetch(...);
} catch (e) {
  // Error ignored, UI shows nothing
}
```

### Rule: Wrap Error-Prone Features with ErrorBoundary

**✅ DO THIS:**

```typescript
<ErrorBoundary fallback={<ErrorState />}>
  <SDMTCatalog />
</ErrorBoundary>
```

**❌ DON'T DO THIS:**

```typescript
// No protection against runtime errors
<SDMTCatalog />
```

### Rule: Use Proper Component Naming & Organization

```
src/features/sdmt/cost/Catalog/
├── SDMTCatalog.tsx           (Main component, exported)
├── CatalogContent.tsx        (Sub-component: content display)
├── CatalogFilters.tsx        (Sub-component: filtering)
├── LineItemDialog.tsx        (Sub-component: modal)
├── hooks/
│   ├── useCatalogData.ts     (Custom hook for data loading)
│   └── useCatalogFilters.ts  (Custom hook for filtering)
└── types.ts                  (Local type definitions)
```

---

## State Management

### Rule: Use Hooks Properly - Always Add Dependencies

**✅ DO THIS:**

```typescript
// Dependency array complete - runs when selectedProjectId changes
useEffect(() => {
  if (selectedProjectId) {
    loadData();
  }
}, [selectedProjectId]); // ✅ Listed all dependencies

// Memoize expensive calculations
const filteredItems = useMemo(() => {
  return items.filter((item) => item.category === filter);
}, [items, filter]); // ✅ All dependencies listed
```

**❌ DON'T DO THIS:**

```typescript
// Missing dependencies - causes stale closures
useEffect(() => {
  loadData();
}, []); // ❌ Should include selectedProjectId

// No memoization - recalculates every render
const filteredItems = items.filter((item) => item.category === filter);
// ❌ Will recalculate even if items/filter unchanged
```

### Rule: Clean Up Async Operations

**✅ DO THIS:**

```typescript
useEffect(() => {
  const controller = new AbortController();

  const loadData = async () => {
    try {
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      setData(data); // Only if component still mounted
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // Request was cancelled, don't update state
        return;
      }
      setError(error);
    }
  };

  loadData();

  return () => controller.abort(); // ✅ Cleanup: abort pending requests
}, []);
```

**❌ DON'T DO THIS:**

```typescript
useEffect(() => {
  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      setData(data); // ❌ Updates state even if unmounted = memory leak warning
    });
}, []); // ❌ No cleanup
```

### Rule: Don't Use State for Derived Data

**✅ DO THIS:**

```typescript
const lineItems = [...];
const totalCost = useMemo(() => {
  return lineItems.reduce((sum, item) => sum + item.unit_cost, 0);
}, [lineItems]);  // ✅ Computed from source data
```

**❌ DON'T DO THIS:**

```typescript
const [lineItems, setLineItems] = useState([]);
const [totalCost, setTotalCost] = useState(0); // ❌ Duplicate data

// Now totalCost and lineItems can get out of sync
```

---

## API Integration

### Rule: Always Use New Unified HTTP Client

**✅ DO THIS:**

```typescript
// Use httpClient from new unified layer
import { httpClient } from "@/lib/http-client";
import { ApiSchemas } from "@/lib/api.schema";

async function loadProjects() {
  try {
    const response = await httpClient.get<Project[]>("/projects", {
      timeout: 10000,
      retries: 3,
    });

    // Validate response structure
    const projects = ApiSchemas.ProjectList.parse(response.data);
    setProjects(projects);
  } catch (error) {
    logger.error("Failed to load projects:", error);
    setError(error);
  }
}
```

**❌ DON'T DO THIS:**

```typescript
// Old fragmented patterns - will be deprecated
ApiService.getProjects();  // ❌ Old pattern
fetch(buildApiUrl(...));  // ❌ Direct fetch

// No validation
const response = await fetch(...);
const data = await response.json();
setProjects(data);  // ❌ No runtime validation
```

### Rule: Create Custom Hooks for Data Loading

**✅ DO THIS:**

```typescript
// src/features/sdmt/cost/Catalog/hooks/useCatalogData.ts
export function useCatalogData(projectId: string) {
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      try {
        setLoading(true);
        const response = await httpClient.get(`/projects/${projectId}/rubros`, {
          signal: controller.signal,
        });
        const data = ApiSchemas.LineItemList.parse(response.data);
        setItems(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setError(error as Error);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadData();
    }

    return () => controller.abort();
  }, [projectId]);

  return { items, loading, error };
}
```

**❌ DON'T DO THIS:**

```typescript
// Inline all logic in component
export function SDMTCatalog() {
  useEffect(() => {
    // 50+ lines of async code here
    // Impossible to reuse, test, or maintain
  }, []);
}
```

---

## Error Handling

### Rule: All Error Cases Must Be Caught and Shown

**✅ DO THIS:**

```typescript
async function handleSave() {
  try {
    setLoading(true);
    await httpClient.post("/items", data);
    toast.success("Item saved successfully");
  } catch (error) {
    logger.error("Failed to save item:", error);

    if (error instanceof HttpTimeoutError) {
      toast.error("Request timed out. Please try again.");
    } else if (error instanceof HttpError) {
      toast.error(`Error: ${error.status} ${error.statusText}`);
    } else {
      toast.error("An unexpected error occurred");
    }
  } finally {
    setLoading(false);
  }
}
```

**❌ DON'T DO THIS:**

```typescript
async function handleSave() {
  const result = await httpClient.post("/items", data); // ❌ No error handling
  toast.success("Saved!");
}

// Or silent failures
try {
  await httpClient.post("/items", data);
} catch (error) {
  logger.error("Failed:", error); // ❌ No user feedback
}
```

### Rule: Use Specific Error Types

**✅ DO THIS:**

```typescript
import { HttpError, HttpTimeoutError } from "@/lib/http-client";

try {
  await operation();
} catch (error) {
  if (error instanceof HttpTimeoutError) {
    // Handle timeout specifically
  } else if (error instanceof HttpError) {
    if (error.status === 401) {
      // Handle auth errors
    } else if (error.status === 404) {
      // Handle not found
    }
  }
}
```

**❌ DON'T DO THIS:**

```typescript
catch (error: any) {  // ❌ Loses type information
  // Can't distinguish error types
}
```

---

## TypeScript & Type Safety

### Rule: No `any` Types Allowed

**✅ DO THIS:**

```typescript
interface ApiResponse<T> {
  status: number;
  data: T;
  message?: string;
}

async function fetchData<T>(endpoint: string): Promise<T> {
  const response: ApiResponse<T> = await httpClient.get(endpoint);
  return response.data;
}
```

**❌ DON'T DO THIS:**

```typescript
async function fetchData(endpoint: string): Promise<any> {
  // ❌ any
  return await fetch(endpoint).then((r) => r.json());
}
```

### Rule: All Functions Need Return Types

**✅ DO THIS:**

```typescript
function calculateCost(item: LineItem): number {
  return item.qty * item.unit_cost;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
```

**❌ DON'T DO THIS:**

```typescript
function calculateCost(item: LineItem) {
  // ❌ Missing return type
  return item.qty * item.unit_cost;
}
```

### Rule: All Props Must Be Typed

**✅ DO THIS:**

```typescript
interface CatalogProps {
  items: LineItem[];
  loading: boolean;
  error: Error | null;
  onItemSelect: (item: LineItem) => void;
  onAdd: () => void;
}

export function Catalog({
  items,
  loading,
  error,
  onItemSelect,
  onAdd,
}: CatalogProps) {
  return ...
}
```

**❌ DON'T DO THIS:**

```typescript
export function Catalog(props: any) {  // ❌ any
  return ...
}

// Or implicit typing
export function Catalog({ items, loading }) {  // ❌ No types
  return ...
}
```

---

## Performance Optimization

### Rule: Memoize Expensive Operations

```typescript
// ✅ Memoize calculations
const totalCost = useMemo(() => {
  logger.debug("Recalculating total cost");
  return items.reduce((sum, item) => sum + calculateCost(item), 0);
}, [items]);

// ✅ Memoize callbacks to prevent child re-renders
const handleAdd = useCallback(() => {
  setItems([...items, newItem]);
}, [items]);

// ✅ Memoize expensive filtering
const filteredItems = useMemo(() => {
  return items.filter((item) =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [items, searchTerm]);
```

### Rule: Avoid Inline Object/Function Definitions

**✅ DO THIS:**

```typescript
// Define outside component
const defaultFilter = { category: "Labor" };

export function Catalog() {
  // Uses same object on every render
  return <Filter defaultValue={defaultFilter} />;
}
```

**❌ DON'T DO THIS:**

```typescript
export function Catalog() {
  // New object every render - child re-renders unnecessarily
  return <Filter defaultValue={{ category: "Labor" }} />;
}
```

---

## Accessibility (WCAG)

### Rule: All Interactive Elements Must Be Keyboard Accessible

**✅ DO THIS:**

```typescript
<Table>
  <TableRow
    onClick={() => handleEdit(item)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEdit(item);
      }
    }}
    tabIndex={0}
    role="row"
    aria-selected={isSelected}
  >
    <TableCell role="gridcell">{item.name}</TableCell>
  </TableRow>
</Table>
```

**❌ DON'T DO THIS:**

```typescript
<div onClick={() => handleEdit(item)}>
  {" "}
  {/* ❌ Not keyboard accessible */}
  {item.name}
</div>
```

### Rule: Use ARIA Labels for Complex Components

**✅ DO THIS:**

```typescript
<button
  aria-label="Edit item: Healthcare System Modernization"
  onClick={() => handleEdit(item)}
>
  <Edit size={16} />
</button>

<div
  role="grid"
  aria-label="Cost catalog table"
  aria-rowcount={items.length}
>
  ...
</div>
```

**❌ DON'T DO THIS:**

```typescript
<button onClick={() => handleEdit(item)}>
  <Edit size={16} /> // ❌ No label for screen readers
</button>
```

### Rule: Images and Icons Need Alt Text

**✅ DO THIS:**

```tsx
<img src="logo.png" alt="Company logo" />
<Icon role="img" aria-label="Warning icon" />
```

**❌ DON'T DO THIS:**

```tsx
<img src="logo.png" />  // ❌ Missing alt text
<Icon />  // ❌ No aria-label
```

---

## Code Review Checklist

Use this before submitting a PR:

- [ ] All `console.*` replaced with `logger.*`
- [ ] Component has loading, error, and empty states
- [ ] All fetch/HTTP calls use httpClient with validation
- [ ] All `async` operations have cleanup in useEffect
- [ ] No `any` types - all props and functions typed
- [ ] All return types explicitly specified
- [ ] No inline object/function definitions passed as props
- [ ] Expensive operations wrapped in useMemo/useCallback
- [ ] Error messages shown to users, not just logged
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels added for complex components
- [ ] Tests written for business logic
- [ ] JSDoc comments for public functions

---

## Related Documents

- `ARCHITECTURE_REVIEW_COMPREHENSIVE.md` - Full architecture audit with findings
- `src/lib/http-client.ts` - Unified HTTP client implementation
- `src/lib/api.schema.ts` - Response validation schemas
- `src/utils/logger.ts` - Logger implementation

---

**Last Updated:** November 16, 2025  
**Status:** Active - Use as reference for all new code
