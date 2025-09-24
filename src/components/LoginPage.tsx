import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, LogIn, Shield, Users, Eye } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getRoleInfo } from '@/lib/auth';
import { UserRole } from '@/types/domain';

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const roleIcons: Record<UserRole, any> = {
    PMO: Shield,
    SDMT: Users,
    VENDOR: Users,
    EXEC_RO: Eye
  };

  const availableRoles: UserRole[] = ['PMO', 'SDMT', 'VENDOR', 'EXEC_RO'];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <Card className="glass-card">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">I</span>
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl">Financial Planning & Management</CardTitle>
              <CardDescription className="text-base mt-2">
                Ikusi Digital Platform
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Role Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Available Roles</h3>
              <div className="grid grid-cols-2 gap-2">
                {availableRoles.map((role) => {
                  const roleInfo = getRoleInfo(role);
                  const Icon = roleIcons[role];
                  return (
                    <div key={role} className="flex items-center space-x-2 p-2 rounded-lg border border-border/50">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <Badge variant="secondary" className="text-xs">
                          {roleInfo.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Your role and access will be determined automatically based on your GitHub account.
              </p>
            </div>

            {/* Sign In Button */}
            <Button 
              onClick={handleSignIn} 
              disabled={isLoading}
              className="w-full h-11"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in with GitHub
                </>
              )}
            </Button>

            {/* Demo Note */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground">
                <strong>Demo Mode:</strong> In this demonstration environment, role switching is available 
                for testing purposes. In production, roles would be managed by your organization's 
                identity provider.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;