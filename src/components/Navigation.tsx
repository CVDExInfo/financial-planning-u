import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ModuleType, UserRole } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, Calculator, BarChart3, Settings } from 'lucide-react';
import { useKV } from '@github/spark/hooks';
import { toast } from 'sonner';

interface NavigationProps {
  currentModule?: ModuleType;
}

export function Navigation({ currentModule }: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentRole, setCurrentRole] = useKV<UserRole>('user-role', 'PMO');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get user info from Spark runtime
    if (typeof window !== 'undefined' && (window as any).spark) {
      (window as any).spark.user().then(setUser).catch(() => {
        // Fallback for demo
        setUser({
          login: 'demo-user',
          email: 'demo@ikusi.com',
          avatarUrl: '',
          isOwner: true
        });
      });
    } else {
      // Fallback for demo
      setUser({
        login: 'demo-user',
        email: 'demo@ikusi.com',
        avatarUrl: '',
        isOwner: true
      });
    }
  }, []);

  // Check if current route is accessible when role or location changes
  useEffect(() => {
    if (!canAccessRoute(location.pathname)) {
      // Redirect to appropriate module based on role
      if (currentRole === 'PMO') {
        navigate('/pmo/prefactura/estimator');
      } else if (currentRole === 'SDMT') {
        navigate('/sdmt/cost/catalog');
      } else {
        navigate('/');
      }
    }
  }, [currentRole, location.pathname, navigate]);

  const roleOptions: { role: UserRole; label: string; description: string }[] = [
    { role: 'PMO', label: 'PMO', description: 'Project Management Office' },
    { role: 'SDMT', label: 'SDMT', description: 'Service Delivery Management Team' },
    { role: 'VENDOR', label: 'Vendor', description: 'External Vendor/Contractor' },
    { role: 'EXEC_RO', label: 'Executive', description: 'Executive (Read Only)' },
  ];

  const getModuleBadgeClass = (module: ModuleType) => {
    return module === 'PMO' ? 'module-badge-pmo' : 'module-badge-sdmt';
  };

  const canAccessRoute = (route: string, role?: UserRole): boolean => {
    const roleToCheck = role || currentRole || 'PMO';
    // Simple role-based access control
    if (route.startsWith('/pmo/')) {
      return ['PMO', 'EXEC_RO'].includes(roleToCheck);
    }
    if (route.startsWith('/sdmt/')) {
      return ['SDMT', 'PMO', 'EXEC_RO'].includes(roleToCheck);
    }
    return true;
  };

  const handleRoleChange = (newRole: UserRole) => {
    const oldRole = currentRole;
    console.log('Navigation - Role change requested:', { from: oldRole, to: newRole, currentPath: location.pathname });
    
    setCurrentRole(newRole);
    
    // Show feedback about role change
    toast.success(`Role changed to ${newRole}`, {
      description: `You now have ${newRole} permissions`
    });
    
    // Navigate to appropriate module's home page based on role
    let newPath: string | null = null;
    
    console.log('Navigation - Checking access for current path:', location.pathname, 'with new role:', newRole);
    console.log('Navigation - canAccessRoute result:', canAccessRoute(location.pathname, newRole));
    
    if (newRole === 'PMO' && !canAccessRoute(location.pathname, newRole)) {
      newPath = '/pmo/prefactura/estimator';
    } else if (newRole === 'SDMT' && !canAccessRoute(location.pathname, newRole)) {
      newPath = '/sdmt/cost/catalog';
    } else if (newRole === 'VENDOR' && !canAccessRoute(location.pathname, newRole)) {
      // Vendors typically have limited access, redirect to a safe page
      newPath = '/sdmt/cost/catalog';
    } else if (newRole === 'EXEC_RO' && !canAccessRoute(location.pathname, newRole)) {
      // Executives can see most things, but redirect to home if current route is not accessible
      newPath = '/';
    }
    
    console.log('Navigation - Calculated new path:', newPath);
    
    if (newPath && newPath !== location.pathname) {
      console.log('Navigation - Navigating to:', newPath);
      navigate(newPath);
      toast.info(`Redirected to ${newRole} module`, {
        description: 'You were redirected to a page accessible with your new role'
      });
    }
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
    } else if (['SDMT', 'VENDOR'].includes(currentRole || 'PMO')) {
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
                <span className="text-primary-foreground font-bold text-sm">I</span>
              </div>
              <div>
                <h1 className="font-semibold text-foreground">Financial Planning</h1>
                <p className="text-xs text-muted-foreground">Ikusi Digital Platform</p>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Badge variant="secondary">{currentRole}</Badge>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {roleOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.role}
                    onClick={() => handleRoleChange(option.role)}
                    className={currentRole === option.role ? 'bg-muted' : ''}
                  >
                    <div className="flex flex-col">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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