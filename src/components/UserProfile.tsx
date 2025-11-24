import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, Shield, Clock, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getRoleInfo } from "@/lib/auth";

export function UserProfile() {
  const { user, roles, logout } = useAuth();

  if (!user) {
    return null;
  }

  const currentRole = roles[0] || "SDMT";
  const currentRoleInfo = getRoleInfo(currentRole);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={""} alt={user.email || "Usuario"} />
              <AvatarFallback className="text-lg">
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>{user.name || user.email}</span>
              </CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Current Role */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Rol actual</h3>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="text-sm">
                {currentRoleInfo.label}
              </Badge>
              <span className="text-sm text-muted-foreground">Nivel {currentRoleInfo.level}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {currentRoleInfo.description}
            </p>
          </div>

          <Separator />

          {/* Available Roles */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Roles disponibles</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((role) => {
                const roleInfo = getRoleInfo(role);
                const isCurrent = role === currentRole;
                return (
                  <div
                    key={role}
                    className={`p-3 rounded-lg border ${
                      isCurrent ? "bg-primary/5 border-primary/30" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{roleInfo.label}</span>
                      <Badge variant={isCurrent ? "default" : "secondary"}>{role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{roleInfo.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Account Actions */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Sesión</h3>
            </div>
            <Button variant="outline" onClick={logout} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Permisos por rol</CardTitle>
          <CardDescription>Acceso derivado de tus grupos Cognito</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {roles.map((role) => {
            const roleInfo = getRoleInfo(role);
            return (
              <div
                key={role}
                className={`p-3 rounded-lg border ${
                  role === currentRole ? "bg-primary/5 border-primary/20" : "bg-muted/20"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Badge
                    variant={role === currentRole ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {roleInfo.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Nivel {roleInfo.level}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{roleInfo.description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default UserProfile;
