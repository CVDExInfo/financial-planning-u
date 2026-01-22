# Taxonomy Normalization Documentation

## Overview

This document explains the normalization strategies used for rubro taxonomy keys across the application and why the client and server use different approaches.

## Two Normalization Strategies

The application uses **two different normalization functions** depending on the context:

### 1. Client Normalization (`src/lib/rubros/normalize-key.ts`)

**Purpose**: UI display consistency and URL-friendly keys

**Behavior**: Converts spaces to hyphens

**Example**:
```typescript
normalizeKey('Service Delivery Manager') // → 'service-delivery-manager'
normalizeKey('Ingeniero líder / coordinador') // → 'ingeniero-lider-coordinador'
normalizeKey('test_underscore') // → 'test-underscore'
```

**Used by**:
- Client-side taxonomy lookups
- URL generation and routing
- UI component keys
- Display formatting

### 2. Server Normalization (`services/finanzas-api/src/lib/normalize-server.ts`)

**Purpose**: Backward compatibility with existing server data

**Behavior**: Preserves spaces and underscores

**Example**:
```typescript
normalizeKey('Service Delivery Manager') // → 'service delivery manager'
normalizeKey('Ingeniero líder / coordinador') // → 'ingeniero lider coordinador'
normalizeKey('test_underscore') // → 'test_underscore'
```

**Used by**:
- Server materializers (`materializers.ts`)
- Legacy database lookups
- Alias seeding from `LEGACY_RUBRO_ID_MAP`
- Taxonomy index building

## Why Two Approaches?

### Historical Context

The server's normalization preserves spaces because:

1. **Existing Data**: Legacy database records use space-separated keys
2. **API Compatibility**: Existing API responses expect space-preserved keys
3. **Migration Risk**: Changing server normalization would require migrating all DynamoDB data

The client's normalization uses hyphens because:

1. **URL Safety**: Hyphens work better in URLs than spaces
2. **Consistency**: Modern UI frameworks prefer hyphenated keys
3. **Readability**: `service-delivery-manager` is more readable than `service%20delivery%20manager`

## Common Normalization Features

Both approaches share these features:

### 1. Diacritics Removal
```typescript
'café' → 'cafe'
'niño' → 'nino'
'Mañana' → 'manana'
'técnico' → 'tecnico'
'coordinación' → 'coordinacion'
```

Uses Unicode NFD (Canonical Decomposition) to split accented characters into base + combining marks, then removes the diacritical marks.

### 2. Lowercase Conversion
```typescript
'SERVICE DELIVERY MANAGER' → all lowercase
'MixedCase' → all lowercase
```

### 3. Punctuation Removal
Both remove most punctuation (except hyphens):
```typescript
'Hello, World!' → removes comma and exclamation
'test@example.com' → removes @ and .
'(parentheses)' → removes parentheses
```

### 4. Whitespace Collapse
Multiple spaces/tabs/newlines are collapsed to single space (or single hyphen for client):
```typescript
'multiple   spaces' → collapses to one separator
```

## Implementation Details

### Server Implementation

```typescript
// services/finanzas-api/src/lib/normalize-server.ts
export function normalizeKey(input: any): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  s = s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  s = s.replace(/[^\p{L}\p{N}\s\-_]/gu, ""); // Keeps spaces and underscores
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  return s;
}
```

### Client Implementation

```typescript
// src/lib/rubros/normalize-key.ts
export function normalizeKey(s?: string): string {
  if (!s) return '';
  const raw = String(s).trim();
  const last = raw.includes('#') ? raw.split('#').pop() || raw : raw;
  return last
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')  // Converts everything except alnum and hyphen to hyphen
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

## When to Use Which

### Use Server Normalization When:
- Building taxonomy indexes in materializers
- Seeding legacy aliases from `LEGACY_RUBRO_ID_MAP`
- Looking up existing server-side data
- Maintaining backward compatibility with DynamoDB keys

### Use Client Normalization When:
- Generating UI component keys
- Creating URL slugs
- Client-side taxonomy lookups
- Display formatting

## Testing

Both normalization strategies have comprehensive test coverage:

- **Server tests**: `services/finanzas-api/test/materializer-index.spec.ts`
- **Client tests**: `src/lib/rubros/__tests__/normalize-key.test.ts`

## Future Considerations

### Potential Migration Path

If we ever need to unify the normalization strategies:

1. **Data Migration**: Migrate all server data to use hyphenated keys
2. **API Versioning**: Version the API to support both formats during transition
3. **Backward Compatibility**: Maintain alias mappings for old space-separated keys
4. **Gradual Rollout**: Migrate one service at a time to minimize risk

### Current Best Practice

For now, maintain both strategies and ensure they're well-documented and tested. The separation is intentional and serves different purposes.

## Related Files

- Client normalization: `src/lib/rubros/normalize-key.ts`
- Server normalization: `services/finanzas-api/src/lib/normalize-server.ts`
- Server materializers: `services/finanzas-api/src/lib/materializers.ts`
- Canonical taxonomy: `src/lib/rubros/canonical-taxonomy.ts`
- Copy script: `scripts/copy-canonical-taxonomy.cjs`

## Support

For questions or issues related to normalization:

1. Check test files for examples of expected behavior
2. Review implementation comments for detailed explanations
3. Consult this documentation for strategic context
