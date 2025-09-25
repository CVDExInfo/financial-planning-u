import { useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentModuleContext } from '@/lib/auth';

interface ModuleBadgeProps {
  className?: string;
}

export function ModuleBadge({ className }: ModuleBadgeProps) {
  // Hide the module badge as requested
  return null;
}

export default ModuleBadge;