import { useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentModuleContext } from '@/lib/auth';

interface ModuleBadgeProps {
  className?: string;
}

export function ModuleBadge({ className }: ModuleBadgeProps) {
  const location = useLocation();
  const { currentRole } = useAuth();
  
  const currentModule = getCurrentModuleContext(location.pathname, currentRole);
  const badgeClass = currentModule === 'PMO' ? 'module-badge-pmo' : 'module-badge-sdmt';
  
  return (
    <Badge className={`${badgeClass} ${className || ''}`}>
      {currentModule} Module
    </Badge>
  );
}

export default ModuleBadge;