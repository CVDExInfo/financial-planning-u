import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectRubros, getProjectRubrosWithTaxonomy } from "@/api/finanzas";
import { getRubrosWithFallback } from "@/lib/api";
import { ALL_PROJECTS_ID, useProject } from "@/contexts/ProjectContext";
import type { LineItem } from "@/types/domain";

const lineItemsKey = (projectId?: string, baselineId?: string) =>
  ["lineItems", projectId ?? "none", baselineId ?? "none"] as const;

export function useProjectLineItems(options?: { useFallback?: boolean; baselineId?: string; withTaxonomy?: boolean }) {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id;
  const projectBaselineId = selectedProject?.baselineId;
  const queryClient = useQueryClient();
  const useFallback = options?.useFallback ?? false;
  const withTaxonomy = options?.withTaxonomy ?? false;
  const baselineId = options?.baselineId ?? projectBaselineId;

  const query = useQuery<{ 
    lineItems: LineItem[]; 
    taxonomyByRubroId?: Record<string, { description?: string; category?: string }> 
  }>({
    queryKey: lineItemsKey(projectId),
    queryFn: async () => {
      if (!projectId || projectId === ALL_PROJECTS_ID) {
        if (import.meta.env.DEV) {
          console.log(
            `[useProjectLineItems] Guarded call with projectId=${projectId} - returning empty result (ALL_PROJECTS not supported)`
          );
        }
        return { lineItems: [], taxonomyByRubroId: undefined };
      }
      
      // Fetch line items with taxonomy if requested
      if (withTaxonomy) {
        const result = await getProjectRubrosWithTaxonomy(projectId);
        return {
          lineItems: result.lineItems,
          taxonomyByRubroId: result.taxonomyByRubroId,
        };
      }
      
      // Fetch line items using fallback method if requested
      let items: LineItem[];
      if (useFallback) {
        items = await getRubrosWithFallback(projectId, baselineId) as LineItem[];
      } else {
        items = await getProjectRubros(projectId);
      }
      
      return {
        lineItems: items,
      };
    },
    enabled: !!projectId && projectId !== ALL_PROJECTS_ID,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const lineItems = useMemo(() => query.data?.lineItems ?? [], [query.data?.lineItems]);
  const taxonomyByRubroId = useMemo(() => query.data?.taxonomyByRubroId, [query.data?.taxonomyByRubroId]);

  useEffect(() => {
    if (import.meta.env.DEV && projectId && Array.isArray(query.data?.lineItems)) {
      console.info("[useProjectLineItems] loaded", {
        projectId,
        baselineId,
        count: query.data.lineItems.length,
        ids: query.data.lineItems.map((li) => li.id).filter(Boolean),
        useFallback,
        withTaxonomy,
        hasTaxonomy: !!query.data.taxonomyByRubroId,
      });
    }
  }, [projectId, query.data, useFallback, withTaxonomy]);

  const invalidate = useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: lineItemsKey(projectId) });
  }, [projectId, queryClient]);

  return {
    ...query,
    projectId,
    lineItems,
    taxonomyByRubroId,
    invalidate,
  };
}
