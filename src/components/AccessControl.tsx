import { Navigate, useLocation } from "react-router-dom";
import { UserRole } from "@/types/domain";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

interface AccessControlProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

export function AccessControl({
  children,
  requiredRoles = [],
}: AccessControlProps) {
  const location = useLocation();
  const {
    currentRole,
    canAccessRoute,
    isLoading,
    isAuthenticated,
    routeConfigMissing,
  } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const { hasAnyRole } = usePermissions();

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
    return <Navigate to="/finanzas/" replace />;
  }

  if (routeConfigMissing) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12 text-center">
        <Card>
          <CardHeader>
            <CardTitle>No route configuration found for your role</CardTitle>
            <CardDescription>
              Please contact the administrator so we can provision access for your account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (shouldRedirect) {
    const defaultRoute = getDefaultRouteForRole(currentRole);
    return <Navigate to={defaultRoute} replace />;
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  const allowed = hasAnyRole(requiredRoles);

  if (!allowed) {
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
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default AccessControl;
