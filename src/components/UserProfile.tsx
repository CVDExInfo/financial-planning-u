import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { User, Shield, Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getRoleInfo } from '@/lib/auth';

export function UserProfile() {
  const { user, currentRole, availableRoles, setRole, signOut } = useAuth();

  if (!user) {
    return null;
  }

  const currentRoleInfo = getRoleInfo(currentRole);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user.avatarUrl} alt={user.login} />
              <AvatarFallback className="text-lg">
                {user.login.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>{user.login}</span>
                {user.isOwner && (
                  <Badge variant="secondary" className="text-xs">
                    Owner
                  </Badge>
                )}
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
              <h3 className="text-sm font-medium">Current Role</h3>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="text-sm">
                {currentRoleInfo.label}
              </Badge>
              <span className="text-sm text-muted-foreground">Level {currentRoleInfo.level}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {currentRoleInfo.description}
            </p>
          </div>

          <Separator />

          {/* Available Roles */}
          {availableRoles.length > 1 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Switch Role</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {availableRoles.map((role) => {
                  const roleInfo = getRoleInfo(role);
                  const isCurrent = role === currentRole;
                  return (
                    <Button
                      key={role}
                      variant={isCurrent ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRole(role)}
                      disabled={isCurrent}
                      className="justify-start h-auto p-3"
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm">{roleInfo.label}</div>
                        <div className="text-xs opacity-70">Level {roleInfo.level}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Account Actions */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Session</h3>
            </div>
            <Button 
              variant="outline" 
              onClick={signOut}
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role Permissions</CardTitle>
          <CardDescription>
            What you can do with your current role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableRoles.map((role) => {
            const roleInfo = getRoleInfo(role);
            return (
              <div
                key={role}
                className={`p-3 rounded-lg border ${
                  role === currentRole ? 'bg-primary/5 border-primary/20' : 'bg-muted/20'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Badge 
                    variant={role === currentRole ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {roleInfo.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Level {roleInfo.level}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {roleInfo.description}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default UserProfile;