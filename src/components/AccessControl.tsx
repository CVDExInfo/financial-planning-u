import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from 'react';
import { UserRole } from "@/types/domain";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { getDefaultRouteForRole, normalizeAppPath } from "@/lib/auth";
import { formatRequiredRoles } from "@/auth/rolePolicies";

interface AccessControlProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
}

export function AccessControl({
  children,
  requiredRoles = [],
}: AccessControlProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const { currentRole, canAccessRoute, hasAnyRole } = usePermissions();

  const isFinanzasRoute =
    location.pathname.startsWith("/finanzas") ||
    (typeof window !== "undefined" &&
      window.location.pathname.startsWith("/finanzas"));
  const loginPath = isFinanzasRoute ? "/finanzas/login" : "/login";

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Checking access…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  // Check role-based access (if requiredRoles specified)
  const roleCheckPassed = hasAnyRole(requiredRoles);
  
  // Check route-based access (from auth.ts ROLE_PERMISSIONS)
  const routeAllowed = canAccessRoute(normalizeAppPath(location.pathname));

  // Access is granted if:
  // 1. No specific roles required (empty array) AND route is allowed, OR
  // 2. Role check passed AND route is allowed
  const hasAccess = 
    (requiredRoles.length === 0 && routeAllowed) || 
    (roleCheckPassed && routeAllowed);

  if (!hasAccess) {
    const defaultRoute = getDefaultRouteForRole(currentRole);

    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              You don't have permission to view this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                {requiredRoles.length > 0 
                  ? `Required roles: ${formatRequiredRoles(requiredRoles)}`
                  : `Your current role (${currentRole}) does not have access to this page.`}
                <br />
                Please contact your administrator if you believe this is a mistake.
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => navigate(defaultRoute)}>Go to my workspace</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default AccessControl;
