import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRubrosWithFallback } from "@/api/finanzas";
import { ALL_PROJECTS_ID, useProject } from "@/contexts/ProjectContext";
import type { LineItem } from "@/types/domain";

const lineItemsKey = (projectId?: string, baselineId?: string) =>
  ["lineItems", projectId ?? "none", baselineId ?? "none"] as const;

export function useProjectLineItems() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id;
  const baselineId = selectedProject?.baseline_id;
  const queryClient = useQueryClient();

  const query = useQuery<LineItem[]>({
    queryKey: lineItemsKey(projectId, baselineId),
    queryFn: () => {
      if (!projectId || projectId === ALL_PROJECTS_ID) {
        throw new Error("Project is required before loading line items");
      }
      // Use getRubrosWithFallback to get rubros from multiple sources
      return getRubrosWithFallback(projectId, baselineId);
    },
    enabled: !!projectId && projectId !== ALL_PROJECTS_ID,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const lineItems = useMemo(() => query.data ?? [], [query.data]);

  useEffect(() => {
    if (import.meta.env.DEV && projectId && Array.isArray(query.data)) {
      console.info("[useProjectLineItems] loaded", {
        projectId,
        baselineId,
        count: query.data.length,
        ids: query.data.map((li) => li.id).filter(Boolean),
        sources: [...new Set(query.data.map((li) => (li as any).metadata?.source).filter(Boolean))],
      });
    }
  }, [projectId, baselineId, query.data]);

  const invalidate = useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: lineItemsKey(projectId, baselineId) });
  }, [projectId, baselineId, queryClient]);

  return {
    ...query,
    projectId,
    lineItems,
    invalidate,
  };
}
