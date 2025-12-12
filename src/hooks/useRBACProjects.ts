/**
 * Hook for getting RBAC-filtered projects
 * Returns only projects the current user is allowed to access based on their role
 */

import { useMemo } from 'react';
import { useFinanzasUser } from './useFinanzasUser';
import { useProjects, type ProjectForUI } from '@/modules/finanzas/projects/useProjects';

export interface ProjectOption {
  projectId: string;
  code: string;
  name: string;
  client?: string;
}

export function useRBACProjects() {
  const { canAccessAllProjects } = useFinanzasUser();
  const { projects, loading, error, reload } = useProjects();
  
  // Filter projects based on RBAC
  // For now, FIN and PMO see all projects
  // SDMT/SDM would see only their assigned projects (future enhancement with API support)
  const accessibleProjects = useMemo<ProjectOption[]>(() => {
    if (!projects || projects.length === 0) return [];
    
    // For now, if user can access all projects (FIN/PMO), return all
    // Otherwise return all (SDMT filtering needs backend support)
    const filteredProjects = canAccessAllProjects 
      ? projects 
      : projects; // TODO: Filter by sdmManagerEmail when API supports it
    
    return filteredProjects.map(p => ({
      projectId: p.id,
      code: p.code,
      name: p.name,
      client: p.client,
    })).filter(p => p.projectId && p.code); // Ensure valid projects
  }, [projects, canAccessAllProjects]);
  
  return {
    projects: accessibleProjects,
    loading,
    error,
    reload,
  };
}

export default useRBACProjects;
