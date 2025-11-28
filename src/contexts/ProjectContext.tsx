import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import ApiService from "@/lib/api";
import type { Project } from "@/types/domain";
import { logger } from "@/utils/logger";

export type ProjectSummary = {
  id: string;
  name: string;
  description?: string;
  baselineId?: string;
  baselineAcceptedAt?: string;
  status?: Project["status"];
  period?: string;
};

interface ProjectContextType {
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  selectProject: (project: ProjectSummary) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  currentProject: ProjectSummary | undefined;
  selectedProject: ProjectSummary | undefined;
  projects: ProjectSummary[];
  loading: boolean;
  refreshProject: () => Promise<void>;
  projectChangeCount: number; // Track how many times project has changed for debugging
  periodChangeCount: number; // Track period changes to trigger re-renders
  baselineId: string; // Current project's baseline ID
  invalidateProjectData: () => void; // Force invalidation of project-dependent data
  projectError: string | null;
  clearProjectError: () => void;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(
  undefined
);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdStorage] =
    useLocalStorage<string>("selected-project-id", "");
  const [selectedPeriod, setSelectedPeriodStorage] = useLocalStorage<string>(
    "selected-period",
    "12"
  );
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectChangeCount, setProjectChangeCount] = useState(0);
  const [periodChangeCount, setPeriodChangeCount] = useState(0);
  const [projectError, setProjectError] = useState<string | null>(null);

  const projectMap = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]));
  }, [projects]);

  const currentProject = projectMap.get(selectedProjectId);
  const selectedProject = currentProject
    ? { ...currentProject, period: selectedPeriod }
    : undefined;

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

  const selectProject = useCallback(
    (next: ProjectSummary) => {
      if (!next?.id?.trim()) {
        logger.warn("Attempted to set blank projectId - ignoring");
        return;
      }

      if (next.id === selectedProjectId) {
        return;
      }

      logger.info("Project changing", {
        from: selectedProjectId,
        to: next.id,
        name: next.name,
      });

      setProjectError(null);
      setSelectedProjectIdStorage(next.id);
      setProjectChangeCount((prev) => prev + 1);
    },
    [selectedProjectId, setSelectedProjectIdStorage]
  );

  // Enhanced project setter that triggers change counter and forces updates
  const setSelectedProjectId = useCallback(
    (projectId: string) => {
      const normalized = projectId?.trim();
      if (!normalized) {
        logger.warn("Attempted to set blank projectId - ignoring");
        return;
      }

      const lookup = projectMap.get(normalized);
      if (!lookup) {
        logger.warn("Project not found in context", projectId);
        return;
      }

      selectProject(lookup);
    },
    [projectMap, selectProject]
  );

  // Force invalidation of project-dependent data
  const invalidateProjectData = useCallback(() => {
    logger.info("Manually invalidating project data");
    setProjectChangeCount((prev) => prev + 1);
  }, []);

  const mapProject = (project: Project): ProjectSummary => ({
    id: project.id?.trim() || "",
    name: project.name?.trim() || "Unnamed Project",
    description: project.description || "",
    baselineId: project.baseline_id || undefined,
    baselineAcceptedAt: project.baseline_accepted_at,
    status: project.status,
  });

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setProjectError(null);
      const projectData = await ApiService.getProjects();
      const normalized = projectData
        .map(mapProject)
        .filter((project) => project.id)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );

      setProjects(normalized);

      // Auto-select first project if needed or if the current selection disappeared
      if (!selectedProjectId && normalized.length > 0) {
        logger.info("Auto-selecting first project:", normalized[0].id);
        selectProject(normalized[0]);
      } else if (
        selectedProjectId &&
        normalized.every((project) => project.id !== selectedProjectId) &&
        normalized.length > 0
      ) {
        logger.warn(
          "Previously selected project missing; selecting first entry"
        );
        selectProject(normalized[0]);
      }
    } catch (error) {
      logger.error("Failed to load projects:", error);
      setProjectError(
        error instanceof Error ? error.message : "Failed to load projects"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Log project changes for debugging
  useEffect(() => {
    if (selectedProjectId && currentProject) {
      logger.debug("Project context changed:", {
        projectId: selectedProjectId,
        projectName: currentProject.name,
        baselineId: currentProject.baselineId,
        changeCount: projectChangeCount,
      });
    }
  }, [selectedProjectId, currentProject, projectChangeCount]);

  const refreshProject = async () => {
    await loadProjects();
  };

  const value: ProjectContextType = {
    selectedProjectId: selectedProjectId || "",
    setSelectedProjectId,
    selectProject,
    selectedPeriod: selectedPeriod || "12",
    setSelectedPeriod,
    currentProject,
    selectedProject,
    projects,
    loading,
    refreshProject,
    projectChangeCount,
    periodChangeCount,
    baselineId: currentProject?.baselineId || "",
    invalidateProjectData,
    projectError,
    clearProjectError: () => setProjectError(null),
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
