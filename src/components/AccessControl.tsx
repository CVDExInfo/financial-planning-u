import { Navigate, useLocation, useNavigate } from "react-router-dom";
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

interface AccessControlProps {
  children: React.ReactNode;
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

  const allowed = hasAnyRole(requiredRoles);
  const routeAllowed = canAccessRoute(normalizeAppPath(location.pathname));

  if (!allowed || !routeAllowed) {
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
                Required roles: {requiredRoles.join(", ") || "Not specified"}
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
