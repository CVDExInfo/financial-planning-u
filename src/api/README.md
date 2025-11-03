# Finanzas API Client

This directory contains the typed API client for the Finanzas SD module.

## Structure

```
src/api/
├── client.ts              # Core API client with JWT auth and error handling
├── index.ts               # Clean API endpoint functions
├── mocks/                 # Mock JSON data for development
│   ├── projects.json
│   ├── rubros.json
│   ├── plan.json
│   ├── adjustments.json
│   ├── movements.json
│   └── providers.json
├── FinanzasApiExample.tsx # Example component showing API usage
└── README.md              # This file
```

## Quick Start

### Import and use API functions

```typescript
import { getProjects, getRubros, createProject } from '@/api';

// List projects
const response = await getProjects({ status: 'active' });
console.log(response.data);

// Get rubros catalog
const rubros = await getRubros();
console.log(rubros.data);
```

### Enable mock mode

Set in your `.env` or `.env.local`:

```bash
VITE_USE_MOCKS=true
```

## Features

- ✅ **Full Type Safety**: Generated from OpenAPI spec
- ✅ **JWT Authentication**: Automatic bearer token injection
- ✅ **Error Handling**: Structured error responses
- ✅ **Mock Layer**: Local development without API
- ✅ **401 Handling**: Automatic unauthorized detection

## Documentation

See [docs/fe/api-usage.md](../../docs/fe/api-usage.md) for complete documentation.

## Available Endpoints

- **Projects**: `getProjects`, `createProject`, `createHandoff`
- **Catalog**: `getRubros`, `addProjectRubro`, `getProjectRubros`
- **Allocations**: `bulkUpdateAllocations`, `getProjectPlan`
- **Payroll**: `ingestPayroll`, `closeMonth`, `getCoverageReport`
- **Adjustments**: `createAdjustment`, `getAdjustments`
- **Movements**: `createMovement`, `getMovements`, `approveMovement`, `rejectMovement`
- **Alerts**: `getAlerts`
- **Providers**: `createProvider`, `getProviders`
- **Webhooks**: `prefacturaWebhook`

## Type Helpers

```typescript
import type { ApiResponse, ApiRequestBody } from '@/api/client';

// Get response type
type ProjectsResponse = ApiResponse<'/projects', 'get'>;

// Get request body type
type ProjectCreate = ApiRequestBody<'/projects', 'post'>;
```

## Regenerate Types

When the OpenAPI spec changes:

```bash
npm run generate-api-types
```
