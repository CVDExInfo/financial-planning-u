import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import ApiService from "@/lib/api";
import type { Project } from "@/types/domain";
import { logger } from "@/utils/logger";

interface ProjectContextType {
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  selectProject: (projectId: string) => void; // Guarded setter (same as setSelectedProjectId)
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  currentProject: Project | undefined;
  projects: Project[];
  loading: boolean;
  refreshProject: () => Promise<void>;
  projectChangeCount: number; // Track how many times project has changed for debugging
  periodChangeCount: number; // Track period changes to trigger re-renders
  baselineId: string; // Current project's baseline ID
  invalidateProjectData: () => void; // Force invalidation of project-dependent data
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdStorage] =
    useLocalStorage<string>("selected-project-id", "");
  const [selectedPeriod, setSelectedPeriodStorage] = useLocalStorage<string>(
    "selected-period",
    "12"
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectChangeCount, setProjectChangeCount] = useState(0);
  const [periodChangeCount, setPeriodChangeCount] = useState(0);

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  // Enhanced period setter that triggers change counter
  const setSelectedPeriod = useCallback(
    (period: string) => {
      if (period !== selectedPeriod) {
        logger.debug("Period changing from:", selectedPeriod, "to:", period);
        setSelectedPeriodStorage(period);
        setPeriodChangeCount((prev) => prev + 1);
      }
    },
    [selectedPeriod, setSelectedPeriodStorage]
  );

  // Enhanced project setter that triggers change counter and forces updates
  // NEVER allows blank projectId to be set
  const setSelectedProjectId = useCallback(
    (projectId: string) => {
      // Guard: never set blank/empty projectId
      if (!projectId || projectId.trim() === "") {
        logger.warn(
          "Attempted to set blank projectId - ignoring",
          new Error().stack
        );
        return;
      }

      if (projectId !== selectedProjectId) {
        logger.info(
          "Project changing from:",
          selectedProjectId,
          "to:",
          projectId
        );

        // Directly set the new project (no clearing intermediate state)
        setSelectedProjectIdStorage(projectId);
        setProjectChangeCount((prev) => prev + 1);
      }
    },
    [selectedProjectId, setSelectedProjectIdStorage]
  );

  // Force invalidation of project-dependent data
  const invalidateProjectData = useCallback(() => {
    logger.info("Manually invalidating project data");
    setProjectChangeCount((prev) => prev + 1);
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectData = await ApiService.getProjects();
      setProjects(projectData);

      // Auto-select first project if none selected
      if (!selectedProjectId && projectData.length > 0) {
        logger.info("Auto-selecting first project:", projectData[0].id);
        // Directly set the project without the delay logic
        setSelectedProjectIdStorage(projectData[0].id);
        setProjectChangeCount((prev) => prev + 1);
      }
    } catch (error) {
      logger.error("Failed to load projects:", error);
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
      logger.debug("Project context changed:", {
        projectId: selectedProjectId,
        projectName: currentProject?.name,
        baselineId: currentProject?.baseline_id,
        changeCount: projectChangeCount,
      });
    }
  }, [
    selectedProjectId,
    currentProject?.name,
    currentProject?.baseline_id,
    projectChangeCount,
  ]);

  const refreshProject = async () => {
    await loadProjects();
  };

  const value: ProjectContextType = {
    selectedProjectId: selectedProjectId || "",
    setSelectedProjectId,
    selectProject: setSelectedProjectId, // Alias for clarity
    selectedPeriod: selectedPeriod || "12",
    setSelectedPeriod,
    currentProject,
    projects,
    loading,
    refreshProject,
    projectChangeCount,
    periodChangeCount,
    baselineId: currentProject?.baseline_id || "",
    invalidateProjectData,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
