import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logoutWithHostedUI } from "@/config/aws";
import { useAuth } from "@/hooks/useAuth";

/**
 * Component shown to authenticated users who have no assigned roles/groups
 */
export function NoAccess() {
  const { logout } = useAuth();

  const handleSignOut = () => {
    logout();
    logoutWithHostedUI();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Sin permisos asignados</CardTitle>
          <CardDescription className="text-base">
            No tienes permisos asignados para acceder a esta aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Tu cuenta está autenticada pero no tiene grupos de Cognito asociados
              que otorguen acceso a los módulos de esta aplicación.
            </p>
            <p className="font-medium">
              Para obtener acceso, contacta al administrador del sistema.
            </p>
          </div>
          <div className="pt-4 border-t">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleSignOut}
            >
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default NoAccess;
