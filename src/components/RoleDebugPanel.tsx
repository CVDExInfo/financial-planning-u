import { useLocation } from 'react-router-dom';
import { useKV } from '@github/spark/hooks';
import { UserRole } from '@/types/domain';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function RoleDebugPanel() {
  const location = useLocation();
  const [currentRole, setCurrentRole] = useKV<UserRole>('user-role', 'PMO');

  const canAccessRoute = (route: string, role: UserRole): boolean => {
    if (route.startsWith('/pmo/')) {
      return ['PMO', 'EXEC_RO'].includes(role);
    }
    if (route.startsWith('/sdmt/')) {
      return ['SDMT', 'PMO', 'EXEC_RO'].includes(role);
    }
    return true;
  };

  const roles: UserRole[] = ['PMO', 'SDMT', 'VENDOR', 'EXEC_RO'];

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-card/95 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-sm">Role Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground">Current Role:</div>
          <Badge variant="outline">{currentRole}</Badge>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground">Current Path:</div>
          <code className="text-xs">{location.pathname}</code>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground">Path Accessible:</div>
          <Badge variant={canAccessRoute(location.pathname, currentRole || 'PMO') ? 'default' : 'destructive'}>
            {canAccessRoute(location.pathname, currentRole || 'PMO') ? 'Yes' : 'No'}
          </Badge>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground mb-2">Switch Role:</div>
          <div className="grid grid-cols-2 gap-1">
            {roles.map(role => (
              <Button 
                key={role}
                size="sm"
                variant={role === currentRole ? 'default' : 'outline'}
                onClick={() => setCurrentRole(role)}
                className="text-xs"
              >
                {role}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Access Matrix:
          <ul className="mt-1 space-y-1">
            <li>PMO: {canAccessRoute('/pmo/prefactura/estimator', currentRole || 'PMO') ? '✅' : '❌'} PMO, {canAccessRoute('/sdmt/cost/catalog', currentRole || 'PMO') ? '✅' : '❌'} SDMT</li>
            <li>SDMT: {canAccessRoute('/pmo/prefactura/estimator', currentRole || 'PMO') ? '✅' : '❌'} PMO, {canAccessRoute('/sdmt/cost/catalog', currentRole || 'PMO') ? '✅' : '❌'} SDMT</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default RoleDebugPanel;