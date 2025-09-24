import { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useKV } from '@github/spark/hooks';
import { UserRole } from '@/types/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

interface AccessControlProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  fallbackPath?: string;
}

export function AccessControl({ 
  children, 
  requiredRoles = [], 
  fallbackPath = '/' 
}: AccessControlProps) {
  const location = useLocation();
  const [currentRole] = useKV<UserRole>('user-role', 'PMO');
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // Check if current role has access
    const hasAccess = checkAccess(location.pathname, currentRole || 'PMO');
    if (!hasAccess) {
      // Add a small delay to prevent flash of error message
      const timer = setTimeout(() => setShouldRedirect(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShouldRedirect(false);
    }
  }, [location.pathname, currentRole]);

  const checkAccess = (route: string, role: UserRole): boolean => {
    if (requiredRoles.length > 0) {
      return requiredRoles.includes(role);
    }

    // Default role-based access control
    if (route.startsWith('/pmo/')) {
      return ['PMO', 'EXEC_RO'].includes(role);
    }
    if (route.startsWith('/sdmt/')) {
      return ['SDMT', 'PMO', 'EXEC_RO'].includes(role);
    }
    return true;
  };

  if (shouldRedirect) {
    return <Navigate to={fallbackPath} replace />;
  }

  const hasAccess = checkAccess(location.pathname, currentRole || 'PMO');

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