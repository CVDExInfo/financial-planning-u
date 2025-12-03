import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectRubros } from "@/api/finanzas";
import { useProject } from "@/contexts/ProjectContext";
import type { LineItem } from "@/types/domain";

const lineItemsKey = (projectId?: string) =>
  ["lineItems", projectId ?? "none"] as const;

export function useProjectLineItems() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id;
  const queryClient = useQueryClient();

  const query = useQuery<LineItem[]>({
    queryKey: lineItemsKey(projectId),
    queryFn: () => {
      if (!projectId) {
        throw new Error("Project is required before loading line items");
      }
      return getProjectRubros(projectId);
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const lineItems = useMemo(() => query.data ?? [], [query.data]);

  useEffect(() => {
    if (import.meta.env.DEV && projectId && Array.isArray(query.data)) {
      console.info("[useProjectLineItems] loaded", {
        projectId,
        count: query.data.length,
        ids: query.data.map((li) => li.id).filter(Boolean),
      });
    }
  }, [projectId, query.data]);

  const invalidate = useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: lineItemsKey(projectId) });
  }, [projectId, queryClient]);

  return {
    ...query,
    projectId,
    lineItems,
    invalidate,
  };
}
