import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ModuleType } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, Calculator, BarChart3, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getDefaultRouteForRole, getRoleInfo } from '@/lib/auth';
import { toast } from 'sonner';

interface NavigationProps {
  currentModule?: ModuleType;
}

export function Navigation({ currentModule }: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, currentRole, availableRoles, setRole, canAccessRoute, signOut } = useAuth();

  // Check if current route is accessible when role or location changes
  useEffect(() => {
    if (!canAccessRoute(location.pathname)) {
      // Redirect to appropriate module based on role
      const defaultRoute = getDefaultRouteForRole(currentRole);
      navigate(defaultRoute);
      
      toast.info('Redirected to accessible page', {
        description: 'You were redirected to a page accessible with your current role'
      });
    }
  }, [currentRole, location.pathname, navigate, canAccessRoute]);

  const getModuleBadgeClass = (module: ModuleType) => {
    return module === 'PMO' ? 'module-badge-pmo' : 'module-badge-sdmt';
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole as any);
  };

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  const moduleNavItems = {
    PMO: [
      { path: '/pmo/prefactura/estimator', label: 'Estimator', icon: Calculator },
    ],
    SDMT: [
      { path: '/sdmt/cost/catalog', label: 'Catalog', icon: Settings },
      { path: '/sdmt/cost/forecast', label: 'Forecast', icon: BarChart3 },
      { path: '/sdmt/cost/reconciliation', label: 'Reconciliation', icon: Settings },
      { path: '/sdmt/cost/cashflow', label: 'Cash Flow', icon: BarChart3 },
      { path: '/sdmt/cost/scenarios', label: 'Scenarios', icon: Settings },
      { path: '/sdmt/cost/changes', label: 'Changes', icon: Settings },
    ]
  };

  const getVisibleModuleNavItems = () => {
    // Show navigation based on current route and role access
    if (location.pathname.startsWith('/pmo/') && canAccessRoute(location.pathname)) {
      return moduleNavItems.PMO;
    } else if (location.pathname.startsWith('/sdmt/') && canAccessRoute(location.pathname)) {
      return moduleNavItems.SDMT;
    }
    // If current route is not accessible, show navigation for default module based on role
    else if (currentRole === 'PMO') {
      return moduleNavItems.PMO;
    } else if (['SDMT', 'VENDOR'].includes(currentRole)) {
      return moduleNavItems.SDMT;
    }
    return [];
  };

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">E</span>
              </div>
              <div>
                <h1 className="font-semibold text-foreground">Financial Planning</h1>
                <p className="text-xs text-muted-foreground">Enterprise PMO Platform</p>
              </div>
            </Link>
            
            {/* Module Badge */}
            {currentModule && (
              <Badge className={getModuleBadgeClass(currentModule)}>
                {currentModule}
              </Badge>
            )}
          </div>

          {/* Module Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {getVisibleModuleNavItems()
              ?.filter(item => canAccessRoute(item.path))
              .map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }
                    `}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Role Switcher */}
            {availableRoles.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Badge variant="secondary">{currentRole}</Badge>
                    <ChevronDown size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {availableRoles.map((role) => {
                    const roleInfo = getRoleInfo(role);
                    return (
                      <DropdownMenuItem
                        key={role}
                        onClick={() => handleRoleChange(role)}
                        className={currentRole === role ? 'bg-muted' : ''}
                      >
                        <div className="flex flex-col">
                          <div className="font-medium">{roleInfo.label}</div>
                          <div className="text-xs text-muted-foreground">{roleInfo.description}</div>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User Avatar */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl || ''} alt={user.login || 'User'} />
                      <AvatarFallback>{(user.login || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{user.login || 'Demo User'}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {user.email || 'demo@ikusi.com'}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile & Roles</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;