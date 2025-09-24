import { Link, useLocation } from 'react-router-dom';
import { Calculator, ChartLine, Upload, CreditCard, ChartBar, GitBranch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRole } from '@/components/RoleProvider';
import type { ModuleType, UserRole } from '@/types/domain';

interface NavigationProps {
  currentModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
}

export function Navigation({ currentModule, onModuleChange }: NavigationProps) {
  const location = useLocation();
  const { currentRole, setRole } = useRole();

  const pmoRoutes = [
    { path: '/pmo/prefactura/estimator', label: 'Pre-Factura Estimator', icon: Calculator },
  ];

  const sdmtRoutes = [
    { path: '/sdmt/cost/catalog', label: 'Catalog', icon: ChartLine },
    { path: '/sdmt/cost/forecast', label: 'Forecast', icon: ChartBar },
    { path: '/sdmt/cost/recon', label: 'Reconciliation', icon: Upload },
    { path: '/sdmt/cost/cashflow', label: 'Cash Flow', icon: CreditCard },
    { path: '/sdmt/cost/scenarios', label: 'Scenarios', icon: GitBranch },
    { path: '/sdmt/cost/changes', label: 'Changes', icon: Calculator },
  ];

  const handleModuleChange = (module: ModuleType) => {
    onModuleChange(module);
  };

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Module Badge */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">I</span>
              </div>
              <span className="font-semibold text-lg">Ikusi</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge 
                className={`${
                  currentModule === 'PMO' ? 'module-badge-pmo' : 'module-badge-sdmt'
                } font-medium`}
              >
                {currentModule}
              </Badge>
              <span className="text-muted-foreground">Financial Planning & Management</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            {currentModule === 'PMO' ? (
              <>
                {pmoRoutes.map((route) => {
                  const Icon = route.icon;
                  const isActive = location.pathname === route.path;
                  
                  return (
                    <Link key={route.path} to={route.path}>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        size="sm"
                        className="flex items-center space-x-2"
                        onClick={() => handleModuleChange('PMO')}
                      >
                        <Icon size={16} />
                        <span>{route.label}</span>
                      </Button>
                    </Link>
                  );
                })}
              </>
            ) : (
              <>
                {sdmtRoutes.map((route) => {
                  const Icon = route.icon;
                  const isActive = location.pathname === route.path;
                  
                  return (
                    <Link key={route.path} to={route.path}>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        size="sm"
                        className="flex items-center space-x-2"
                        onClick={() => handleModuleChange('SDMT')}
                      >
                        <Icon size={16} />
                        <span>{route.label}</span>
                      </Button>
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          {/* Role Selector (Demo) */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Select value={currentRole} onValueChange={(role: UserRole) => setRole(role)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PMO">PMO</SelectItem>
                  <SelectItem value="SDMT">SDMT</SelectItem>
                  <SelectItem value="VENDOR">VENDOR</SelectItem>
                  <SelectItem value="EXEC_RO">EXEC_RO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant={currentModule === 'PMO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  handleModuleChange('PMO');
                  window.location.href = '/pmo/prefactura/estimator';
                }}
              >
                PMO
              </Button>
              <Button
                variant={currentModule === 'SDMT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  handleModuleChange('SDMT');
                  window.location.href = '/sdmt/cost/catalog';
                }}
              >
                SDMT
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}