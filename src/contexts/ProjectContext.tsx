import { createContext, useContext, useEffect, useState } from 'react';
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
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = useKV<string>('selected-project-id', '');
  const [selectedPeriod, setSelectedPeriod] = useKV<string>('selected-period', '12');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const currentProject = projects.find(p => p.id === selectedProjectId);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectData = await ApiService.getProjects();
      setProjects(projectData);
      
      // Auto-select first project if none selected
      if (!selectedProjectId && projectData.length > 0) {
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
    refreshProject
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