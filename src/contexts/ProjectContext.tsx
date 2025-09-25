import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useKV } from '@github/spark/hooks';
import ApiService from '@/lib/api';
import type { Project } from '@/types/domain';

interface ProjectContextType {
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  currentProject: Project | undefined;
  projects: Project[];
  loading: boolean;
  refreshProject: () => Promise<void>;
  projectChangeCount: number; // Track how many times project has changed for debugging
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdKV] = useKV<string>('selected-project-id', '');
  const [selectedPeriod, setSelectedPeriod] = useKV<string>('selected-period', '12');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectChangeCount, setProjectChangeCount] = useState(0);

  const currentProject = projects.find(p => p.id === selectedProjectId);

  // Enhanced project setter that triggers change counter
  const setSelectedProjectId = useCallback((projectId: string) => {
    console.log('🔄 Project changing from:', selectedProjectId, 'to:', projectId);
    setSelectedProjectIdKV(projectId);
    setProjectChangeCount(prev => prev + 1);
  }, [selectedProjectId, setSelectedProjectIdKV]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectData = await ApiService.getProjects();
      setProjects(projectData);
      
      // Auto-select first project if none selected
      if (!selectedProjectId && projectData.length > 0) {
        console.log('🎯 Auto-selecting first project:', projectData[0].id);
        setSelectedProjectId(projectData[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Log project changes for debugging
  useEffect(() => {
    if (selectedProjectId) {
      console.log('📊 Project context changed:', {
        projectId: selectedProjectId,
        projectName: currentProject?.name,
        changeCount: projectChangeCount
      });
    }
  }, [selectedProjectId, currentProject?.name, projectChangeCount]);

  const refreshProject = async () => {
    await loadProjects();
  };

  const value: ProjectContextType = {
    selectedProjectId: selectedProjectId || '',
    setSelectedProjectId,
    selectedPeriod: selectedPeriod || '12',
    setSelectedPeriod,
    currentProject,
    projects,
    loading,
    refreshProject,
    projectChangeCount
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}