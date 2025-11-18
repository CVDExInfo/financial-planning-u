import { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { UserRole } from '@/types/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultRouteForRole } from '@/lib/auth';

interface AccessControlProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

export function AccessControl({ 
  children, 
  requiredRoles = []
}: AccessControlProps) {
  const location = useLocation();
  const { currentRole, canAccessRoute } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    const checkAccess = (route: string, role: UserRole): boolean => {
      if (requiredRoles.length > 0) {
        return requiredRoles.includes(role);
      }

      // Use the auth system's access control
      return canAccessRoute(route);
    };

    // Check if current role has access
    const hasAccess = checkAccess(location.pathname, currentRole);
    if (!hasAccess) {
      // Add a small delay to prevent flash of error message
      const timer = setTimeout(() => setShouldRedirect(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShouldRedirect(false);
    }
  }, [location.pathname, currentRole, requiredRoles, canAccessRoute]);

  if (shouldRedirect) {
    const defaultRoute = getDefaultRouteForRole(currentRole);
    return <Navigate to={defaultRoute} replace />;
  }

  const hasAccess = requiredRoles.length > 0 
    ? requiredRoles.includes(currentRole)
    : canAccessRoute(location.pathname);

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              You don't have permission to view this page with your current role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Current role: <strong>{currentRole}</strong>
                <br />
                Please contact your administrator or switch to an appropriate role to access this content.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default AccessControl;