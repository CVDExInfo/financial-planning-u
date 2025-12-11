/**
 * Hook for Finanzas user context with RBAC awareness
 * Provides user role, groups, and allowed projects based on permissions
 */

import { useMemo } from 'react';
import { usePermissions } from './usePermissions';
import { useAuth } from './useAuth';
import type { FinanzasRole } from './usePermissions';

export interface FinanzasUserContext {
  /** Current effective Finanzas role */
  role: FinanzasRole | null;
  
  /** All user groups */
  groups: string[];
  
  /** Is user in FIN role */
  isFIN: boolean;
  
  /** Is user in SDMT/SDM role */
  isSDMT: boolean;
  
  /** Is user in PM role */
  isPM: boolean;
  
  /** Is user in PMO role */
  isPMO: boolean;
  
  /** Is user read-only (EXEC_RO) */
  isExecRO: boolean;
  
  /** Can user edit/create */
  canEdit: boolean;
  
  /** Can user access all projects (FIN, PMO) */
  canAccessAllProjects: boolean;
  
  /** User email from JWT */
  userEmail?: string;
}

export function useFinanzasUser(): FinanzasUserContext {
  const { 
    role, 
    groups, 
    isExecRO, 
    isSDMT, 
    isSDM, 
    isPM, 
    isPMO,
    canEdit,
  } = usePermissions();
  
  const { user } = useAuth();
  
  // FIN group has special privileges
  const isFIN = useMemo(() => {
    return groups.some(g => g.toUpperCase() === 'FIN');
  }, [groups]);
  
  // FIN and PMO can access all projects
  const canAccessAllProjects = useMemo(() => {
    return isFIN || isPMO;
  }, [isFIN, isPMO]);
  
  return {
    role,
    groups,
    isFIN,
    isSDMT: isSDMT || isSDM,
    isPM,
    isPMO,
    isExecRO,
    canEdit,
    canAccessAllProjects,
    userEmail: user?.email,
  };
}

export default useFinanzasUser;
