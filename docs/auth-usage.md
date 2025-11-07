# Authentication & Role Management - Usage Examples

This document provides examples of how to use the authentication and role management system in the Financial Planning & Management UI.

## Basic Authentication Hooks

### Getting current user and role information

```tsx
import { useAuth, useCurrentUser, useCurrentRole } from '@/components/AuthProvider';

function MyComponent() {
  // Get all auth state
  const { user, currentRole, isAuthenticated, isLoading } = useAuth();
  
  // Or get specific parts
  const user = useCurrentUser();
  const { currentRole, setRole, availableRoles } = useCurrentRole();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please sign in</div>;
  
  return (
    <div>
      <h1>Welcome {user?.login}</h1>
      <p>Current role: {currentRole}</p>
    </div>
  );
}
```

### Checking permissions

```tsx
import { usePermissions } from '@/hooks/usePermissions';

function ActionButton() {
  const { canUpdate, canDelete, isReadOnly } = usePermissions();
  
  return (
    <div>
      <button disabled={!canUpdate}>Edit</button>
      <button disabled={!canDelete}>Delete</button>
      {isReadOnly && <p>You have read-only access</p>}
    </div>
  );
}
```

## Conditional Rendering with Protected Component

### Hide content based on role

```tsx
import Protected from '@/components/Protected';

function AdminPanel() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Only PMO can see this */}
      <Protected roles={['PMO']}>
        <button>Create Baseline</button>
      </Protected>
      
      {/* Only users who can approve see this */}
      <Protected action="approve">
        <button>Approve Change Request</button>
      </Protected>
      
      {/* Minimum role level required */}
      <Protected minimumRole="SDMT">
        <div>Cost Management Tools</div>
      </Protected>
      
      {/* Show fallback instead of hiding */}
      <Protected 
        roles={['PMO']} 
        hideWhenDenied={false}
        fallback={<p>Contact PMO for access</p>}
      >
        <button>PMO Features</button>
      </Protected>
    </div>
  );
}
```

## Route Protection

### Using AccessControl component

```tsx
import AccessControl from '@/components/AccessControl';

function App() {
  return (
    <Routes>
      <Route path="/public" element={<PublicPage />} />
      
      {/* Protected by role */}
      <Route path="/pmo/*" element={
        <AccessControl requiredRoles={['PMO']}>
          <PMORoutes />
        </AccessControl>
      } />
      
      {/* Protected by default route-based rules */}
      <Route path="/sdmt/*" element={
        <AccessControl>
          <SDMTRoutes />
        </AccessControl>
      } />
    </Routes>
  );
}
```

## Role Management

### Role switching component

```tsx
import { useCurrentRole } from '@/components/AuthProvider';
import { getRoleInfo } from '@/lib/auth';

function RoleSwitcher() {
  const { currentRole, setRole, availableRoles } = useCurrentRole();
  
  return (
    <select 
      value={currentRole} 
      onChange={(e) => setRole(e.target.value as UserRole)}
    >
      {availableRoles.map(role => (
        <option key={role} value={role}>
          {getRoleInfo(role).label}
        </option>
      ))}
    </select>
  );
}
```

### Dynamic navigation based on role

```tsx
import { usePermissions } from '@/hooks/usePermissions';

function Navigation() {
  const { currentRole, canAccessRoute } = usePermissions();
  
  const navItems = [
    { path: '/pmo/estimator', label: 'Estimator' },
    { path: '/sdmt/catalog', label: 'Catalog' },
    { path: '/sdmt/forecast', label: 'Forecast' },
  ];
  
  return (
    <nav>
      {navItems
        .filter(item => canAccessRoute(item.path))
        .map(item => (
          <Link key={item.path} to={item.path}>
            {item.label}
          </Link>
        ))}
    </nav>
  );
}
```

## Advanced Permission Patterns

### Component that adapts to role

```tsx
import { usePermissions } from '@/hooks/usePermissions';

function DataTable({ data }) {
  const { canUpdate, canDelete, currentRole } = usePermissions();
  
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Amount</th>
          {(canUpdate || canDelete) && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.id}>
            <td>{row.name}</td>
            <td>{row.amount}</td>
            {(canUpdate || canDelete) && (
              <td>
                {canUpdate && <button>Edit</button>}
                {canDelete && <button>Delete</button>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Form with role-based field access

```tsx
function ProjectForm({ project }) {
  const { canUpdate, hasAnyRole } = usePermissions();
  const isReadOnly = !canUpdate;
  const isPMO = hasAnyRole(['PMO']);
  
  return (
    <form>
      <input 
        name="name" 
        value={project.name}
        disabled={isReadOnly}
      />
      
      <input 
        name="budget" 
        value={project.budget}
        disabled={isReadOnly}
      />
      
      {/* Only PMO can modify baseline */}
      <Protected roles={['PMO']}>
        <input 
          name="baseline" 
          value={project.baseline}
          disabled={!isPMO}
        />
      </Protected>
      
      {canUpdate && <button type="submit">Save</button>}
    </form>
  );
}
```

## Testing Role-Based Features

### Mock user for testing

```tsx
// In test files
import { AuthProvider } from '@/components/AuthProvider';

const TestWrapper = ({ children, userRole = 'PMO' }) => (
  <AuthProvider>
    <MockUser role={userRole}>
      {children}
    </MockUser>
  </AuthProvider>
);

test('PMO users can see create button', () => {
  render(
    <TestWrapper userRole="PMO">
      <MyComponent />
    </TestWrapper>
  );
  
  expect(screen.getByText('Create Baseline')).toBeInTheDocument();
});

test('Vendor users cannot see create button', () => {
  render(
    <TestWrapper userRole="VENDOR">
      <MyComponent />
    </TestWrapper>
  );
  
  expect(screen.queryByText('Create Baseline')).not.toBeInTheDocument();
});
```

## Best Practices

1. **Use Protected component for UI elements** instead of manual permission checks
2. **Check permissions in components** that perform actions, not just in the UI
3. **Provide meaningful fallbacks** when access is denied
4. **Test with different roles** to ensure proper access control
5. **Use semantic permission names** (canUpdate, canApprove) over role checks
6. **Handle loading states** for async authentication
7. **Provide clear feedback** when users don't have access to features

## Backend JWT Authorizer (Finanzas API)

The Finanzas API (SAM template `services/finanzas-api/template.yaml`) secures all non-health routes with an HTTP API JWT Authorizer backed by Cognito.

### Configuration (SAM)

```yaml
Auth:
  Authorizers:
    CognitoJwt:
      JwtConfiguration:
        Issuer: https://cognito-idp.${AWS::Region}.amazonaws.com/${CognitoUserPoolId}
        Audience:
          - ${CognitoUserPoolClientId}
      IdentitySource: "$request.header.Authorization"
  DefaultAuthorizer: CognitoJwt
```

Runtime expects `Authorization: Bearer <JWT>` header containing a **Cognito ID Token** (NOT the access token). The handler layer enforces SDT group membership via `ensureSDT` in `src/lib/auth.ts`.

### Required Claims

| Claim | Purpose |
|-------|---------|
| `cognito:groups` | Must include `SDT` for protected endpoints |
| `aud` | Must match the App Client ID (`dshos5iou44tuach7ta3ici5m`) |
| `iss` | Must match `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_FyHLtOhiY` |

### Token Acquisition (Workflow / CLI)

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id dshos5iou44tuach7ta3ici5m \
  --auth-parameters USERNAME="$USERNAME",PASSWORD="$PASSWORD" \
  --region us-east-2 | jq -r '.AuthenticationResult.IdToken'
```

### Decoding for Debugging

```bash
ID_TOKEN=... # paste token
cut -d '.' -f2 <<< "$ID_TOKEN" | base64 -d | jq
```

### Access Logs (Authorizer Diagnostics)

The HTTP API writes access logs to the CloudWatch Log Group:

```
/aws/http-api/dev/finz-access
```

Format (simplified for quick grep):

```
$context.requestId $context.identity.sourceIp $context.status $context.authorizer.error
```

Sample tail:

```bash
aws logs tail /aws/http-api/dev/finz-access --since 10m --region us-east-2 | grep '401'
```

If you see authorizer errors (e.g. `Unauthorized`), verify token segments (3 parts), `aud`, `iss`, and presence of `cognito:groups`.

### Local Bypass (SAM Local Only)

Set environment variable `SKIP_AUTH=true` for specific functions during `sam local start-api` to short‑circuit `ensureSDT`. Never enable this in deployed stacks.

### Fallback Behavior

If Dynamo seed tables are not yet populated, some handlers (e.g. catalog) return an enriched static fallback and add header `X-Fallback: true`. This still requires a valid JWT unless explicitly public.

### Smoke Test Script

`scripts/test-protected-endpoints.sh` automates:

1. Resolving API URL from CloudFormation outputs
2. Fetching Cognito ID token
3. Decoding header/claims for inspection
4. Curling `/catalog/rubros`, `/allocation-rules`, `/adjustments`

Keep this script up-to-date with any new protected endpoints.

## Common Patterns to Avoid

❌ **Don't check roles directly in business logic**

```tsx
// Bad
if (currentRole === 'PMO') {
  // do something
}

// Good  
if (canPerformAction('approve')) {
  // do something
}
```

❌ **Don't forget to handle loading states**

```tsx
// Bad
const { user } = useAuth();
return <div>Welcome {user.login}</div>; // Will error if user is null

// Good
const { user, isLoading } = useAuth();
if (isLoading) return <div>Loading...</div>;
if (!user) return <div>Please sign in</div>;
return <div>Welcome {user.login}</div>;
```

❌ **Don't hardcode role assumptions**

```tsx
// Bad - assumes PMO always has full access
if (currentRole === 'PMO') {
  showAllFeatures();
}

// Good - check specific permissions
if (canUpdate && canDelete && canApprove) {
  showAllFeatures();
}
```
