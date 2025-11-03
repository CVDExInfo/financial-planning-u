# API Usage Guide

## Overview

This document describes how to use the typed API client for the Finanzas SD module. The client provides a strongly-typed interface to the Finanzas API with automatic JWT bearer token authentication and a local mock layer for development.

## Environment Setup

### Required Environment Variables

Add these to your `.env` or `.env.local` file:

```bash
# API Base URL (required)
VITE_API_BASE_URL=https://q2b9avfwv5.execute-api.us-east-2.amazonaws.com/prod

# API Gateway ID (optional, for reference)
VITE_ACTA_API_ID=q2b9avfwv5

# Enable mock mode (optional, default: false)
VITE_USE_MOCKS=false

# Cognito settings (required for authentication)
VITE_COGNITO_WEB_CLIENT_ID=dshos5iou44tuach7ta3ici5m
VITE_COGNITO_REGION=us-east-2
VITE_COGNITO_POOL_ID=us-east-2_FyHLtOhiY

# Skip authentication (optional, for development)
VITE_SKIP_AUTH=false
```

### Toggle Mock Mode

To enable mock mode (useful for UI development without a live API):

```bash
VITE_USE_MOCKS=true
```

When mock mode is enabled:
- All API calls return mock data from `src/api/mocks/`
- No network requests are made
- No authentication is required
- 300ms simulated network delay is added

## Usage Examples

### Import the API client

```typescript
import {
  getProjects,
  createProject,
  getRubros,
  getProjectPlan,
  createMovement,
  approveMovement,
  getAlerts,
} from '@/api';
```

### List Projects

```typescript
async function loadProjects() {
  try {
    const response = await getProjects({
      status: 'active',
      limit: 20,
      offset: 0,
    });
    
    console.log('Projects:', response.data);
    console.log('Total:', response.total);
  } catch (error) {
    if (error instanceof ApiClientError) {
      console.error('API Error:', error.code, error.message);
      if (error.status === 401) {
        // Handle unauthorized - redirect to login
      }
    }
  }
}
```

### Create a New Project

```typescript
import { createProject } from '@/api';

async function addProject() {
  try {
    const project = await createProject({
      name: "Mobile Banking App MVP",
      code: "PROJ-2025-001",
      client: "Global Bank Corp",
      start_date: "2025-01-15",
      end_date: "2025-12-31",
      currency: "USD",
      mod_total: 1500000,
      description: "MVP for mobile banking application with core features"
    });
    
    console.log('Created project:', project);
  } catch (error) {
    console.error('Failed to create project:', error);
  }
}
```

### Get Budget Rubros

```typescript
import { getRubros } from '@/api';

async function loadRubros() {
  const response = await getRubros({
    tipo_ejecucion: 'mensual'
  });
  
  return response.data;
}
```

### Get Project Financial Plan

```typescript
import { getProjectPlan } from '@/api';

async function loadPlan(projectId: string, month: string) {
  const plan = await getProjectPlan(projectId, month);
  
  console.log('Engineering costs:', plan.plan_ing);
  console.log('SDM costs:', plan.plan_sdm);
  console.log('Non-recurring:', plan.non_recurrentes);
  console.log('Total:', plan.total_mes);
}
```

### Create and Approve Movements

```typescript
import { createMovement, approveMovement } from '@/api';

// Create a new movement
const movement = await createMovement({
  project_id: "proj_7x9k2m4n8p",
  rubro_id: "rubro_1a2b3c4d5e",
  tipo: "gasto",
  monto: 25000,
  fecha: "2025-10-28",
  descripcion: "Pago consultoría especializada Q4",
  proveedor_id: "prov_8h9i0j1k2l"
});

// Approve the movement
const approved = await approveMovement(movement.id, {
  aprobado_por: "finance.manager@company.com",
  comentarios: "Aprobado - documentación correcta"
});
```

## TypeScript Type Safety

The API client provides full type safety through OpenAPI-generated types:

```typescript
import type { paths } from '@/types/api';
import type { ApiResponse, ApiRequestBody } from '@/api/client';

// Get the response type for a specific endpoint
type ProjectsResponse = ApiResponse<'/projects', 'get'>;

// Get the request body type
type ProjectCreate = ApiRequestBody<'/projects', 'post'>;

// Use in your components
interface Props {
  projects: ProjectsResponse['data'];
}
```

## Authentication

The API client automatically handles JWT authentication:

1. **Token Retrieval**: Tokens are retrieved from localStorage/sessionStorage where Cognito stores them
2. **Automatic Injection**: The `Authorization: Bearer <token>` header is automatically added
3. **401 Handling**: When a 401 response is received, the client throws an `ApiClientError` with code `UNAUTHORIZED`
4. **Token Refresh**: Currently, you need to redirect users to login when tokens expire (future enhancement: automatic refresh)

### Skipping Authentication in Development

Set `VITE_SKIP_AUTH=true` in your environment to bypass authentication checks during local development.

## Error Handling

All API errors are wrapped in `ApiClientError` with a consistent structure:

```typescript
import { ApiClientError } from '@/api/client';

try {
  const data = await getProjects();
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error('Error code:', error.code);
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    console.error('Details:', error.details);
    console.error('Timestamp:', error.timestamp);
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Authentication required or token expired
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `BAD_REQUEST` - Invalid request parameters
- `HTTP_ERROR` - Other HTTP errors
- `NETWORK_ERROR` - Network connectivity issues

## Mock Data

Mock data is stored in `src/api/mocks/` directory:

- `projects.json` - List of sample projects
- `rubros.json` - Budget rubros catalog
- `plan.json` - Sample financial plan
- `adjustments.json` - Sample budget adjustments
- `movements.json` - Sample financial movements
- `providers.json` - Sample providers/vendors

To customize mock data, edit these JSON files. The mock layer automatically returns appropriate data based on the API endpoint being called.

## Regenerating Types

If the OpenAPI spec changes, regenerate the TypeScript types:

```bash
npm run generate-api-types
```

Or manually:

```bash
npx openapi-typescript openapi/finanzas.yaml -o src/types/api.d.ts
```

## Best Practices

1. **Use TypeScript**: Take advantage of the type safety provided by generated types
2. **Handle Errors**: Always wrap API calls in try-catch blocks
3. **Loading States**: Show loading indicators while API calls are in progress
4. **Retry Logic**: Implement retry logic for transient network errors
5. **Mock Mode**: Use mock mode during UI development to avoid API dependencies
6. **Environment Variables**: Never commit API keys or tokens to version control

## Region and Domain

- **Region**: us-east-2
- **CloudFront Base**: `/finanzas/`
- **API Gateway**: The API is deployed via API Gateway in us-east-2

All API paths are automatically prefixed with `/finanzas/` by the client.

## Coding Style

Follow the project's ESLint and Prettier configurations:

```bash
npm run lint
npm run format
```

## Support

For issues or questions:
- Check the OpenAPI spec: `openapi/finanzas.yaml`
- Review mock data: `src/api/mocks/`
- Contact the API team
